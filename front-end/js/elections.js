/**
 * Elections management for Market DAO
 * Handles displaying and voting in elections
 */
class ElectionManager {
    constructor() {
        this.elections = [];
        this.completedElections = [];
        this.currentBlock = 0;
        this.daoInfo = null;
        
        // Initialize when contracts are ready
        window.addEventListener('contracts-initialized', () => this.initialize());
        
        // Update when proposals are loaded
        window.addEventListener('proposals-loaded', (event) => {
            this.processProposalElections(event.detail.proposals);
        });
        
        // Refresh when wallet changes
        window.addEventListener('wallet-connected', () => this.updateElections());
        window.addEventListener('wallet-account-changed', () => this.updateElections());
        
        // Refresh when switching back to elections tab
        window.addEventListener('section-changed', (event) => {
            if (event.detail.section === 'elections') {
                this.updateElections();
            }
        });
    }
    
    /**
     * Initialize elections manager
     */
    initialize() {
        console.log('Initializing elections manager');
        this.setupEventListeners();
        this.startPolling();
        
        // If on elections tab, load data
        if (UI.activeSection === 'elections') {
            this.updateElections();
        }
    }
    
    /**
     * Setup event listeners for election actions
     */
    setupEventListeners() {
        // No specific listeners to add at initialization
        // Event listeners for voting buttons are added when rendering election cards
    }
    
    /**
     * Start polling for new blocks
     */
    startPolling() {
        // Check current block number
        this.updateCurrentBlock();
        
        // Poll for new blocks every polling interval
        setInterval(() => {
            this.updateCurrentBlock();
            
            // If on elections tab, update elections
            if (UI.activeSection === 'elections') {
                this.updateElectionTimers();
            }
        }, AppConfig.ui.pollingInterval);
    }
    
    /**
     * Update current block number
     */
    async updateCurrentBlock() {
        try {
            const provider = Wallet.getProvider() || new ethers.providers.JsonRpcProvider(AppConfig.rpcUrl);
            this.currentBlock = await provider.getBlockNumber();
        } catch (error) {
            console.error('Error updating current block:', error);
        }
    }
    
    /**
     * Process proposal data to extract election information
     * @param {Array} proposals - List of proposals
     */
    processProposalElections(proposals) {
        if (!proposals || proposals.length === 0) return;
        
        // Extract active and completed elections
        this.elections = proposals.filter(p => 
            p.electionTriggered && 
            !p.executed && 
            p.election && 
            p.election.endBlock >= this.currentBlock
        );
        
        this.completedElections = proposals.filter(p => 
            p.electionTriggered && 
            (p.executed || (p.election && p.election.endBlock < this.currentBlock))
        );
        
        // Update DAO information
        this.updateDashboardInfo();
        
        // Update elections display if on elections tab
        if (UI.activeSection === 'elections') {
            this.renderElections();
        }
    }
    
    /**
     * Update dashboard info with election counts
     */
    updateDashboardInfo() {
        const activeElectionsElement = document.getElementById('active-elections');
        if (activeElectionsElement) {
            activeElectionsElement.textContent = this.elections.length;
        }
    }
    
    /**
     * Update election displays
     */
    async updateElections() {
        // Load proposals to get election data
        if (Proposals.proposals.length === 0) {
            // If proposals not yet loaded, prompt a load
            window.dispatchEvent(new CustomEvent('refresh-data'));
            return;
        }
        
        this.processProposalElections(Proposals.proposals);
    }
    
    /**
     * Update election timers without full refresh
     */
    updateElectionTimers() {
        this.elections.forEach(election => {
            const electionCard = document.querySelector(`.election-card[data-id="${election.id}"]`);
            if (electionCard) {
                const timerElement = electionCard.querySelector('.timer-value');
                if (timerElement && election.election) {
                    const blocksRemaining = election.election.endBlock - this.currentBlock;
                    timerElement.textContent = `${blocksRemaining} blocks`;
                    
                    // If election has ended, refresh the whole display
                    if (blocksRemaining <= 0) {
                        this.updateElections();
                    }
                }
            }
        });
    }
    
