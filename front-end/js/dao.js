// DAO information and management functions for the Market DAO application

class DAOManager {
    constructor() {
        this.daoInfo = {
            name: '',
            supportThreshold: 0,
            quorumPercentage: 0,
            maxProposalAge: 0,
            electionDuration: 0,
            allowMinting: false,
            tokenPrice: 0,
            hasTreasury: false,
            acceptsETH: false,
            acceptsERC20: false,
            acceptsERC721: false,
            acceptsERC1155: false,
            governanceTokenSupply: 0
        };
        this.userTokens = 0;
        this.refreshInterval = null;
    }

    /**
     * Initialize the DAO manager
     */
    async initialize() {
        if (!contracts.isInitialized()) {
            console.warn('Contracts not initialized. Cannot load DAO info.');
            return;
        }
        
        await this.refreshDAOInfo();
        await this.refreshUserInfo();
        
        // Setup refresh intervals
        this.setupRefreshIntervals();
    }

    /**
     * Refresh DAO information
     */
    async refreshDAOInfo() {
        try {
            const daoContract = contracts.daoContract;
            
            // Fetch basic DAO info
            const [
                name,
                supportThreshold,
                quorumPercentage,
                maxProposalAge,
                electionDuration,
                allowMinting,
                tokenPrice,
                hasTreasury,
                acceptsETH,
                acceptsERC20,
                acceptsERC721,
                acceptsERC1155,
                governanceTokenSupply
            ] = await Promise.all([
                daoContract.name(),
                daoContract.supportThreshold(),
                daoContract.quorumPercentage(),
                daoContract.maxProposalAge(),
                daoContract.electionDuration(),
                daoContract.allowMinting(),
                daoContract.tokenPrice(),
                daoContract.hasTreasury(),
                daoContract.acceptsETH(),
                daoContract.acceptsERC20(),
                daoContract.acceptsERC721(),
                daoContract.acceptsERC1155(),
                daoContract.totalSupply(CONFIG.GOVERNANCE_TOKEN_ID)
            ]);
            
            // Update the DAO info
            this.daoInfo = {
                name,
                supportThreshold: supportThreshold.toNumber(),
                quorumPercentage: quorumPercentage.toNumber(),
                maxProposalAge: maxProposalAge.toNumber(),
                electionDuration: electionDuration.toNumber(),
                allowMinting,
                tokenPrice,
                hasTreasury,
                acceptsETH,
                acceptsERC20,
                acceptsERC721,
                acceptsERC1155,
                governanceTokenSupply: governanceTokenSupply.toNumber()
            };
            
            // Update UI with new info
            this.updateDAOInfoUI();
        } catch (error) {
            console.error('Error refreshing DAO info:', error);
        }
    }

    /**
     * Refresh user-specific information
     */
    async refreshUserInfo() {
        try {
            if (!wallet.isConnected) {
                this.userTokens = 0;
                this.updateUserInfoUI();
                return;
            }
            
            const daoContract = contracts.daoContract;
            
            // Fetch user's governance token balance
            const userTokens = await daoContract.balanceOf(wallet.address, CONFIG.GOVERNANCE_TOKEN_ID);
            this.userTokens = userTokens.toNumber();
            
            // Update UI with user info
            this.updateUserInfoUI();
        } catch (error) {
            console.error('Error refreshing user info:', error);
        }
    }

    /**
     * Update the DAO info in the UI
     */
    updateDAOInfoUI() {
        document.getElementById('daoName').textContent = this.daoInfo.name;
        document.getElementById('supportThreshold').textContent = `${this.daoInfo.supportThreshold}%`;
        document.getElementById('quorumPercentage').textContent = `${this.daoInfo.quorumPercentage}%`;
        document.getElementById('maxProposalAge').textContent = 
            `${this.daoInfo.maxProposalAge} blocks (${Utils.blocksToTime(this.daoInfo.maxProposalAge)})`;
        document.getElementById('electionDuration').textContent = 
            `${this.daoInfo.electionDuration} blocks (${Utils.blocksToTime(this.daoInfo.electionDuration)})`;
        
        if (this.daoInfo.tokenPrice.toString() === '0') {
            document.getElementById('tokenPrice').textContent = 'Direct token sales disabled';
            document.getElementById('tokenManagement').classList.add('hidden');
        } else {
            document.getElementById('tokenPrice').textContent = Utils.formatEth(this.daoInfo.tokenPrice);
            document.getElementById('tokenManagement').classList.remove('hidden');
        }
    }

    /**
     * Update user info in the UI
     */
    updateUserInfoUI() {
        document.getElementById('userTokens').textContent = Utils.formatTokenAmount(this.userTokens);
    }

    /**
     * Setup auto-refresh intervals
     */
    setupRefreshIntervals() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Setup periodic refresh
        this.refreshInterval = setInterval(async () => {
            await this.refreshDAOInfo();
            await this.refreshUserInfo();
        }, CONFIG.refreshIntervals.daoInfo);
    }

    /**
     * Clean up when disconnecting
     */
    cleanup() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Buy governance tokens
     * @param {string} ethAmount - Amount of ETH to spend
     */
    async buyTokens(ethAmount) {
        if (!wallet.isConnected) {
            throw new Error('Wallet not connected');
        }
        
        if (this.daoInfo.tokenPrice.toString() === '0') {
            throw new Error('Direct token sales are disabled');
        }
        
        // Convert ETH to wei
        const weiAmount = ethers.utils.parseEther(ethAmount);
        
        // Check if the amount is valid
        if (weiAmount.lte(0)) {
            throw new Error('Invalid amount');
        }
        
        // Check if the amount is a multiple of token price
        if (weiAmount.mod(this.daoInfo.tokenPrice).toString() !== '0') {
            throw new Error('Amount must be a multiple of token price');
        }
        
        try {
            // Calculate token amount
            const tokenAmount = weiAmount.div(this.daoInfo.tokenPrice);
            
            // Execute the purchase
            return await Utils.waitForTransaction(
                contracts.daoContract.purchaseTokens({ value: weiAmount }),
                `Purchasing ${tokenAmount} governance tokens...`,
                `Successfully purchased ${tokenAmount} governance tokens!`
            );
        } catch (error) {
            console.error('Error purchasing tokens:', error);
            throw error;
        }
    }
}

// Create a singleton instance and ensure it's defined in the global scope
window.daoManager = new DAOManager();
