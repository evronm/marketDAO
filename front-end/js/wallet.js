/**
 * Wallet management for Market DAO
 * Handles connection to MetaMask or other web3 providers
 */
class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.chainId = null;
        this.isConnected = false;
        
        // Setup connect button event listener
        this.connectButton = document.getElementById('connect-wallet');
        this.connectButton.addEventListener('click', () => this.connectWallet());
        
        // Setup event listeners for account changes
        this.setupEventListeners();
    }
    
    /**
     * Setup Web3 event listeners for account and chain changes
     */
    setupEventListeners() {
        // If already in a browser with ethereum provider
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                console.log('Account changed:', accounts[0]);
                this.handleAccountChange(accounts);
            });
            
            window.ethereum.on('chainChanged', (chainId) => {
                console.log('Chain changed:', parseInt(chainId, 16));
                window.location.reload();
            });
            
            // Check if already connected
            this.checkExistingConnection();
        }
    }
    
    /**
     * Check for existing connection when page loads
     */
    async checkExistingConnection() {
        if (window.ethereum) {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await provider.listAccounts();
            
            if (accounts.length > 0) {
                this.provider = provider;
                this.signer = this.provider.getSigner();
                this.account = accounts[0];
                this.isConnected = true;
                this.updateUI();
                
                // Get chain ID
                const network = await this.provider.getNetwork();
                this.chainId = network.chainId;
                
                // Dispatch connected event
                window.dispatchEvent(new CustomEvent('wallet-connected', {
                    detail: { address: this.account }
                }));
            }
        }
    }
    
    /**
     * Connect to the wallet
     */
    async connectWallet() {
        try {
            if (window.ethereum) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                const accounts = await this.provider.send('eth_requestAccounts', []);
                
                if (accounts.length > 0) {
                    this.signer = this.provider.getSigner();
                    this.account = accounts[0];
                    this.isConnected = true;
                    
                    // Get chain ID
                    const network = await this.provider.getNetwork();
                    this.chainId = network.chainId;
                    
                    this.updateUI();
                    
                    // Dispatch connected event
                    window.dispatchEvent(new CustomEvent('wallet-connected', {
                        detail: { address: this.account }
                    }));
                    
                    // Show success notification
                    UI.showNotification('success', 'Wallet Connected', 'Connected to account ' + this.formatAddress(this.account));
                }
            } else {
                UI.showNotification('error', 'No Provider Found', 'Please install MetaMask or another Web3 wallet');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            UI.showNotification('error', 'Connection Failed', error.message || 'Could not connect to wallet');
        }
    }
    
    /**
     * Handle account change from wallet
     */
    handleAccountChange(accounts) {
        if (accounts.length === 0) {
            // Disconnected
            this.disconnectWallet();
        } else {
            // Account changed
            this.account = accounts[0];
            this.updateUI();
            
            // Dispatch event for account change
            window.dispatchEvent(new CustomEvent('wallet-account-changed', {
                detail: { address: this.account }
            }));
            
            // Refresh data
            window.dispatchEvent(new CustomEvent('refresh-data'));
        }
    }
    
    /**
     * Disconnect wallet (UI only, cannot force disconnect MetaMask)
     */
    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.isConnected = false;
        this.updateUI();
        
        // Dispatch disconnected event
        window.dispatchEvent(new CustomEvent('wallet-disconnected'));
        
        // Show notification
        UI.showNotification('warning', 'Wallet Disconnected', 'Your wallet has been disconnected');
    }
    
    /**
     * Update UI based on connection state
     */
    updateUI() {
        const connectButton = document.getElementById('connect-wallet');
        const walletInfo = document.getElementById('wallet-info');
        const accountAddress = document.getElementById('account-address');
        
        if (this.isConnected && this.account) {
            connectButton.classList.add('hidden');
            walletInfo.classList.remove('hidden');
            accountAddress.textContent = this.formatAddress(this.account);
        } else {
            connectButton.classList.remove('hidden');
            walletInfo.classList.add('hidden');
        }
    }
    
    /**
     * Format address for display (0x1234...5678)
     */
    formatAddress(address) {
        if (!address) return '';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
    
    /**
     * Get current connected address
     */
    getAddress() {
        return this.account;
    }
    
    /**
     * Get current signer
     */
    getSigner() {
        return this.signer;
    }
    
    /**
     * Get current provider
     */
    getProvider() {
        return this.provider;
    }
    
    /**
     * Check if wallet is connected
     */
    isWalletConnected() {
        return this.isConnected;
    }
}

// Create global wallet instance
const Wallet = new WalletManager();
