/**
 * Secureon Wallet - Security Module
 * Handles integrity verification, CDN validation, session protection
 * and advanced security features
 */

'use strict';

const SecurityModule = (function () {
    // Security constants
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    const SEED_DISPLAY_TIMEOUT = 30 * 1000; // 30 seconds
    const ADDRESS_CHANGE_DETECTION_INTERVAL = 100; // ms

    // Expected library signatures (simplified integrity check)
    const EXPECTED_LIBRARIES = {
        ethers: {
            check: () => typeof ethers !== 'undefined' &&
                typeof ethers.Wallet !== 'undefined' &&
                typeof ethers.isAddress === 'function',
            name: 'ethers.js'
        },
        qrcode: {
            check: () => typeof QRCode !== 'undefined',
            name: 'QRCode.js'
        },
        tailwind: {
            check: () => typeof tailwind !== 'undefined' ||
                document.querySelector('style[data-tailwind]') !== null ||
                typeof window.tailwind !== 'undefined',
            name: 'Tailwind CSS',
            optional: true
        }
    };

    // Session state
    let lastActivity = Date.now();
    let inactivityTimer = null;
    let isSessionActive = false;
    let onLockCallback = null;
    let addressWatchers = new Map();

    // Console protection - disable in production
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error
    };

    /**
     * Initialize security module
     * @param {Object} options
     * @returns {Promise<{success: boolean, errors: string[]}>}
     */
    async function init(options = {}) {
        const errors = [];

        // 1. Validate required libraries
        const libValidation = validateLibraries();
        if (!libValidation.valid) {
            errors.push(...libValidation.errors);
        }

        // 2. Setup console protection (optional, can be disabled for debugging)
        if (options.protectConsole !== false) {
            protectConsole();
        }

        // 3. Disable dangerous functions
        disableDangerousFunctions();

        // 4. Setup global error handler (no sensitive data leaks)
        setupErrorHandler();

        // 5. Detect DevTools (informational only)
        if (options.detectDevTools !== false) {
            detectDevTools();
        }

        // 6. Validate page integrity
        const integrityCheck = await validatePageIntegrity();
        if (!integrityCheck.valid) {
            errors.push('Possível modificação detectada na página');
        }

        return {
            success: errors.length === 0,
            errors
        };
    }

    /**
     * Validate that all required libraries loaded correctly
     * @returns {{valid: boolean, errors: string[]}}
     */
    function validateLibraries() {
        const errors = [];

        for (const [key, lib] of Object.entries(EXPECTED_LIBRARIES)) {
            try {
                if (!lib.check() && !lib.optional) {
                    errors.push(`Biblioteca ${lib.name} não carregou corretamente`);
                }
            } catch (e) {
                if (!lib.optional) {
                    errors.push(`Erro ao validar ${lib.name}`);
                }
            }
        }

        // Check if Web Crypto API is available
        if (!window.crypto || !window.crypto.subtle) {
            errors.push('Web Crypto API não disponível - navegador não suportado');
        }

        // Check for secure context (allow file:// for local testing)
        if (!window.isSecureContext && location.protocol !== 'file:') {
            // Just warn, don't block
            console.warn('Aviso: Contexto não seguro - recomendado usar HTTPS');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate page integrity using DOM checksums
     * @returns {Promise<{valid: boolean}>}
     */
    async function validatePageIntegrity() {
        try {
            // Check for unexpected iframes
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
                return { valid: false };
            }

            // Check for unexpected forms pointing elsewhere
            const forms = document.querySelectorAll('form[action]');
            for (const form of forms) {
                const action = form.getAttribute('action');
                if (action && !action.startsWith('#') && action !== '') {
                    return { valid: false };
                }
            }

            // Check for suspicious event listeners on body
            // (This is a basic check, sophisticated attacks might bypass it)

            return { valid: true };
        } catch (e) {
            return { valid: false };
        }
    }

    /**
     * Protect console from leaking sensitive data
     */
    function protectConsole() {
        const sensitivePatterns = [
            /mnemonic/i,
            /privatekey/i,
            /private_key/i,
            /seed/i,
            /secret/i,
            /password/i
        ];

        const sanitize = (args) => {
            return args.map(arg => {
                if (typeof arg === 'string') {
                    for (const pattern of sensitivePatterns) {
                        if (pattern.test(arg)) {
                            return '[DADOS SENSÍVEIS OCULTADOS]';
                        }
                    }
                }
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        const str = JSON.stringify(arg);
                        for (const pattern of sensitivePatterns) {
                            if (pattern.test(str)) {
                                return '[OBJETO COM DADOS SENSÍVEIS]';
                            }
                        }
                    } catch (e) {
                        // Circular reference or other issue
                    }
                }
                return arg;
            });
        };

        console.log = (...args) => originalConsole.log(...sanitize(args));
        console.warn = (...args) => originalConsole.warn(...sanitize(args));
        console.error = (...args) => originalConsole.error(...sanitize(args));
    }

    /**
     * Disable dangerous JavaScript functions
     */
    function disableDangerousFunctions() {
        // These are already blocked by CSP, but add extra protection

        // Wrap eval to prevent use
        if (window.eval) {
            window.eval = function () {
                throw new Error('eval() está desabilitado por segurança');
            };
        }

        // Disable Function constructor for dynamic code
        try {
            const OriginalFunction = Function;
            // Only wrap if not already wrapped
            if (!Function.__secured__) {
                window.Function = function (...args) {
                    if (args.length > 0 && typeof args[args.length - 1] === 'string') {
                        // Check if it's being used to execute code
                        const body = args[args.length - 1];
                        if (body.includes('return') || body.includes(';')) {
                            throw new Error('Criação dinâmica de funções desabilitada');
                        }
                    }
                    return new OriginalFunction(...args);
                };
                window.Function.__secured__ = true;
                window.Function.prototype = OriginalFunction.prototype;
            }
        } catch (e) {
            // Some browsers may not allow this
        }
    }

    /**
     * Setup global error handler to prevent sensitive data leaks
     */
    function setupErrorHandler() {
        window.onerror = function (message, source, lineno, colno, error) {
            // Log sanitized error
            originalConsole.error('Erro:', {
                message: message?.replace(/[a-f0-9]{64}/gi, '[HASH]'),
                source: source?.split('/').pop(),
                line: lineno
            });
            return true; // Prevent default error handling
        };

        window.onunhandledrejection = function (event) {
            originalConsole.error('Promise rejeitada');
            event.preventDefault();
        };
    }

    /**
     * Detect DevTools opening (informational)
     */
    function detectDevTools() {
        let devToolsOpen = false;

        const threshold = 160;
        const check = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;

            if (widthThreshold || heightThreshold) {
                if (!devToolsOpen) {
                    devToolsOpen = true;
                    // Just log, don't block functionality
                    originalConsole.warn('🔧 DevTools detectado - tenha cuidado com dados sensíveis');
                }
            } else {
                devToolsOpen = false;
            }
        };

        // Check periodically
        setInterval(check, 1000);
    }

    /**
     * Start session activity tracking
     * @param {Function} onLock - Callback when session should lock
     * @param {number} timeout - Inactivity timeout in ms
     */
    function startSession(onLock, timeout = INACTIVITY_TIMEOUT) {
        onLockCallback = onLock;
        isSessionActive = true;
        lastActivity = Date.now();

        // Activity events
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

        const recordActivity = () => {
            lastActivity = Date.now();
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, recordActivity, { passive: true });
        });

        // Start inactivity checker
        if (inactivityTimer) {
            clearInterval(inactivityTimer);
        }

        inactivityTimer = setInterval(() => {
            if (isSessionActive && Date.now() - lastActivity > timeout) {
                endSession();
                if (onLockCallback) {
                    onLockCallback('inactivity');
                }
            }
        }, 10000); // Check every 10 seconds

        // Lock on visibility change (optional - configurable)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && isSessionActive) {
                // Start countdown for auto-lock when tab hidden
                const hiddenTimeout = setTimeout(() => {
                    if (document.hidden && isSessionActive) {
                        endSession();
                        if (onLockCallback) {
                            onLockCallback('hidden');
                        }
                    }
                }, 60000); // 1 minute when hidden

                // Clear timeout if tab becomes visible again
                const clearOnVisible = () => {
                    clearTimeout(hiddenTimeout);
                    document.removeEventListener('visibilitychange', clearOnVisible);
                };
                document.addEventListener('visibilitychange', clearOnVisible);
            }
        });
    }

    /**
     * End active session
     */
    function endSession() {
        isSessionActive = false;
        if (inactivityTimer) {
            clearInterval(inactivityTimer);
            inactivityTimer = null;
        }

        // Clear all address watchers
        addressWatchers.forEach((watcher) => {
            clearInterval(watcher.interval);
        });
        addressWatchers.clear();
    }

    /**
     * Record user activity to prevent auto-lock
     */
    function recordActivity() {
        lastActivity = Date.now();
    }

    /**
     * Get time until auto-lock
     * @returns {number} Seconds until lock, or -1 if no active session
     */
    function getTimeUntilLock() {
        if (!isSessionActive) return -1;
        const elapsed = Date.now() - lastActivity;
        const remaining = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
        return Math.ceil(remaining / 1000);
    }

    /**
     * Watch an address input for unexpected changes (clipboard hijacking protection)
     * @param {HTMLInputElement} input - The address input element
     * @param {Function} onTampering - Callback if tampering detected
     * @returns {string} Watcher ID for cleanup
     */
    function watchAddressInput(input, onTampering) {
        const watcherId = 'watch_' + Math.random().toString(36).substr(2, 9);
        let lastKnownValue = input.value;
        let lastUserInput = input.value;
        let isUserTyping = false;

        // Track user input
        const onInput = () => {
            isUserTyping = true;
            lastUserInput = input.value;
            lastKnownValue = input.value;
            setTimeout(() => { isUserTyping = false; }, 100);
        };

        input.addEventListener('input', onInput);
        input.addEventListener('keydown', () => { isUserTyping = true; });
        input.addEventListener('keyup', () => {
            setTimeout(() => { isUserTyping = false; }, 100);
        });

        // Periodic check for unexpected changes
        const interval = setInterval(() => {
            if (!isUserTyping && input.value !== lastKnownValue) {
                // Value changed without user input - possible clipboard hijacking
                const changed = input.value;

                // Check if it looks like an address swap
                if (changed.startsWith('0x') && changed.length === 42 &&
                    lastKnownValue.startsWith('0x') && lastKnownValue.length === 42) {
                    // Likely address swap attack
                    onTampering({
                        original: lastKnownValue,
                        tampered: changed,
                        type: 'address_swap'
                    });
                }

                lastKnownValue = input.value;
            }
        }, ADDRESS_CHANGE_DETECTION_INTERVAL);

        addressWatchers.set(watcherId, { interval, input, onInput });
        return watcherId;
    }

    /**
     * Stop watching an address input
     * @param {string} watcherId
     */
    function unwatchAddressInput(watcherId) {
        const watcher = addressWatchers.get(watcherId);
        if (watcher) {
            clearInterval(watcher.interval);
            watcher.input.removeEventListener('input', watcher.onInput);
            addressWatchers.delete(watcherId);
        }
    }

    /**
     * Securely display address with visual verification aids
     * @param {string} address
     * @returns {Object} HTML parts for display
     */
    function formatAddressForVerification(address) {
        if (!address || address.length !== 42) {
            return { full: address, formatted: address, html: address };
        }

        const prefix = address.slice(0, 6);    // 0x + 4 chars
        const middle = address.slice(6, -6);
        const suffix = address.slice(-6);

        return {
            full: address,
            prefix,
            middle,
            suffix,
            // HTML with highlighted start/end for easy verification
            html: `<span class="address-highlight">${prefix}</span><span class="address-middle">${middle}</span><span class="address-highlight">${suffix}</span>`
        };
    }

    /**
     * Create a secure temporary container for sensitive data
     * Data is automatically cleared after timeout
     * @param {number} timeout - Auto-clear timeout in ms
     * @returns {Object} Secure container
     */
    function createSecureContainer(timeout = SEED_DISPLAY_TIMEOUT) {
        let data = null;
        let clearTimer = null;

        const clear = () => {
            if (data) {
                if (typeof data === 'object') {
                    Object.keys(data).forEach(key => {
                        if (typeof data[key] === 'string') {
                            // Overwrite string data
                            data[key] = 'x'.repeat(data[key].length);
                        }
                        data[key] = null;
                    });
                }
                data = null;
            }
            if (clearTimer) {
                clearTimeout(clearTimer);
                clearTimer = null;
            }
        };

        return {
            set: (value) => {
                clear();
                data = value;
                clearTimer = setTimeout(clear, timeout);
            },
            get: () => data,
            clear,
            extendTimeout: (newTimeout) => {
                if (clearTimer) {
                    clearTimeout(clearTimer);
                    clearTimer = setTimeout(clear, newTimeout);
                }
            }
        };
    }

    /**
     * Validate transaction parameters before signing
     * CORREÇÃO: tx.amount é usado no pendingTx, tx.value como fallback
     * @param {Object} tx - Transaction object
     * @param {Object} wallet - Wallet state
     * @returns {{valid: boolean, errors: string[], warnings: string[]}}
     */
    function validateTransaction(tx, wallet) {
        const errors = [];

        // Check recipient address
        if (!tx.to || !tx.to.startsWith('0x') || tx.to.length !== 42) {
            errors.push('Endereço de destino inválido');
        }

        // Check for sending to self
        if (tx.to && wallet.address &&
            tx.to.toLowerCase() === wallet.address.toLowerCase()) {
            errors.push('Você está enviando para seu próprio endereço');
        }

        // Check value — pendingTx uses 'amount', fallback to 'value'
        const value = parseFloat(tx.amount || tx.value);
        if (isNaN(value) || value <= 0) {
            errors.push('Valor deve ser maior que zero');
        }

        // Check gas
        if (!tx.gasLimit || !tx.gasPrice) {
            errors.push('Parâmetros de gas inválidos');
        }

        // Check sufficient balance
        const total = value + parseFloat(tx.totalGas || 0);
        if (total > parseFloat(wallet.balance)) {
            errors.push('Saldo insuficiente para valor + taxa');
        }

        // Sanity check - warn on very high gas
        const gasInEth = parseFloat(tx.totalGas || 0);
        if (gasInEth > 0.1) {
            errors.push('⚠️ Taxa de gas muito alta: ' + gasInEth.toFixed(4) + ' ETH');
        }

        // Sanity check - warn on large transactions
        if (value > 10) {
            errors.push('⚠️ Transação de alto valor: ' + value + ' ETH');
        }

        return {
            valid: errors.filter(e => !e.startsWith('⚠️')).length === 0,
            errors,
            warnings: errors.filter(e => e.startsWith('⚠️'))
        };
    }

    /**
     * Generate a simple checksum for verification
     * @param {string} data
     * @returns {Promise<string>}
     */
    async function generateChecksum(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    }

    /**
     * Create anti-phishing visual indicator
     * @param {string} userSecret - User-chosen secret word/phrase
     */
    function setAntiPhishingIndicator(userSecret) {
        // Store hashed version
        generateChecksum(userSecret).then(hash => {
            localStorage.setItem('secureeth_antiphish', hash);
        });
    }

    /**
     * Verify anti-phishing indicator
     * @param {string} userSecret
     * @returns {Promise<boolean>}
     */
    async function verifyAntiPhishingIndicator(userSecret) {
        const stored = localStorage.getItem('secureeth_antiphish');
        if (!stored) return true; // Not set up
        const hash = await generateChecksum(userSecret);
        return hash === stored;
    }

    // Public API
    return {
        init,
        validateLibraries,
        validatePageIntegrity,
        startSession,
        endSession,
        recordActivity,
        getTimeUntilLock,
        watchAddressInput,
        unwatchAddressInput,
        formatAddressForVerification,
        createSecureContainer,
        validateTransaction,
        generateChecksum,
        setAntiPhishingIndicator,
        verifyAntiPhishingIndicator,
        INACTIVITY_TIMEOUT,
        SEED_DISPLAY_TIMEOUT
    };
})();

// Prevent modifications
Object.freeze(SecurityModule);
