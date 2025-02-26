// ui.js - Handles UI initialization and interactions

/**
 * Initialize the UI components
 * @param {Object} state - Application state
 */
export function initUI(state) {
    setupTabs();
    setupProposalTypeSelector();
    setupNotificationClose();
}

/**
 * Setup tab switching functionality
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab content
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * Setup proposal type selector to show/hide relevant fields
 */
function setupProposalTypeSelector() {
    const proposalTypeSelect = document.getElementById('proposal-type');
    const proposalFields = document.querySelectorAll('.proposal-field');
    
    proposalTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        
        // Hide all proposal fields
        proposalFields.forEach(field => field.style.display = 'none');
        
        // Show fields for the selected proposal type
        if (selectedType !== 'resolution') {
            document.querySelectorAll(`.${selectedType}-field`).forEach(field => {
                field.style.display = 'block';
            });
        }
    });
}

/**
 * Setup notification close button
 */
function setupNotificationClose() {
    const closeButton = document.getElementById('notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.getElementById('notification').style.display = 'none';
        });
    }
}

/**
 * Format an address for display (0x1234...5678)
 * @param {string} address - The address to format
 * @returns {string} - Formatted address
 */
export function formatAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Format Wei to Ether
 * @param {ethers.BigNumber} wei - The amount in Wei
 * @returns {string} - Formatted Ether amount
 */
export function formatEther(wei) {
    return ethers.utils.formatEther(wei);
}

/**
 * Update DAO information in the UI
 * @param {Object} daoInfo - DAO information object
 * @param {Object} userInfo - User information object
 */
export function updateDaoInfo(daoInfo, userInfo) {
    document.getElementById('dao-name').textContent = daoInfo.name || 'Unknown';
    document.getElementById('support-threshold').textContent = `${daoInfo.supportThreshold || 0}%`;
    document.getElementById('quorum').textContent = `${daoInfo.quorumPercentage || 0}%`;
    document.getElementById('max-proposal-age').textContent = `${daoInfo.maxProposalAge || 0} blocks`;
    document.getElementById('election-duration').textContent = `${daoInfo.electionDuration || 0} blocks`;
    document.getElementById('token-price').textContent = daoInfo.tokenPrice ? 
        `${ethers.utils.formatEther(daoInfo.tokenPrice)} ETH` : '0 ETH';
    
    // Update user balance if available
    if (userInfo) {
        document.getElementById('governance-balance').textContent = userInfo.balance.toString();
    }
}

/**
 * Update wallet connection status in the UI
 * @param {boolean} connected - Whether wallet is connected
 * @param {string} account - Connected account address
 */
export function updateWalletStatus(connected, account) {
    const walletAddressElement = document.getElementById('wallet-address');
    const connectWalletButton = document.getElementById('connect-wallet');
    
    if (connected && account) {
        walletAddressElement.textContent = formatAddress(account);
        connectWalletButton.textContent = 'Connected';
        connectWalletButton.classList.add('success');
    } else {
        walletAddressElement.textContent = 'Not connected';
        connectWalletButton.textContent = 'Connect Wallet';
        connectWalletButton.classList.remove('success');
    }
}

/**
 * Show a loading spinner or message
 * @param {string} elementId - ID of the element to show loading state
 * @param {string} message - Loading message to display
 */
export function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Hide the loading spinner
 * @param {string} elementId - ID of the element to hide loading state
 */
export function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const loading = element.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}
