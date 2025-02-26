
// Simple test to verify the script is loading
console.log("MarketDAO app.js loaded!");

// Contract ABIs
const marketDAOABI = [
    // Basic DAO information
    "function name() view returns (string)",
    "function supportThreshold() view returns (uint256)",
    "function quorumPercentage() view returns (uint256)",
    "function maxProposalAge() view returns (uint256)",
    "function electionDuration() view returns (uint256)",
    "function allowMinting() view returns (bool)",
    "function tokenPrice() view returns (uint256)",
    "function totalSupply(uint256 tokenId) view returns (uint256)",
    
    // Governance tokens functions
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function purchaseTokens() payable",
    "function getGovernanceTokenHolders() view returns (address[])",
    "function acceptsETH() view returns (bool)",
    "function acceptsERC20() view returns (bool)",
    "function acceptsERC721() view returns (bool)",
    "function acceptsERC1155() view returns (bool)",
    "function hasTreasury() view returns (bool)",
    
    // Events to listen for
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)"
];

const proposalFactoryABI = [
    "function dao() view returns (address)",
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (address)",
    "function getProposal(uint256 index) view returns (address)",
    "function createResolutionProposal(string description) returns (address)",
    "function createTreasuryProposal(string description, address recipient, uint256 amount, address token, uint256 tokenId) returns (address)",
    "function createMintProposal(string description, address recipient, uint256 amount) returns (address)",
    "function createTokenPriceProposal(string description, uint256 newPrice) returns (address)"
];

const proposalABI = [
    "function dao() view returns (address)",
    "function proposer() view returns (address)",
    "function createdAt() view returns (uint256)",
    "function description() view returns (string)",
    "function supportTotal() view returns (uint256)",
    "function support(address) view returns (uint256)",
    "function electionTriggered() view returns (bool)",
    "function electionStart() view returns (uint256)",
    "function votingTokenId() view returns (uint256)",
    "function yesVoteAddress() view returns (address)",
    "function noVoteAddress() view returns (address)",
    "function executed() view returns (bool)",
    "function addSupport(uint256 amount)",
    "function removeSupport(uint256 amount)",
    "function execute()",
    "function canTriggerElection() view returns (bool)",
    
    // Additional fields for specific proposal types
    "function recipient() view returns (address)",
    "function amount() view returns (uint256)",
    "function token() view returns (address)",
    "function tokenId() view returns (uint256)",
    "function newPrice() view returns (uint256)"
];

// MarketDAO App
class MarketDAOApp {
    constructor() {
        // Contract addresses
        this.marketDAOAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
        this.proposalFactoryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
        
        // Connection state
        this.provider = null;
        this.signer = null;
        this.daoContract = null;
        this.factoryContract = null;
        this.userAddress = null;
        
        // DOM elements
        this.connectWalletBtn = document.getElementById('connectWallet');
        this.accountInfo = document.getElementById('accountInfo');
        this.accountAddress = document.getElementById('accountAddress');
        this.accountBalance = document.getElementById('accountBalance');
        this.proposalTypeSelect = document.getElementById('proposalType');
        this.submitProposalBtn = document.getElementById('submitProposal');
        this.purchaseTokensBtn = document.getElementById('purchaseTokens');
        this.purchaseTokensSection = document.getElementById('tokenPurchaseSection');
        
        // Initialize app
        this.initApp();
    }
    
    async initApp() {
        console.log("Initializing MarketDAO app...");
        
        // Setup event listeners
        this.connectWalletBtn.addEventListener('click', () => {
            console.log("Connect wallet button clicked");
            this.connectWallet();
        });
        this.proposalTypeSelect.addEventListener('change', () => this.updateProposalFields());
        this.submitProposalBtn.addEventListener('click', () => this.submitProposal());
        this.purchaseTokensBtn.addEventListener('click', () => this.purchaseTokens());
        
        // Check if already connected
        if (window.ethereum) {
            console.log("Ethereum provider detected");
            try {
                // Check if already connected
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                console.log("Existing accounts:", accounts);
                
                if (accounts.length > 0) {
                    this.provider = new ethers.providers.Web3Provider(window.ethereum);
                    await this.setupConnection(accounts[0]);
                } else {
                    console.log("No connected accounts found");
                }
            } catch (error) {
                console.error("Error checking connection:", error);
                this.showNotification(`Connection check failed: ${error.message}`, 'error');
            }
        } else {
            console.log("No Ethereum provider detected");
            this.showNotification('Please install MetaMask or another Ethereum wallet', 'error');
        }
    }
    
