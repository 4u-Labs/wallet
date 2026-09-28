/**
 * Secureon Wallet - Blockchain Module
 * Handles all Ethereum blockchain interactions via RPC
 * Enhanced with RPC validation, chainId verification, and ERC-20 token support
 */

'use strict';

const BlockchainModule = (function() {
    // Network configurations with multiple RPC endpoints
    const NETWORKS = {
        mainnet: {
            name: 'Ethereum Mainnet',
            chainId: 1,
            rpcUrls: [
                'https://eth.llamarpc.com',
                'https://rpc.ankr.com/eth',
                'https://cloudflare-eth.com'
            ],
            explorer: 'https://etherscan.io',
            explorerApi: 'https://api.etherscan.io',
            symbol: 'ETH',
            isTestnet: false
        },
        sepolia: {
            name: 'Sepolia Testnet',
            chainId: 11155111,
            rpcUrls: [
                'https://rpc.sepolia.org',
                'https://rpc.ankr.com/eth_sepolia'
            ],
            explorer: 'https://sepolia.etherscan.io',
            explorerApi: 'https://api-sepolia.etherscan.io',
            symbol: 'SepoliaETH',
            isTestnet: true
        },
        goerli: {
            name: 'Goerli Testnet',
            chainId: 5,
            rpcUrls: [
                'https://rpc.ankr.com/eth_goerli'
            ],
            explorer: 'https://goerli.etherscan.io',
            explorerApi: 'https://api-goerli.etherscan.io',
            symbol: 'GoerliETH',
            isTestnet: true
        }
    };

    // ERC-20 ABI mínima
    const ERC20_ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)'
    ];

    // State
    let currentNetwork = 'mainnet';
    let provider = null;
    let rpcIndex = 0;
    let lastValidatedChainId = null;

    /**
     * Initialize blockchain module
     * @param {string} network - Network key
     */
    async function init(network = 'mainnet') {
        await switchNetwork(network);
    }

    /**
     * Create a provider for the current RPC
     * @returns {ethers.JsonRpcProvider}
     */
    function createProvider() {
        const networkConfig = NETWORKS[currentNetwork];
        const rpcUrl = networkConfig.rpcUrls[rpcIndex];
        
        return new ethers.JsonRpcProvider(rpcUrl, {
            chainId: networkConfig.chainId,
            name: networkConfig.name
        });
    }

    /**
     * Switch to next RPC endpoint on failure
     * @returns {boolean} True if switched, false if no more endpoints
     */
    function switchRpcEndpoint() {
        const networkConfig = NETWORKS[currentNetwork];
        const oldIndex = rpcIndex;
        rpcIndex = (rpcIndex + 1) % networkConfig.rpcUrls.length;
        
        // If we've cycled through all, return false
        if (rpcIndex === 0 && oldIndex !== 0) {
            return false;
        }
        
        provider = createProvider();
        return true;
    }

    /**
     * Get current RPC URL
     * @returns {string}
     */
    function getCurrentRpcUrl() {
        const networkConfig = NETWORKS[currentNetwork];
        return networkConfig.rpcUrls[rpcIndex];
    }

    /**
     * Validate RPC response chainId
     * @param {ethers.JsonRpcProvider} p
     * @returns {Promise<boolean>}
     */
    async function validateChainId(p) {
        const networkConfig = NETWORKS[currentNetwork];
        const network = await p.getNetwork();
        const chainId = Number(network.chainId);
        
        if (chainId !== networkConfig.chainId) {
            throw new Error(`ChainId inválido: esperado ${networkConfig.chainId}, recebido ${chainId}`);
        }
        
        lastValidatedChainId = chainId;
        return true;
    }

    /**
     * Execute RPC call with fallback and validation
     * @param {Function} action
     * @param {number} maxRetries
     * @param {boolean} validateChain - Whether to validate chainId
     * @returns {Promise<any>}
     */
    async function executeWithFallback(action, maxRetries = 3, validateChain = false) {
        let lastError;
        const triedEndpoints = new Set();
        
        for (let i = 0; i < maxRetries; i++) {
            const currentUrl = getCurrentRpcUrl();
            
            // Skip if we already tried this endpoint
            if (triedEndpoints.has(currentUrl)) {
                if (!switchRpcEndpoint()) {
                    break;
                }
                continue;
            }
            
            triedEndpoints.add(currentUrl);
            
            try {
                // Validate chainId if requested
                if (validateChain) {
                    await validateChainId(provider);
                }
                
                return await action(provider);
            } catch (error) {
                lastError = error;
                
                // If chainId validation failed, this is a security issue
                if (error.message && error.message.includes('ChainId')) {
                    throw error; // Don't retry, this is critical
                }
                
                // Try next endpoint
                if (!switchRpcEndpoint()) {
                    break;
                }
            }
        }
        
        throw lastError || new Error('Todos os endpoints RPC falharam');
    }

    /**
     * Switch network
     * @param {string} network
     * @returns {Promise<boolean>}
     */
    async function switchNetwork(network) {
        if (!NETWORKS[network]) {
            throw new Error('Rede não suportada');
        }

        currentNetwork = network;
        rpcIndex = 0;
        provider = createProvider();
        lastValidatedChainId = null;

        // Validate chainId on network switch
        try {
            await executeWithFallback(async (p) => {
                return await validateChainId(p);
            }, 3, false);

            // Save to settings
            const settings = StorageModule.getSettings();
            settings.network = network;
            StorageModule.saveSettings(settings);

            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get current network info
     * @returns {Object}
     */
    function getCurrentNetwork() {
        return {
            key: currentNetwork,
            ...NETWORKS[currentNetwork],
            currentRpc: getCurrentRpcUrl(),
            validatedChainId: lastValidatedChainId
        };
    }

    /**
     * Get all available networks
     * @returns {Object}
     */
    function getNetworks() {
        return NETWORKS;
    }

    /**
     * Get balance for address (ETH)
     * @param {string} address
     * @returns {Promise<{wei: bigint, eth: string}>}
     */
    async function getBalance(address) {
        if (!ethers.isAddress(address)) {
            throw new Error('Endereço inválido');
        }

        const balance = await executeWithFallback(async (p) => {
            // Validate chainId periodically
            await validateChainId(p);
            return await p.getBalance(address);
        }, 3, false);

        return {
            wei: balance,
            eth: ethers.formatEther(balance)
        };
    }

    /**
     * Validate ERC-20 contract before operations
     * Checks if contract exists and responds to standard functions
     * @param {string} tokenAddress - Token contract address
     * @returns {Promise<{valid: boolean, data?: Object, error?: string}>}
     */
    async function validateTokenContract(tokenAddress) {
        if (!ethers.isAddress(tokenAddress)) {
            return { valid: false, error: 'Endereço de token inválido' };
        }

        return await executeWithFallback(async (p) => {
            // Check if address has code (is a contract)
            const code = await p.getCode(tokenAddress);
            if (code === '0x' || code === '0x0') {
                return { valid: false, error: 'Endereço não é um contrato' };
            }

            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, p);

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
                    error: 'Contrato não implementa interface ERC-20' 
                };
            }

            const decNum = Number(decimals);
            if (isNaN(decNum) || decNum < 0 || decNum > 18) {
                return { valid: false, error: 'Valor de decimals inválido' };
            }

            return {
                valid: true,
                data: {
                    symbol: String(symbol),
                    name: String(name || symbol),
                    decimals: decNum,
                    address: tokenAddress
                }
            };
        }, 2, false);
    }

    /**
     * Get ERC-20 token balance with contract validation
     * @param {string} tokenAddress - Token contract address
     * @param {string} walletAddress - Wallet address
     * @param {number} decimals - Token decimals (optional, will fetch if not provided)
     * @param {boolean} skipValidation - Skip contract validation (use cached)
     * @returns {Promise<{raw: bigint, formatted: string, decimals: number, validated: boolean}>}
     */
    async function getTokenBalance(tokenAddress, walletAddress, decimals = null, skipValidation = false) {
        // Validate addresses
        if (!ethers.isAddress(tokenAddress)) {
            throw new Error('Endereço de token inválido');
        }
        if (!ethers.isAddress(walletAddress)) {
            throw new Error('Endereço de carteira inválido');
        }

        return await executeWithFallback(async (p) => {
            // Validate chainId before token operations
            await validateChainId(p);

            // Optional: Validate contract first (for security)
            if (!skipValidation) {
                const validation = await validateTokenContract(tokenAddress);
                if (!validation.valid) {
                    throw new Error(validation.error || 'Contrato inválido');
                }
            }
            
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, p);
            
            // Get balance
            const balance = await contract.balanceOf(walletAddress);
            
            // Get decimals if not provided
            let tokenDecimals = decimals;
            if (tokenDecimals === null) {
                try {
                    tokenDecimals = await contract.decimals();
                    tokenDecimals = Number(tokenDecimals);
                } catch {
                    tokenDecimals = 18; // Default to 18 if decimals() fails
                }
            }

            // Validate decimals is a valid number
            if (isNaN(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 18) {
                throw new Error('Decimals inválido');
            }
            
            return {
                raw: balance,
                formatted: ethers.formatUnits(balance, tokenDecimals),
                decimals: tokenDecimals,
                validated: true
            };
        }, 3, false);
    }

    /**
     * Get all token balances for a wallet
     * CORREÇÃO: Validação adicional de tokens e endereços de contrato
     * @param {string} walletAddress - Wallet address
     * @param {Array} tokens - Array of {symbol, contractAddress, decimals, isNative}
     * @returns {Promise<Object>} - {symbol: {raw, formatted, hasBalance, error?}}
     */
    async function getAllTokenBalances(walletAddress, tokens) {
        if (!ethers.isAddress(walletAddress)) {
            throw new Error('Endereço de carteira inválido');
        }

        // Verificação defensiva: garantir que tokens é um array válido
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return {};
        }

        const balances = {};

        // Process tokens in parallel with Promise.allSettled
        // This ensures one failure doesn't break all others
        const promises = tokens.map(async (token) => {
            // Verificação defensiva: ignorar tokens inválidos
            if (!token || !token.symbol) {
                return null;
            }

            try {
                if (token.isNative) {
                    // Native ETH balance
                    const ethBalance = await getBalance(walletAddress);
                    return {
                        symbol: token.symbol,
                        data: {
                            raw: ethBalance.wei,
                            formatted: ethBalance.eth,
                            hasBalance: parseFloat(ethBalance.eth) > 0,
                            decimals: 18
                        }
                    };
                } else if (token.contractAddress && 
                           typeof token.contractAddress === 'string' && 
                           token.contractAddress.length === 42 &&
                           token.contractAddress.startsWith('0x')) {
                    // ERC-20 token balance - validar endereço antes de consultar
                    if (!ethers.isAddress(token.contractAddress)) {
                        // Endereço de contrato inválido - ignorar silenciosamente
                        return {
                            symbol: token.symbol,
                            data: {
                                raw: BigInt(0),
                                formatted: '0',
                                hasBalance: false,
                                decimals: token.decimals || 18,
                                unavailable: true,
                                reason: 'invalid_contract'
                            }
                        };
                    }

                    const balance = await getTokenBalance(
                        token.contractAddress,
                        walletAddress,
                        token.decimals
                    );
                    return {
                        symbol: token.symbol,
                        data: {
                            raw: balance.raw,
                            formatted: balance.formatted,
                            hasBalance: parseFloat(balance.formatted) > 0,
                            decimals: balance.decimals
                        }
                    };
                } else {
                    // No contract for this network - ignorar silenciosamente
                    return {
                        symbol: token.symbol,
                        data: {
                            raw: BigInt(0),
                            formatted: '0',
                            hasBalance: false,
                            decimals: token.decimals || 18,
                            unavailable: true,
                            reason: 'no_contract'
                        }
                    };
                }
            } catch (error) {
                // Return error state but don't throw - falhas individuais não quebram o carregamento
                // Log apenas para debug
                console.debug(`Error fetching balance for ${token.symbol}:`, error.message);
                return {
                    symbol: token.symbol,
                    data: {
                        raw: BigInt(0),
                        formatted: '0',
                        hasBalance: false,
                        decimals: token.decimals || 18,
                        error: true,
                        errorMessage: error.message
                    }
                };
            }
        });

        // Wait for all promises using Promise.allSettled
        const results = await Promise.allSettled(promises);

        // Process results - ignorar valores null
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value && result.value.symbol) {
                balances[result.value.symbol] = result.value.data;
            }
            // Falhas rejeitadas são ignoradas silenciosamente
        });

        return balances;
    }

    /**
     * Get ETH price in USD
     * @returns {Promise<number>}
     */
    async function getEthPrice() {
        try {
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                return 0;
            }
            
            const data = await response.json();
            return data.ethereum?.usd || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Estimate gas for ETH transaction
     * @param {string} to
     * @param {string} value - Value in ETH
     * @returns {Promise<{gasLimit: bigint, gasPrice: bigint, totalGas: string}>}
     */
    async function estimateGas(to, value) {
        if (!ethers.isAddress(to)) {
            throw new Error('Endereço de destino inválido');
        }

        const valueWei = ethers.parseEther(value);
        
        const [gasLimit, feeData] = await executeWithFallback(async (p) => {
            const gasEst = await p.estimateGas({
                to: to,
                value: valueWei
            });
            const fees = await p.getFeeData();
            return [gasEst, fees];
        });

        const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
        const totalGasWei = gasLimit * gasPrice;

        return {
            gasLimit,
            gasPrice,
            totalGas: ethers.formatEther(totalGasWei)
        };
    }

    /**
     * Estimate gas for ERC-20 token transfer
     * @param {string} tokenAddress - Token contract address
     * @param {string} from - Sender address
     * @param {string} to - Recipient address
     * @param {string} amount - Amount in token units (human readable)
     * @param {number} decimals - Token decimals
     * @returns {Promise<{gasLimit: bigint, gasPrice: bigint, totalGas: string}>}
     */
    async function estimateTokenGas(tokenAddress, from, to, amount, decimals) {
        if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(to)) {
            throw new Error('Endereço inválido');
        }

        const amountWei = ethers.parseUnits(amount, decimals);
        
        return await executeWithFallback(async (p) => {
            // Validate chainId
            await validateChainId(p);
            
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, p);
            
            // Estimate gas for transfer
            const gasLimit = await contract.transfer.estimateGas(to, amountWei, { from });
            const feeData = await p.getFeeData();
            
            const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
            const totalGasWei = gasLimit * gasPrice;

            return {
                gasLimit,
                gasPrice,
                totalGas: ethers.formatEther(totalGasWei)
            };
        });
    }

    /**
     * Get transaction count (nonce)
     * @param {string} address
     * @returns {Promise<number>}
     */
    async function getNonce(address) {
        return await executeWithFallback(async (p) => {
            return await p.getTransactionCount(address, 'pending');
        });
    }

    /**
     * Create and sign transaction (returns signed tx, does not broadcast)
     * @param {Object} params
     * @returns {Promise<string>} - Signed transaction hex
     */
    async function createTransaction(params) {
        const { privateKey, to, value, gasLimit, gasPrice } = params;

        // Validate destination address
        if (!ethers.isAddress(to)) {
            throw new Error('Endereço de destino inválido');
        }

        // Validate value
        const valueNum = parseFloat(value);
        if (isNaN(valueNum) || valueNum <= 0) {
            throw new Error('Valor inválido');
        }

        // Validate chainId before signing
        await validateChainId(provider);

        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Get nonce
        const nonce = await getNonce(wallet.address);

        // Build transaction with explicit chainId
        const tx = {
            to: to,
            value: ethers.parseEther(value),
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: NETWORKS[currentNetwork].chainId
        };

        // Sign transaction
        const signedTx = await wallet.signTransaction(tx);
        
        return signedTx;
    }

    /**
     * Broadcast signed transaction with chainId verification
     * @param {string} signedTx
     * @returns {Promise<{hash: string, wait: Function}>}
     */
    async function broadcastTransaction(signedTx) {
        // Verify chainId one more time before broadcast
        await validateChainId(provider);
        
        return await executeWithFallback(async (p) => {
            const tx = await p.broadcastTransaction(signedTx);
            return {
                hash: tx.hash,
                wait: () => tx.wait()
            };
        });
    }

    /**
     * Full send ETH transaction flow
     * @param {Object} params
     * @returns {Promise<{hash: string, explorerUrl: string}>}
     */
    async function sendTransaction(params) {
        // Create and sign
        const signedTx = await createTransaction(params);
        
        // Broadcast
        const result = await broadcastTransaction(signedTx);

        return {
            hash: result.hash,
            explorerUrl: `${NETWORKS[currentNetwork].explorer}/tx/${result.hash}`
        };
    }

    /**
     * Send ERC-20 token with full validation
     * @param {Object} params
     * @returns {Promise<{hash: string, explorerUrl: string}>}
     */
    async function sendToken(params) {
        const { privateKey, tokenAddress, to, amount, decimals, gasLimit, gasPrice } = params;

        // Validate destination address
        if (!ethers.isAddress(to)) {
            throw new Error('Endereço de destino inválido');
        }

        // Validate token address
        if (!ethers.isAddress(tokenAddress)) {
            throw new Error('Endereço de token inválido');
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error('Valor inválido');
        }

        // Validate decimals is a valid number
        const decNum = Number(decimals);
        if (isNaN(decNum) || decNum < 0 || decNum > 18) {
            throw new Error('Decimals inválido');
        }

        // Validate chainId before signing
        await validateChainId(provider);

        // Validate contract before sending
        const contractValidation = await validateTokenContract(tokenAddress);
        if (!contractValidation.valid) {
            throw new Error(`Contrato inválido: ${contractValidation.error}`);
        }

        // Verify decimals match
        if (contractValidation.data.decimals !== decNum) {
            console.warn(`Decimals mismatch: expected ${decNum}, contract has ${contractValidation.data.decimals}`);
            // Use contract's decimals for safety
        }

        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Create contract instance with signer
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

        // Parse amount using contract's actual decimals
        const actualDecimals = contractValidation.data.decimals;
        const amountWei = ethers.parseUnits(amount, actualDecimals);

        // Get nonce
        const nonce = await getNonce(wallet.address);

        // Send transaction
        const tx = await contract.transfer(to, amountWei, {
            gasLimit: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce
        });

        return {
            hash: tx.hash,
            explorerUrl: `${NETWORKS[currentNetwork].explorer}/tx/${tx.hash}`,
            wait: () => tx.wait()
        };
    }

    /**
     * Get transaction history from explorer API
     * @param {string} address
     * @returns {Promise<Array>}
     */
    async function getTransactionHistory(address) {
        const network = getCurrentNetwork();
        
        try {
            const apiUrl = `${network.explorerApi}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                return [];
            }
            
            const data = await response.json();

            if (data.status === '1' && data.result) {
                return data.result.map(tx => ({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: ethers.formatEther(tx.value),
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    status: tx.isError === '0' ? 'success' : 'failed',
                    type: tx.from.toLowerCase() === address.toLowerCase() ? 'sent' : 'received',
                    tokenSymbol: 'ETH',
                    explorerUrl: `${network.explorer}/tx/${tx.hash}`
                }));
            }

            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get token transfer history from explorer API
     * @param {string} address
     * @param {string} tokenAddress - Optional, filter by token
     * @returns {Promise<Array>}
     */
    async function getTokenTransferHistory(address, tokenAddress = null) {
        const network = getCurrentNetwork();
        
        try {
            let apiUrl = `${network.explorerApi}/api?module=account&action=tokentx&address=${address}&page=1&offset=20&sort=desc`;
            
            if (tokenAddress) {
                apiUrl += `&contractaddress=${tokenAddress}`;
            }

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) return [];
            
            const data = await response.json();

            if (data.status === '1' && data.result) {
                return data.result.map(tx => ({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: ethers.formatUnits(tx.value, parseInt(tx.tokenDecimal)),
                    tokenSymbol: tx.tokenSymbol,
                    tokenName: tx.tokenName,
                    tokenAddress: tx.contractAddress,
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    type: tx.from.toLowerCase() === address.toLowerCase() ? 'sent' : 'received',
                    explorerUrl: `${network.explorer}/tx/${tx.hash}`
                }));
            }

            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get combined transaction history (ETH + tokens)
     * @param {string} address
     * @returns {Promise<Array>}
     */
    async function getCombinedHistory(address) {
        try {
            const [ethTxs, tokenTxs] = await Promise.all([
                getTransactionHistory(address),
                getTokenTransferHistory(address)
            ]);

            // Combine and sort by timestamp
            const combined = [...ethTxs, ...tokenTxs];

            return combined.sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);
        } catch (error) {
            return [];
        }
    }

    /**
     * Validate Ethereum address with checksum verification
     * @param {string} address
     * @returns {boolean}
     */
    function isValidAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }
        
        // Basic format check
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            return false;
        }
        
        return ethers.isAddress(address);
    }

    /**
     * Generate wallet from mnemonic
     * @param {string} mnemonic
     * @returns {Object}
     */
    function walletFromMnemonic(mnemonic) {
        // Validate mnemonic
        if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
            throw new Error('Seed phrase inválida');
        }

        // Create wallet
        const wallet = ethers.Wallet.fromPhrase(mnemonic);

        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: mnemonic
        };
    }

    /**
     * Generate new random mnemonic
     * @returns {string}
     */
    function generateMnemonic() {
        // Generate with additional entropy from security module
        let extraEntropy;
        if (typeof CryptoModule !== 'undefined') {
            extraEntropy = CryptoModule.generateEntropy();
        }
        
        const wallet = ethers.Wallet.createRandom({
            extraEntropy: extraEntropy
        });
        
        // Clear extra entropy
        if (typeof CryptoModule !== 'undefined' && extraEntropy) {
            CryptoModule.secureClear(extraEntropy);
        }

        return wallet.mnemonic.phrase;
    }

    /**
     * Validate mnemonic phrase
     * @param {string} mnemonic
     * @returns {boolean}
     */
    function isValidMnemonic(mnemonic) {
        if (!mnemonic || typeof mnemonic !== 'string') return false;
        
        const words = mnemonic.trim().toLowerCase().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) return false;

        return ethers.Mnemonic.isValidMnemonic(mnemonic.trim().toLowerCase());
    }

    /**
     * Get explorer URL for address
     * @param {string} address
     * @returns {string}
     */
    function getAddressExplorerUrl(address) {
        return `${NETWORKS[currentNetwork].explorer}/address/${address}`;
    }

    /**
     * Get explorer URL for transaction
     * @param {string} hash
     * @returns {string}
     */
    function getTxExplorerUrl(hash) {
        return `${NETWORKS[currentNetwork].explorer}/tx/${hash}`;
    }

    /**
     * Format address for display (shortened)
     * @param {string} address
     * @returns {string}
     */
    function formatAddress(address) {
        if (!address || address.length < 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Check if an address is a smart contract
     * Uses existing provider and executeWithFallback
     * @param {string} address
     * @returns {Promise<{isContract: boolean, codeSize: number}>}
     */
    async function isContractAddress(address) {
        if (!ethers.isAddress(address)) {
            return { isContract: false, codeSize: 0 };
        }

        try {
            return await executeWithFallback(async (p) => {
                const code = await p.getCode(address);
                const isContract = code !== '0x' && code !== '0x0' && code.length > 2;
                return { 
                    isContract, 
                    codeSize: isContract ? (code.length - 2) / 2 : 0 
                };
            }, 2, false);
        } catch {
            // If check fails, don't block - just return unknown
            return { isContract: false, codeSize: 0 };
        }
    }

    /**
     * Resolve ENS name to address (if supported)
     * @param {string} ensName
     * @returns {Promise<{resolved: boolean, address: string|null}>}
     */
    async function resolveENS(ensName) {
        if (!ensName || !ensName.endsWith('.eth')) {
            return { resolved: false, address: null };
        }

        try {
            return await executeWithFallback(async (p) => {
                const address = await p.resolveName(ensName);
                return {
                    resolved: !!address,
                    address: address || null
                };
            }, 2, false);
        } catch {
            return { resolved: false, address: null };
        }
    }

    /**
     * Verify RPC endpoint health
     * @returns {Promise<{healthy: boolean, latency: number}>}
     */
    async function verifyRpcHealth() {
        const start = Date.now();
        try {
            await provider.getBlockNumber();
            const latency = Date.now() - start;
            return { healthy: true, latency };
        } catch {
            return { healthy: false, latency: -1 };
        }
    }

    /**
     * Get token info from contract
     * @param {string} tokenAddress
     * @returns {Promise<Object>}
     */
    async function getTokenInfo(tokenAddress) {
        if (!ethers.isAddress(tokenAddress)) {
            throw new Error('Endereço de token inválido');
        }

        return await executeWithFallback(async (p) => {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, p);

            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.decimals()
            ]);

            return { name, symbol, decimals: Number(decimals), address: tokenAddress };
        });
    }

    // Public API
    return {
        init,
        switchNetwork,
        getCurrentNetwork,
        getNetworks,
        getBalance,
        getEthPrice,
        estimateGas,
        getNonce,
        sendTransaction,
        getTransactionHistory,
        isValidAddress,
        walletFromMnemonic,
        generateMnemonic,
        isValidMnemonic,
        getAddressExplorerUrl,
        getTxExplorerUrl,
        formatAddress,
        verifyRpcHealth,
        getCurrentRpcUrl,
        // Address analysis
        isContractAddress,
        resolveENS,
        // Token functions
        validateTokenContract,  // Contract validation
        getTokenBalance,
        getAllTokenBalances,
        estimateTokenGas,
        sendToken,
        getTokenInfo,
        getTokenTransferHistory,
        getCombinedHistory
    };
})();

// Prevent modifications
Object.freeze(BlockchainModule);
