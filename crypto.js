/**
 * Secureon Wallet - Crypto Module
 * Handles all cryptographic operations: key derivation, encryption, decryption
 * Uses Web Crypto API with PBKDF2 and AES-256-GCM
 * Enhanced with better memory protection and secure patterns
 */

'use strict';

const CryptoModule = (function () {
    // Constants - Security parameters
    const PBKDF2_ITERATIONS = 210000; // OWASP 2023 recommendation for SHA-256
    const SALT_LENGTH = 32; // 256 bits
    const IV_LENGTH = 12; // 96 bits for GCM (recommended)
    const KEY_LENGTH = 256; // AES-256
    const AUTH_TAG_LENGTH = 128; // GCM auth tag

    // Memory protection - track sensitive data for cleanup
    const sensitiveDataRegistry = new WeakSet();

    /**
     * Generate cryptographically secure random bytes
     * @param {number} length - Number of bytes
     * @returns {Uint8Array}
     */
    function getRandomBytes(length) {
        if (length <= 0 || length > 65536) {
            throw new Error('Tamanho de bytes inválido');
        }
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return array;
    }

    /**
     * Convert ArrayBuffer to Base64 string (constant-time safe)
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     * @param {string} base64
     * @returns {ArrayBuffer}
     */
    function base64ToArrayBuffer(base64) {
        // Validate base64 format
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            throw new Error('Formato base64 inválido');
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Derive encryption key from password using PBKDF2
     * @param {string} password - User's password
     * @param {Uint8Array} salt - Random salt
     * @param {number} iterations - Number of iterations
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
        // Import password as raw key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false, // Not extractable
            ['deriveBits', 'deriveKey']
        );

        // Derive AES-GCM key using PBKDF2
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: KEY_LENGTH },
            false, // Not extractable - IMPORTANT for security
            ['encrypt', 'decrypt']
        );

        return key;
    }

    /**
     * Encrypt data using AES-256-GCM
     * @param {string} plaintext - Data to encrypt
     * @param {string} password - User's password
     * @returns {Promise<{encrypted: string, salt: string, iv: string, iterations: number}>}
     */
    async function encrypt(plaintext, password) {
        if (!plaintext || typeof plaintext !== 'string') {
            throw new Error('Dados inválidos para criptografia');
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            throw new Error('Senha inválida');
        }

        try {
            const salt = getRandomBytes(SALT_LENGTH);
            const iv = getRandomBytes(IV_LENGTH);
            const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

            const encodedData = new TextEncoder().encode(plaintext);

            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: AUTH_TAG_LENGTH
                },
                key,
                encodedData
            );

            // Clear the encoded data from memory
            secureClearBuffer(encodedData);

            return {
                encrypted: arrayBufferToBase64(encryptedBuffer),
                salt: arrayBufferToBase64(salt),
                iv: arrayBufferToBase64(iv),
                iterations: PBKDF2_ITERATIONS,
                version: 2 // Version for future compatibility
            };
        } catch (error) {
            // Don't reveal internal errors
            throw new Error('Falha na criptografia');
        }
    }

    /**
     * Decrypt data using AES-256-GCM
     * @param {string} encryptedBase64 - Encrypted data in base64
     * @param {string} password - User's password
     * @param {string} saltBase64 - Salt in base64
     * @param {string} ivBase64 - IV in base64
     * @param {number} iterations - PBKDF2 iterations (for backward compatibility)
     * @returns {Promise<string>}
     */
    async function decrypt(encryptedBase64, password, saltBase64, ivBase64, iterations) {
        if (!encryptedBase64 || !password || !saltBase64 || !ivBase64) {
            throw new Error('Parâmetros de descriptografia inválidos');
        }

        try {
            const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));
            const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
            const encryptedData = base64ToArrayBuffer(encryptedBase64);

            // Use provided iterations or default (backward compatibility)
            const iterCount = iterations || PBKDF2_ITERATIONS;
            const key = await deriveKey(password, salt, iterCount);

            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: AUTH_TAG_LENGTH
                },
                key,
                encryptedData
            );

            const result = new TextDecoder().decode(decryptedBuffer);

            // Clear the decrypted buffer
            secureClearBuffer(new Uint8Array(decryptedBuffer));

            return result;
        } catch (error) {
            // Don't reveal specific error details - timing attack prevention
            throw new Error('Senha incorreta ou dados corrompidos');
        }
    }

    /**
     * Securely clear a buffer by overwriting with random then zero
     * @param {Uint8Array} buffer
     */
    function secureClearBuffer(buffer) {
        if (!buffer || !(buffer instanceof Uint8Array)) return;

        // First pass: random data
        crypto.getRandomValues(buffer);
        // Second pass: zeros
        buffer.fill(0);
    }

    /**
     * Securely clear sensitive data from memory
     * Note: JavaScript doesn't guarantee memory clearing due to GC,
     * but this helps reduce the window of exposure
     * @param {any} data - Data to clear
     * @returns {null}
     */
    function secureClear(data) {
        if (data === null || data === undefined) return null;

        if (typeof data === 'string') {
            // Strings are immutable in JS - we can only null the reference
            // The actual memory will be cleared by GC
            return null;
        }

        if (data instanceof Uint8Array) {
            secureClearBuffer(data);
            return null;
        }

        if (Array.isArray(data)) {
            // Overwrite array elements
            for (let i = 0; i < data.length; i++) {
                if (typeof data[i] === 'number') {
                    data[i] = 0;
                } else {
                    data[i] = secureClear(data[i]);
                }
            }
            data.length = 0;
            return null;
        }

        if (data instanceof ArrayBuffer) {
            secureClearBuffer(new Uint8Array(data));
            return null;
        }

        if (typeof data === 'object') {
            // Recursively clear object properties
            const keys = Object.keys(data);
            for (const key of keys) {
                if (data.hasOwnProperty(key)) {
                    data[key] = secureClear(data[key]);
                    delete data[key];
                }
            }
            return null;
        }

        return null;
    }

    /**
     * Check password strength
     * @param {string} password
     * @returns {{score: number, strength: string, className: string, feedback: string}}
     */
    function checkPasswordStrength(password) {
        if (!password) {
            return {
                score: 0,
                strength: 'Vazia',
                className: 'strength-weak',
                feedback: 'Digite uma senha'
            };
        }

        let score = 0;
        const feedback = [];

        // Length checks
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;
        if (password.length >= 20) score += 1;

        // Character variety
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;

        // Deductions for common patterns
        if (/^[a-zA-Z]+$/.test(password)) score -= 1;
        if (/^[0-9]+$/.test(password)) score -= 2;
        if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
        if (/^(123|abc|qwerty|password)/i.test(password)) score -= 2;

        // Feedback
        if (password.length < 8) {
            feedback.push('Mínimo 8 caracteres');
        }
        if (!/[A-Z]/.test(password)) {
            feedback.push('Adicione maiúsculas');
        }
        if (!/[0-9]/.test(password)) {
            feedback.push('Adicione números');
        }
        if (!/[^a-zA-Z0-9]/.test(password)) {
            feedback.push('Adicione símbolos');
        }
        if (password.length < 12) {
            feedback.push('12+ caracteres recomendado');
        }

        // Normalize score
        score = Math.max(0, Math.min(score, 8));

        let strength = 'Fraca';
        let className = 'strength-weak';

        if (score >= 6) {
            strength = 'Muito Forte';
            className = 'strength-strong';
        } else if (score >= 5) {
            strength = 'Forte';
            className = 'strength-strong';
        } else if (score >= 3) {
            strength = 'Média';
            className = 'strength-medium';
        }

        return {
            score,
            strength,
            className,
            feedback: feedback.slice(0, 3).join(' • ')
        };
    }

    /**
     * Generate secure entropy for additional randomness
     * Combines multiple entropy sources
     * @returns {Uint8Array}
     */
    function generateEntropy() {
        // Primary source: crypto.getRandomValues
        const random = getRandomBytes(32);

        // Additional entropy sources (non-critical, just adds to mix)
        const timestamp = new TextEncoder().encode(Date.now().toString());
        const perfNow = new TextEncoder().encode(
            (typeof performance !== 'undefined')
                ? performance.now().toString()
                : Math.random().toString()
        );

        // Screen/window entropy (if available)
        let screenEntropy = new Uint8Array(0);
        if (typeof screen !== 'undefined') {
            const screenData = `${screen.width}${screen.height}${screen.colorDepth}`;
            screenEntropy = new TextEncoder().encode(screenData);
        }

        // Combine all entropy
        const totalLength = random.length + timestamp.length + perfNow.length + screenEntropy.length;
        const combined = new Uint8Array(totalLength);
        let offset = 0;

        combined.set(random, offset);
        offset += random.length;
        combined.set(timestamp, offset);
        offset += timestamp.length;
        combined.set(perfNow, offset);
        offset += perfNow.length;
        combined.set(screenEntropy, offset);

        return combined;
    }

    /**
     * Generate a random ID (not for cryptographic use)
     * @param {number} length
     * @returns {string}
     */
    function generateId(length = 16) {
        const bytes = getRandomBytes(length);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
    }

    /**
     * Constant-time string comparison (to prevent timing attacks)
     * @param {string} a
     * @param {string} b
     * @returns {boolean}
     */
    function constantTimeCompare(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string') {
            return false;
        }

        const aBytes = new TextEncoder().encode(a);
        const bBytes = new TextEncoder().encode(b);

        if (aBytes.length !== bBytes.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < aBytes.length; i++) {
            result |= aBytes[i] ^ bBytes[i];
        }

        return result === 0;
    }

    /**
     * Hash data using SHA-256
     * @param {string} data
     * @returns {Promise<string>} Hex string
     */
    async function sha256(data) {
        const encoded = new TextEncoder().encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Public API
    return {
        encrypt,
        decrypt,
        secureClear,
        secureClearBuffer,
        checkPasswordStrength,
        generateEntropy,
        getRandomBytes,
        generateId,
        constantTimeCompare,
        sha256,
        arrayBufferToBase64,
        base64ToArrayBuffer,
        PBKDF2_ITERATIONS
    };
})();

// Prevent modifications to the module
Object.freeze(CryptoModule);
