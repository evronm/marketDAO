/**
 * Treasury management for Market DAO
 * Handles displaying treasury information and transactions
 */
class TreasuryManager {
    constructor() {
        this.daoInfo = null;
        this.ethBalance = '0';
        this.transactions = [];
        
        // Initialize when contracts are ready
        window.addEventListener('contracts-initialized', () => this.initialize());
        
        // Refresh when wallet changes
        window.addEventListener('wallet-connected', () => this.loadTreasuryInfo());
        window.addEventListener('wallet-account-changed', () => this.loadTreasuryInfo());
        
        // Refresh when switching to treasury tab
        window.addEventListener('section-changed', (event) => {
            if (event.detail.section === 'treasury') {
                this.loadTreasuryInfo();
            }
        });
    }
    
    /**
     * Initialize treasury manager
     */
    initialize() {
        console.log('Initializing treasury manager');
        
        // Load treasury info if on treasury tab
        if (UI.activeSection === 'treasury') {
            this.loadTreasuryInfo();
        }
    }
    
    /**
     * Load treasury information
     */
    async loadTreasuryInfo() {
        // Load DAO info to get treasury configuration
        try {
            if (!this.daoInfo) {
                this.daoInfo = await Contracts.fetchDAOInfo();
            }
            
            // Show loading state
            document.getElementById('treasury-status').innerHTML = `
                <h3>Treasury Status</h3>
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading treasury information...</p>
                </div>
            `;
            
            // Check if treasury is enabled
            if (!this.daoInfo.hasTreasury) {
                document.getElementById('treasury-status').innerHTML = `
                    <h3>Treasury Status</h3>
                    <div class="empty-state">
                        <i class="fas fa-lock"></i>
                        <p>Treasury is not enabled for this DAO</p>
                    </div>
                `;
                return;
            }
            
            // Fetch ETH balance
            const provider = Wallet.getProvider() || new ethers.providers.JsonRpcProvider(AppConfig.rpcUrl);
            this.ethBalance = await provider.getBalance(AppConfig.contracts.daoAddress);
            
            // Build treasury assets container
            let assetsHtml = '<div id="treasury-assets-container">';
            
            // ETH balance
            if (this.daoInfo.acceptsETH) {
                assetsHtml += `
                    <div class="treasury-asset-type">
                        <i class="fas fa-ethereum"></i>
                        <span>ETH: </span>
                        <span id="eth-balance">${ethers.utils.formatEther(this.ethBalance)} ETH</span>
                    </div>
                `;
            }
            
            // Placeholders for other asset types
            if (this.daoInfo.acceptsERC20) {
                assetsHtml += `
                    <div class="treasury-asset-type">
                        <i class="fas fa-coins"></i>
                        <span>ERC20 Tokens: </span>
                        <span>Use treasury proposals to view specific token balances</span>
                    </div>
                `;
            }
            
            if (this.daoInfo.acceptsERC721) {
                assetsHtml += `
                    <div class="treasury-asset-type">
                        <i class="fas fa-image"></i>
                        <span>ERC721 NFTs: </span>
                        <span>Use treasury proposals to view specific NFTs</span>
                    </div>
                `;
            }
            
            if (this.daoInfo.acceptsERC1155) {
                assetsHtml += `
                    <div class="treasury-asset-type">
                        <i class="fas fa-cubes"></i>
                        <span>ERC1155 Tokens: </span>
                        <span>Use treasury proposals to view specific token balances</span>
                    </div>
                `;
            }
            
            assetsHtml += '</div>';
            
            // Update treasury status
            document.getElementById('treasury-status').innerHTML = `
                <h3>Treasury Status</h3>
                ${assetsHtml}
            `;
            
            // Load recent transactions
            this.loadTreasuryTransactions();
        } catch (error) {
            console.error('Error loading treasury info:', error);
            
            document.getElementById('treasury-status').innerHTML = `
                <h3>Treasury Status</h3>
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Error loading treasury information</p>
                </div>
            `;
        }
    }
    
    /**
     * Load recent treasury transactions
     */
    async loadTreasuryTransactions() {
        const treasuryTransactions = document.getElementById('treasury-transactions');
        
        if (!treasuryTransactions) return;
        
        try {
            // In a real implementation, you would fetch transaction history
            // For this demo, we'll use treasury proposals as a proxy for transactions
            
            // Find treasury proposals that were executed
            const treasuryProposals = Proposals.proposals.filter(p => 
                p.type === 'treasury' && p.executed
            );
            
            if (treasuryProposals.length === 0) {
                treasuryTransactions.innerHTML = `
                    <tr>
                        <td colspan="4" class="empty-table">No transactions found</td>
                    </tr>
                `;
                return;
            }
            
            // Sort by creation date (newest first)
            treasuryProposals.sort((a, b) => b.createdAt - a.createdAt);
            
            // Build table rows
            let html = '';
            
            treasuryProposals.forEach(proposal => {
                const tokenType = proposal.token === ethers.constants.AddressZero ? 'ETH' : 'Token';
                
                html += `
                    <tr>
                        <td>${proposal.description}</td>
                        <td>${UI.formatEth(proposal.amount)}</td>
                        <td>Block #${proposal.createdAt}</td>
                        <td><span class="status-badge success">Completed</span></td>
                    </tr>
                `;
            });
            
            treasuryTransactions.innerHTML = html;
        } catch (error) {
            console.error('Error loading treasury transactions:', error);
            treasuryTransactions.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-table">Error loading transactions</td>
                </tr>
            `;
        }
    }
}

// Create global treasury manager
const Treasury = new TreasuryManager();