    async connectWallet() {
        if (!window.ethereum) {
            this.showNotification('Please install MetaMask or another Ethereum wallet', 'error');
            return;
        }
        
        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            if (accounts.length === 0) {
                this.showNotification('No accounts found. Please unlock your wallet and try again.', 'error');
                return;
            }
            
            // Setup with the first account
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            await this.setupConnection(accounts[0]);
            
            console.log("Connected successfully to:", accounts[0]);
        } catch (error) {
            console.error("Connection error:", error);
            this.showNotification(`Connection failed: ${error.message}`, 'error');
        }
    }
    
    async setupConnection(address) {
        console.log("Setting up connection for address:", address);
        
        // Set user address
        this.userAddress = address;
        this.signer = this.provider.getSigner();
        
        // Create contract instances
        try {
            console.log("Creating contract instances...");
            this.daoContract = new ethers.Contract(this.marketDAOAddress, marketDAOABI, this.signer);
            this.factoryContract = new ethers.Contract(this.proposalFactoryAddress, proposalFactoryABI, this.signer);
            
            // Update UI
            this.connectWalletBtn.classList.add('hidden');
            this.accountInfo.classList.remove('hidden');
            this.accountAddress.textContent = `${address.substr(0, 6)}...${address.substr(-4)}`;
            
            // Load DAO data
            console.log("Loading DAO information...");
            await this.loadDAOInfo();
            
            // Load user's token balance
            console.log("Loading user balance...");
            await this.loadUserBalance();
            
            // Load proposals and elections
            console.log("Loading proposals...");
            await this.loadProposals();
            
            // Setup event listeners for blockchain events
            console.log("Setting up event listeners...");
            this.setupEventListeners();
            
            console.log("Connection setup complete");
        } catch (error) {
            console.error("Error during setup:", error);
            this.showNotification(`Connection setup failed: ${error.message}`, 'error');
        }
    }
    
    async loadDAOInfo() {
        try {
            const daoName = await this.daoContract.name();
            const supportThreshold = await this.daoContract.supportThreshold();
            const quorumPercentage = await this.daoContract.quorumPercentage();
            const maxProposalAge = await this.daoContract.maxProposalAge();
            const electionDuration = await this.daoContract.electionDuration();
            const allowMinting = await this.daoContract.allowMinting();
            const tokenPrice = await this.daoContract.tokenPrice();
            const totalSupply = await this.daoContract.totalSupply(0); // Governance token ID is 0
            
            // Update UI
            document.getElementById('daoName').textContent = daoName;
            document.getElementById('supportThreshold').textContent = `${supportThreshold}%`;
            document.getElementById('quorumPercentage').textContent = `${quorumPercentage}%`;
            document.getElementById('maxProposalAge').textContent = `${maxProposalAge} blocks`;
            document.getElementById('electionDuration').textContent = `${electionDuration} blocks`;
            document.getElementById('allowMinting').textContent = allowMinting ? 'Yes' : 'No';
            document.getElementById('tokenPrice').textContent = tokenPrice > 0 ? 
                `${ethers.utils.formatEther(tokenPrice)} ETH` : 'Direct sales disabled';
            document.getElementById('totalGovernanceTokens').textContent = ethers.utils.commify(totalSupply);
            
            // Show purchase section if tokens can be bought directly
            if (tokenPrice > 0) {
                this.purchaseTokensSection.classList.remove('hidden');
            }
            
        } catch (error) {
            this.showNotification(`Failed to load DAO info: ${error.message}`, 'error');
        }
    }
    
    async loadUserBalance() {
        try {
            const balance = await this.daoContract.balanceOf(this.userAddress, 0);
            this.accountBalance.textContent = `${ethers.utils.commify(balance)} governance tokens`;
            document.getElementById('userGovernanceTokens').textContent = ethers.utils.commify(balance);
        } catch (error) {
            this.showNotification(`Failed to load user balance: ${error.message}`, 'error');
        }
    }
    
    async loadProposals() {
        try {
            const proposalCount = await this.factoryContract.proposalCount();
            
            if (proposalCount.toNumber() === 0) {
                document.querySelector('#proposalsList').innerHTML = '<p class="empty-message">No active proposals found</p>';
                document.querySelector('#electionsList').innerHTML = '<p class="empty-message">No active elections found</p>';
                document.querySelector('#pastElectionsList').innerHTML = '<p class="empty-message">No past elections found</p>';
                return;
            }
            
            const activeProposals = [];
            const activeElections = [];
            const pastElections = [];
            
            for (let i = 0; i < proposalCount.toNumber(); i++) {
                const proposalAddress = await this.factoryContract.getProposal(i);
                const proposalContract = new ethers.Contract(proposalAddress, proposalABI, this.signer);
                
                const description = await proposalContract.description();
                const proposer = await proposalContract.proposer();
                const createdAt = await proposalContract.createdAt();
                const supportTotal = await proposalContract.supportTotal();
                const userSupport = await proposalContract.support(this.userAddress);
                const electionTriggered = await proposalContract.electionTriggered();
                const proposalType = await this.determineProposalType(proposalContract);
                
                const proposalData = {
                    address: proposalAddress,
                    description,
                    proposer,
                    createdAt: createdAt.toNumber(),
                    supportTotal: supportTotal.toString(),
                    userSupport: userSupport.toString(),
                    electionTriggered,
                    type: proposalType
                };
                
                if (electionTriggered) {
                    const electionStart = await proposalContract.electionStart();
                    const votingTokenId = await proposalContract.votingTokenId();
                    const yesVoteAddress = await proposalContract.yesVoteAddress();
                    const noVoteAddress = await proposalContract.noVoteAddress();
                    const executed = await proposalContract.executed();
                    const currentBlock = await this.provider.getBlockNumber();
                    const electionDuration = await this.daoContract.electionDuration();
                    const endBlock = electionStart.add(electionDuration);
                    
                    // Get vote counts
                    const yesVotes = await this.daoContract.balanceOf(yesVoteAddress, votingTokenId);
                    const noVotes = await this.daoContract.balanceOf(noVoteAddress, votingTokenId);
                    const userVotingTokens = await this.daoContract.balanceOf(this.userAddress, votingTokenId);
                    
                    // Add additional election data
                    proposalData.electionStart = electionStart.toNumber();
                    proposalData.votingTokenId = votingTokenId.toNumber();
                    proposalData.yesVoteAddress = yesVoteAddress;
                    proposalData.noVoteAddress = noVoteAddress;
                    proposalData.executed = executed;
                    proposalData.yesVotes = yesVotes.toString();
                    proposalData.noVotes = noVotes.toString();
                    proposalData.userVotingTokens = userVotingTokens.toString();
                    proposalData.endBlock = endBlock.toNumber();
                    
                    // Determine if the election is active or past
                    if (currentBlock < endBlock.toNumber() && !executed) {
                        activeElections.push(proposalData);
                    } else {
                        pastElections.push(proposalData);
                    }
                } else {
                    activeProposals.push(proposalData);
                }
            }
            
            // Update UI with the proposals
            this.displayActiveProposals(activeProposals);
            this.displayActiveElections(activeElections);
            this.displayPastElections(pastElections);
            
        } catch (error) {
            this.showNotification(`Failed to load proposals: ${error.message}`, 'error');
            console.error(error);
        }
    }
    
    updateProposalFields() {
        const selectedType = this.proposalTypeSelect.value;
        
        // Hide all conditional fields first
        document.querySelectorAll('.conditional-fields').forEach(el => el.classList.add('hidden'));
        
        // Show fields based on selection
        if (selectedType === 'treasury') {
            document.getElementById('treasuryFields').classList.remove('hidden');
        } else if (selectedType === 'mint') {
            document.getElementById('mintFields').classList.remove('hidden');
        } else if (selectedType === 'price') {
            document.getElementById('priceFields').classList.remove('hidden');
        }
    }
    
    async submitProposal() {
        try {
            const proposalType = this.proposalTypeSelect.value;
            const description = document.getElementById('proposalDescription').value.trim();
            
            if (!description) {
                this.showNotification('Please enter a proposal description', 'error');
                return;
            }
            
            this.submitProposalBtn.disabled = true;
            this.submitProposalBtn.textContent = 'Submitting...';
            
            let tx;
            
            if (proposalType === 'resolution') {
                tx = await this.factoryContract.createResolutionProposal(description);
            } 
            else if (proposalType === 'treasury') {
                const recipient = document.getElementById('treasuryRecipient').value;
                const amount = document.getElementById('treasuryAmount').value;
                const token = document.getElementById('treasuryToken').value || ethers.constants.AddressZero;
                const tokenId = document.getElementById('treasuryTokenId').value || 0;
                
                if (!ethers.utils.isAddress(recipient)) {
                    this.showNotification('Please enter a valid recipient address', 'error');
                    this.submitProposalBtn.disabled = false;
                    this.submitProposalBtn.textContent = 'Submit Proposal';
                    return;
                }
                
                if (!amount || parseInt(amount) <= 0) {
                    this.showNotification('Please enter a valid amount', 'error');
                    this.submitProposalBtn.disabled = false;
                    this.submitProposalBtn.textContent = 'Submit Proposal';
                    return;
                }
                
                tx = await this.factoryContract.createTreasuryProposal(
                    description,
                    recipient,
                    amount,
                    token,
                    tokenId
                );
            } 
            else if (proposalType === 'mint') {
                const recipient = document.getElementById('mintRecipient').value;
                const amount = document.getElementById('mintAmount').value;
                
                if (!ethers.utils.isAddress(recipient)) {
                    this.showNotification('Please enter a valid recipient address', 'error');
                    this.submitProposalBtn.disabled = false;
                    this.submitProposalBtn.textContent = 'Submit Proposal';
                    return;
                }
                
                if (!amount || parseInt(amount) <= 0) {
                    this.showNotification('Please enter a valid amount', 'error');
                    this.submitProposalBtn.disabled = false;
                    this.submitProposalBtn.textContent = 'Submit Proposal';
                    return;
                }
                
                tx = await this.factoryContract.createMintProposal(
                    description,
                    recipient,
                    amount
                );
            } 
            else if (proposalType === 'price') {
                const newPrice = document.getElementById('newTokenPrice').value;
                
                if (newPrice === '' || parseInt(newPrice) < 0) {
                    this.showNotification('Please enter a valid price', 'error');
                    this.submitProposalBtn.disabled = false;
                    this.submitProposalBtn.textContent = 'Submit Proposal';
                    return;
                }
                
                tx = await this.factoryContract.createTokenPriceProposal(
                    description,
                    newPrice
                );
            }
            
            // Wait for transaction confirmation
            await tx.wait();
            
            this.showNotification(`Proposal created successfully!`, 'success');
            
            // Reset form
            document.getElementById('proposalDescription').value = '';
            document.getElementById('treasuryRecipient').value = '';
            document.getElementById('treasuryAmount').value = '';
            document.getElementById('treasuryToken').value = '';
            document.getElementById('treasuryTokenId').value = '0';
            document.getElementById('mintRecipient').value = '';
            document.getElementById('mintAmount').value = '';
            document.getElementById('newTokenPrice').value = '';
            
            // Reload proposals
            await this.loadProposals();
            
        } catch (error) {
            this.showNotification(`Failed to create proposal: ${error.message}`, 'error');
            console.error(error);
        } finally {
            this.submitProposalBtn.disabled = false;
            this.submitProposalBtn.textContent = 'Submit Proposal';
        }
    }
    
    async purchaseTokens() {
        try {
            const amount = document.getElementById('purchaseAmount').value;
            
            if (!amount || parseInt(amount) <= 0) {
                this.showNotification('Please enter a valid amount', 'error');
                return;
            }
            
            const tokenPrice = await this.daoContract.tokenPrice();
            if (tokenPrice.eq(0)) {
                this.showNotification('Direct token sales are disabled', 'error');
                return;
            }
            
            const totalCost = tokenPrice.mul(amount);
            
            this.purchaseTokensBtn.disabled = true;
            this.purchaseTokensBtn.textContent = 'Purchasing...';
            
            const tx = await this.daoContract.purchaseTokens({
                value: totalCost
            });
            
            await tx.wait();
            
            this.showNotification(`Successfully purchased ${amount} governance tokens!`, 'success');
            
            // Reset form and reload user balance
            document.getElementById('purchaseAmount').value = '';
            await this.loadUserBalance();
            
        } catch (error) {
            this.showNotification(`Failed to purchase tokens: ${error.message}`, 'error');
            console.error(error);
        } finally {
            this.purchaseTokensBtn.disabled = false;
            this.purchaseTokensBtn.textContent = 'Purchase';
        }
    }
    
    setupEventListeners() {
        // Listen for token transfers
        this.daoContract.on("TransferSingle", async (operator, from, to, id, value) => {
            // If it involves the current user, refresh their balance
            if (from.toLowerCase() === this.userAddress.toLowerCase() || 
                to.toLowerCase() === this.userAddress.toLowerCase()) {
                await this.loadUserBalance();
            }
            
            // If it's a governance token transfer, refresh proposals
            if (id.toNumber() === 0) {
                await this.loadProposals();
            }
        });
    }
    
    displayActiveProposals(proposals) {
        const container = document.getElementById('proposalsList');
        
        if (proposals.length === 0) {
            container.innerHTML = '<p class="empty-message">No active proposals found</p>';
            return;
        }
        
        container.innerHTML = '';
        const template = document.getElementById('proposalTemplate');
        
        proposals.forEach(proposal => {
            const element = template.content.cloneNode(true);
            
            element.querySelector('.proposal-title').textContent = 
                `Proposal #${proposal.address.substr(-4)} - ${proposal.type}`;
            element.querySelector('.proposal-description').textContent = proposal.description;
            element.querySelector('.proposal-type').textContent = proposal.type;
            element.querySelector('.proposal-proposer').textContent = 
                `${proposal.proposer.substr(0, 6)}...${proposal.proposer.substr(-4)}`;
            element.querySelector('.proposal-created').textContent = 
                `Block #${proposal.createdAt}`;
            element.querySelector('.proposal-support').textContent = 
                `${proposal.supportTotal} (Your support: ${proposal.userSupport})`;
            
            const supportInput = element.querySelector('.support-amount');
            const addSupportBtn = element.querySelector('.add-support');
            const removeSupportBtn = element.querySelector('.remove-support');
            
            // Add support action
            addSupportBtn.addEventListener('click', async () => {
                const amount = supportInput.value;
                if (!amount || parseInt(amount) <= 0) {
                    this.showNotification('Please enter a valid amount', 'error');
                    return;
                }
                
                try {
                    addSupportBtn.disabled = true;
                    addSupportBtn.textContent = 'Processing...';
                    
                    const proposalContract = new ethers.Contract(proposal.address, proposalABI, this.signer);
                    const tx = await proposalContract.addSupport(amount);
                    await tx.wait();
                    
                    this.showNotification(`Successfully added support!`, 'success');
                    await this.loadProposals();
                } catch (error) {
                    this.showNotification(`Failed to add support: ${error.message}`, 'error');
                    console.error(error);
                } finally {
                    addSupportBtn.disabled = false;
                    addSupportBtn.textContent = 'Add Support';
                }
            });
            
            // Remove support action
            removeSupportBtn.addEventListener('click', async () => {
                const amount = supportInput.value;
                if (!amount || parseInt(amount) <= 0) {
                    this.showNotification('Please enter a valid amount', 'error');
                    return;
                }
                
                try {
                    removeSupportBtn.disabled = true;
                    removeSupportBtn.textContent = 'Processing...';
                    
                    const proposalContract = new ethers.Contract(proposal.address, proposalABI, this.signer);
                    const tx = await proposalContract.removeSupport(amount);
                    await tx.wait();
                    
                    this.showNotification(`Successfully removed support!`, 'success');
                    await this.loadProposals();
                } catch (error) {
                    this.showNotification(`Failed to remove support: ${error.message}`, 'error');
                    console.error(error);
                } finally {
                    removeSupportBtn.disabled = false;
                    removeSupportBtn.textContent = 'Remove Support';
                }
            });
            
            container.appendChild(element);
        });
    }
    
    displayActiveElections(elections) {
        const container = document.getElementById('electionsList');
        
        if (elections.length === 0) {
            container.innerHTML = '<p class="empty-message">No active elections found</p>';
            return;
        }
        
        container.innerHTML = '';
        const template = document.getElementById('electionTemplate');
        
        elections.forEach(election => {
            const element = template.content.cloneNode(true);
            
            element.querySelector('.election-title').textContent = 
                `Election #${election.address.substr(-4)} - ${election.type}`;
            element.querySelector('.election-description').textContent = election.description;
            element.querySelector('.election-type').textContent = election.type;
            element.querySelector('.election-status').textContent = 'Active';
            element.querySelector('.yes-votes').textContent = election.yesVotes;
            element.querySelector('.no-votes').textContent = election.noVotes;
            element.querySelector('.end-block').textContent = `#${election.endBlock}`;
            element.querySelector('.user-tokens').textContent = election.userVotingTokens;
            
            const voteYesBtn = element.querySelector('.vote-yes');
            const voteNoBtn = element.querySelector('.vote-no');
            const executeBtn = element.querySelector('.execute');
            
            // Hide execute button during active election
            executeBtn.classList.add('hidden');
            
            // Vote Yes action
            voteYesBtn.addEventListener('click', async () => {
                await this.vote(election, true);
            });
            
            // Vote No action
            voteNoBtn.addEventListener('click', async () => {
                await this.vote(election, false);
            });
            
            container.appendChild(element);
        });
    }
    
    displayPastElections(elections) {
        const container = document.getElementById('pastElectionsList');
        
        if (elections.length === 0) {
            container.innerHTML = '<p class="empty-message">No past elections found</p>';
            return;
        }
        
        container.innerHTML = '';
        const template = document.getElementById('pastElectionTemplate');
        
        elections.forEach(election => {
            const element = template.content.cloneNode(true);
            
            const result = election.executed ? 'Passed' : 
                           parseInt(election.yesVotes) > parseInt(election.noVotes) ? 'Passed (Not Executed)' : 'Rejected';
            
            element.querySelector('.past-election-title').textContent = 
                `Election #${election.address.substr(-4)} - ${election.type}`;
            element.querySelector('.past-election-description').textContent = election.description;
            element.querySelector('.past-election-type').textContent = election.type;
            element.querySelector('.past-election-result').textContent = result;
            element.querySelector('.past-yes-votes').textContent = election.yesVotes;
            element.querySelector('.past-no-votes').textContent = election.noVotes;
            element.querySelector('.past-executed').textContent = election.executed ? 'Yes' : 'No';
            
            container.appendChild(element);
        });
    }
    
    async vote(election, isYesVote) {
        const voteAddress = isYesVote ? election.yesVoteAddress : election.noVoteAddress;
        const voteType = isYesVote ? 'Yes' : 'No';
        
        if (parseInt(election.userVotingTokens) <= 0) {
            this.showNotification('You have no voting tokens for this election', 'error');
            return;
        }
        
        try {
            // First, get approval to transfer all voting tokens
            const tx = await this.daoContract.safeTransferFrom(
                this.userAddress,
                voteAddress,
                election.votingTokenId,
                election.userVotingTokens,
                "0x"
            );
            
            await tx.wait();
            
            this.showNotification(`Successfully voted ${voteType}!`, 'success');
            await this.loadProposals();
        } catch (error) {
            this.showNotification(`Failed to vote: ${error.message}`, 'error');
            console.error(error);
        }
    }
    
    showNotification(message, type = 'info') {
        console.log(`Notification (${type}):`, message);
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notificationContainer');
        if (!container) {
            console.error("Notification container not found!");
            return;
        }
        
        container.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // Execute a proposal
    async executeProposal(election) {
        try {
            const proposalContract = new ethers.Contract(election.address, proposalABI, this.signer);
            
            // Check if the proposal can be executed
            const yesVotes = parseInt(election.yesVotes);
            const noVotes = parseInt(election.noVotes);
            
            if (yesVotes <= noVotes) {
                this.showNotification('This proposal cannot be executed as it did not pass', 'error');
                return;
            }
            
            const tx = await proposalContract.execute();
            await tx.wait();
            
            this.showNotification('Proposal executed successfully!', 'success');
            await this.loadProposals();
        } catch (error) {
            this.showNotification(`Failed to execute proposal: ${error.message}`, 'error');
            console.error(error);
        }
    }
    
    // Helper function to get proposal type name from contract address
    async determineProposalType(proposalContract) {
        try {
            // Try to access specific fields to determine type
            if (await proposalContract.newPrice) {
                return 'Token Price Change';
            } else if (await proposalContract.token) {
                return 'Treasury Transfer';
            } else if (await proposalContract.recipient && await proposalContract.amount) {
                return 'Mint Governance Tokens';
            } else {
                return 'Resolution';
            }
        } catch (error) {
            return 'Unknown';
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const app = new MarketDAOApp();
});
