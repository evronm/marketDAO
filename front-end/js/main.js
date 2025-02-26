// Main entry point for the Market DAO application

// Initialize app immediately (this script is now loaded dynamically after all dependencies)
initializeApp();

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log("Initializing Market DAO application...");
    
    // Check that all required objects are defined
    console.log("Checking dependencies:", {
        wallet: typeof wallet !== 'undefined',
        contracts: typeof contracts !== 'undefined',
        daoManager: typeof daoManager !== 'undefined',
        proposalManager: typeof proposalManager !== 'undefined',
        uiManager: typeof uiManager !== 'undefined'
    });
    // Initialize UI
    window.uiManager.initialize();
    
    // Add wallet connection event handler
    window.wallet.onConnect(async (address) => {
        console.log(`Wallet connected: ${address}`);
        
        try {
            // Initialize DAO and proposal managers
            await window.daoManager.initialize();
            await window.proposalManager.initialize();
            
            // Enable the UI
            enableUI();
        } catch (error) {
            console.error('Error initializing application:', error);
            Utils.showNotification('Failed to initialize application. Please try again.', 'error');
        }
    });
    
    // Add wallet disconnection event handler
    window.wallet.onDisconnect(() => {
        console.log('Wallet disconnected');
        
        // Clean up
        window.daoManager.cleanup();
        window.proposalManager.cleanup();
        window.uiManager.cleanup();
        
        // Disable the UI
        disableUI();
        
        // Reset UI state
        resetUIState();
    });
    
    // Check if MetaMask is available
    if (!window.wallet.isMetaMaskAvailable()) {
        Utils.showNotification('MetaMask extension not detected. Please install MetaMask to use this application.', 'error');
        disableUI();
        return;
    }
    
    // Try to connect if browser provider is already authenticated
    try {
        if (window.ethereum && window.ethereum.selectedAddress) {
            await window.wallet.connect();
        } else {
            disableUI();
        }
    } catch (error) {
        console.error('Error connecting to wallet:', error);
        disableUI();
    }
}

/**
 * Enable UI elements that require a wallet connection
 */
function enableUI() {
    console.log("Enabling UI elements...");
    
    // Enable all interactive elements
    document.querySelectorAll('button:not(#connectWalletBtn)').forEach(button => {
        button.removeAttribute('disabled');
    });
    
    document.querySelectorAll('input, textarea, select').forEach(element => {
        element.removeAttribute('disabled');
    });
    
    document.querySelectorAll('form').forEach(form => {
        form.removeAttribute('disabled');
    });
    
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.remove('disabled');
    });
    
    console.log("UI elements enabled");
}

/**
 * Disable UI elements that require a wallet connection
 */
function disableUI() {
    console.log("Disabling UI elements due to no wallet connection...");
    
    // Disable form elements except the wallet connect button
    document.querySelectorAll('button:not(#connectWalletBtn), input:not([readonly]), textarea:not([readonly]), select').forEach(element => {
        if (element.id !== 'connectWalletBtn') {
            element.setAttribute('disabled', 'disabled');
        }
    });
    
    document.querySelectorAll('.panel').forEach(panel => {
        if (!panel.id.includes('wallet')) {
            panel.classList.add('disabled');
        }
    });
    
    console.log("UI elements disabled");
}

/**
 * Reset UI state when disconnecting
 */
function resetUIState() {
    // Reset DAO info
    document.getElementById('daoName').textContent = 'Connect wallet to view';
    document.getElementById('supportThreshold').textContent = 'Connect wallet to view';
    document.getElementById('quorumPercentage').textContent = 'Connect wallet to view';
    document.getElementById('maxProposalAge').textContent = 'Connect wallet to view';
    document.getElementById('electionDuration').textContent = 'Connect wallet to view';
    document.getElementById('tokenPrice').textContent = 'Connect wallet to view';
    document.getElementById('userTokens').textContent = 'Connect wallet to view';
    
    // Reset proposal and election lists
    document.getElementById('proposalsList').innerHTML = '<p class="empty-message">Connect wallet to view proposals</p>';
    document.getElementById('electionsList').innerHTML = '<p class="empty-message">Connect wallet to view elections</p>';
    document.getElementById('completedElectionsList').innerHTML = '<p class="empty-message">Connect wallet to view past elections</p>';
    
    // Reset forms
    document.querySelectorAll('form').forEach(form => {
        form.reset();
    });
}
