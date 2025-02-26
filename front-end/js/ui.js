// UI interaction for the Market DAO application

class UIManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the UI
     */
    initialize() {
        // Only initialize once
        if (this.initialized) return;
        
        // Setup tabs
        this.setupTabs();
        
        // Setup form submissions
        this.setupForms();
        
        // Setup wallet connection button
        this.setupWalletButton();
        
        this.initialized = true;
    }

    /**
     * Setup tab switching
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Show corresponding content
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    /**
     * Setup form submissions
     */
    setupForms() {
        // Resolution proposal form
        const resolutionForm = document.getElementById('resolutionForm');
        resolutionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleResolutionFormSubmit(resolutionForm);
        });
        
        // Treasury proposal form
        const treasuryForm = document.getElementById('treasuryForm');
        treasuryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleTreasuryFormSubmit(treasuryForm);
        });
        
        // Mint proposal form
        const mintForm = document.getElementById('mintForm');
        mintForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleMintFormSubmit(mintForm);
        });
        
        // Token price proposal form
        const tokenPriceForm = document.getElementById('tokenPriceForm');
        tokenPriceForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleTokenPriceFormSubmit(tokenPriceForm);
        });
        
        // Buy tokens form
        const buyTokensBtn = document.getElementById('buyTokensBtn');
        buyTokensBtn.addEventListener('click', async () => {
            await this.handleBuyTokens();
        });
    }

    /**
     * Setup wallet connection button
     */
    setupWalletButton() {
        const connectWalletBtn = document.getElementById('connectWalletBtn');
        
        connectWalletBtn.addEventListener('click', async () => {
            if (!wallet.isConnected) {
                try {
                    await wallet.connect();
                } catch (error) {
                    Utils.showNotification(`Failed to connect wallet: ${error.message}`, 'error');
                }
            } else {
                wallet.disconnect();
            }
        });
        
        // Update button text when wallet connection state changes
        wallet.onConnect((address) => {
            connectWalletBtn.textContent = 'Disconnect Wallet';
            document.getElementById('accountAddress').textContent = Utils.shortenAddress(address);
            document.getElementById('accountInfo').classList.remove('hidden');
            
            // Update wallet balance
            this.updateWalletBalance();
            
            // Refresh balance periodically
            this.balanceInterval = setInterval(() => {
                this.updateWalletBalance();
            }, CONFIG.refreshIntervals.userInfo);
        });
        
        wallet.onDisconnect(() => {
            connectWalletBtn.textContent = 'Connect Wallet';
            document.getElementById('accountInfo').classList.add('hidden');
            
            if (this.balanceInterval) {
                clearInterval(this.balanceInterval);
                this.balanceInterval = null;
            }
        });
    }

    /**
     * Update wallet balance display
     */
    async updateWalletBalance() {
        if (!wallet.isConnected) return;
        
        try {
            const balance = await wallet.getBalance();
            document.getElementById('accountBalance').textContent = `${parseFloat(balance).toFixed(4)} ETH`;
        } catch (error) {
            console.error('Error updating wallet balance:', error);
        }
    }

    /**
     * Handle resolution proposal form submission
     * @param {HTMLFormElement} form - The form element
     */
    async handleResolutionFormSubmit(form) {
        if (!wallet.isConnected) {
            Utils.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            const description = form.elements.resolutionDescription.value.trim();
            
            if (!description) {
                Utils.showNotification('Description is required', 'error');
                return;
            }
            
            await proposalManager.createProposal(CONFIG.proposalTypes.RESOLUTION, {
                description
            });
            
            // Reset form
            form.reset();
        } catch (error) {
            console.error('Error creating resolution proposal:', error);
            Utils.showNotification(`Failed to create proposal: ${error.message}`, 'error');
        }
    }

    /**
     * Handle treasury proposal form submission
     * @param {HTMLFormElement} form - The form element
     */
    async handleTreasuryFormSubmit(form) {
        if (!wallet.isConnected) {
            Utils.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            const description = form.elements.treasuryDescription.value.trim();
            const recipient = form.elements.treasuryRecipient.value.trim();
            const amount = form.elements.treasuryAmount.value;
            const token = form.elements.treasuryToken.value.trim();
            const tokenId = form.elements.treasuryTokenId.value;
            
            if (!description) {
                Utils.showNotification('Description is required', 'error');
                return;
            }
            
            if (!Utils.isValidAddress(recipient)) {
                Utils.showNotification('Invalid recipient address', 'error');
                return;
            }
            
            if (isNaN(amount) || parseFloat(amount) <= 0) {
                Utils.showNotification('Amount must be greater than 0', 'error');
                return;
            }
            
            if (!Utils.isValidAddress(token)) {
                Utils.showNotification('Invalid token address', 'error');
                return;
            }
            
            if (isNaN(tokenId) || parseInt(tokenId) < 0) {
                Utils.showNotification('Token ID must be a non-negative number', 'error');
                return;
            }
            
            // Convert amount to BigNumber
            const amountBN = ethers.utils.parseUnits(amount, 'ether');
            
            await proposalManager.createProposal(CONFIG.proposalTypes.TREASURY, {
                description,
                recipient,
                amount: amountBN,
                token,
                tokenId: parseInt(tokenId)
            });
            
            // Reset form
            form.reset();
        } catch (error) {
            console.error('Error creating treasury proposal:', error);
            Utils.showNotification(`Failed to create proposal: ${error.message}`, 'error');
        }
    }

    /**
     * Handle mint proposal form submission
     * @param {HTMLFormElement} form - The form element
     */
    async handleMintFormSubmit(form) {
        if (!wallet.isConnected) {
            Utils.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            const description = form.elements.mintDescription.value.trim();
            const recipient = form.elements.mintRecipient.value.trim();
            const amount = form.elements.mintAmount.value;
            
            if (!description) {
                Utils.showNotification('Description is required', 'error');
                return;
            }
            
            if (!Utils.isValidAddress(recipient)) {
                Utils.showNotification('Invalid recipient address', 'error');
                return;
            }
            
            if (isNaN(amount) || parseInt(amount) <= 0) {
                Utils.showNotification('Amount must be greater than 0', 'error');
                return;
            }
            
            await proposalManager.createProposal(CONFIG.proposalTypes.MINT, {
                description,
                recipient,
                amount: parseInt(amount)
            });
            
            // Reset form
            form.reset();
        } catch (error) {
            console.error('Error creating mint proposal:', error);
            Utils.showNotification(`Failed to create proposal: ${error.message}`, 'error');
        }
    }

    /**
     * Handle token price proposal form submission
     * @param {HTMLFormElement} form - The form element
     */
    async handleTokenPriceFormSubmit(form) {
        if (!wallet.isConnected) {
            Utils.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            const description = form.elements.priceDescription.value.trim();
            const newPrice = form.elements.newTokenPrice.value;
            
            if (!description) {
                Utils.showNotification('Description is required', 'error');
                return;
            }
            
            if (isNaN(newPrice) || parseInt(newPrice) < 0) {
                Utils.showNotification('New price must be a non-negative number', 'error');
                return;
            }
            
            await proposalManager.createProposal(CONFIG.proposalTypes.TOKEN_PRICE, {
                description,
                newPrice: ethers.BigNumber.from(newPrice)
            });
            
            // Reset form
            form.reset();
        } catch (error) {
            console.error('Error creating token price proposal:', error);
            Utils.showNotification(`Failed to create proposal: ${error.message}`, 'error');
        }
    }

    /**
     * Handle buy tokens action
     */
    async handleBuyTokens() {
        if (!wallet.isConnected) {
            Utils.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            const ethAmount = document.getElementById('tokenAmount').value;
            
            if (isNaN(ethAmount) || parseFloat(ethAmount) <= 0) {
                Utils.showNotification('Please enter a valid amount', 'error');
                return;
            }
            
            await daoManager.buyTokens(ethAmount);
            
            // Reset form
            document.getElementById('tokenAmount').value = '';
        } catch (error) {
            console.error('Error buying tokens:', error);
            Utils.showNotification(`Failed to buy tokens: ${error.message}`, 'error');
        }
    }

    /**
     * Clean up when disconnecting
     */
    cleanup() {
        if (this.balanceInterval) {
            clearInterval(this.balanceInterval);
            this.balanceInterval = null;
        }
    }
}

// Create a singleton instance and ensure it's defined in the global scope
window.uiManager = new UIManager();
