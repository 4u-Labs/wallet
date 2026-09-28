/**
 * Secureon Wallet - Main Application
 * Handles UI, user interactions, and orchestrates all modules
 * Enhanced with token support and security features
 */

'use strict';

const App = (function () {
    // Application state
    let state = {
        currentScreen: null,
        address: null,
        balance: '0',
        balanceUsd: '0',
        tokenBalances: {},      // {symbol: {raw, formatted, hasBalance}}
        selectedToken: 'ETH',   // Currently selected token for send
        pendingTx: null,
        tempMnemonic: null,
        isLocked: true,
        addressWatcherId: null,
        seedContainer: null,
        inactivityTimeout: 5 * 60 * 1000, // 5 minutes default
        isLoadingTokens: false,
        checkSessionIntervalId: null  // FIX #1: store interval to prevent leak
    };

    /**
     * Escape HTML to prevent XSS when inserting dynamic content
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, c => map[c]);
    }

    /**
     * Securely clear sensitive fields from an object
     * @param {Object} obj - Object containing sensitive string properties
     */
    function secureClearObject(obj) {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            if (typeof obj[key] === 'string') {
                CryptoModule.secureClear(obj[key]);
                obj[key] = null;
            }
        }
    }

    // Cache DOM elements
    const elements = {};

    // Secure container for temporary sensitive data
    let secureContainer = null;

    /**
     * Initialize the application
     */
    async function init() {
        // First, run security checks
        const securityCheck = await runSecurityChecks();
        if (!securityCheck.success) {
            showSecurityError(securityCheck.errors);
            return;
        }

        // Update loading message
        updateLoadingMessage('Inicializando carteira...');

        // Cache DOM elements
        cacheElements();

        // Setup event listeners
        setupEventListeners();

        // Initialize blockchain module
        const settings = StorageModule.getSettings();

        try {
            await BlockchainModule.init(settings.network);
            updateNetworkDisplay();
        } catch (error) {
            // Network init failed, continue but show warning
            showToast('Erro ao conectar à rede', 'warning');
        }

        // Load inactivity timeout setting
        if (settings.inactivityTimeout) {
            state.inactivityTimeout = settings.inactivityTimeout;
            const timeoutSelect = document.getElementById('inactivity-timeout');
            if (timeoutSelect) {
                timeoutSelect.value = settings.inactivityTimeout;
            }
        }

        // Check if wallet exists
        if (StorageModule.hasWallet()) {
            showScreen('login-screen');
        } else {
            showScreen('welcome-screen');
        }

        // Hide loading screen with animation
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
        }, 300);
    }

    /**
     * Run security checks before initializing
     */
    async function runSecurityChecks() {
        updateLoadingMessage('Verificando bibliotecas...');

        // Verificação defensiva: garantir que módulos essenciais estão carregados
        const requiredModules = [
            { name: 'SecurityModule', module: typeof SecurityModule !== 'undefined' },
            { name: 'CryptoModule', module: typeof CryptoModule !== 'undefined' },
            { name: 'StorageModule', module: typeof StorageModule !== 'undefined' },
            { name: 'BlockchainModule', module: typeof BlockchainModule !== 'undefined' },
            { name: 'TokensModule', module: typeof TokensModule !== 'undefined' }
        ];

        const missingModules = requiredModules.filter(m => !m.module);
        if (missingModules.length > 0) {
            return {
                success: false,
                errors: missingModules.map(m => `Módulo ${m.name} não carregado`)
            };
        }

        const result = await SecurityModule.init({
            protectConsole: true,
            detectDevTools: true
        });

        return result;
    }

    /**
     * Show security error and block app
     */
    function showSecurityError(errors) {
        const errorScreen = document.getElementById('security-error-screen');
        const errorDetails = document.getElementById('security-error-details');
        const loadingScreen = document.getElementById('loading-screen');

        if (errorDetails) {
            errorDetails.innerHTML = errors.map(e => `<p class="mb-1">• ${escapeHtml(e)}</p>`).join('');
        }

        loadingScreen.classList.add('hidden');
        errorScreen.classList.remove('hidden');
    }

    /**
     * Update loading message
     */
    function updateLoadingMessage(message) {
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    function cacheElements() {
        const ids = [
            'loading-screen', 'app', 'welcome-screen', 'create-wallet-screen',
            'import-wallet-screen', 'login-screen', 'dashboard-screen',
            'send-screen', 'confirm-send-screen', 'receive-screen',
            'settings-screen', 'export-seed-screen', 'tx-success-modal',
            'delete-modal', 'toast-container', 'seed-words', 'network-name',
            'create-password', 'create-password-confirm', 'confirm-saved',
            'password-strength', 'import-seed', 'import-seed-error',
            'import-password', 'import-password-confirm', 'login-password',
            'login-error', 'login-attempts', 'balance-display', 'balance-usd',
            'address-display', 'send-to', 'send-to-error', 'send-amount',
            'send-amount-error', 'available-balance', 'gas-estimate',
            'total-amount', 'confirm-to', 'confirm-amount', 'confirm-gas',
            'confirm-total', 'confirm-network', 'confirm-send-password',
            'confirm-password-error', 'qr-code', 'receive-address',
            'network-select', 'export-password', 'export-password-error',
            'exported-seed', 'exported-seed-words', 'transaction-list',
            'tx-hash', 'tx-explorer-link', 'delete-confirm-text',
            'session-timeout-warning', 'timeout-countdown', 'rpc-status',
            'rpc-endpoint', 'network-status-dot', 'address-tamper-warning',
            'confirm-to-enhanced', 'tx-warnings', 'tx-warnings-list',
            'confirm-address-verified', 'inactivity-timeout', 'seed-countdown',
            'token-list', 'token-selector', 'token-selector-modal',
            'token-modal-list', 'token-search', 'selected-token-icon',
            'selected-token-symbol', 'selected-token-balance', 'send-screen-title'
        ];

        ids.forEach(id => {
            elements[id] = document.getElementById(id);
        });
    }

    /**
     * Setup all event listeners
     */
    function setupEventListeners() {
        // Welcome screen
        document.getElementById('btn-create-wallet').addEventListener('click', startCreateWallet);
        document.getElementById('btn-import-wallet').addEventListener('click', () => showScreen('import-wallet-screen'));

        // Create wallet screen
        document.getElementById('btn-back-create').addEventListener('click', () => {
            clearTempMnemonic();
            showScreen('welcome-screen');
        });
        document.getElementById('btn-confirm-create').addEventListener('click', confirmCreateWallet);
        elements['create-password'].addEventListener('input', handlePasswordInput);
        elements['create-password-confirm'].addEventListener('input', validateCreateForm);
        elements['confirm-saved'].addEventListener('change', validateCreateForm);

        // Import wallet screen
        document.getElementById('btn-back-import').addEventListener('click', () => showScreen('welcome-screen'));
        document.getElementById('btn-confirm-import').addEventListener('click', confirmImportWallet);
        elements['import-seed'].addEventListener('input', validateImportSeed);

        // Login screen
        document.getElementById('btn-unlock').addEventListener('click', unlockWallet);
        document.getElementById('btn-reset-wallet').addEventListener('click', () => showModal('delete-modal'));
        elements['login-password'].addEventListener('keypress', (e) => {
            if (e.key === 'Enter') unlockWallet();
        });

        // Dashboard screen
        document.getElementById('btn-refresh-balance').addEventListener('click', refreshAllBalances);
        document.getElementById('btn-copy-address').addEventListener('click', copyAddress);
        document.getElementById('btn-send').addEventListener('click', () => showSendScreen('ETH'));
        document.getElementById('btn-receive').addEventListener('click', () => showReceiveScreen());
        document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings-screen'));
        document.getElementById('btn-refresh-history').addEventListener('click', loadTransactionHistory);
        document.getElementById('btn-lock').addEventListener('click', lockWallet);

        // Token list refresh
        const btnRefreshTokens = document.getElementById('btn-refresh-tokens');
        if (btnRefreshTokens) {
            btnRefreshTokens.addEventListener('click', loadTokenBalances);
        }

        // Send screen
        document.getElementById('btn-back-send').addEventListener('click', () => {
            cleanupAddressWatcher();
            showScreen('dashboard-screen');
        });
        document.getElementById('btn-continue-send').addEventListener('click', showConfirmSend);
        document.getElementById('btn-max-amount').addEventListener('click', setMaxAmount);
        elements['send-to'].addEventListener('input', validateSendForm);
        elements['send-amount'].addEventListener('input', validateSendForm);

        // Token selector
        if (elements['token-selector']) {
            elements['token-selector'].addEventListener('click', openTokenSelectorModal);
        }

        // Confirm send screen
        document.getElementById('btn-cancel-send').addEventListener('click', () => showScreen('send-screen'));
        document.getElementById('btn-confirm-send').addEventListener('click', executeSend);
        elements['confirm-address-verified'].addEventListener('change', updateConfirmSendButton);
        elements['confirm-send-password'].addEventListener('input', updateConfirmSendButton);

        // Receive screen
        document.getElementById('btn-copy-receive-address').addEventListener('click', copyAddress);
        document.getElementById('btn-back-receive').addEventListener('click', () => showScreen('dashboard-screen'));

        // Settings screen
        document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('dashboard-screen'));
        document.getElementById('btn-export-seed').addEventListener('click', () => showScreen('export-seed-screen'));
        document.getElementById('btn-delete-wallet').addEventListener('click', () => showModal('delete-modal'));
        elements['network-select'].addEventListener('change', handleNetworkChange);

        // Backup listeners
        const btnExportBackup = document.getElementById('btn-export-backup');
        if (btnExportBackup) btnExportBackup.addEventListener('click', downloadBackup);

        const btnImportBackup = document.getElementById('btn-import-backup');
        if (btnImportBackup) btnImportBackup.addEventListener('click', handleImportBackup);

        const btnImportBackupSettings = document.getElementById('btn-import-backup-settings');
        if (btnImportBackupSettings) btnImportBackupSettings.addEventListener('click', handleImportBackup);


        // Inactivity timeout setting
        if (elements['inactivity-timeout']) {
            elements['inactivity-timeout'].addEventListener('change', (e) => {
                const timeout = parseInt(e.target.value);
                state.inactivityTimeout = timeout;
                const settings = StorageModule.getSettings();
                settings.inactivityTimeout = timeout;
                StorageModule.saveSettings(settings);
                showToast('Timeout atualizado', 'success');
            });
        }

        // Export seed screen
        document.getElementById('btn-back-export').addEventListener('click', () => {
            clearExportedSeed();
            showScreen('settings-screen');
        });
        document.getElementById('btn-reveal-seed').addEventListener('click', revealSeed);

        // TX Success modal
        document.getElementById('btn-close-tx-modal').addEventListener('click', () => {
            hideModal('tx-success-modal');
            showScreen('dashboard-screen');
            refreshAllBalances();
        });

        // Delete modal
        document.getElementById('btn-cancel-delete').addEventListener('click', () => hideModal('delete-modal'));
        document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteWallet);
        elements['delete-confirm-text'].addEventListener('input', (e) => {
            document.getElementById('btn-confirm-delete').disabled = e.target.value !== 'APAGAR';
        });

        // Token selector modal
        const btnCloseTokenModal = document.getElementById('btn-close-token-modal');
        if (btnCloseTokenModal) {
            btnCloseTokenModal.addEventListener('click', closeTokenSelectorModal);
        }

        if (elements['token-search']) {
            elements['token-search'].addEventListener('input', filterTokenList);
        }

        // Tutorial modal
        const btnOpenTutorial = document.getElementById('btn-open-tutorial');
        if (btnOpenTutorial) {
            btnOpenTutorial.addEventListener('click', () => showModal('tutorial-modal'));
        }
        const btnCloseTutorial = document.getElementById('btn-close-tutorial');
        if (btnCloseTutorial) {
            btnCloseTutorial.addEventListener('click', () => hideModal('tutorial-modal'));
        }
        const btnCloseTutorialBottom = document.getElementById('btn-close-tutorial-bottom');
        if (btnCloseTutorialBottom) {
            btnCloseTutorialBottom.addEventListener('click', () => hideModal('tutorial-modal'));
        }
        // Tutorial tab navigation
        const tutorialTabs = document.querySelectorAll('.tutorial-tab');
        tutorialTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPanel = tab.dataset.tab;
                // Deactivate all tabs
                tutorialTabs.forEach(t => t.classList.remove('active'));
                // Activate clicked tab
                tab.classList.add('active');
                // Hide all panels
                document.querySelectorAll('.tutorial-panel').forEach(p => {
                    p.classList.add('hidden');
                    p.classList.remove('active');
                });
                // Show target panel
                const panel = document.querySelector(`.tutorial-panel[data-panel="${targetPanel}"]`);
                if (panel) {
                    panel.classList.remove('hidden');
                    panel.classList.add('active');
                }
            });
        });
        // Close tutorial modal on backdrop click
        const tutorialModal = document.getElementById('tutorial-modal');
        if (tutorialModal) {
            tutorialModal.addEventListener('click', (e) => {
                if (e.target === tutorialModal) {
                    hideModal('tutorial-modal');
                }
            });
        }

        // Prevent form submission
        document.querySelectorAll('input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') e.preventDefault();
            });
        });
    }

    /**
     * Cleanup address watcher when leaving send screen
     */
    function cleanupAddressWatcher() {
        if (state.addressWatcherId) {
            SecurityModule.unwatchAddressInput(state.addressWatcherId);
            state.addressWatcherId = null;
        }
        if (elements['address-tamper-warning']) {
            elements['address-tamper-warning'].classList.add('hidden');
        }
    }

    /**
     * Show a specific screen with animation
     */
    function showScreen(screenId) {
        state.currentScreen = screenId;

        // Update RPC display if entering settings
        if (screenId === 'settings-screen') {
            const network = BlockchainModule.getCurrentNetwork();
            const rpcUrlEl = document.getElementById('settings-rpc-url');
            if (rpcUrlEl) {
                rpcUrlEl.textContent = network.currentRpc;
            }
        }

        const screens = [

            'welcome-screen', 'create-wallet-screen', 'import-wallet-screen',
            'login-screen', 'dashboard-screen', 'send-screen',
            'confirm-send-screen', 'receive-screen', 'settings-screen',
            'export-seed-screen'
        ];

        screens.forEach(id => {
            const screen = document.getElementById(id);
            if (id === screenId) {
                screen.classList.remove('hidden');
                screen.style.opacity = '0';
                requestAnimationFrame(() => {
                    screen.style.transition = 'opacity 0.2s ease';
                    screen.style.opacity = '1';
                });
            } else {
                screen.classList.add('hidden');
            }
        });

        state.currentScreen = screenId;
        SecurityModule.recordActivity();
    }

    /**
     * Show modal with animation
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('hidden');
        modal.style.opacity = '0';
        requestAnimationFrame(() => {
            modal.style.transition = 'opacity 0.2s ease';
            modal.style.opacity = '1';
        });
    }

    /**
     * Hide modal with animation
     */
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }

    /**
     * Show toast notification with icon
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
            error: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
            warning: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
            info: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<span></span>`;
        toast.querySelector('span').textContent = message;
        elements['toast-container'].appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slide-out-right 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Update network display
     */
    function updateNetworkDisplay() {
        const network = BlockchainModule.getCurrentNetwork();
        elements['network-name'].textContent = network.name;
        elements['network-select'].value = network.key;

        const statusDot = elements['network-status-dot'];
        if (statusDot) {
            statusDot.className = 'w-2 h-2 rounded-full';
            if (network.key === 'mainnet') {
                statusDot.classList.add('bg-green-500');
            } else {
                statusDot.classList.add('bg-amber-500');
            }
        }

        if (elements['rpc-status'] && elements['rpc-endpoint']) {
            elements['rpc-endpoint'].textContent = network.rpcUrls[0].replace('https://', '').split('/')[0];
            elements['rpc-status'].classList.remove('hidden');
        }
    }

    /**
     * Start wallet creation process
     */
    function startCreateWallet() {
        const mnemonic = BlockchainModule.generateMnemonic();
        secureContainer = SecurityModule.createSecureContainer(5 * 60 * 1000);
        secureContainer.set({ mnemonic });
        state.tempMnemonic = mnemonic;

        displaySeedWords(mnemonic, elements['seed-words']);

        elements['create-password'].value = '';
        elements['create-password-confirm'].value = '';
        elements['confirm-saved'].checked = false;
        elements['password-strength'].innerHTML = '';
        document.getElementById('btn-confirm-create').disabled = true;

        showScreen('create-wallet-screen');
    }

    /**
     * Display seed words in grid with animation
     */
    function displaySeedWords(mnemonic, container) {
        container.innerHTML = '';
        const words = mnemonic.split(' ');

        words.forEach((word, index) => {
            const div = document.createElement('div');
            div.className = 'seed-word';
            div.setAttribute('data-index', index + 1);
            div.textContent = word;
            div.style.opacity = '0';
            div.style.transform = 'translateY(10px)';
            container.appendChild(div);

            setTimeout(() => {
                div.style.transition = 'all 0.3s ease';
                div.style.opacity = '1';
                div.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    /**
     * Clear temporary mnemonic from memory
     */
    function clearTempMnemonic() {
        if (secureContainer) {
            secureContainer.clear();
            secureContainer = null;
        }
        state.tempMnemonic = CryptoModule.secureClear(state.tempMnemonic);

        if (elements['seed-words']) {
            elements['seed-words'].innerHTML = '';
        }
    }

    /**
     * Handle password input for strength indicator
     */
    function handlePasswordInput() {
        const password = elements['create-password'].value;
        const strength = CryptoModule.checkPasswordStrength(password);

        let barClass = 'weak';
        if (strength.score >= 5) barClass = 'strong';
        else if (strength.score >= 3) barClass = 'medium';

        elements['password-strength'].innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="${strength.className} text-xs font-medium">${strength.strength}</span>
                <span class="text-dark-500 text-xs">${strength.feedback || ''}</span>
            </div>
            <div class="strength-bar">
                <div class="strength-bar-fill ${barClass}"></div>
            </div>
        `;

        validateCreateForm();
    }

    /**
     * Validate create wallet form
     */
    function validateCreateForm() {
        const password = elements['create-password'].value;
        const confirm = elements['create-password-confirm'].value;
        const saved = elements['confirm-saved'].checked;

        const isValid = password.length >= 8 && password === confirm && saved && state.tempMnemonic;
        document.getElementById('btn-confirm-create').disabled = !isValid;
    }

    /**
     * Confirm wallet creation
     */
    async function confirmCreateWallet() {
        const password = elements['create-password'].value;
        const confirm = elements['create-password-confirm'].value;

        if (password !== confirm) {
            showToast('As senhas não coincidem', 'error');
            return;
        }

        if (password.length < 8) {
            showToast('Senha deve ter no mínimo 8 caracteres', 'error');
            return;
        }

        const btn = document.getElementById('btn-confirm-create');
        btn.classList.add('loading');

        try {
            const wallet = BlockchainModule.walletFromMnemonic(state.tempMnemonic);
            const dataToEncrypt = JSON.stringify({
                mnemonic: state.tempMnemonic,
                privateKey: wallet.privateKey
            });

            const encrypted = await CryptoModule.encrypt(dataToEncrypt, password);
            if (!StorageModule.saveWallet(encrypted, wallet.address)) {
                throw new Error('Falha ao salvar carteira no armazenamento');
            }

            clearTempMnemonic();
            CryptoModule.secureClear(dataToEncrypt);
            elements['create-password'].value = '';
            elements['create-password-confirm'].value = '';

            state.address = wallet.address;
            state.isLocked = false;

            startSessionTracking();
            showToast('Carteira criada com sucesso!', 'success');
            showDashboard();

        } catch (error) {
            showToast('Erro ao criar carteira: ' + error.message, 'error');
        } finally {
            btn.classList.remove('loading');
        }
    }

    /**
     * Validate import seed phrase
     */
    function validateImportSeed() {
        const seed = elements['import-seed'].value.trim().toLowerCase();
        const words = seed.split(/\s+/).filter(w => w);

        if (words.length !== 12 && words.length !== 24) {
            elements['import-seed-error'].textContent = `Digite 12 ou 24 palavras (atual: ${words.length})`;
            elements['import-seed-error'].classList.remove('hidden');
            return false;
        }

        if (!BlockchainModule.isValidMnemonic(seed)) {
            elements['import-seed-error'].textContent = 'Seed phrase inválida';
            elements['import-seed-error'].classList.remove('hidden');
            return false;
        }

        elements['import-seed-error'].classList.add('hidden');
        return true;
    }

    /**
     * Confirm wallet import
     */
    async function confirmImportWallet() {
        const seed = elements['import-seed'].value.trim().toLowerCase();
        const password = elements['import-password'].value;
        const confirm = elements['import-password-confirm'].value;

        if (!validateImportSeed()) return;

        if (password !== confirm) {
            showToast('As senhas não coincidem', 'error');
            return;
        }

        if (password.length < 8) {
            showToast('Senha deve ter no mínimo 8 caracteres', 'error');
            return;
        }

        const btn = document.getElementById('btn-confirm-import');
        btn.classList.add('loading');

        try {
            const wallet = BlockchainModule.walletFromMnemonic(seed);
            const dataToEncrypt = JSON.stringify({
                mnemonic: seed,
                privateKey: wallet.privateKey
            });

            const encrypted = await CryptoModule.encrypt(dataToEncrypt, password);
            if (!StorageModule.saveWallet(encrypted, wallet.address)) {
                throw new Error('Falha ao salvar carteira no armazenamento');
            }

            elements['import-seed'].value = '';
            elements['import-password'].value = '';
            elements['import-password-confirm'].value = '';
            CryptoModule.secureClear(dataToEncrypt);

            state.address = wallet.address;
            state.isLocked = false;

            startSessionTracking();
            showToast('Carteira importada com sucesso!', 'success');
            showDashboard();

        } catch (error) {
            showToast('Erro ao importar: ' + error.message, 'error');
        } finally {
            btn.classList.remove('loading');
        }
    }

    /**
     * Start session activity tracking
     */
    function startSessionTracking() {
        // FIX #1: Clear any existing interval before creating a new one
        if (state.checkSessionIntervalId) {
            clearInterval(state.checkSessionIntervalId);
            state.checkSessionIntervalId = null;
        }

        SecurityModule.startSession((reason) => {
            if (reason === 'inactivity') {
                showToast('Sessão expirada por inatividade', 'warning');
            } else if (reason === 'hidden') {
                showToast('Sessão expirada (aba oculta)', 'warning');
            }
            lockWallet();
        }, state.inactivityTimeout);

        state.checkSessionIntervalId = setInterval(checkSessionTimeout, 10000);
    }

    /**
     * Check session timeout and show warning
     */
    function checkSessionTimeout() {
        if (state.isLocked) return;

        const remaining = SecurityModule.getTimeUntilLock();
        // FIX #11: Null-guard for DOM elements
        if (remaining > 0 && remaining <= 60) {
            if (elements['session-timeout-warning']) elements['session-timeout-warning'].classList.remove('hidden');
            if (elements['timeout-countdown']) elements['timeout-countdown'].textContent = `${remaining}s restantes`;
        } else {
            if (elements['session-timeout-warning']) elements['session-timeout-warning'].classList.add('hidden');
        }
    }

    /**
     * Unlock wallet
     */
    async function unlockWallet() {
        const password = elements['login-password'].value;

        const protection = StorageModule.checkBruteForceProtection();
        if (protection.locked) {
            elements['login-attempts'].textContent = `Aguarde ${protection.remainingTime}s antes de tentar novamente`;
            elements['login-attempts'].classList.remove('hidden');
            return;
        }

        const btn = document.getElementById('btn-unlock');
        btn.classList.add('loading');

        try {
            const walletData = StorageModule.getWallet();
            const metadata = StorageModule.getMetadata();

            if (!walletData) {
                showToast('Nenhuma carteira encontrada', 'error');
                showScreen('welcome-screen');
                return;
            }

            const decrypted = await CryptoModule.decrypt(
                walletData.encrypted,
                password,
                walletData.salt,
                walletData.iv
            );

            const data = JSON.parse(decrypted);
            const address = metadata.address;

            CryptoModule.secureClear(decrypted);
            secureClearObject(data);  // FIX #2: clear individual string properties

            StorageModule.resetFailedAttempts();

            elements['login-password'].value = '';
            elements['login-error'].classList.add('hidden');
            elements['login-attempts'].classList.add('hidden');

            state.address = address;
            state.isLocked = false;

            startSessionTracking();
            showDashboard();

        } catch (error) {
            const result = StorageModule.recordFailedAttempt();

            elements['login-error'].textContent = 'Senha incorreta';
            elements['login-error'].classList.remove('hidden');

            if (result.attempts >= 3) {
                elements['login-attempts'].textContent =
                    `${result.attempts} tentativas falhas. ${result.attempts >= 5 ? 'Bloqueado temporariamente.' : ''}`;
                elements['login-attempts'].classList.remove('hidden');
            }
        } finally {
            btn.classList.remove('loading');
        }
    }

    /**
     * Lock wallet
     */
    function lockWallet() {
        SecurityModule.endSession();
        cleanupAddressWatcher();

        // FIX #1: Clear the session check interval
        if (state.checkSessionIntervalId) {
            clearInterval(state.checkSessionIntervalId);
            state.checkSessionIntervalId = null;
        }

        state.address = null;
        state.balance = '0';
        state.balanceUsd = '0';
        state.tokenBalances = {};
        state.pendingTx = null;
        state.isLocked = true;
        state.selectedToken = 'ETH';

        document.querySelectorAll('input[type="password"]').forEach(input => {
            input.value = '';
        });
        document.querySelectorAll('textarea').forEach(textarea => {
            textarea.value = '';
        });

        if (elements['session-timeout-warning']) elements['session-timeout-warning'].classList.add('hidden');
        showScreen('login-screen');
        showToast('Carteira bloqueada', 'info');
    }

    /**
     * Show dashboard
     */
    async function showDashboard() {
        showScreen('dashboard-screen');
        elements['address-display'].textContent = formatAddressShort(state.address);

        await refreshAllBalances();
        await loadTransactionHistory();
    }

    /**
     * Format address for short display
     */
    function formatAddressShort(address) {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    }

    /**
     * Refresh all balances (ETH + tokens)
     */
    async function refreshAllBalances() {
        if (!state.address) return;

        // Refresh ETH balance
        await refreshBalance();

        // Refresh token balances
        await loadTokenBalances();

        // Fetch prices for portfolio calculation
        await TokensModule.fetchPrices();
    }

    /**
     * Refresh ETH balance
     */
    async function refreshBalance() {
        if (!state.address) return;

        const btn = document.getElementById('btn-refresh-balance');
        const balanceDisplay = elements['balance-display'];

        btn.querySelector('svg').classList.add('animate-spin');
        balanceDisplay.classList.add('animate-pulse');

        try {
            const balance = await BlockchainModule.getBalance(state.address);
            state.balance = balance.eth;
            state.tokenBalances['ETH'] = {
                raw: balance.wei,
                formatted: balance.eth,
                hasBalance: parseFloat(balance.eth) > 0
            };

            elements['balance-display'].textContent = `${parseFloat(balance.eth).toFixed(6)} ETH`;

            const price = await BlockchainModule.getEthPrice();
            if (price > 0) {
                const usd = parseFloat(balance.eth) * price;
                state.balanceUsd = usd.toFixed(2);
                elements['balance-usd'].textContent = `≈ $${state.balanceUsd} USD`;
            }

        } catch (error) {
            showToast('Erro ao atualizar saldo', 'error');
        } finally {
            btn.querySelector('svg').classList.remove('animate-spin');
            balanceDisplay.classList.remove('animate-pulse');
        }
    }

    /**
     * Load token balances
     * CORREÇÃO: Adicionada verificação defensiva para TokensModule
     */
    async function loadTokenBalances() {
        if (!state.address || state.isLoadingTokens) return;

        // Verificação defensiva: garantir que TokensModule está disponível
        if (typeof TokensModule === 'undefined') {
            console.error('TokensModule não está disponível');
            return;
        }

        state.isLoadingTokens = true;
        const tokenList = elements['token-list'];

        if (tokenList) {
            tokenList.innerHTML = `
                <div class="p-8 text-center">
                    <div class="w-12 h-12 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg class="w-6 h-6 text-dark-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                    </div>
                    <p class="text-dark-400">Carregando tokens...</p>
                </div>
            `;
        }

        try {
            const network = BlockchainModule.getCurrentNetwork();

            // getTokensForNetwork já filtra apenas tokens com contrato válido para a rede
            const tokensForNetwork = TokensModule.getTokensForNetwork(network.key);

            // Filtrar tokens que não têm contrato válido (verificação adicional)
            const validTokens = tokensForNetwork.filter(token => {
                // ETH nativo sempre é válido
                if (token.isNative) return true;
                // Para ERC-20, verificar se tem endereço de contrato
                return token.contractAddress && token.contractAddress.length === 42;
            });

            // Get all token balances usando Promise.allSettled para não quebrar em falhas individuais
            const balances = await BlockchainModule.getAllTokenBalances(state.address, validTokens);

            // Merge with state
            state.tokenBalances = { ...state.tokenBalances, ...balances };

            // Update cache
            TokensModule.updateBalanceCache(state.tokenBalances);

            // Render token list
            renderTokenList();

        } catch (error) {
            // Log apenas para debug, não exibir ao usuário
            console.error('Error loading tokens:', error);
            if (tokenList) {
                tokenList.innerHTML = `
                    <div class="p-8 text-center">
                        <p class="text-dark-400">Erro ao carregar tokens</p>
                    </div>
                `;
            }
        } finally {
            state.isLoadingTokens = false;
        }
    }

    /**
     * Render token list in dashboard
     * Enhanced with verification badges
     */
    function renderTokenList() {
        const tokenList = elements['token-list'];
        if (!tokenList) return;

        // Sort tokens by value
        const sortedTokens = TokensModule.sortTokensByValue(state.tokenBalances);

        // Se houver tokens com saldo, exibe-os; se não houver saldo em nenhum, exibe todos os tokens rastreados
        const tokensWithBalance = sortedTokens.filter(t => t.hasBalance);
        const tokensToDisplay = tokensWithBalance.length > 0 ? tokensWithBalance : sortedTokens;

        if (tokensToDisplay.length === 0) {
            tokenList.innerHTML = `
                <div class="p-6 text-center">
                    <p class="text-slate-400 text-xs font-medium">Nenhum ativo rastreado nesta rede.</p>
                </div>
            `;
            return;
        }

        tokenList.innerHTML = tokensToDisplay.map(token => {
            const safeSymbol = escapeHtml(token.symbol);
            const safeName = escapeHtml(token.name);
            const safeIcon = escapeHtml(token.icon || token.symbol.charAt(0));
            const safeColor = escapeHtml(token.color || '#6366f1');
            const valueFormatted = token.valueUsd > 0 ? `$${token.valueUsd.toFixed(2)}` : '$0.00';
            const balanceNum = parseFloat(token.balance || 0);

            // Verification badge
            let verificationBadge = '';
            if (token.verified) {
                verificationBadge = `
                    <span class="ml-1.5 inline-flex items-center" title="Token Verificado">
                        <svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                    </span>
                `;
            } else if (token.isCustom) {
                verificationBadge = `
                    <span class="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono" title="Custom Token">Custom</span>
                `;
            }

            return `
                <div class="token-item-row group" onclick="App.showSendScreen('${safeSymbol}')">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="token-badge-icon shadow-sm group-hover:scale-105 transition-transform"
                             style="background: linear-gradient(135deg, ${safeColor}35, ${safeColor}15); color: ${safeColor}; border: 1px solid ${safeColor}50;">
                            ${safeIcon}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center text-sm font-bold text-white">
                                <span class="truncate">${safeSymbol}</span>
                                ${verificationBadge}
                            </div>
                            <p class="text-[11px] text-slate-400 font-medium truncate">${safeName}</p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 pl-3">
                        <p class="font-bold text-sm text-white font-mono">${balanceNum.toFixed(4)}</p>
                        <p class="text-[11px] text-slate-400 font-medium">${valueFormatted}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Load transaction history
     */
    async function loadTransactionHistory() {
        if (!state.address) return;

        elements['transaction-list'].innerHTML = `
            <div class="tx-loading">
                <div class="tx-loading-spinner"></div>
                <span class="text-dark-400 text-sm">Carregando transações...</span>
            </div>
        `;

        try {
            // Get combined history (ETH + tokens)
            const txs = await BlockchainModule.getCombinedHistory(state.address);

            if (txs.length === 0) {
                elements['transaction-list'].innerHTML = `
                    <div class="p-8 text-center">
                        <div class="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg class="w-8 h-8 text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                        </div>
                        <p class="text-dark-400">Nenhuma transação encontrada</p>
                    </div>
                `;
                return;
            }

            elements['transaction-list'].innerHTML = txs.map(tx => {
                const date = new Date(tx.timestamp);
                const formattedDate = date.toLocaleDateString('pt-BR');
                const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isSent = tx.type === 'sent';
                const safeTokenSymbol = escapeHtml(tx.tokenSymbol || 'ETH');
                // FIX #5: Sanitize API-sourced data
                const safeExplorerUrl = escapeHtml(tx.explorerUrl || '#');
                const safeValue = parseFloat(tx.value).toFixed(6);

                return `
                    <a href="${safeExplorerUrl}" target="_blank" rel="noopener noreferrer" class="tx-item block hover:bg-dark-700/50 transition-colors">
                        <div class="tx-icon ${isSent ? 'sent' : 'received'}">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
                            </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium">${isSent ? 'Enviado' : 'Recebido'} ${safeTokenSymbol}</p>
                            <p class="text-xs text-dark-400">${formattedDate} às ${formattedTime}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold ${isSent ? 'text-red-400' : 'text-green-400'}">
                                ${isSent ? '-' : '+'}${safeValue} ${safeTokenSymbol}
                            </p>
                            <p class="text-xs text-dark-500">Ver detalhes →</p>
                        </div>
                    </a>
                `;
            }).join('');

        } catch (error) {
            elements['transaction-list'].innerHTML = `
                <div class="p-8 text-center">
                    <p class="text-dark-400">Erro ao carregar histórico</p>
                </div>
            `;
        }
    }

    /**
     * Copy address to clipboard
     */
    async function copyAddress() {
        try {
            await navigator.clipboard.writeText(state.address);
            showToast('Endereço copiado!', 'success');

            const btn = document.getElementById('btn-copy-address');
            btn.classList.add('copy-success');
            setTimeout(() => btn.classList.remove('copy-success'), 300);
        } catch {
            showToast('Erro ao copiar', 'error');
        }
    }

    /**
     * Show send screen for a specific token
     */
    function showSendScreen(tokenSymbol = 'ETH') {
        state.selectedToken = tokenSymbol;
        const token = TokensModule.getToken(tokenSymbol);
        const balance = state.tokenBalances[tokenSymbol];

        // Update title
        if (elements['send-screen-title']) {
            elements['send-screen-title'].textContent = `Enviar ${tokenSymbol}`;
        }

        // Update token selector
        if (elements['selected-token-icon']) {
            elements['selected-token-icon'].innerHTML = token?.icon || tokenSymbol.charAt(0);
            elements['selected-token-icon'].style.backgroundColor = (token?.color || '#6366f1') + '20';
            elements['selected-token-icon'].style.color = token?.color || '#6366f1';
        }
        if (elements['selected-token-symbol']) {
            elements['selected-token-symbol'].textContent = tokenSymbol;
        }
        if (elements['selected-token-balance']) {
            const balanceFormatted = balance ? parseFloat(balance.formatted).toFixed(6) : '0';
            elements['selected-token-balance'].textContent = `Saldo: ${balanceFormatted}`;
        }

        // Clear form
        elements['send-to'].value = '';
        elements['send-amount'].value = '';
        elements['send-to-error'].classList.add('hidden');
        elements['send-amount-error'].classList.add('hidden');

        const balanceFormatted = balance ? parseFloat(balance.formatted).toFixed(6) : '0';
        elements['available-balance'].textContent = `Disponível: ${balanceFormatted} ${tokenSymbol}`;
        elements['gas-estimate'].textContent = '~0.0000 ETH';
        elements['total-amount'].textContent = '0.0000 ETH';
        elements['address-tamper-warning'].classList.add('hidden');
        document.getElementById('btn-continue-send').disabled = true;

        // Setup address tampering detection
        state.addressWatcherId = SecurityModule.watchAddressInput(
            elements['send-to'],
            (tampering) => {
                elements['address-tamper-warning'].classList.remove('hidden');
                showToast('⚠️ ALERTA: Endereço modificado!', 'error');
            }
        );

        showScreen('send-screen');
    }

    /**
     * Open token selector modal
     */
    function openTokenSelectorModal() {
        const modal = elements['token-selector-modal'];
        if (!modal) return;

        // Populate token list
        renderTokenModalList();

        showModal('token-selector-modal');

        if (elements['token-search']) {
            elements['token-search'].value = '';
            elements['token-search'].focus();
        }
    }

    /**
     * Close token selector modal
     */
    function closeTokenSelectorModal() {
        hideModal('token-selector-modal');
    }

    /**
     * Render token list in modal
     * Enhanced with verification badges
     */
    function renderTokenModalList(filter = '') {
        const modalList = elements['token-modal-list'];
        if (!modalList) return;

        const network = BlockchainModule.getCurrentNetwork();
        const tokensForNetwork = TokensModule.getTokensForNetwork(network.key);

        // Filter by search query
        let filteredTokens = tokensForNetwork;
        if (filter) {
            const q = filter.toLowerCase();
            filteredTokens = tokensForNetwork.filter(t =>
                t.symbol.toLowerCase().includes(q) ||
                t.name.toLowerCase().includes(q)
            );
        }

        // Sort: tokens with balance first, then verified
        filteredTokens.sort((a, b) => {
            const balA = state.tokenBalances[a.symbol]?.hasBalance ? 1 : 0;
            const balB = state.tokenBalances[b.symbol]?.hasBalance ? 1 : 0;
            if (balA !== balB) return balB - balA;
            // Then by verified status
            const verA = a.verified ? 1 : 0;
            const verB = b.verified ? 1 : 0;
            return verB - verA;
        });

        modalList.innerHTML = filteredTokens.map(token => {
            const balance = state.tokenBalances[token.symbol];
            const balanceFormatted = balance ? parseFloat(balance.formatted).toFixed(6) : '0';
            const hasBalance = balance?.hasBalance;

            // Verification indicator
            let verificationIndicator = '';
            if (token.verified) {
                verificationIndicator = `
                    <svg class="w-3.5 h-3.5 text-green-400 ml-1" fill="currentColor" viewBox="0 0 20 20" title="Verificado">
                        <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                `;
            } else if (token.isCustom) {
                verificationIndicator = `
                    <span class="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">Não verificado</span>
                `;
            }

            return `
                <div class="p-4 flex items-center gap-3 hover:bg-dark-700 transition-colors cursor-pointer ${hasBalance ? '' : 'opacity-50'}"
                     onclick="App.selectToken('${token.symbol}')">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                         style="background-color: ${token.color}20; color: ${token.color}; border: 1px solid ${token.color}40;">
                        ${token.icon || token.symbol.charAt(0)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold flex items-center">${token.symbol}${verificationIndicator}</p>
                        <p class="text-xs text-dark-400">${token.name}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-medium">${balanceFormatted}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Filter token list in modal
     */
    function filterTokenList() {
        const query = elements['token-search']?.value || '';
        renderTokenModalList(query);
    }

    /**
     * Select token for sending
     */
    function selectToken(symbol) {
        closeTokenSelectorModal();
        showSendScreen(symbol);
    }

    /**
     * Validate send form
     * Enhanced with ENS resolution
     */
    async function validateSendForm() {
        let to = elements['send-to'].value.trim();
        const amount = elements['send-amount'].value;
        const tokenSymbol = state.selectedToken;
        const token = TokensModule.getToken(tokenSymbol);
        const balance = state.tokenBalances[tokenSymbol];
        let isValid = true;

        // ENS resolution: if ends with .eth, try to resolve
        if (to.endsWith('.eth') && to.length > 4) {
            try {
                elements['send-to-error'].textContent = 'Resolvendo ENS...';
                elements['send-to-error'].classList.remove('hidden');
                elements['send-to-error'].className = 'text-primary-400 text-xs mt-2';

                const ens = await BlockchainModule.resolveENS(to);
                if (ens.resolved && ens.address) {
                    elements['send-to-error'].textContent = `ENS → ${ens.address.slice(0, 10)}...${ens.address.slice(-8)}`;
                    elements['send-to-error'].className = 'text-green-400 text-xs mt-2';
                    elements['send-to-error'].classList.remove('hidden');
                    // Use the resolved address for the rest of validation
                    to = ens.address;
                    // Store resolved address for later use
                    elements['send-to'].dataset.resolvedAddress = ens.address;
                } else {
                    elements['send-to-error'].textContent = 'Domínio ENS não encontrado';
                    elements['send-to-error'].className = 'text-red-400 text-xs mt-2';
                    elements['send-to-error'].classList.remove('hidden');
                    isValid = false;
                }
            } catch {
                elements['send-to-error'].textContent = 'Erro ao resolver ENS';
                elements['send-to-error'].className = 'text-red-400 text-xs mt-2';
                elements['send-to-error'].classList.remove('hidden');
                isValid = false;
            }
        }
        // Normal address validation
        else if (to && !BlockchainModule.isValidAddress(to)) {
            elements['send-to-error'].textContent = 'Endereço inválido';
            elements['send-to-error'].className = 'text-red-400 text-xs mt-2';
            elements['send-to-error'].classList.remove('hidden');
            isValid = false;
        } else {
            elements['send-to-error'].classList.add('hidden');
            // Clear resolved address if user typed a normal address
            delete elements['send-to'].dataset.resolvedAddress;
        }

        // Check for sending to self
        if (to && state.address && to.toLowerCase() === state.address.toLowerCase()) {
            elements['send-to-error'].textContent = 'Você está enviando para si mesmo';
            elements['send-to-error'].classList.remove('hidden');
            isValid = false;
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        const balanceNum = balance ? parseFloat(balance.formatted) : 0;

        if (amount && (isNaN(amountNum) || amountNum <= 0)) {
            elements['send-amount-error'].textContent = 'Valor inválido';
            elements['send-amount-error'].classList.remove('hidden');
            isValid = false;
        } else if (amountNum > balanceNum) {
            elements['send-amount-error'].textContent = 'Saldo insuficiente';
            elements['send-amount-error'].classList.remove('hidden');
            isValid = false;
        } else {
            elements['send-amount-error'].classList.add('hidden');
        }

        // Estimate gas if valid
        if (isValid && to && amount && amountNum > 0) {
            try {
                elements['gas-estimate'].innerHTML = '<span class="animate-pulse">Calculando...</span>';

                let gas;
                if (token?.isNative) {
                    gas = await BlockchainModule.estimateGas(to, amount);
                } else {
                    const network = BlockchainModule.getCurrentNetwork();
                    const tokenAddress = TokensModule.getTokenAddress(tokenSymbol, network.key);
                    gas = await BlockchainModule.estimateTokenGas(tokenAddress, state.address, to, amount, token.decimals);
                }

                elements['gas-estimate'].textContent = `~${parseFloat(gas.totalGas).toFixed(6)} ETH`;

                // For tokens, check ETH balance for gas
                const ethBalance = parseFloat(state.balance);
                const gasNeeded = parseFloat(gas.totalGas);

                if (!token?.isNative && gasNeeded > ethBalance) {
                    elements['send-amount-error'].textContent = 'Saldo ETH insuficiente para taxa';
                    elements['send-amount-error'].classList.remove('hidden');
                    isValid = false;
                }

                // Calculate total
                let total;
                if (token?.isNative) {
                    total = amountNum + gasNeeded;
                    elements['total-amount'].textContent = `${total.toFixed(6)} ETH`;

                    if (total > balanceNum) {
                        elements['send-amount-error'].textContent = 'Saldo insuficiente para valor + taxa';
                        elements['send-amount-error'].classList.remove('hidden');
                        isValid = false;
                    }
                } else {
                    elements['total-amount'].textContent = `${amountNum.toFixed(6)} ${tokenSymbol} + ${gasNeeded.toFixed(6)} ETH`;
                }

                // Use resolved ENS address if available
                const resolvedTo = elements['send-to'].dataset.resolvedAddress || to;

                state.pendingTx = {
                    to: resolvedTo,
                    amount,
                    tokenSymbol,
                    tokenAddress: token?.isNative ? null : TokensModule.getTokenAddress(tokenSymbol, BlockchainModule.getCurrentNetwork().key),
                    decimals: token?.decimals || 18,
                    isNative: token?.isNative || false,
                    gasLimit: gas.gasLimit,
                    gasPrice: gas.gasPrice,
                    totalGas: gas.totalGas,
                    total: token?.isNative ? (amountNum + gasNeeded).toFixed(6) : amountNum.toFixed(6)
                };
            } catch (e) {
                elements['gas-estimate'].textContent = 'Erro ao estimar';
                isValid = false;
            }
        }

        document.getElementById('btn-continue-send').disabled = !isValid || !to || !amount;
    }

    /**
     * Set max amount
     */
    async function setMaxAmount() {
        const to = elements['send-to'].value.trim();
        const tokenSymbol = state.selectedToken;
        const token = TokensModule.getToken(tokenSymbol);
        const balance = state.tokenBalances[tokenSymbol];

        if (!BlockchainModule.isValidAddress(to)) {
            showToast('Digite um endereço válido primeiro', 'warning');
            return;
        }

        try {
            if (token?.isNative) {
                // For ETH, subtract gas estimate
                const gas = await BlockchainModule.estimateGas(to, '0.001');
                const gasBuffer = parseFloat(gas.totalGas) * 1.5;
                const maxAmount = parseFloat(balance?.formatted || 0) - gasBuffer;

                if (maxAmount <= 0) {
                    showToast('Saldo insuficiente para cobrir taxa', 'error');
                    return;
                }

                elements['send-amount'].value = maxAmount.toFixed(6);
            } else {
                // For tokens, use full balance
                elements['send-amount'].value = parseFloat(balance?.formatted || 0).toFixed(6);
            }

            validateSendForm();
        } catch {
            showToast('Erro ao calcular valor máximo', 'error');
        }
    }

    /**
     * Show confirm send screen
     * Enhanced with contract detection, first-time address, full-balance warnings
     */
    async function showConfirmSend() {
        if (!state.pendingTx) return;

        const network = BlockchainModule.getCurrentNetwork();
        const tokenSymbol = state.pendingTx.tokenSymbol;
        const token = TokensModule.getToken(tokenSymbol);

        const addrParts = SecurityModule.formatAddressForVerification(state.pendingTx.to);
        elements['confirm-to-enhanced'].innerHTML = addrParts.html;
        elements['confirm-to'].textContent = state.pendingTx.to;

        elements['confirm-amount'].textContent = `${state.pendingTx.amount} ${tokenSymbol}`;
        elements['confirm-gas'].textContent = `~${parseFloat(state.pendingTx.totalGas).toFixed(6)} ETH`;
        elements['confirm-total'].textContent = state.pendingTx.isNative
            ? `${state.pendingTx.total} ETH`
            : `${state.pendingTx.amount} ${tokenSymbol} + ${parseFloat(state.pendingTx.totalGas).toFixed(6)} ETH`;
        elements['confirm-network'].textContent = network.name;
        elements['confirm-send-password'].value = '';
        elements['confirm-password-error'].classList.add('hidden');
        elements['confirm-address-verified'].checked = false;

        // Collect all warnings
        const allWarnings = [];

        // 1. SecurityModule.validateTransaction — high gas, high value, self-send
        const validation = SecurityModule.validateTransaction(state.pendingTx, {
            address: state.address,
            balance: state.balance
        });

        if (validation.warnings && validation.warnings.length > 0) {
            allWarnings.push(...validation.warnings);
        }

        // 2. Detect if destination is a smart contract
        try {
            const contractCheck = await BlockchainModule.isContractAddress(state.pendingTx.to);
            if (contractCheck.isContract) {
                allWarnings.push('⚠️ Este endereço é um contrato inteligente. Enviar tokens diretamente pode resultar em perda permanente.');
            }
        } catch {
            // Non-critical — don't block send if check fails
        }

        // 3. First time sending to this address
        if (!StorageModule.isKnownAddress(state.pendingTx.to)) {
            allWarnings.push('ℹ️ Primeira vez enviando para este endereço. Verifique com cuidado.');
        }

        // 4. Full balance send detection (>=99%)
        const balance = state.tokenBalances[tokenSymbol];
        if (balance) {
            const balanceNum = parseFloat(balance.formatted);
            const amountNum = parseFloat(state.pendingTx.amount);
            if (balanceNum > 0 && amountNum / balanceNum >= 0.99) {
                allWarnings.push('⚠️ Você está enviando praticamente todo o saldo. Confirme se deseja continuar.');
            }
        }

        // 5. Token verification warning (for ERC-20 tokens only)
        if (!state.pendingTx.isNative && token) {
            const verificationStatus = TokensModule.getVerificationStatus(tokenSymbol);

            if (verificationStatus === TokensModule.VERIFICATION_STATUS.UNVERIFIED) {
                allWarnings.push('⚠️ Token não verificado - verifique o endereço do contrato');
            } else if (verificationStatus === TokensModule.VERIFICATION_STATUS.SUSPICIOUS) {
                allWarnings.push('⚠️ Token suspeito - dados divergem do esperado');
            }

            if (state.pendingTx.tokenAddress) {
                allWarnings.push(`Contrato: ${state.pendingTx.tokenAddress.slice(0, 10)}...${state.pendingTx.tokenAddress.slice(-8)}`);
            }
        }

        // Display warnings
        if (allWarnings.length > 0) {
            elements['tx-warnings'].classList.remove('hidden');
            elements['tx-warnings-list'].innerHTML = allWarnings.map(w => `<li>${w}</li>`).join('');
        } else {
            elements['tx-warnings'].classList.add('hidden');
        }

        document.getElementById('btn-confirm-send').disabled = true;
        showScreen('confirm-send-screen');
    }

    /**
     * Update confirm send button state
     */
    function updateConfirmSendButton() {
        const verified = elements['confirm-address-verified'].checked;
        const password = elements['confirm-send-password'].value;
        document.getElementById('btn-confirm-send').disabled = !verified || !password;
    }

    /**
     * Execute send transaction
     */
    async function executeSend() {
        const password = elements['confirm-send-password'].value;

        if (!password) {
            elements['confirm-password-error'].textContent = 'Digite sua senha';
            elements['confirm-password-error'].classList.remove('hidden');
            return;
        }

        if (!elements['confirm-address-verified'].checked) {
            showToast('Confirme que verificou o endereço', 'warning');
            return;
        }

        const btn = document.getElementById('btn-confirm-send');
        btn.classList.add('loading');

        try {
            // Decrypt wallet
            const walletData = StorageModule.getWallet();
            const decrypted = await CryptoModule.decrypt(
                walletData.encrypted,
                password,
                walletData.salt,
                walletData.iv
            );

            const data = JSON.parse(decrypted);
            let result;

            if (state.pendingTx.isNative) {
                // Send ETH
                result = await BlockchainModule.sendTransaction({
                    privateKey: data.privateKey,
                    to: state.pendingTx.to,
                    value: state.pendingTx.amount,
                    gasLimit: state.pendingTx.gasLimit,
                    gasPrice: state.pendingTx.gasPrice
                });
            } else {
                // Send token
                result = await BlockchainModule.sendToken({
                    privateKey: data.privateKey,
                    tokenAddress: state.pendingTx.tokenAddress,
                    to: state.pendingTx.to,
                    amount: state.pendingTx.amount,
                    decimals: state.pendingTx.decimals,
                    gasLimit: state.pendingTx.gasLimit,
                    gasPrice: state.pendingTx.gasPrice
                });
            }

            // Clear sensitive data
            CryptoModule.secureClear(decrypted);
            secureClearObject(data);  // FIX #2: clear individual string properties
            elements['confirm-send-password'].value = '';

            // Save destination to recent addresses history
            StorageModule.addRecentAddress(
                state.pendingTx.to,
                state.pendingTx.tokenSymbol
            );

            state.pendingTx = null;

            cleanupAddressWatcher();

            elements['tx-hash'].textContent = result.hash;
            elements['tx-explorer-link'].href = result.explorerUrl;
            showModal('tx-success-modal');

        } catch (error) {
            if (error.message.includes('incorreta') || error.message.includes('corrompidos')) {
                elements['confirm-password-error'].textContent = 'Senha incorreta';
                elements['confirm-password-error'].classList.remove('hidden');
            } else {
                showToast('Erro ao enviar: ' + error.message, 'error');
            }
        } finally {
            btn.classList.remove('loading');
        }
    }

    /**
     * Show receive screen with QR code
     */
    function showReceiveScreen() {
        elements['receive-address'].textContent = state.address;
        elements['qr-code'].innerHTML = '';

        new QRCode(elements['qr-code'], {
            text: state.address,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        showScreen('receive-screen');
    }

    /**
     * Handle network change
     */
    async function handleNetworkChange() {
        const network = elements['network-select'].value;

        try {
            showToast('Trocando rede...', 'info');
            await BlockchainModule.switchNetwork(network);
            updateNetworkDisplay();
            showToast(`Conectado à ${BlockchainModule.getCurrentNetwork().name}`, 'success');

            if (!state.isLocked) {
                // Clear token balances and reload
                state.tokenBalances = {};
                await refreshAllBalances();
                await loadTransactionHistory();
            }
        } catch (error) {
            showToast('Erro ao trocar rede: ' + error.message, 'error');
            elements['network-select'].value = BlockchainModule.getCurrentNetwork().key;
        }
    }

    /**
     * Clear exported seed display
     */
    function clearExportedSeed() {
        elements['exported-seed'].classList.add('hidden');
        elements['exported-seed-words'].innerHTML = '';
        elements['export-password'].value = '';
        elements['export-password-error'].classList.add('hidden');

        if (state.seedContainer) {
            state.seedContainer.clear();
            state.seedContainer = null;
        }
    }

    /**
     * Reveal seed phrase
     */
    async function revealSeed() {
        const password = elements['export-password'].value;

        if (!password) {
            elements['export-password-error'].textContent = 'Digite sua senha';
            elements['export-password-error'].classList.remove('hidden');
            return;
        }

        const btn = document.getElementById('btn-reveal-seed');
        btn.classList.add('loading');

        try {
            const walletData = StorageModule.getWallet();
            const decrypted = await CryptoModule.decrypt(
                walletData.encrypted,
                password,
                walletData.salt,
                walletData.iv
            );

            const data = JSON.parse(decrypted);

            state.seedContainer = SecurityModule.createSecureContainer(30000);
            state.seedContainer.set({ mnemonic: data.mnemonic });

            displaySeedWords(data.mnemonic, elements['exported-seed-words']);
            elements['exported-seed'].classList.remove('hidden');
            elements['export-password-error'].classList.add('hidden');

            let countdown = 30;
            const countdownEl = elements['seed-countdown'];
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdownEl) {
                    countdownEl.textContent = countdown;
                }
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    clearExportedSeed();
                }
            }, 1000);

            CryptoModule.secureClear(decrypted);
            secureClearObject(data);  // FIX #2: clear individual string properties

        } catch (error) {
            elements['export-password-error'].textContent = 'Senha incorreta';
            elements['export-password-error'].classList.remove('hidden');
        } finally {
            btn.classList.remove('loading');
        }
    }

    /**
     * Download wallet backup as JSON
     */
    function downloadBackup() {
        try {
            const backup = StorageModule.exportBackup();
            if (!backup) {
                showToast('Nenhum dado de carteira encontrado', 'error');
                return;
            }

            const metadata = StorageModule.getMetadata();
            const address = metadata ? metadata.address.slice(0, 8) : 'wallet';
            const fileName = `secureon_backup_${address}_${new Date().toISOString().split('T')[0]}.json`;

            const blob = new Blob([backup], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Backup baixado com sucesso', 'success');
        } catch (error) {
            console.error('Backup error:', error);
            showToast('Erro ao exportar backup', 'error');
        }
    }

    /**
     * Handle backup file import
     */
    function handleImportBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = StorageModule.importBackup(event.target.result);
                    if (result.success) {
                        showToast('Backup restaurado! Agora use sua senha para desbloquear.', 'success');
                        showScreen('login-screen');
                    } else {
                        showToast('Erro: ' + (result.error || 'Formato inválido'), 'error');
                    }
                } catch (error) {
                    showToast('Erro ao ler arquivo de backup', 'error');
                }
            };
            reader.readAsText(file);
        };

        input.click();
    }


    /**
     * Confirm delete wallet
     */
    function confirmDeleteWallet() {
        const confirmText = elements['delete-confirm-text'].value;

        if (confirmText !== 'APAGAR') return;

        SecurityModule.endSession();
        StorageModule.deleteWallet();
        hideModal('delete-modal');
        elements['delete-confirm-text'].value = '';

        // FIX #8: Use Object.assign to preserve references held by closures
        // FIX #1: Clear interval before resetting
        if (state.checkSessionIntervalId) {
            clearInterval(state.checkSessionIntervalId);
        }
        Object.assign(state, {
            currentScreen: null,
            address: null,
            balance: '0',
            balanceUsd: '0',
            tokenBalances: {},
            selectedToken: 'ETH',
            pendingTx: null,
            tempMnemonic: null,
            isLocked: true,
            addressWatcherId: null,
            seedContainer: null,
            inactivityTimeout: 5 * 60 * 1000,
            isLoadingTokens: false,
            checkSessionIntervalId: null
        });

        showToast('Carteira apagada', 'warning');
        showScreen('welcome-screen');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        lockWallet,
        refreshBalance: refreshAllBalances,
        showSendScreen,
        selectToken,
        showUpdateNotification: function () {
            if (typeof window.showUpdateBanner === 'function') {
                window.showUpdateBanner();
            }
        }
    };
})();

// Prevent modifications
Object.freeze(App);

// Clear sensitive data on page unload
window.addEventListener('beforeunload', () => {
    if (typeof App !== 'undefined' && App.lockWallet) {
        App.lockWallet();
    }
});

// Lock on visibility change after timeout
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        SecurityModule.recordActivity();
    }
});