    /**
     * Render elections to the UI
     */
    renderElections() {
        const activeElectionsList = document.getElementById('active-elections-list');
        const pastElectionsList = document.getElementById('past-elections-list');
        
        // Render active elections
        if (activeElectionsList) {
            if (this.elections.length === 0) {
                activeElectionsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-vote-yea"></i>
                        <p>No active elections found</p>
                    </div>
                `;
            } else {
                activeElectionsList.innerHTML = '';
                
                // Sort by end date (soonest ending first)
                this.elections.sort((a, b) => a.election.endBlock - b.election.endBlock);
                
                this.elections.forEach(election => {
                    const card = this.createElectionCard(election);
                    activeElectionsList.appendChild(card);
                });
            }
        }
        
        // Render past elections
        if (pastElectionsList) {
            if (this.completedElections.length === 0) {
                pastElectionsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>No past elections found</p>
                    </div>
                `;
            } else {
                pastElectionsList.innerHTML = '';
                
                // Sort by end date (most recent first)
                this.completedElections.sort((a, b) => b.election.endBlock - a.election.endBlock);
                
                this.completedElections.forEach(election => {
                    const card = this.createElectionCard(election);
                    pastElectionsList.appendChild(card);
                });
            }
        }
    }
    
    /**
     * Create an election card element
     * @param {Object} election - Election data (from proposal)
     */
    createElectionCard(election) {
        const template = document.getElementById('election-card-template');
        const card = template.content.cloneNode(true).querySelector('.election-card');
        
        // Set election ID and address
        card.setAttribute('data-id', election.id);
        card.setAttribute('data-address', election.address);
        
        // Update type label
        const typeLabel = card.querySelector('.election-type');
        let typeText = 'Resolution';
        let typeClass = 'resolution';
        
        switch (election.type) {
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
        
        // Set election status
        const statusElement = card.querySelector('.election-status');
        let statusText = 'Active';
        let statusClass = 'active';
        
        if (election.executed) {
            statusText = 'Executed';
            statusClass = 'executed';
        } else if (election.election && election.election.endBlock < this.currentBlock) {
            statusText = 'Ended';
            statusClass = 'ended';
        }
        
        statusElement.textContent = statusText;
        statusElement.classList.add(statusClass);
        
        // Set description
        card.querySelector('.election-description').textContent = election.description;
        
        // Set election details based on type
        const detailsElement = card.querySelector('.election-details');
        
        if (election.type === 'treasury') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${UI.formatAddress(election.recipient)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${UI.formatEth(election.amount)}</span>
                </div>
            `;
        } else if (election.type === 'mint') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Recipient:</span>
                    <span class="detail-value">${UI.formatAddress(election.recipient)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Amount:</span>
                    <span class="detail-value">${election.amount} tokens</span>
                </div>
            `;
        } else if (election.type === 'token-price') {
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">New Price:</span>
                    <span class="detail-value">${UI.formatEth(election.newPrice)}</span>
                </div>
            `;
        } else {
            // Resolution proposal
            detailsElement.innerHTML = `
                <div class="detail-item">
                    <span class="detail-label">Proposer:</span>
                    <span class="detail-value">${UI.formatAddress(election.proposer)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Election Start:</span>
                    <span class="detail-value">Block #${election.electionStart}</span>
                </div>
            `;
        }
        
        // Set vote progress
        const yesVotes = election.election ? election.election.yesVotes : 0;
        const noVotes = election.election ? election.election.noVotes : 0;
        const totalVotes = election.election ? election.election.totalVotes : 0;
        
        const yesPercent = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
        const noPercent = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;
        
        const yesElement = card.querySelector('.yes-votes');
        const noElement = card.querySelector('.no-votes');
        const yesValueElement = card.querySelector('.yes-value');
        const noValueElement = card.querySelector('.no-value');
        
        yesElement.style.width = `${yesPercent}%`;
        noElement.style.width = `${noPercent}%`;
        yesValueElement.textContent = `${yesVotes} (${yesPercent.toFixed(1)}%)`;
        noValueElement.textContent = `${noVotes} (${noPercent.toFixed(1)}%)`;
        
        // Set timer
        const timerElement = card.querySelector('.timer-value');
        if (election.election && election.election.endBlock) {
            const blocksRemaining = election.election.endBlock - this.currentBlock;
            timerElement.textContent = blocksRemaining > 0 ? `${blocksRemaining} blocks` : 'Ended';
        } else {
            timerElement.textContent = 'Unknown';
        }
        
        // Setup action buttons
        const yesButton = card.querySelector('.btn-vote-yes');
        const noButton = card.querySelector('.btn-vote-no');
        const executeButton = card.querySelector('.btn-execute');
        
        // Show/hide buttons based on status
        if (election.executed || (election.election && election.election.endBlock < this.currentBlock)) {
            // Election is over
            yesButton.classList.add('hidden');
            noButton.classList.add('hidden');
            
            if (!election.executed && election.election && election.election.endBlock < this.currentBlock && yesVotes > noVotes) {
                // Election can be executed
                executeButton.classList.remove('hidden');
                executeButton.addEventListener('click', () => {
                    this.executeElection(election);
                });
            } else {
                executeButton.classList.add('hidden');
            }
        } else {
            // Active election
            executeButton.classList.add('hidden');
            
            // Add event listeners for voting
            yesButton.addEventListener('click', () => {
                this.handleVote(election, true);
            });
            
            noButton.addEventListener('click', () => {
                this.handleVote(election, false);
            });
        }
        
        return card;
    }
    
    /**
     * Handle voting in an election
     * @param {Object} election - Election data
     * @param {boolean} voteYes - Whether voting yes (true) or no (false)
     */
    async handleVote(election, voteYes) {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to vote');
            return;
        }
        
        if (!election.election) {
            UI.showNotification('error', 'Invalid Election', 'Election data is missing');
            return;
        }
        
        // Show vote confirmation dialog
        UI.showModal('Confirm Vote', `
            <div class="vote-modal">
                <p>You are about to vote <strong>${voteYes ? 'YES' : 'NO'}</strong> on the proposal:</p>
                <p class="election-description">"${election.description}"</p>
                
                <div class="form-group">
                    <label for="vote-amount">Voting Tokens:</label>
                    <input type="number" id="vote-amount" class="form-control" min="1">
                </div>
                
                <div class="form-actions">
                    <button id="confirm-vote-btn" class="btn-primary">Confirm Vote</button>
                </div>
            </div>
        `);
        
        // Try to get voting token balance
        try {
            const dao = Contracts.getDAOContract();
            const votingTokenBalance = await dao.balanceOf(Wallet.getAddress(), election.election.votingTokenId);
            
            // Update input with max available
            const voteAmountInput = document.getElementById('vote-amount');
            if (voteAmountInput) {
                voteAmountInput.value = votingTokenBalance.toString();
                voteAmountInput.max = votingTokenBalance.toString();
            }
        } catch (error) {
            console.error('Error fetching voting token balance:', error);
        }
        
        // Setup confirm button
        const confirmBtn = document.getElementById('confirm-vote-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const amount = parseInt(document.getElementById('vote-amount').value);
                this.castVote(election, voteYes, amount);
            });
        }
    }
    
    /**
     * Cast a vote in an election
     * @param {Object} election - Election data
     * @param {boolean} voteYes - Whether voting yes (true) or no (false)
     * @param {number} amount - Amount of voting tokens to use
     */
    async castVote(election, voteYes, amount) {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to vote');
            return;
        }
        
        try {
            // Check if amount is valid
            if (!amount || amount <= 0) {
                UI.showNotification('warning', 'Invalid Amount', 'Please enter a valid vote amount');
                return;
            }
            
            const dao = Contracts.getDAOContract();
            const targetAddress = voteYes ? election.election.yesVoteAddress : election.election.noVoteAddress;
            
            // Cast vote by transferring voting tokens
            UI.showNotification('info', 'Processing', 'Casting your vote...');
            const tx = await dao.safeTransferFrom(
                Wallet.getAddress(),
                targetAddress,
                election.election.votingTokenId,
                amount,
                '0x'
            );
            
            await tx.wait();
            
            // Close modal
            document.getElementById('modal-container').classList.add('hidden');
            
            // Show success notification
            UI.showNotification('success', 'Vote Cast', `Successfully cast your ${voteYes ? 'YES' : 'NO'} vote`);
            
            // Reload elections
            this.updateElections();
        } catch (error) {
            console.error('Error casting vote:', error);
            UI.showNotification('error', 'Vote Failed', error.message || 'Failed to cast vote');
        }
    }
    
    /**
     * Execute a completed election
     * @param {Object} election - Election data
     */
    async executeElection(election) {
        if (!Wallet.isWalletConnected()) {
            UI.showNotification('warning', 'Connect Wallet', 'Please connect your wallet to execute the election');
            return;
        }
        
        try {
            const proposalContract = Contracts.getProposalContract(election.address);
            
            // Execute the proposal
            UI.showNotification('info', 'Processing', 'Executing election result...');
            const tx = await proposalContract.execute();
            await tx.wait();
            
            // Show success notification
            UI.showNotification('success', 'Election Executed', 'The election has been successfully executed');
            
            // Reload elections
            this.updateElections();
        } catch (error) {
            console.error('Error executing election:', error);
            UI.showNotification('error', 'Execution Failed', error.message || 'Failed to execute election');
        }
    }
}

// Create global election manager
const Elections = new ElectionManager();
