/**
 * Secureon Wallet - Storage Module
 * Handles secure storage with encryption and brute force protection
 * Enhanced with additional security measures
 */

'use strict';

const StorageModule = (function () {
    // Storage keys - prefixed to avoid collisions
    const KEYS = {
        WALLET: 'secureeth_wallet_v2',
        METADATA: 'secureeth_metadata_v2',
        SETTINGS: 'secureeth_settings_v2',
        SECURITY: 'secureeth_security_v2',
        RECENT_ADDRESSES: 'secureeth_recent_addr_v2'
    };

    // Brute force protection settings
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY = 1000; // 1 second
    const MAX_DELAY = 600000; // 10 minutes
    const LOCKOUT_THRESHOLD = 10; // After this many attempts, longer lockout

    /**
     * Check if localStorage is available and working
     * @returns {boolean}
     */
    function isStorageAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize storage module
     */
    function init() {
        if (!isStorageAvailable()) {
            throw new Error('localStorage não disponível');
        }

        // Ensure security data exists
        const security = getSecurityData();
        if (!security) {
            setSecurityData({
                failedAttempts: 0,
                lastAttempt: 0,
                lockedUntil: 0,
                totalAttempts: 0
            });
        }

        // Migrate old data if exists
        migrateOldData();
    }

    /**
     * Migrate data from old storage keys
     */
    function migrateOldData() {
        // Check for v1 data
        const oldWallet = localStorage.getItem('secureeth_wallet');
        if (oldWallet && !localStorage.getItem(KEYS.WALLET)) {
            try {
                localStorage.setItem(KEYS.WALLET, oldWallet);
                localStorage.removeItem('secureeth_wallet');
            } catch (e) {
                // Migration failed, keep old data
            }
        }

        const oldMetadata = localStorage.getItem('secureeth_metadata');
        if (oldMetadata && !localStorage.getItem(KEYS.METADATA)) {
            try {
                localStorage.setItem(KEYS.METADATA, oldMetadata);
                localStorage.removeItem('secureeth_metadata');
            } catch (e) {
                // Migration failed
            }
        }

        const oldSettings = localStorage.getItem('secureeth_settings');
        if (oldSettings && !localStorage.getItem(KEYS.SETTINGS)) {
            try {
                localStorage.setItem(KEYS.SETTINGS, oldSettings);
                localStorage.removeItem('secureeth_settings');
            } catch (e) {
                // Migration failed
            }
        }
    }

    /**
     * Get security data
     * @returns {Object|null}
     */
    function getSecurityData() {
        try {
            const data = localStorage.getItem(KEYS.SECURITY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    /**
     * Set security data
     * @param {Object} data
     */
    function setSecurityData(data) {
        try {
            localStorage.setItem(KEYS.SECURITY, JSON.stringify(data));
        } catch (e) {
            // Storage might be full
        }
    }

    /**
     * Check if brute force protection is active
     * @returns {{locked: boolean, remainingTime: number, attempts: number}}
     */
    function checkBruteForceProtection() {
        const security = getSecurityData() || { failedAttempts: 0, lockedUntil: 0 };
        const now = Date.now();

        if (security.lockedUntil > now) {
            return {
                locked: true,
                remainingTime: Math.ceil((security.lockedUntil - now) / 1000),
                attempts: security.failedAttempts
            };
        }

        // If lock expired, reset attempts
        if (security.lockedUntil > 0 && security.lockedUntil <= now) {
            security.failedAttempts = 0;
            security.lockedUntil = 0;
            setSecurityData(security);
        }

        return {
            locked: false,
            remainingTime: 0,
            attempts: security.failedAttempts
        };
    }

    /**
     * Record a failed login attempt
     * @returns {{attempts: number, maxAttempts: number, lockedUntil: number}}
     */
    function recordFailedAttempt() {
        const security = getSecurityData() || {
            failedAttempts: 0,
            lockedUntil: 0,
            totalAttempts: 0
        };

        security.failedAttempts++;
        security.totalAttempts = (security.totalAttempts || 0) + 1;
        security.lastAttempt = Date.now();

        // Calculate progressive delay
        if (security.failedAttempts >= MAX_ATTEMPTS) {
            // Exponential backoff
            const exponent = security.failedAttempts - MAX_ATTEMPTS;
            let delay = BASE_DELAY * Math.pow(2, exponent);

            // Extra punishment for persistent attackers
            if (security.totalAttempts > LOCKOUT_THRESHOLD) {
                delay = Math.min(delay * 2, MAX_DELAY);
            }

            delay = Math.min(delay, MAX_DELAY);
            security.lockedUntil = Date.now() + delay;
        }

        setSecurityData(security);

        return {
            attempts: security.failedAttempts,
            maxAttempts: MAX_ATTEMPTS,
            lockedUntil: security.lockedUntil,
            totalAttempts: security.totalAttempts
        };
    }

    /**
     * Reset failed attempts on successful login
     */
    function resetFailedAttempts() {
        const security = getSecurityData() || {};
        setSecurityData({
            failedAttempts: 0,
            lastAttempt: 0,
            lockedUntil: 0,
            totalAttempts: security.totalAttempts || 0, // Keep total for audit
            lastSuccess: Date.now()
        });
    }

    /**
     * Check if wallet exists in storage
     * @returns {boolean}
     */
    function hasWallet() {
        return localStorage.getItem(KEYS.WALLET) !== null;
    }

    /**
     * Save encrypted wallet data
     * @param {Object} encryptedData - Contains encrypted, salt, iv
     * @param {string} address - Public address (not sensitive)
     * @returns {boolean}
     */
    function saveWallet(encryptedData, address) {
        try {
            // Validate encrypted data structure
            if (!encryptedData.encrypted || !encryptedData.salt || !encryptedData.iv) {
                throw new Error('Dados de carteira inválidos');
            }

            const walletData = {
                encrypted: encryptedData.encrypted,
                salt: encryptedData.salt,
                iv: encryptedData.iv,
                iterations: encryptedData.iterations,
                version: encryptedData.version || 1,
                createdAt: Date.now()
            };

            const metadata = {
                address: address,
                createdAt: Date.now(),
                lastAccess: Date.now()
            };

            localStorage.setItem(KEYS.WALLET, JSON.stringify(walletData));
            localStorage.setItem(KEYS.METADATA, JSON.stringify(metadata));

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get encrypted wallet data
     * @returns {Object|null}
     */
    function getWallet() {
        try {
            const data = localStorage.getItem(KEYS.WALLET);
            if (!data) return null;

            const parsed = JSON.parse(data);

            // Validate structure
            if (!parsed.encrypted || !parsed.salt || !parsed.iv) {
                return null;
            }

            return parsed;
        } catch {
            return null;
        }
    }

    /**
     * Get wallet metadata (non-sensitive)
     * @returns {Object|null}
     */
    function getMetadata() {
        try {
            const data = localStorage.getItem(KEYS.METADATA);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    /**
     * Update metadata
     * @param {Object} updates
     */
    function updateMetadata(updates) {
        try {
            const current = getMetadata() || {};
            const updated = { ...current, ...updates, lastAccess: Date.now() };
            localStorage.setItem(KEYS.METADATA, JSON.stringify(updated));
        } catch {
            // Storage error
        }
    }

    /**
     * Get settings
     * @returns {Object}
     */
    function getSettings() {
        try {
            const data = localStorage.getItem(KEYS.SETTINGS);
            const settings = data ? JSON.parse(data) : getDefaultSettings();
            return { ...getDefaultSettings(), ...settings };
        } catch {
            return getDefaultSettings();
        }
    }

    /**
     * Get default settings
     * @returns {Object}
     */
    function getDefaultSettings() {
        return {
            network: 'mainnet',
            currency: 'USD',
            inactivityTimeout: 5 * 60 * 1000, // 5 minutes
            showTestnets: true
        };
    }

    /**
     * Save settings
     * @param {Object} settings
     * @returns {boolean}
     */
    function saveSettings(settings) {
        try {
            // Validate settings
            const validSettings = { ...getDefaultSettings(), ...settings };
            localStorage.setItem(KEYS.SETTINGS, JSON.stringify(validSettings));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete all wallet data
     * @returns {boolean}
     */
    function deleteWallet() {
        try {
            localStorage.removeItem(KEYS.WALLET);
            localStorage.removeItem(KEYS.METADATA);
            // FIX #10: Also clear settings and recent addresses to prevent data leakage
            localStorage.removeItem(KEYS.SETTINGS);
            localStorage.removeItem(KEYS.RECENT_ADDRESSES);
            resetFailedAttempts();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete all data including settings
     * @returns {boolean}
     */
    function clearAll() {
        try {
            Object.values(KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Export storage data for backup (encrypted wallet data only)
     * @returns {string|null}
     */
    function exportBackup() {
        const wallet = getWallet();
        if (!wallet) return null;

        const backup = {
            type: 'secureeth_backup',
            version: 2,
            data: wallet,
            // FIX #7: Include metadata in backup so address is restored on import
            metadata: getMetadata(),
            exportedAt: Date.now(),
            checksum: null // Will be added below
        };

        // Add simple checksum for integrity
        const dataStr = JSON.stringify(backup.data);
        backup.checksum = simpleChecksum(dataStr);

        return JSON.stringify(backup);
    }

    /**
     * Import backup data
     * @param {string} backupString
     * @returns {{success: boolean, error?: string}}
     */
    function importBackup(backupString) {
        try {
            const backup = JSON.parse(backupString);

            if (backup.type !== 'secureeth_backup' || !backup.data) {
                return { success: false, error: 'Formato de backup inválido' };
            }

            // Verify checksum if present
            if (backup.checksum) {
                const dataStr = JSON.stringify(backup.data);
                if (simpleChecksum(dataStr) !== backup.checksum) {
                    return { success: false, error: 'Checksum inválido - backup corrompido' };
                }
            }

            // Validate wallet data structure
            if (!backup.data.encrypted || !backup.data.salt || !backup.data.iv) {
                return { success: false, error: 'Dados de carteira inválidos' };
            }

            localStorage.setItem(KEYS.WALLET, JSON.stringify(backup.data));

            // FIX #7: Also restore metadata (contains address) if present in backup
            if (backup.metadata && backup.metadata.address) {
                localStorage.setItem(KEYS.METADATA, JSON.stringify(backup.metadata));
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: 'Erro ao processar backup' };
        }
    }

    /**
     * Simple checksum for data integrity (not cryptographic)
     * @param {string} str
     * @returns {string}
     */
    function simpleChecksum(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Get recent addresses the user has sent to
     * @returns {Array<{address: string, timestamp: number, label?: string}>}
     */
    function getRecentAddresses() {
        try {
            const data = localStorage.getItem(KEYS.RECENT_ADDRESSES);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    /**
     * Add address to recent history (after successful send)
     * @param {string} address
     * @param {string} label - Optional label (token symbol sent)
     */
    function addRecentAddress(address, label = '') {
        try {
            const recent = getRecentAddresses();

            // Remove if already exists (to move to top)
            const filtered = recent.filter(r =>
                r.address.toLowerCase() !== address.toLowerCase()
            );

            // Add to beginning
            filtered.unshift({
                address: address,
                timestamp: Date.now(),
                label: label
            });

            // Keep max 50 entries
            const trimmed = filtered.slice(0, 50);
            localStorage.setItem(KEYS.RECENT_ADDRESSES, JSON.stringify(trimmed));
        } catch {
            // Storage error - non-critical
        }
    }

    /**
     * Check if address has been sent to before
     * @param {string} address
     * @returns {boolean}
     */
    function isKnownAddress(address) {
        if (!address) return false;
        const recent = getRecentAddresses();
        return recent.some(r =>
            r.address.toLowerCase() === address.toLowerCase()
        );
    }

    /**
     * Get storage usage
     * @returns {Object}
     */
    function getStorageUsage() {
        let total = 0;
        Object.values(KEYS).forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                total += item.length * 2; // UTF-16
            }
        });

        return {
            bytes: total,
            kb: (total / 1024).toFixed(2),
            mb: (total / (1024 * 1024)).toFixed(4)
        };
    }

    /**
     * Get security audit log
     * @returns {Object}
     */
    function getSecurityAudit() {
        const security = getSecurityData() || {};
        const metadata = getMetadata() || {};

        return {
            totalFailedAttempts: security.totalAttempts || 0,
            currentFailedStreak: security.failedAttempts || 0,
            lastFailedAttempt: security.lastAttempt ? new Date(security.lastAttempt).toISOString() : null,
            lastSuccessfulLogin: security.lastSuccess ? new Date(security.lastSuccess).toISOString() : null,
            walletCreatedAt: metadata.createdAt ? new Date(metadata.createdAt).toISOString() : null,
            lastAccess: metadata.lastAccess ? new Date(metadata.lastAccess).toISOString() : null
        };
    }

    // Initialize on load
    try {
        init();
    } catch (e) {
        // Will be handled by app
    }

    // Public API
    return {
        hasWallet,
        saveWallet,
        getWallet,
        getMetadata,
        updateMetadata,
        getSettings,
        saveSettings,
        deleteWallet,
        clearAll,
        exportBackup,
        importBackup,
        getStorageUsage,
        getSecurityAudit,
        checkBruteForceProtection,
        recordFailedAttempt,
        resetFailedAttempts,
        isStorageAvailable,
        // Recent addresses
        getRecentAddresses,
        addRecentAddress,
        isKnownAddress
    };
})();

// Prevent modifications
Object.freeze(StorageModule);
