/**
 * Token management for Market DAO
 * Handles displaying token holder information
 */
class TokenManager {
    constructor() {
        this.tokenHolders = [];
        this.totalSupply = 0;
        
        // Initialize when contracts are ready
        window.addEventListener('contracts-initialized', () => this.initialize());
        
        // Refresh when wallet changes
        window.addEventListener('wallet-connected', () => this.loadTokenHolders());
        window.addEventListener('wallet-account-changed', () => this.loadTokenHolders());
        
        // Refresh when switching to tokens tab
        window.addEventListener('section-changed', (event) => {
            if (event.detail.section === 'tokens') {
                this.loadTokenHolders();
            }
        });
        
        // Update when tokens are purchased
        window.addEventListener('tokens-purchased', () => this.loadTokenHolders());
    }
    
    /**
     * Initialize token manager
     */
    initialize() {
        console.log('Initializing token manager');
        
        // Load token info if on tokens tab
        if (UI.activeSection === 'tokens') {
            this.loadTokenHolders();
        }
    }
    
    /**
     * Load token holder information
     */
    async loadTokenHolders() {
        const tokenHoldersList = document.getElementById('token-holders-list');
        
        if (!tokenHoldersList) return;
        
        tokenHoldersList.innerHTML = `
            <tr>
                <td colspan="3" class="empty-table">Loading token holders...</td>
            </tr>
        `;
        
        try {
            // Get token supply
            const daoContract = Contracts.getDAOContract();
            this.totalSupply = await daoContract.totalSupply(0);
            this.totalSupply = this.totalSupply.toNumber();
            
            // Get token holders and balances
            this.tokenHolders = await Contracts.fetchTokenHolders();
            
            if (this.tokenHolders.length === 0) {
                tokenHoldersList.innerHTML = `
                    <tr>
                        <td colspan="3" class="empty-table">No token holders found</td>
                    </tr>
                `;
                return;
            }
            
            // Sort by balance (highest first)
            this.tokenHolders.sort((a, b) => b.balance - a.balance);
            
            // Build table rows
            let html = '';
            
            this.tokenHolders.forEach(holder => {
                const percentage = this.totalSupply > 0 
                    ? ((holder.balance / this.totalSupply) * 100).toFixed(2) 
                    : 0;
                
                // Highlight current user's address
                const isCurrentUser = Wallet.isWalletConnected() && 
                    holder.address.toLowerCase() === Wallet.getAddress().toLowerCase();
                
                html += `
                    <tr${isCurrentUser ? ' class="current-user"' : ''}>
                        <td>${isCurrentUser ? 'You: ' : ''}${holder.address}</td>
                        <td>${holder.balance}</td>
                        <td>${percentage}%</td>
                    </tr>
                `;
            });
            
            tokenHoldersList.innerHTML = html;
            
            // Update token holder count in dashboard
            const tokenHoldersElement = document.getElementById('token-holders');
            if (tokenHoldersElement) {
                tokenHoldersElement.textContent = this.tokenHolders.length;
            }
        } catch (error) {
            console.error('Error loading token holders:', error);
            tokenHoldersList.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-table">Error loading token holders</td>
                </tr>
            `;
        }
    }
}

// Create global token manager
const Tokens = new TokenManager();
