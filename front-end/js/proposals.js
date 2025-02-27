/**
 * Proposal management for Market DAO
 * Handles creation, display, and interaction with proposals
 */
class ProposalManager {
    constructor() {
        this.proposals = [];
        this.daoInfo = null;
        
        // Initialize when contracts are ready
        window.addEventListener('contracts-initialized', () => this.initialize());
        
        // Refresh when wallet changes
        window.addEventListener('wallet-connected', () => this.loadProposals());
        window.addEventListener('wallet-account-changed', () => this.loadProposals());
        
        // Refresh when switching back to proposals tab
        window.addEventListener('section-changed', (event) => {
            if (event.detail.section === 'proposals') {
                this.loadProposals();
            }
        });
    }
    
    /**
     * Initialize proposal manager
     */
    initialize() {
        console.log('Initializing proposal manager');
        this.setupEventListeners();
        
        // Load proposals if on proposals tab
        if (UI.activeSection === 'proposals') {
            this.loadProposals();
        }
    }
    
    /**
     * Setup event listeners for proposal actions
     */
    setupEventListeners() {
        // Proposal form submission
        const proposalForm = document.getElementById('create-proposal-form');
        if (proposalForm) {
            proposalForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleProposalCreation();
            });
        }
        
        // Purchase amount change listener for total calculation
        const purchaseAmount = document.getElementById('purchase-amount');
        if (purchaseAmount) {
            purchaseAmount.addEventListener('input', () => this.updatePurchaseTotal());
        }
        
        // Purchase tokens button
        const purchaseBtn = document.getElementById('purchase-tokens-btn');
        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', () => this.handleTokenPurchase());
        }
    }
    
    /**
     * Load DAO information
     */
    async loadDAOInfo() {
        try {
            this.daoInfo = await Contracts.fetchDAOInfo();
            
            // Update token price display
            const currentTokenPrice = document.getElementById('current-token-price');
            if (currentTokenPrice) {
                currentTokenPrice.textContent = this.daoInfo.tokenPrice == 0 
                    ? 'Sales Disabled' 
                    : UI.formatEth(this.daoInfo.tokenPrice);
            }
            
            // Enable/disable purchase section
            const purchaseContainer = document.getElementById('token-purchase-container');
            if (purchaseContainer) {
                if (this.daoInfo.tokenPrice == 0) {
                    purchaseContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-lock"></i>
                            <p>Token purchases are currently disabled</p>
                        </div>
                    `;
                }
            }
            
            // Update dashboard
            UI.updateDashboard(this.daoInfo);
            
            // Update purchase total if needed
            this.updatePurchaseTotal();
            
            return this.daoInfo;
        } catch (error) {
            console.error('Error loading DAO info:', error);
            UI.showNotification('error', 'Error', 'Failed to load DAO information');
            return null;
        }
    }
    
    /**
     * Load proposals and update UI
     */
    async loadProposals() {
        // Load DAO info first to get support threshold
        if (!this.daoInfo) {
            await this.loadDAOInfo();
        }
        
        // Clear proposals lists
        const activeProposalsList = document.getElementById('active-proposals-list');
        const myProposalsList = document.getElementById('my-proposals-list');
        
        if (activeProposalsList) {
            activeProposalsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading proposals...</p></div>';
        }
        
        if (myProposalsList) {
            myProposalsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading your proposals...</p></div>';
        }
        
        try {
            // Fetch proposals
            this.proposals = await Contracts.fetchProposals();
            
            // Separate active and completed proposals
            const activeProposals = this.proposals.filter(p => !p.electionTriggered && !p.executed);
            const myProposals = Wallet.isWalletConnected() 
                ? this.proposals.filter(p => p.proposer.toLowerCase() === Wallet.getAddress().toLowerCase())
                : [];
            
            // Update UI
            this.renderProposalsList(activeProposalsList, activeProposals, 'active');
            this.renderProposalsList(myProposalsList, myProposals, 'my');
            
            // Dispatch event for elections
            window.dispatchEvent(new CustomEvent('proposals-loaded', {
                detail: { proposals: this.proposals }
            }));
            
            // Update token balance if wallet is connected
            if (Wallet.isWalletConnected()) {
                this.updateTokenBalance();
            }
        } catch (error) {
            console.error('Error loading proposals:', error);
            UI.showNotification('error', 'Error', 'Failed to load proposals');
            
            if (activeProposalsList) {
                activeProposalsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading proposals</p></div>';
            }
            
            if (myProposalsList) {
                myProposalsList.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading your proposals</p></div>';
            }
        }
    }
    
    /**
     * Render a list of proposals
     * @param {HTMLElement} container - Container element
     * @param {Array} proposals - Array of proposal objects
     * @param {string} listType - Type of list (active, my)
     */
    renderProposalsList(container, proposals, listType) {
        if (!container) return;
        
        if (proposals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-signature"></i>
                    <p>${listType === 'active' ? 'No active proposals found' : 'You haven\'t created any proposals'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        // Sort proposals by creation date (newest first)
        proposals.sort((a, b) => b.createdAt - a.createdAt);
        
        proposals.forEach(proposal => {
            const card = this.createProposalCard(proposal);
            container.appendChild(card);
        });
    }
    
    /**
     * Create a proposal card element
     * @param {Object} proposal - Proposal data
     */
    createProposalCard(proposal) {
        const template = document.getElementById('proposal-card-template');
        const card = template.content.cloneNode(true).querySelector('.proposal-card');
        
        // Set proposal ID and address
        card.setAttribute('data-id', proposal.id);
        card.setAttribute('data-address', proposal.address);
        
        // Update type label
        const typeLabel = card.querySelector('.proposal-type');
        let typeText = 'Resolution';
        let typeClass = 'resolution';
        
        switch (proposal.type) {
            case 'treasury':
                typeText = 'Treasury';
                typeClass = 'treasury';
                break;
            case 'mint':
                typeText = 'Mint Tokens';
                typeClass = 'mint';
                break;
            case 'token-price':
                typeText = 'Token Price';
                typeClass = 'token-price';
                break;
        }
        
        typeLabel.textContent = typeText;
        typeLabel.classList.add(typeClass);
        
        // Set proposal ID
        card.querySelector('.proposal-id').textContent = `#${proposal.id}`;
        
        // Set description
        card.querySelector('.proposal-description').textContent = proposal.description;
        
        // Set proposal details based on type
        const detailsElement = card.querySelector('.proposal-details');
        
        if (proposal.type === 'treasury') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${UI.formatAddress(proposal.recipient)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${UI.formatEth(proposal.amount)}</span>
                </div>
            `;
        } else if (proposal.type === 'mint') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${UI.formatAddress(proposal.recipient)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${proposal.amount} tokens</span>
                </div>
            `;
        } else if (proposal.type === 'token-price') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">New Price:</span>
                    <span class="detail-value">${UI.formatEth(proposal.newPrice)}</span>
                </div>
            `;
        } else {
            // Resolution proposal
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Proposer:</span>
                    <span class="detail-value">${UI.formatAddress(proposal.proposer)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created:</span>
                    <span class="detail-value">Block #${proposal.createdAt}</span>
                </div>
            `;
        }
        
        // Set support progress
        const progressFill = card.querySelector('.progress-fill');
        const supportValue = card.querySelector('.progress-value');
        
        if (this.daoInfo && this.daoInfo.tokenSupply > 0) {
            const supportPercent = (proposal.supportTotal / this.daoInfo.tokenSupply) * 100;
            const thresholdPercent = this.daoInfo.supportThreshold;
            
            progressFill.style.width = `${supportPercent}%`;
            supportValue.textContent = `${proposal.supportTotal} / ${this.daoInfo.tokenSupply} (${supportPercent.toFixed(1)}%)`;
            
            // Add indicator for threshold
            const progressBar = card.querySelector('.progress-bar');
            const thresholdIndicator = document.createElement('div');
            thresholdIndicator.className = 'threshold-indicator';
            thresholdIndicator.style.left = `${thresholdPercent}%`;
            thresholdIndicator.setAttribute('title', `${thresholdPercent}% Threshold`);
            progressBar.appendChild(thresholdIndicator);
        } else {
            progressFill.style.width = '0%';
            supportValue.textContent = `${proposal.supportTotal} / Unknown`;
        }
        
        // Setup action buttons
        const supportBtn = card.querySelector('.btn-support');
        const detailsBtn = card.querySelector('.btn-details');
        
        supportBtn.addEventListener('click', () => {
            this.handleSupportProposal(proposal);
        });
        
        detailsBtn.addEventListener('click', () => {
            this.showProposalDetails(proposal);
        });
        
        return card;
    }
    
    /**
     * Show proposal details in a modal
     * @param {Object} proposal - Proposal data
     */
    showProposalDetails(proposal) {
        let detailsHtml = `
            <div class="proposal-details-modal">
                <div class="detail-item">
                    <span class="detail-label">Proposal ID:</span>
                    <span class="detail-value">#${proposal.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${proposal.type.charAt(0).toUpperCase() + proposal.type.slice(1)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Proposer:</span>
                    <span class="detail-value">${proposal.proposer}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created at Block:</span>
                    <span class="detail-value">#${proposal.createdAt}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${proposal.description}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Current Support:</span>
                    <span class="detail-value">${proposal.supportTotal} tokens</span>
                </div>
        `;
        
        // Add type-specific details
        if (proposal.type === 'treasury') {
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${proposal.recipient}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${UI.formatEth(proposal.amount)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Token:</span>
                    <span class="detail-value">${proposal.token === '0x0000000000000000000000000000000000000000' ? 'ETH' : proposal.token}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Token ID:</span>
                    <span class="detail-value">${proposal.tokenId || 'N/A'}</span>
                </div>
            `;
        } else if (proposal.type === 'mint') {
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${proposal.recipient}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${proposal.amount} tokens</span>
                </div>
            `;
        } else if (proposal.type === 'token-price') {
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">New Price:</span>
                    <span class="detail-value">${UI.formatEth(proposal.newPrice)}</span>
                </div>
            `;
        }
        
        // Add election information if triggered
        if (proposal.electionTriggered) {
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">Election Status:</span>
                    <span class="detail-value">Active</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Election Start Block:</span>
                    <span class="detail-value">#${proposal.electionStart}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Yes Votes:</span>
                    <span class="detail-value">${proposal.election ? proposal.election.yesVotes : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">No Votes:</span>
                    <span class="detail-value">${proposal.election ? proposal.election.noVotes : 'N/A'}</span>
                </div>
            `;
        }
        
        // Add support actions if not in election and wallet is connected
        if (!proposal.electionTriggered && Wallet.isWalletConnected()) {
            detailsHtml += `
                <div class="modal-actions">
                    <div class="form-group">
                        <label for="support-amount">Support Amount:</label>
                        <input type="number" id="support-amount" class="form-control" min="1" value="1">
                    </div>
                    <button id="modal-support-btn" class="btn-primary">Add Support</button>
                </div>
            `;
        }
        
        detailsHtml += '</div>';
        
        // Show modal
        UI.showModal(`Proposal Details`, detailsHtml);
        
        // Add event listener for support button in modal
        const modalSupportBtn = document.getElementById('modal-support-btn');
        if (modalSupportBtn) {
            modalSupportBtn.addEventListener('click', () => {
                const amount = parseInt(document.getElementById('support-amount').value);
                this.supportProposal(proposal.address, amount);
            });
        }
    }
    
    /**
     * Handle support action for a proposal
     * @param {Object} proposal - Proposal data
     */
    async handleSupportProposal(proposal) {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to support proposals');
            return;
        }
        
        // Show support dialog
        UI.showModal('Support Proposal', `
            <div class="support-proposal-modal">
                <p>Add support to proposal "${proposal.description}"</p>
                <div class="form-group">
                    <label for="support-amount">Support Amount:</label>
                    <input type="number" id="support-amount" class="form-control" min="1" value="1">
                </div>
                <div class="form-actions">
                    <button id="modal-support-btn" class="btn-primary">Add Support</button>
                </div>
            </div>
        `);
        
        // Add event listener for support button
        const supportBtn = document.getElementById('modal-support-btn');
        if (supportBtn) {
            supportBtn.addEventListener('click', () => {
                const amount = parseInt(document.getElementById('support-amount').value);
                this.supportProposal(proposal.address, amount);
            });
        }
    }
    
    /**
     * Add support to a proposal
     * @param {string} proposalAddress - Address of the proposal
     * @param {number} amount - Amount of support to add
     */
    async supportProposal(proposalAddress, amount) {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to support proposals');
            return;
        }
        
        try {
            // Check if amount is valid
            if (!amount || amount <= 0) {
                UI.showNotification('warning', 'Invalid Amount', 'Please enter a valid support amount');
                return;
            }
            
            // Get proposal contract
            const proposalContract = Contracts.getProposalContract(proposalAddress);
            
            // Check if approval is needed
            const daoContract = Contracts.getDAOContract();
            const isApproved = await daoContract.isApprovedForAll(Wallet.getAddress(), proposalAddress);
            
            if (!isApproved) {
                UI.showNotification('info', 'Approval Required', 'Approving proposal to manage your tokens...');
                
                // Approve proposal
                const approveTx = await daoContract.setApprovalForAll(proposalAddress, true);
                await approveTx.wait();
                
                UI.showNotification('success', 'Approved', 'Proposal approved to manage your tokens');
            }
            
            // Add support
            UI.showNotification('info', 'Processing', 'Adding support to proposal...');
            const tx = await proposalContract.addSupport(amount);
            await tx.wait();
            
            // Close modal
            document.getElementById('modal-container').classList.add('hidden');
            
            // Show success notification
            UI.showNotification('success', 'Support Added', `Successfully added ${amount} support to the proposal`);
            
            // Reload proposals
            this.loadProposals();
        } catch (error) {
            console.error('Error supporting proposal:', error);
            UI.showNotification('error', 'Support Failed', error.message || 'Failed to support proposal');
        }
    }
    
    /**
     * Handle proposal creation form submission
     */
    async handleProposalCreation() {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to create a proposal');
            return;
        }
        
        try {
            const proposalType = document.getElementById('proposal-type').value;
            const description = document.getElementById('proposal-description').value;
            
            if (!proposalType || !description) {
                UI.showNotification('warning', 'Missing Fields', 'Please fill in all required fields');
                return;
            }
            
            const factory = Contracts.getFactoryContract();
            let tx;
            
            switch (proposalType) {
                case 'resolution':
                    UI.showNotification('info', 'Creating Proposal', 'Creating resolution proposal...');
                    tx = await factory.createResolutionProposal(description);
                    break;
                
                case 'treasury':
                    const recipient = document.getElementById('recipient-address').value;
                    const amount = ethers.utils.parseEther(document.getElementById('amount').value.toString());
                    const token = document.getElementById('token-address').value || ethers.constants.AddressZero;
                    const tokenId = parseInt(document.getElementById('token-id').value || '0');
                    
                    if (!recipient || amount.lte(0)) {
                        UI.showNotification('warning', 'Missing Fields', 'Please fill in all required fields');
                        return;
                    }
                    
                    UI.showNotification('info', 'Creating Proposal', 'Creating treasury proposal...');
                    tx = await factory.createTreasuryProposal(description, recipient, amount, token, tokenId);
                    break;
                
                case 'mint':
                    const mintRecipient = document.getElementById('recipient-address').value;
                    const mintAmount = parseInt(document.getElementById('amount').value);
                    
                    if (!mintRecipient || mintAmount <= 0) {
                        UI.showNotification('warning', 'Missing Fields', 'Please fill in all required fields');
                        return;
                    }
                    
                    UI.showNotification('info', 'Creating Proposal', 'Creating mint proposal...');
                    tx = await factory.createMintProposal(description, mintRecipient, mintAmount);
                    break;
                
                case 'token-price':
                    const newPrice = ethers.utils.parseEther(document.getElementById('new-token-price').value.toString());
                    
                    UI.showNotification('info', 'Creating Proposal', 'Creating token price proposal...');
                    tx = await factory.createTokenPriceProposal(description, newPrice);
                    break;
                
                default:
                    UI.showNotification('error', 'Invalid Type', 'Invalid proposal type selected');
                    return;
            }
            
            await tx.wait();
            
            // Hide form and show success message
            document.getElementById('proposal-form').classList.add('hidden');
            document.getElementById('new-proposal-btn').classList.remove('hidden');
            document.getElementById('create-proposal-form').reset();
            
            UI.showNotification('success', 'Proposal Created', 'Your proposal has been created successfully');
            
            // Reload proposals
            this.loadProposals();
        } catch (error) {
            console.error('Error creating proposal:', error);
            UI.showNotification('error', 'Creation Failed', error.message || 'Failed to create proposal');
        }
    }
    
    /**
     * Update token balance display
     */
    async updateTokenBalance() {
        if (!Wallet.isWalletConnected()) return;
        
        try {
            const balance = await Contracts.fetchTokenBalance(Wallet.getAddress());
            
            // Update in sidebar
            const tokenBalance = document.getElementById('token-balance');
            if (tokenBalance) {
                tokenBalance.textContent = `${balance} Governance Tokens`;
            }
            
            // Update in tokens section
            const governanceTokenBalance = document.getElementById('governance-token-balance');
            if (governanceTokenBalance) {
                governanceTokenBalance.textContent = balance;
            }
        } catch (error) {
            console.error('Error updating token balance:', error);
        }
    }
    
    /**
     * Update purchase total when amount changes
     */
    updatePurchaseTotal() {
        if (!this.daoInfo || this.daoInfo.tokenPrice == 0) return;
        
        const purchaseAmount = document.getElementById('purchase-amount');
        const totalCost = document.getElementById('purchase-total-cost');
        
        if (purchaseAmount && totalCost) {
            const amount = parseInt(purchaseAmount.value) || 0;
            const cost = amount * parseFloat(this.daoInfo.tokenPrice);
            totalCost.textContent = UI.formatEth(cost);
        }
    }
    
    /**
     * Handle token purchase
     */
    async handleTokenPurchase() {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to purchase tokens');
            return;
        }
        
        if (!this.daoInfo || this.daoInfo.tokenPrice == 0) {
            UI.showNotification('warning', 'Purchases Disabled', 'Token purchases are currently disabled');
            return;
        }
        
        try {
            const amount = parseInt(document.getElementById('purchase-amount').value);
            
            if (!amount || amount <= 0) {
                UI.showNotification('warning', 'Invalid Amount', 'Please enter a valid purchase amount');
                return;
            }
            
            UI.showNotification('info', 'Processing', 'Processing token purchase...');
            
            await Contracts.purchaseTokens(amount, this.daoInfo.tokenPrice);
            
            UI.showNotification('success', 'Purchase Complete', `Successfully purchased ${amount} governance tokens`);
            
            // Update balance
            this.updateTokenBalance();
            
            // Reload DAO info to update token supply
            this.loadDAOInfo();
        } catch (error) {
            console.error('Error purchasing tokens:', error);
            UI.showNotification('error', 'Purchase Failed', error.message || 'Failed to purchase tokens');
        }
    }
}

// Create global proposal manager
const Proposals = new ProposalManager();
