/**
 * Main application file for Market DAO
 * Initializes the application and creates instances of contract and UI managers
 */
class App {
    constructor() {
        this.initialized = false;
        this.contractsInitialized = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Listen for contracts initialization - do this before we create the contract manager
        window.addEventListener('contracts-initialized', () => {
            this.contractsInitialized = true;
            console.log('App initialized with contracts');
            
            // Now that contracts are initialized, we can safely refresh data
            // Wait a bit to ensure all components are ready
            setTimeout(() => this.refreshData(), 500);
        });
        
        window.addEventListener('abis-loaded', () => {
            this.initialized = true;
            console.log('App initialized with ABIs');
        });
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh data when requested
        window.addEventListener('refresh-data', () => this.refreshData());
        
        // Check for automatic wallet connection when page loads
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM content loaded');
        });
    }
    
    /**
     * Refresh all data from contracts
     */
    async refreshData() {
        if (!this.contractsInitialized) {
            console.warn('Cannot refresh data: contracts not initialized');
            // Try to initialize contracts anyway
            if (window.Contracts) {
                Contracts.initialize();
                // Give it a moment to initialize before trying again
                setTimeout(() => this.refreshData(), 1000);
            }
            return;
        }
        
        try {
            // Make sure all the components we need are defined
            if (!window.Proposals || !window.Tokens || !window.Treasury) {
                console.warn('Components not ready yet, delaying refresh');
                setTimeout(() => this.refreshData(), 500);
                return;
            }
            
            // Ensure contracts are connected
            if (!Contracts.contracts.dao || !Contracts.contracts.factory) {
                console.warn('Contracts not connected, attempting to reconnect...');
                Contracts.createReadOnlyInstances();
                
                // If still not connected, try again later
                if (!Contracts.contracts.dao || !Contracts.contracts.factory) {
                    setTimeout(() => this.refreshData(), 1000);
                    return;
                }
            }
            
            // Refresh DAO info
            await Proposals.loadDAOInfo();
            
            // Refresh proposals (which will also update elections)
            await Proposals.loadProposals();
            
            // Reload token holders if needed
            if (UI.activeSection === 'tokens') {
                await Tokens.loadTokenHolders();
            }
            
            // Reload treasury info if needed
            if (UI.activeSection === 'treasury') {
                await Treasury.loadTreasuryInfo();
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            UI.showNotification('error', 'Refresh Failed', 'Failed to refresh data from contracts');
        }
    }
}

// *** Important: Initialize components in the correct order ***

// First we need to create the global UI instance, before it's used by other components
// This has already been done in ui.js

// Then create the contract manager, which will be used by other components
// This will try to load ABIs and initialize contracts
const Contracts = new ContractManager();

// Finally, create the app instance
// This will set up event listeners and wait for contract initialization
document.addEventListener('DOMContentLoaded', () => {
    // Create app instance after DOM is loaded and all scripts are executed
    window.MarketDAOApp = new App();
    
    // Add a global helper function for development/debugging
    window.refreshApp = () => {
        window.MarketDAOApp.refreshData();
    };
});
