// elections.js - Handles election-related operations

/**
 * ElectionManager class to handle election-related operations
 */
export class ElectionManager {
    /**
     * Create a new ElectionManager instance
     * @param {Object} state - Application state
     */
    constructor(state) {
        this.state = state;
        this.activeElectionsContainer = document.getElementById('active-elections');
        this.pastElectionsContainer = document.getElementById('past-elections');
        
        // Initialize the elections lists
        this.refreshElections();
    }
    
    /**
     * Refresh the list of active and past elections
     */
    async refreshElections() {
        if (!this.state.contracts.factory) {
            console.error('Factory contract not initialized');
            return;
        }
        
        try {
            // Clear existing elections
            this.activeElectionsContainer.innerHTML = '';
            this.pastElectionsContainer.innerHTML = '';
            
            // Get the proposal count
            const count = await this.state.contracts.factory.proposalCount();
            
            if (count.toNumber() === 0) {
                this.activeElectionsContainer.innerHTML = '<p class="empty-message">No active elections found.</p>';
                this.pastElectionsContainer.innerHTML = '<p class="empty-message">No past elections found.</p>';
                return;
            }
            
            // Load all proposals
            const activeElections = [];
            const pastElections = [];
            
            for (let i = 0; i < count.toNumber(); i++) {
                const proposalAddress = await this.state.contracts.factory.getProposal(i);
                
                // Create a proposal contract instance
                const proposal = new ethers.Contract(
                    proposalAddress,
                    [
                        "function description() view returns (string)",
                        "function supportTotal() view returns (uint256)",
                        "function electionTriggered() view returns (bool)",
                        "function electionStart() view returns (uint256)",
                        "function votingTokenId() view returns (uint256)",
                        "function yesVoteAddress() view returns (address)",
                        "function noVoteAddress() view returns (address)",
                        "function executed() view returns (bool)",
                        "function createdAt() view returns (uint256)",
                        "function proposer() view returns (address)"
                    ],
                    this.state.contracts.signer
                );
                
                // Get proposal data
                const [
                    description, 
                    supportTotal, 
                    electionTriggered, 
                    electionStart, 
                    votingTokenId, 
                    yesVoteAddress, 
                    noVoteAddress, 
                    executed, 
                    createdAt, 
                    proposer
                ] = await Promise.all([
                    proposal.description(),
                    proposal.supportTotal(),
                    proposal.electionTriggered(),
                    proposal.electionStart(),
                    proposal.votingTokenId().catch(() => 0),
                    proposal.yesVoteAddress().catch(() => ethers.constants.AddressZero),
                    proposal.noVoteAddress().catch(() => ethers.constants.AddressZero),
                    proposal.executed(),
                    proposal.createdAt(),
                    proposal.proposer()
                ]);
                
                // Skip proposals without active elections
                if (!electionTriggered) continue;
                
                // Get current block number
                const currentBlock = await this.state.contracts.provider.getBlockNumber();
                
                // Get election duration
                const electionDuration = await this.state.contracts.dao.electionDuration();
                
                // Check if election is still active
                const isActive = currentBlock < electionStart.toNumber() + electionDuration.toNumber();
                
                // Get vote counts
                const [yesVotes, noVotes] = await Promise.all([
                    this.state.contracts.dao.balanceOf(yesVoteAddress, votingTokenId.toNumber()),
                    this.state.contracts.dao.balanceOf(noVoteAddress, votingTokenId.toNumber())
                ]);
                
                // Get user voting token balance
                let userVotingBalance = 0;
                if (this.state.account) {
                    userVotingBalance = await this.state.contracts.dao.balanceOf(
                        this.state.account,
                        votingTokenId.toNumber()
                    );
                }
                
                // Create election object
                const electionData = {
                    address: proposalAddress,
                    description,
                    supportTotal: supportTotal.toString(),
                    electionStart: electionStart.toNumber(),
                    votingTokenId: votingTokenId.toNumber(),
                    yesVoteAddress,
                    noVoteAddress,
                    executed,
                    createdAt: createdAt.toNumber(),
                    proposer,
                    isActive,
                    endBlock: electionStart.toNumber() + electionDuration.toNumber(),
                    yesVotes: yesVotes.toString(),
                    noVotes: noVotes.toString(),
                    userVotingBalance: userVotingBalance.toString(),
                    electionDuration: electionDuration.toNumber(),
                    currentBlock
                };
                
                // Determine proposal type by checking for specific properties
                try {
                    // Try to get treasury proposal details
                    const treasuryProposal = new ethers.Contract(
                        proposalAddress,
                        [
                            "function recipient() view returns (address)",
                            "function amount() view returns (uint256)",
                            "function token() view returns (address)",
                            "function tokenId() view returns (uint256)"
                        ],
                        this.state.contracts.signer
                    );
                    
                    const [recipient, amount, token, tokenId] = await Promise.all([
                        treasuryProposal.recipient().catch(() => null),
                        treasuryProposal.amount().catch(() => null),
                        treasuryProposal.token().catch(() => null),
                        treasuryProposal.tokenId().catch(() => null)
                    ]);
                    
                    if (recipient && amount && token !== undefined) {
                        electionData.type = 'treasury';
                        electionData.details = { recipient, amount, token, tokenId };
                    } else {
                        // Try to get mint proposal details
                        const mintProposal = new ethers.Contract(
                            proposalAddress,
                            [
                                "function recipient() view returns (address)",
                                "function amount() view returns (uint256)"
                            ],
                            this.state.contracts.signer
                        );
                        
                        const [mintRecipient, mintAmount] = await Promise.all([
                            mintProposal.recipient().catch(() => null),
                            mintProposal.amount().catch(() => null)
                        ]);
                        
                        if (mintRecipient && mintAmount) {
                            electionData.type = 'mint';
                            electionData.details = { recipient: mintRecipient, amount: mintAmount };
                        } else {
                            // Try to get price proposal details
                            const priceProposal = new ethers.Contract(
                                proposalAddress,
                                ["function newPrice() view returns (uint256)"],
                                this.state.contracts.signer
                            );
                            
                            const newPrice = await priceProposal.newPrice().catch(() => null);
                            
                            if (newPrice) {
                                electionData.type = 'price';
                                electionData.details = { newPrice };
                            } else {
                                electionData.type = 'resolution';
                                electionData.details = {};
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error determining election type for ${proposalAddress}:`, e);
                    electionData.type = 'resolution';
                    electionData.details = {};
                }
                
                // Add to appropriate array
                if (isActive && !executed) {
                    activeElections.push(electionData);
                } else {
                    pastElections.push(electionData);
                }
            }
            
            // Update state
            this.state.elections = activeElections;
            this.state.pastElections = pastElections;
            
            // Render elections
            if (activeElections.length === 0) {
                this.activeElectionsContainer.innerHTML = '<p class="empty-message">No active elections found.</p>';
            } else {
                // Render each active election
                activeElections.forEach(election => {
                    this.renderElectionCard(election, true);
                });
            }
            
            if (pastElections.length === 0) {
                this.pastElectionsContainer.innerHTML = '<p class="empty-message">No past elections found.</p>';
            } else {
                // Render each past election
                pastElections.forEach(election => {
                    this.renderElectionCard(election, false);
                });
            }
        } catch (error) {
            console.error('Error refreshing elections:', error);
            window.notify('Failed to load elections: ' + error.message, 'error');
        }
    }
    
    /**
     * Render an election card
     * @param {Object} election - Election data
     * @param {boolean} isActive - Whether the election is active
     */
    renderElectionCard(election, isActive) {
        const cardElement = document.createElement('div');
        cardElement.className = 'election-card';
        cardElement.setAttribute('data-address', election.address);
        
        // Format the election type display name
        const typeDisplayNames = {
            'resolution': 'Resolution',
            'treasury': 'Treasury Transfer',
            'mint': 'Mint Tokens',
            'price': 'Price Change'
        };
        
        // Calculate election progress
        const totalBlocks = election.electionDuration;
        const elapsedBlocks = election.currentBlock - election.electionStart;
        const progress = Math.min(Math.max(elapsedBlocks / totalBlocks * 100, 0), 100);
        
        // Calculate vote percentages
        const totalVotes = parseInt(election.yesVotes) + parseInt(election.noVotes);
        const yesPercentage = totalVotes > 0 ? (parseInt(election.yesVotes) / totalVotes * 100).toFixed(2) : 0;
        const noPercentage = totalVotes > 0 ? (parseInt(election.noVotes) / totalVotes * 100).toFixed(2) : 0;
        
        // Create details content based on election type
        let detailsContent = '';
        switch (election.type) {
            case 'treasury':
                const tokenAddress = election.details.token === ethers.constants.AddressZero ? 
                    'ETH' : election.details.token;
                detailsContent = `
                    <p><strong>Recipient:</strong> ${this.formatAddress(election.details.recipient)}</p>
                    <p><strong>Amount:</strong> ${ethers.utils.formatEther(election.details.amount)}</p>
                    <p><strong>Token:</strong> ${tokenAddress === 'ETH' ? 'ETH' : this.formatAddress(tokenAddress)}</p>
                    ${tokenAddress !== 'ETH' ? `<p><strong>Token ID:</strong> ${election.details.tokenId}</p>` : ''}
                `;
                break;
            case 'mint':
                detailsContent = `
                    <p><strong>Recipient:</strong> ${this.formatAddress(election.details.recipient)}</p>
                    <p><strong>Amount:</strong> ${election.details.amount.toString()}</p>
                `;
                break;
            case 'price':
                detailsContent = `
                    <p><strong>New Price:</strong> ${ethers.utils.formatEther(election.details.newPrice)} ETH</p>
                `;
                break;
            default:
                // No additional details for resolution proposals
                break;
        }
        
        // Determine the card actions based on election state
        let cardActions = '';
        if (isActive) {
            // Show voting actions for active elections
            if (parseInt(election.userVotingBalance) > 0) {
                cardActions = `
                    <div class="vote-actions">
                        <div class="input-group">
                            <input type="number" min="1" max="${election.userVotingBalance}" placeholder="Amount" class="vote-amount" />
                            <button class="btn vote-yes" data-address="${election.address}">Vote Yes</button>
                            <button class="btn vote-no" data-address="${election.address}">Vote No</button>
                        </div>
                    </div>
                `;
            } else {
                cardActions = `
                    <p class="no-voting-tokens">You have no voting tokens for this election</p>
                `;
            }
        } else if (!election.executed) {
            // Show execute action for past elections that haven't been executed
            cardActions = `
                <button class="btn execute-proposal" data-address="${election.address}">Execute Proposal</button>
            `;
        } else {
            // Show executed status for executed elections
            cardActions = `
                <p class="proposal-status executed">Executed</p>
            `;
        }
        
        cardElement.innerHTML = `
            <div class="card-header">
                <span class="proposal-type ${election.type}">${typeDisplayNames[election.type]}</span>
                <h3>${election.description}</h3>
            </div>
            <div class="card-body">
                <p><strong>Proposer:</strong> ${this.formatAddress(election.proposer)}</p>
                <p><strong>Started:</strong> Block ${election.electionStart}</p>
                <p><strong>Ends:</strong> Block ${election.endBlock}</p>
                
                <div class="election-progress">
                    <div class="progress-bar">
                        <div class="progress" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">
                        ${elapsedBlocks} / ${totalBlocks} blocks (${progress.toFixed(2)}%)
                    </div>
                </div>
                
                <div class="voting-results">
                    <p><strong>Yes Votes:</strong> ${election.yesVotes} (${yesPercentage}%)</p>
                    <p><strong>No Votes:</strong> ${election.noVotes} (${noPercentage}%)</p>
                    <div class="vote-bar">
                        <div class="yes-votes" style="width: ${yesPercentage}%"></div>
                        <div class="no-votes" style="width: ${noPercentage}%"></div>
                    </div>
                </div>
                
                ${detailsContent}
                
                <div class="card-actions">
                    ${cardActions}
                </div>
            </div>
        `;
        
        // Add event listeners for actions
        if (isActive) {
            const voteYesBtn = cardElement.querySelector('.vote-yes');
            const voteNoBtn = cardElement.querySelector('.vote-no');
            
            if (voteYesBtn) {
                voteYesBtn.addEventListener('click', () => {
                    this.vote(election, true);
                });
            }
            
            if (voteNoBtn) {
                voteNoBtn.addEventListener('click', () => {
                    this.vote(election, false);
                });
            }
        } else if (!election.executed) {
            const executeBtn = cardElement.querySelector('.execute-proposal');
            
            if (executeBtn) {
                executeBtn.addEventListener('click', () => {
                    this.executeProposal(election.address);
                });
            }
        }
        
        // Add to appropriate container
        if (isActive) {
            this.activeElectionsContainer.appendChild(cardElement);
        } else {
            this.pastElectionsContainer.appendChild(cardElement);
        }
    }
    
    /**
     * Vote on an election
     * @param {Object} election - Election data
     * @param {boolean} voteYes - Whether to vote yes (true) or no (false)
     */
    async vote(election, voteYes) {
        if (!this.state.connected) {
            window.notify('Please connect your wallet first', 'warning');
            return;
        }
        
        const cardElement = document.querySelector(`.election-card[data-address="${election.address}"]`);
        if (!cardElement) return;
        
        const amountInput = cardElement.querySelector('.vote-amount');
        const amount = amountInput.value.trim();
        
        if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
            window.notify('Please enter a valid amount', 'warning');
            return;
        }
        
        if (parseInt(amount) > parseInt(election.userVotingBalance)) {
            window.notify(`You only have ${election.userVotingBalance} voting tokens`, 'warning');
            return;
        }
        
        try {
            // Get the destination address
            const destination = voteYes ? election.yesVoteAddress : election.noVoteAddress;
            
            // Transfer voting tokens
            const tx = await this.state.contracts.dao.safeTransferFrom(
                this.state.account,
                destination,
                election.votingTokenId,
                amount,
                "0x"
            );
            
            window.notify(`Voting ${voteYes ? 'Yes' : 'No'}, please wait...`, 'info');
            
            await tx.wait();
            
            window.notify(`Voted ${voteYes ? 'Yes' : 'No'} successfully`, 'success');
            
            // Refresh elections
            await this.refreshElections();
        } catch (error) {
            console.error('Error voting:', error);
            window.notify('Failed to vote: ' + error.message, 'error');
        }
    }
    
    /**
     * Execute a proposal
     * @param {string} proposalAddress - Address of the proposal
     */
    async executeProposal(proposalAddress) {
        if (!this.state.connected) {
            window.notify('Please connect your wallet first', 'warning');
            return;
        }
        
        try {
            // Create proposal contract instance
            const proposal = new ethers.Contract(
                proposalAddress,
                ["function execute()"],
                this.state.contracts.signer
            );
            
            // Execute proposal
            const tx = await proposal.execute();
            
            window.notify('Executing proposal, please wait...', 'info');
            
            await tx.wait();
            
            window.notify('Proposal executed successfully', 'success');
            
            // Refresh elections
            await this.refreshElections();
        } catch (error) {
            console.error('Error executing proposal:', error);
            window.notify('Failed to execute proposal: ' + error.message, 'error');
        }
    }
    
    /**
     * Format an address for display
     * @param {string} address - Address to format
     * @returns {string} - Formatted address
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
}
