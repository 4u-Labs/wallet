/**
 * Secureon Wallet - Tokens Module
 * ERC-20 Token definitions, validation, and security
 * Enhanced with verified token system and contract validation
 */

'use strict';

const TokensModule = (function () {
    // ERC-20 ABI (minimal for balanceOf, transfer, decimals, symbol, name)
    const ERC20_ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)'
    ];

    // Token verification status
    const VERIFICATION_STATUS = {
        VERIFIED: 'verified',           // Official token list
        UNVERIFIED: 'unverified',       // User-added or unknown
        SUSPICIOUS: 'suspicious',       // Data mismatch detected
        INVALID: 'invalid'              // Contract validation failed
    };

    // Token definitions with contract addresses per network
    // All tokens in this list are marked as verified = true
    const TOKENS = {
        ETH: {
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            isNative: true,
            verified: true,
            icon: '⟠',
            color: '#627EEA',
            coingeckoId: 'ethereum',
            contracts: {}
        },
        USDT: {
            symbol: 'USDT',
            name: 'Tether USD',
            decimals: 6,
            verified: true,
            icon: '₮',
            color: '#26A17B',
            coingeckoId: 'tether',
            contracts: {
                mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                sepolia: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06'
            }
        },
        USDC: {
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            verified: true,
            icon: '$',
            color: '#2775CA',
            coingeckoId: 'usd-coin',
            contracts: {
                mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
            }
        },
        DAI: {
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            decimals: 18,
            verified: true,
            icon: '◈',
            color: '#F5AC37',
            coingeckoId: 'dai',
            contracts: {
                mainnet: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                sepolia: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6'
            }
        },
        WETH: {
            symbol: 'WETH',
            name: 'Wrapped Ether',
            decimals: 18,
            verified: true,
            icon: '⟠',
            color: '#EC1C79',
            coingeckoId: 'weth',
            contracts: {
                mainnet: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
                sepolia: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
            }
        },
        WBTC: {
            symbol: 'WBTC',
            name: 'Wrapped Bitcoin',
            decimals: 8,
            verified: true,
            icon: '₿',
            color: '#F7931A',
            coingeckoId: 'wrapped-bitcoin',
            contracts: {
                mainnet: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
                sepolia: '0x29f2D40B0605204364af54EC677bD022dA425d03'
            }
        },
        LINK: {
            symbol: 'LINK',
            name: 'Chainlink',
            decimals: 18,
            verified: true,
            icon: '⬡',
            color: '#375BD2',
            coingeckoId: 'chainlink',
            contracts: {
                mainnet: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
                sepolia: '0x779877A7B0D9E8603169DdbD7836e478b4624789'
            }
        },
        UNI: {
            symbol: 'UNI',
            name: 'Uniswap',
            decimals: 18,
            verified: true,
            icon: '🦄',
            color: '#FF007A',
            coingeckoId: 'uniswap',
            contracts: {
                mainnet: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
                sepolia: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
            }
        },
        LDO: {
            symbol: 'LDO',
            name: 'Lido DAO',
            decimals: 18,
            verified: true,
            icon: '🌊',
            color: '#00A3FF',
            coingeckoId: 'lido-dao',
            contracts: {
                mainnet: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32'
            }
        },
        AAVE: {
            symbol: 'AAVE',
            name: 'Aave',
            decimals: 18,
            verified: true,
            icon: '👻',
            color: '#B6509E',
            coingeckoId: 'aave',
            contracts: {
                mainnet: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
                sepolia: '0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a'
            }
        },
        MKR: {
            symbol: 'MKR',
            name: 'Maker',
            decimals: 18,
            verified: true,
            icon: '◆',
            color: '#1AAB9B',
            coingeckoId: 'maker',
            contracts: {
                mainnet: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'
            }
        },
        CRV: {
            symbol: 'CRV',
            name: 'Curve DAO',
            decimals: 18,
            verified: true,
            icon: '📈',
            color: '#FF0000',
            coingeckoId: 'curve-dao-token',
            contracts: {
                mainnet: '0xD533a949740bb3306d119CC777fa900bA034cd52'
            }
        },
        COMP: {
            symbol: 'COMP',
            name: 'Compound',
            decimals: 18,
            verified: true,
            icon: '🏛',
            color: '#00D395',
            coingeckoId: 'compound-governance-token',
            contracts: {
                mainnet: '0xc00e94Cb662C3520282E6f5717214004A7f26888'
            }
        },
        SNX: {
            symbol: 'SNX',
            name: 'Synthetix',
            decimals: 18,
            verified: true,
            icon: '⚡',
            color: '#00D1FF',
            coingeckoId: 'havven',
            contracts: {
                mainnet: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'
            }
        },
        BAL: {
            symbol: 'BAL',
            name: 'Balancer',
            decimals: 18,
            verified: true,
            icon: '⚖',
            color: '#1E1E1E',
            coingeckoId: 'balancer',
            contracts: {
                mainnet: '0xba100000625a3754423978a60c9317c58a424e3D'
            }
        },
        SUSHI: {
            symbol: 'SUSHI',
            name: 'SushiSwap',
            decimals: 18,
            verified: true,
            icon: '🍣',
            color: '#FA52A0',
            coingeckoId: 'sushi',
            contracts: {
                mainnet: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2'
            }
        },
        '1INCH': {
            symbol: '1INCH',
            name: '1inch',
            decimals: 18,
            verified: true,
            icon: '🦄',
            color: '#94A6C3',
            coingeckoId: '1inch',
            contracts: {
                mainnet: '0x111111111117dC0aa78b770fA6A738034120C302'
            }
        },
        GRT: {
            symbol: 'GRT',
            name: 'The Graph',
            decimals: 18,
            verified: true,
            icon: '📊',
            color: '#6747ED',
            coingeckoId: 'the-graph',
            contracts: {
                mainnet: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7'
            }
        },
        ENS: {
            symbol: 'ENS',
            name: 'Ethereum Name Service',
            decimals: 18,
            verified: true,
            icon: '🔷',
            color: '#5298FF',
            coingeckoId: 'ethereum-name-service',
            contracts: {
                mainnet: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72'
            }
        },
        RPL: {
            symbol: 'RPL',
            name: 'Rocket Pool',
            decimals: 18,
            verified: true,
            icon: '🚀',
            color: '#FF6E30',
            coingeckoId: 'rocket-pool',
            contracts: {
                mainnet: '0xD33526068D116cE69F19A9ee46F0bd304F21A51f'
            }
        },
        FRAX: {
            symbol: 'FRAX',
            name: 'Frax',
            decimals: 18,
            verified: true,
            icon: '⨎',
            color: '#000000',
            coingeckoId: 'frax',
            contracts: {
                mainnet: '0x853d955aCEf822Db058eb8505911ED77F175b99e'
            }
        },
        TUSD: {
            symbol: 'TUSD',
            name: 'TrueUSD',
            decimals: 18,
            verified: true,
            icon: '$',
            color: '#002868',
            coingeckoId: 'true-usd',
            contracts: {
                mainnet: '0x0000000000085d4780B73119b644AE5ecd22b376'
            }
        },
        PYUSD: {
            symbol: 'PYUSD',
            name: 'PayPal USD',
            decimals: 6,
            verified: true,
            icon: 'P',
            color: '#003087',
            coingeckoId: 'paypal-usd',
            contracts: {
                mainnet: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'
            }
        },
        SHIB: {
            symbol: 'SHIB',
            name: 'Shiba Inu',
            decimals: 18,
            verified: true,
            icon: '🐕',
            color: '#FFA409',
            coingeckoId: 'shiba-inu',
            contracts: {
                mainnet: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
            }
        },
        PEPE: {
            symbol: 'PEPE',
            name: 'Pepe',
            decimals: 18,
            verified: true,
            icon: '🐸',
            color: '#479F53',
            coingeckoId: 'pepe',
            contracts: {
                mainnet: '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
            }
        },
        MANA: {
            symbol: 'MANA',
            name: 'Decentraland',
            decimals: 18,
            verified: true,
            icon: '🌐',
            color: '#FF2D55',
            coingeckoId: 'decentraland',
            contracts: {
                mainnet: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942'
            }
        },
        SAND: {
            symbol: 'SAND',
            name: 'The Sandbox',
            decimals: 18,
            verified: true,
            icon: '🏝',
            color: '#00ADEF',
            coingeckoId: 'the-sandbox',
            contracts: {
                mainnet: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0'
            }
        },
        AXS: {
            symbol: 'AXS',
            name: 'Axie Infinity',
            decimals: 18,
            verified: true,
            icon: '🎮',
            color: '#0055D5',
            coingeckoId: 'axie-infinity',
            contracts: {
                mainnet: '0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b'
            }
        },
        BAT: {
            symbol: 'BAT',
            name: 'Basic Attention Token',
            decimals: 18,
            verified: true,
            icon: '🦁',
            color: '#FF5000',
            coingeckoId: 'basic-attention-token',
            contracts: {
                mainnet: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'
            }
        },
        ZRX: {
            symbol: 'ZRX',
            name: '0x Protocol',
            decimals: 18,
            verified: true,
            icon: '⬢',
            color: '#302C2C',
            coingeckoId: '0x',
            contracts: {
                mainnet: '0xE41d2489571d322189246DaFA5ebDe1F4699F498'
            }
        }
    };

    // FIX #6: Storage key for custom tokens persistence
    const CUSTOM_TOKENS_KEY = 'secureeth_custom_tokens_v2';

    // Custom tokens added by user — persisted to localStorage
    let customTokens = loadCustomTokens();

    /**
     * Load custom tokens from localStorage
     * @returns {Object}
     */
    function loadCustomTokens() {
        try {
            const data = localStorage.getItem(CUSTOM_TOKENS_KEY);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    /**
     * Save custom tokens to localStorage
     */
    function saveCustomTokens() {
        try {
            localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(customTokens));
        } catch {
            // Storage might be full — non-critical
        }
    }

    // Contract validation cache
    let contractValidationCache = {
        data: {},
        ttl: 300000 // 5 minutes
    };

    // Price cache
    let priceCache = {
        data: {},
        lastUpdate: 0,
        ttl: 60000 // 1 minute cache
    };

    // Token balances cache
    let balanceCache = {
        data: {},
        lastUpdate: 0,
        ttl: 30000 // 30 seconds cache
    };

    /**
     * Get all supported tokens (built-in + custom)
     * @returns {Object}
     */
    function getAllTokens() {
        return { ...TOKENS, ...customTokens };
    }

    /**
     * Get token by symbol
     * Uses contract address as primary identifier for duplicates
     * @param {string} symbol
     * @param {string} contractAddress - Optional, for disambiguation
     * @returns {Object|null}
     */
    function getToken(symbol, contractAddress = null) {
        const allTokens = getAllTokens();
        const upperSymbol = symbol.toUpperCase();

        // If contract address provided, use it for exact match
        if (contractAddress) {
            const normalizedAddress = contractAddress.toLowerCase();
            for (const [key, token] of Object.entries(allTokens)) {
                if (token.contracts) {
                    for (const addr of Object.values(token.contracts)) {
                        if (addr.toLowerCase() === normalizedAddress) {
                            return token;
                        }
                    }
                }
            }
        }

        // Fallback to symbol match
        return allTokens[upperSymbol] || null;
    }

    /**
     * Get token by contract address
     * @param {string} contractAddress
     * @param {string} network
     * @returns {Object|null}
     */
    function getTokenByContract(contractAddress, network) {
        if (!contractAddress) return null;

        const normalizedAddress = contractAddress.toLowerCase();
        const allTokens = getAllTokens();

        for (const [symbol, token] of Object.entries(allTokens)) {
            if (token.contracts && token.contracts[network]) {
                if (token.contracts[network].toLowerCase() === normalizedAddress) {
                    return { symbol, ...token };
                }
            }
        }

        return null;
    }

    /**
     * Check if token is from official list (verified)
     * @param {string} symbol
     * @returns {boolean}
     */
    function isVerifiedToken(symbol) {
        const token = TOKENS[symbol.toUpperCase()];
        return token?.verified === true;
    }

    /**
     * Get verification status for a token
     * @param {string} symbol
     * @param {string} contractAddress
     * @returns {string}
     */
    function getVerificationStatus(symbol, contractAddress = null) {
        const token = getToken(symbol, contractAddress);

        if (!token) {
            return VERIFICATION_STATUS.INVALID;
        }

        if (token.verified === true) {
            return VERIFICATION_STATUS.VERIFIED;
        }

        if (token.suspicious === true) {
            return VERIFICATION_STATUS.SUSPICIOUS;
        }

        return VERIFICATION_STATUS.UNVERIFIED;
    }

    /**
     * Get tokens available on a specific network
     * Validates that contract exists for the network
     * @param {string} network - mainnet, sepolia, goerli
     * @returns {Array} Array of token objects with contractAddress
     */
    function getTokensForNetwork(network) {
        const available = [];
        const allTokens = getAllTokens();

        for (const [symbol, token] of Object.entries(allTokens)) {
            // Include native ETH always
            if (token.isNative) {
                available.push({
                    symbol,
                    ...token,
                    contractAddress: null,
                    verificationStatus: VERIFICATION_STATUS.VERIFIED
                });
            }
            // Include ERC-20 only if contract exists for this network
            else if (token.contracts && token.contracts[network]) {
                available.push({
                    symbol,
                    ...token,
                    contractAddress: token.contracts[network],
                    verificationStatus: getVerificationStatus(symbol)
                });
            }
        }
        return available;
    }

    /**
     * Get token contract address for network
     * @param {string} symbol
     * @param {string} network
     * @returns {string|null}
     */
    function getTokenAddress(symbol, network) {
        const token = getToken(symbol);
        if (!token) return null;
        if (token.isNative) return null;
        return token.contracts?.[network] || null;
    }

    /**
     * Check if token has contract on network
     * @param {string} symbol
     * @param {string} network
     * @returns {boolean}
     */
    function hasContractOnNetwork(symbol, network) {
        const token = getToken(symbol);
        if (!token) return false;
        if (token.isNative) return true;
        return !!(token.contracts && token.contracts[network]);
    }

    /**
     * Validate ERC-20 contract on-chain
     * Checks if contract responds to standard ERC-20 functions
     * @param {string} contractAddress
     * @param {Object} provider - ethers provider
     * @returns {Promise<{valid: boolean, data?: Object, error?: string}>}
     */
    async function validateContract(contractAddress, provider) {
        // Check cache first
        const cacheKey = `${contractAddress}_${Date.now()}`;
        const cached = contractValidationCache.data[contractAddress];
        if (cached && (Date.now() - cached.timestamp) < contractValidationCache.ttl) {
            return cached.result;
        }

        try {
            // Validate address format
            if (!contractAddress ||
                typeof contractAddress !== 'string' ||
                !contractAddress.startsWith('0x') ||
                contractAddress.length !== 42) {
                return { valid: false, error: 'Invalid address format' };
            }

            // Check if address has code (is a contract)
            const code = await provider.getCode(contractAddress);
            if (code === '0x' || code === '0x0') {
                return { valid: false, error: 'Address is not a contract' };
            }

            // Create contract instance
            const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

            // Try to call standard ERC-20 functions
            const [symbol, name, decimals] = await Promise.all([
                contract.symbol().catch(() => null),
                contract.name().catch(() => null),
                contract.decimals().catch(() => null)
            ]);

            // Validate responses
            if (symbol === null || decimals === null) {
                return {
                    valid: false,
                    error: 'Contract does not implement ERC-20 interface'
                };
            }

            // Validate decimals is a reasonable number
            const decNum = Number(decimals);
            if (isNaN(decNum) || decNum < 0 || decNum > 18) {
                return {
                    valid: false,
                    error: 'Invalid decimals value'
                };
            }

            const result = {
                valid: true,
                data: {
                    symbol: String(symbol),
                    name: String(name || symbol),
                    decimals: decNum,
                    address: contractAddress
                }
            };

            // Cache result
            contractValidationCache.data[contractAddress] = {
                timestamp: Date.now(),
                result
            };

            return result;
        } catch (error) {
            console.debug('Contract validation failed:', error.message);
            return {
                valid: false,
                error: error.message || 'Contract validation failed'
            };
        }
    }

    /**
     * Validate token data against CoinGecko (optional)
     * @param {string} coingeckoId
     * @param {string} expectedSymbol
     * @param {string} expectedName
     * @returns {Promise<{valid: boolean, suspicious: boolean, reason?: string}>}
     */
    async function validateWithCoinGecko(coingeckoId, expectedSymbol, expectedName) {
        if (!coingeckoId) {
            return { valid: true, suspicious: false };
        }

        try {
            const response = await fetch(
                `https://api.coingecko.com/api/v3/coins/${coingeckoId}`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                }
            );

            if (!response.ok) {
                // API failed, don't block - just return as unverified
                return { valid: true, suspicious: false };
            }

            const data = await response.json();

            // Check if symbol matches
            const cgSymbol = data.symbol?.toUpperCase();
            const expSymbol = expectedSymbol?.toUpperCase();

            if (cgSymbol && expSymbol && cgSymbol !== expSymbol) {
                return {
                    valid: true,
                    suspicious: true,
                    reason: `Symbol mismatch: expected ${expSymbol}, got ${cgSymbol}`
                };
            }

            return { valid: true, suspicious: false };
        } catch (error) {
            // API failure - don't block, just log
            console.debug('CoinGecko validation failed:', error.message);
            return { valid: true, suspicious: false };
        }
    }

    /**
     * Full token validation before sending
     * @param {string} symbol
     * @param {string} network
     * @param {Object} provider
     * @returns {Promise<{valid: boolean, warnings: string[], errors: string[]}>}
     */
    async function validateTokenForSend(symbol, network, provider) {
        const warnings = [];
        const errors = [];

        const token = getToken(symbol);

        if (!token) {
            errors.push('Token não encontrado');
            return { valid: false, warnings, errors };
        }

        // Native ETH doesn't need contract validation
        if (token.isNative) {
            return { valid: true, warnings, errors };
        }

        const contractAddress = token.contracts?.[network];

        if (!contractAddress) {
            errors.push(`Token não disponível na rede ${network}`);
            return { valid: false, warnings, errors };
        }

        // Validate contract on-chain
        const contractValidation = await validateContract(contractAddress, provider);

        if (!contractValidation.valid) {
            errors.push(`Contrato inválido: ${contractValidation.error}`);
            return { valid: false, warnings, errors };
        }

        // Check if decimals match
        if (contractValidation.data.decimals !== token.decimals) {
            warnings.push(`Decimals diferente: esperado ${token.decimals}, contrato retornou ${contractValidation.data.decimals}`);
        }

        // Check verification status
        if (!isVerifiedToken(symbol)) {
            warnings.push('Token não verificado - verifique o endereço do contrato');
        }

        // Optional: Validate with CoinGecko
        if (token.coingeckoId) {
            const cgValidation = await validateWithCoinGecko(
                token.coingeckoId,
                symbol,
                token.name
            );

            if (cgValidation.suspicious) {
                warnings.push(`Aviso CoinGecko: ${cgValidation.reason}`);
            }
        }

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Add custom token (user-defined)
     * @param {Object} tokenData
     * @returns {{success: boolean, error?: string}}
     */
    function addCustomToken(tokenData) {
        const { symbol, name, decimals, contractAddress, network } = tokenData;

        // Validate required fields
        if (!symbol || !name || decimals === undefined || !contractAddress || !network) {
            return { success: false, error: 'Campos obrigatórios faltando' };
        }

        // Validate decimals
        const decNum = Number(decimals);
        if (isNaN(decNum) || decNum < 0 || decNum > 18) {
            return { success: false, error: 'Decimals inválido' };
        }

        // Check for duplicate by contract address
        const existing = getTokenByContract(contractAddress, network);
        if (existing) {
            return { success: false, error: `Token já existe: ${existing.symbol}` };
        }

        // Create unique key using contract address to avoid symbol collisions
        const key = `CUSTOM_${symbol.toUpperCase()}_${contractAddress.slice(0, 8)}`;

        customTokens[key] = {
            symbol: symbol.toUpperCase(),
            name,
            decimals: decNum,
            verified: false, // Custom tokens are never verified
            icon: symbol.charAt(0).toUpperCase(),
            color: '#888888',
            contracts: {
                [network]: contractAddress
            },
            isCustom: true
        };

        // FIX #6: Persist custom tokens
        saveCustomTokens();

        return { success: true };
    }

    /**
     * Remove custom token
     * @param {string} contractAddress
     * @param {string} network
     * @returns {boolean}
     */
    function removeCustomToken(contractAddress, network) {
        for (const [key, token] of Object.entries(customTokens)) {
            if (token.contracts?.[network]?.toLowerCase() === contractAddress.toLowerCase()) {
                delete customTokens[key];
                // FIX #6: Persist removal
                saveCustomTokens();
                return true;
            }
        }
        return false;
    }

    /**
     * Get ERC-20 ABI
     * @returns {Array}
     */
    function getERC20ABI() {
        return ERC20_ABI;
    }

    /**
     * Format token amount based on decimals
     * @param {string|bigint} amount - Raw amount
     * @param {number} decimals
     * @param {number} displayDecimals - Decimals to show
     * @returns {string}
     */
    function formatTokenAmount(amount, decimals, displayDecimals = 6) {
        try {
            const value = typeof amount === 'bigint' ? amount : BigInt(amount);
            const divisor = BigInt(10 ** decimals);
            const intPart = value / divisor;
            const fracPart = value % divisor;

            const fracStr = fracPart.toString().padStart(decimals, '0');
            const trimmedFrac = fracStr.slice(0, displayDecimals);

            if (parseInt(trimmedFrac) === 0) {
                return intPart.toString();
            }

            return `${intPart}.${trimmedFrac.replace(/0+$/, '')}`;
        } catch (e) {
            return '0';
        }
    }

    /**
     * Parse token amount to raw value
     * @param {string} amount - Human readable amount
     * @param {number} decimals
     * @returns {bigint}
     */
    function parseTokenAmount(amount, decimals) {
        try {
            const [intPart, fracPart = ''] = amount.split('.');
            const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
            return BigInt(intPart + paddedFrac);
        } catch (e) {
            return BigInt(0);
        }
    }

    /**
     * Fetch token prices from CoinGecko
     * @param {Array} symbols - Token symbols to fetch
     * @returns {Promise<Object>}
     */
    async function fetchPrices(symbols = null) {
        const now = Date.now();

        if (priceCache.lastUpdate && (now - priceCache.lastUpdate) < priceCache.ttl) {
            return priceCache.data;
        }

        try {
            const allTokens = getAllTokens();
            const tokensToFetch = symbols || Object.keys(allTokens);
            const ids = tokensToFetch
                .map(s => allTokens[s.toUpperCase()]?.coingeckoId)
                .filter(id => id)
                .join(',');

            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                }
            );

            if (!response.ok) {
                throw new Error('Price fetch failed');
            }

            const data = await response.json();

            const prices = {};
            for (const [symbol, token] of Object.entries(allTokens)) {
                if (token.coingeckoId && data[token.coingeckoId]) {
                    prices[symbol] = {
                        usd: data[token.coingeckoId].usd || 0,
                        change24h: data[token.coingeckoId].usd_24h_change || 0
                    };
                }
            }

            priceCache.data = prices;
            priceCache.lastUpdate = now;

            return prices;
        } catch (error) {
            console.warn('Failed to fetch prices:', error.message);
            return priceCache.data || {};
        }
    }

    /**
     * Get cached price for a token
     * @param {string} symbol
     * @returns {Object|null}
     */
    function getPrice(symbol) {
        return priceCache.data[symbol.toUpperCase()] || null;
    }

    /**
     * Calculate total portfolio value in USD
     * @param {Object} balances - {symbol: {formatted: string}}
     * @returns {number}
     */
    function calculatePortfolioValue(balances) {
        let total = 0;
        for (const [symbol, balanceData] of Object.entries(balances)) {
            const price = getPrice(symbol);
            const amount = parseFloat(balanceData.formatted || balanceData || 0);
            if (price && price.usd && amount > 0) {
                total += amount * price.usd;
            }
        }
        return total;
    }

    /**
     * Sort tokens by value
     * @param {Object} balances - {symbol: {formatted: string, raw: bigint}}
     * @returns {Array}
     */
    function sortTokensByValue(balances) {
        const tokenList = [];

        for (const [symbol, balanceData] of Object.entries(balances)) {
            const token = getToken(symbol);
            if (!token) continue;

            const price = getPrice(symbol);
            const amountStr = balanceData.formatted || '0';
            const amountNum = parseFloat(amountStr);
            const valueUsd = price ? amountNum * price.usd : 0;

            tokenList.push({
                symbol,
                name: token.name,
                icon: token.icon,
                color: token.color,
                decimals: token.decimals,
                isNative: token.isNative || false,
                verified: token.verified || false,
                isCustom: token.isCustom || false,
                balance: amountStr,
                balanceRaw: balanceData.raw || BigInt(0),
                balanceFormatted: amountNum > 0 ? amountNum.toFixed(Math.min(6, token.decimals)) : '0',
                priceUsd: price?.usd || 0,
                valueUsd,
                change24h: price?.change24h || 0,
                hasBalance: amountNum > 0,
                verificationStatus: getVerificationStatus(symbol)
            });
        }

        return tokenList.sort((a, b) => {
            if (b.valueUsd !== a.valueUsd) {
                return b.valueUsd - a.valueUsd;
            }
            return a.symbol.localeCompare(b.symbol);
        });
    }

    /**
     * Get token icon HTML with verification badge
     * @param {string} symbol
     * @param {string} size - sm, md, lg
     * @param {boolean} showVerification - Show verification badge
     * @returns {string}
     */
    function getTokenIcon(symbol, size = 'md', showVerification = false) {
        const token = getToken(symbol);
        if (!token) return '';

        const sizes = {
            sm: 'w-6 h-6 text-xs',
            md: 'w-8 h-8 text-sm',
            lg: 'w-10 h-10 text-base'
        };

        const sizeClass = sizes[size] || sizes.md;
        const bgColor = token.color || '#6366f1';

        let verificationBadge = '';
        if (showVerification) {
            if (token.verified) {
                verificationBadge = `
                    <span class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center" title="Verificado">
                        <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </span>
                `;
            } else {
                verificationBadge = `
                    <span class="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center" title="Não verificado">
                        <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </span>
                `;
            }
        }

        return `
            <div class="token-icon relative ${sizeClass} rounded-full flex items-center justify-center font-bold"
                 style="background-color: ${bgColor}20; color: ${bgColor}; border: 1px solid ${bgColor}40;">
                ${token.icon || symbol.charAt(0)}
                ${verificationBadge}
            </div>
        `;
    }

    /**
     * Validate token transfer parameters
     * @param {Object} params
     * @returns {{valid: boolean, errors: string[]}}
     */
    function validateTransfer(params) {
        const errors = [];
        const { symbol, to, amount, balance } = params;

        const token = getToken(symbol);
        if (!token) {
            errors.push('Token não suportado');
            return { valid: false, errors };
        }

        if (!to || !to.startsWith('0x') || to.length !== 42) {
            errors.push('Endereço de destino inválido');
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            errors.push('Valor deve ser maior que zero');
        }

        const balanceNum = parseFloat(balance);
        if (amountNum > balanceNum) {
            errors.push('Saldo insuficiente');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get popular/featured tokens
     * @returns {Array}
     */
    function getFeaturedTokens() {
        return ['ETH', 'USDT', 'USDC', 'WETH', 'WBTC', 'LINK', 'UNI', 'AAVE'];
    }

    /**
     * Search tokens by name or symbol
     * @param {string} query
     * @returns {Array}
     */
    function searchTokens(query) {
        const q = query.toLowerCase();
        const results = [];
        const allTokens = getAllTokens();

        for (const [symbol, token] of Object.entries(allTokens)) {
            if (symbol.toLowerCase().includes(q) ||
                token.name.toLowerCase().includes(q)) {
                results.push({
                    symbol,
                    ...token,
                    verificationStatus: getVerificationStatus(symbol)
                });
            }
        }

        return results;
    }

    /**
     * Update balance cache
     * @param {Object} balances
     */
    function updateBalanceCache(balances) {
        balanceCache.data = balances;
        balanceCache.lastUpdate = Date.now();
    }

    /**
     * Get cached balances
     * @returns {Object}
     */
    function getCachedBalances() {
        const now = Date.now();
        if (balanceCache.lastUpdate && (now - balanceCache.lastUpdate) < balanceCache.ttl) {
            return balanceCache.data;
        }
        return null;
    }

    /**
     * Clear validation cache
     */
    function clearValidationCache() {
        contractValidationCache.data = {};
    }

    // Public API
    return {
        // Token getters
        getAllTokens,
        getToken,
        getTokenByContract,
        getTokensForNetwork,
        getTokenAddress,
        hasContractOnNetwork,

        // Verification
        isVerifiedToken,
        getVerificationStatus,
        validateContract,
        validateWithCoinGecko,
        validateTokenForSend,
        VERIFICATION_STATUS,

        // Custom tokens
        addCustomToken,
        removeCustomToken,

        // Utils
        getERC20ABI,
        formatTokenAmount,
        parseTokenAmount,

        // Prices
        fetchPrices,
        getPrice,
        calculatePortfolioValue,

        // UI helpers
        sortTokensByValue,
        getTokenIcon,
        validateTransfer,
        getFeaturedTokens,
        searchTokens,

        // Cache
        updateBalanceCache,
        getCachedBalances,
        clearValidationCache
    };
})();

// Prevent modifications
Object.freeze(TokensModule);
