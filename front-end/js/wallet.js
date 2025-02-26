// Wallet connection and management for the Market DAO application

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.networkId = null;
        this.isConnected = false;
        this.onConnectCallbacks = [];
        this.onDisconnectCallbacks = [];
        this.onNetworkChangeCallbacks = [];
    }

    /**
     * Check if MetaMask is available in the browser
     * @returns {boolean} - True if MetaMask is available
     */
    isMetaMaskAvailable() {
        return window.ethereum !== undefined;
    }

    /**
     * Connect to MetaMask wallet
     * @returns {Promise<string>} - The connected wallet address
     */
    async connect() {
        if (!this.isMetaMaskAvailable()) {
            throw new Error('MetaMask is not installed. Please install it to use this application.');
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.address = accounts[0];
            
            // Create ethers provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // Get network information
            const network = await this.provider.getNetwork();
            this.networkId = network.chainId;
            
            // Setup event listeners for MetaMask
            this.setupEventListeners();
            
            // Mark as connected
            this.isConnected = true;
            
            // Initialize contracts
            contracts.initialize(this.provider, this.signer);
            
            // Call the connect callbacks
            this._callCallbacks(this.onConnectCallbacks, this.address);
            
            return this.address;
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the wallet
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.networkId = null;
        this.isConnected = false;
        
        // Reset contracts
        contracts.reset();
        
        // Call the disconnect callbacks
        this._callCallbacks(this.onDisconnectCallbacks);
    }

    /**
     * Setup event listeners for MetaMask
     */
    setupEventListeners() {
        if (!window.ethereum) return;
        
        // Handle account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // User disconnected their wallet
                this.disconnect();
            } else {
                // User switched accounts
                this.address = accounts[0];
                this._callCallbacks(this.onConnectCallbacks, this.address);
            }
        });
        
        // Handle network changes
        window.ethereum.on('chainChanged', (chainId) => {
            // Network was changed, refresh the page
            this.networkId = parseInt(chainId, 16);
            this._callCallbacks(this.onNetworkChangeCallbacks, this.networkId);
            
            // Refresh provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            
            // Reinitialize contracts
            contracts.initialize(this.provider, this.signer);
        });
    }

    /**
     * Get the wallet's ETH balance
     * @returns {Promise<string>} - The balance in ETH
     */
    async getBalance() {
        if (!this.isConnected) return '0';
        
        const balance = await this.provider.getBalance(this.address);
        return ethers.utils.formatEther(balance);
    }

    /**
     * Get the current block number
     * @returns {Promise<number>} - The current block number
     */
    async getBlockNumber() {
        if (!this.isConnected) return 0;
        return await this.provider.getBlockNumber();
    }

    /**
     * Register callback function to be called when wallet is connected
     * @param {Function} callback - The callback function
     */
    onConnect(callback) {
        this.onConnectCallbacks.push(callback);
        
        // If already connected, call the callback immediately
        if (this.isConnected) {
            callback(this.address);
        }
    }

    /**
     * Register callback function to be called when wallet is disconnected
     * @param {Function} callback - The callback function
     */
    onDisconnect(callback) {
        this.onDisconnectCallbacks.push(callback);
    }

    /**
     * Register callback function to be called when network changes
     * @param {Function} callback - The callback function
     */
    onNetworkChange(callback) {
        this.onNetworkChangeCallbacks.push(callback);
        
        // If already connected, call the callback immediately
        if (this.isConnected) {
            callback(this.networkId);
        }
    }

    /**
     * Helper method to call all registered callbacks
     * @param {Array<Function>} callbacks - The callbacks to call
     * @param {...any} args - Arguments to pass to the callbacks
     */
    _callCallbacks(callbacks, ...args) {
        for (const callback of callbacks) {
            try {
                callback(...args);
            } catch (error) {
                console.error('Error in callback:', error);
            }
        }
    }
}

// Create a singleton instance and ensure it's defined in the global scope
window.wallet = new WalletManager();
