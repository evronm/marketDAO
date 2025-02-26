// Main application entry point
import { initWeb3 } from './web3.js';
import { initUI } from './ui.js';
import { initContract } from './contract.js';
import { ProposalManager } from './proposals.js';
import { ElectionManager } from './elections.js';
import { NotificationManager } from './notification.js';

// Global application state
const state = {
    connected: false,
    account: null,
    contracts: {},
    daoInfo: {},
    userInfo: {
        balance: 0
    },
    proposals: [],
    elections: [],
    pastElections: []
};

// Initialize the application
async function init() {
    // Initialize notification system
    const notificationManager = new NotificationManager();
    window.notify = notificationManager.show.bind(notificationManager);
    
    try {
        // Initialize Web3 and connect to blockchain
        const web3Provider = await initWeb3();
        if (!web3Provider) {
            console.error('Failed to initialize Web3');
            return;
        }
        
        // Initialize contracts
        const contracts = await initContract(web3Provider);
        state.contracts = contracts;
        
        // Initialize UI
        initUI(state);
        
        // Initialize managers with state access
        const proposalManager = new ProposalManager(state);
        const electionManager = new ElectionManager(state);
        
        // Load initial data
        await loadInitialData();
        
        // Setup event listeners
        setupEventListeners(proposalManager, electionManager);
        
        window.notify('Application initialized successfully', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        window.notify('Failed to initialize application: ' + error.message, 'error');
    }
}

// Load initial data from the contracts
async function loadInitialData() {
    try {
        // Get DAO information
        const daoContract = state.contracts.dao;
        const [
            name,
            supportThreshold,
            quorumPercentage,
            maxProposalAge,
            electionDuration,
            allowMinting,
            tokenPrice,
        ] = await Promise.all([
            daoContract.name(),
            daoContract.supportThreshold(),
            daoContract.quorumPercentage(),
            daoContract.maxProposalAge(),
            daoContract.electionDuration(),
            daoContract.allowMinting(),
            daoContract.tokenPrice(),
        ]);
        
        state.daoInfo = {
            name,
            supportThreshold: supportThreshold.toNumber(),
            quorumPercentage: quorumPercentage.toNumber(),
            maxProposalAge: maxProposalAge.toNumber(),
            electionDuration: electionDuration.toNumber(),
            allowMinting,
            tokenPrice
        };
        
        // Update UI with DAO info
        document.getElementById('dao-name').textContent = name;
        document.getElementById('support-threshold').textContent = `${supportThreshold}%`;
        document.getElementById('quorum').textContent = `${quorumPercentage}%`;
        document.getElementById('max-proposal-age').textContent = `${maxProposalAge} blocks`;
        document.getElementById('election-duration').textContent = `${electionDuration} blocks`;
        document.getElementById('token-price').textContent = `${ethers.utils.formatEther(tokenPrice)} ETH`;
        
        // If user is connected, get governance token balance
        if (state.account) {
            const balance = await daoContract.balanceOf(state.account, 0);
            state.userInfo.balance = balance;
            document.getElementById('governance-balance').textContent = balance.toString();
        }
        
        // TODO: Load active proposals, elections, and past elections
    } catch (error) {
        console.error('Error loading initial data:', error);
        window.notify('Failed to load DAO information', 'error');
    }
}

// Setup event listeners for the UI
function setupEventListeners(proposalManager, electionManager) {
    // Connect wallet button
    document.getElementById('connect-wallet').addEventListener('click', async () => {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            state.account = accounts[0];
            state.connected = true;
            
            // Update UI
            document.getElementById('wallet-address').textContent = 
                `${state.account.substring(0, 6)}...${state.account.substring(38)}`;
            document.getElementById('connect-wallet').textContent = 'Connected';
            
            // Load user-specific data
            const balance = await state.contracts.dao.balanceOf(state.account, 0);
            state.userInfo.balance = balance;
            document.getElementById('governance-balance').textContent = balance.toString();
            
            window.notify('Wallet connected successfully', 'success');
        } catch (error) {
            console.error('Error connecting wallet:', error);
            window.notify('Failed to connect wallet: ' + error.message, 'error');
        }
    });
    
    // Purchase tokens button
    document.getElementById('purchase-tokens').addEventListener('click', async () => {
        if (!state.connected) {
            window.notify('Please connect your wallet first', 'warning');
            return;
        }
        
        const amountInput = document.getElementById('purchase-amount');
        const amount = amountInput.value.trim();
        
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            window.notify('Please enter a valid amount', 'warning');
            return;
        }
        
        try {
            const amountWei = ethers.utils.parseEther(amount);
            const tx = await state.contracts.dao.purchaseTokens({
                value: amountWei
            });
            
            window.notify('Transaction sent, waiting for confirmation...', 'info');
            
            await tx.wait();
            
            // Update balance
            const balance = await state.contracts.dao.balanceOf(state.account, 0);
            state.userInfo.balance = balance;
            document.getElementById('governance-balance').textContent = balance.toString();
            
            window.notify('Tokens purchased successfully', 'success');
            amountInput.value = '';
        } catch (error) {
            console.error('Error purchasing tokens:', error);
            window.notify('Failed to purchase tokens: ' + error.message, 'error');
        }
    });
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update tab buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update tab content
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Proposal type selector
    document.getElementById('proposal-type').addEventListener('change', function() {
        const proposalType = this.value;
        
        // Hide all proposal-specific fields
        document.querySelectorAll('.proposal-field').forEach(field => {
            field.style.display = 'none';
        });
        
        // Show fields for the selected proposal type
        if (proposalType !== 'resolution') {
            document.querySelectorAll(`.${proposalType}-field`).forEach(field => {
                field.style.display = 'block';
            });
        }
    });
    
    // Create proposal button
    document.getElementById('create-proposal-btn').addEventListener('click', () => {
        proposalManager.createProposal();
    });
}

// Initialize application when the page loads
document.addEventListener('DOMContentLoaded', init);

// Handle account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        window.location.reload();
    });
    
    window.ethereum.on('chainChanged', () => {
        window.location.reload();
    });
}
