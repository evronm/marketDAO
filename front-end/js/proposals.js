// Proposals and elections management for the Market DAO application

class ProposalManager {
    constructor() {
        this.activeProposals = [];
        this.activeElections = [];
        this.completedElections = [];
        this.currentBlock = 0;
        this.proposalsRefreshInterval = null;
        this.electionsRefreshInterval = null;
    }

    /**
     * Initialize the proposal manager
     */
    async initialize() {
        if (!contracts.isInitialized()) {
            console.warn('Contracts not initialized. Cannot load proposals.');
            return;
        }
        
        // Get current block number
        this.currentBlock = await wallet.getBlockNumber();
        
        // Load all proposals and elections
        await this.refreshProposals();
        await this.refreshElections();
        
        // Setup refresh intervals
        this.setupRefreshIntervals();
    }

    /**
     * Refresh all proposals
     */
    async refreshProposals() {
        try {
            // Get current block
            this.currentBlock = await wallet.getBlockNumber();
            
            // Get total proposal count
            const count = await contracts.factoryContract.proposalCount();
            
            // Create array to store active proposals
            const activeProposals = [];
            
            // Fetch each proposal
            for (let i = 0; i < count; i++) {
                const proposalAddress = await contracts.factoryContract.getProposal(i);
                const proposal = await this.getProposalInfo(proposalAddress);
                
                // Only add to active proposals if not in election and not too old
                if (!proposal.electionTriggered && 
                    this.currentBlock - proposal.createdAt < daoManager.daoInfo.maxProposalAge) {
                    activeProposals.push(proposal);
                }
            }
            
            // Update active proposals
            this.activeProposals = activeProposals;
            
            // Update UI
            this.updateProposalsUI();
        } catch (error) {
            console.error('Error refreshing proposals:', error);
        }
    }

    /**
     * Refresh all elections
     */
    async refreshElections() {
        try {
            // Get current block
            this.currentBlock = await wallet.getBlockNumber();
            
            // Get total proposal count
            const count = await contracts.factoryContract.proposalCount();
            
            // Create arrays to store elections
            const activeElections = [];
            const completedElections = [];
            
            // Fetch each proposal
            for (let i = 0; i < count; i++) {
                const proposalAddress = await contracts.factoryContract.getProposal(i);
                const proposal = await this.getProposalInfo(proposalAddress);
                
                // Check if it's an election
                if (proposal.electionTriggered) {
                    // If election is still ongoing
                    if (this.currentBlock < proposal.electionStart + daoManager.daoInfo.electionDuration) {
                        activeElections.push(proposal);
                    } 
                    // If election is completed
                    else {
                        // Only show recent completed elections (within PAST_BLOCKS_TO_QUERY)
                        if (this.currentBlock - proposal.electionStart < CONFIG.PAST_BLOCKS_TO_QUERY) {
                            completedElections.push(proposal);
                        }
                    }
                }
            }
            
            // Update elections arrays
            this.activeElections = activeElections;
            this.completedElections = completedElections;
            
            // Update UI
            this.updateElectionsUI();
        } catch (error) {
            console.error('Error refreshing elections:', error);
        }
    }

    /**
     * Get detailed information about a proposal
     * @param {string} address - The proposal contract address
     * @returns {Object} The proposal information
     */
    async getProposalInfo(address) {
        // Get proposal type first to determine which contract to use
        const proposalType = await this.determineProposalType(address);
        const proposalContract = contracts.getProposalContract(address, proposalType);
        
        // Base proposal information
        const [
            description,
            proposer,
            createdAt,
            supportTotal,
            userSupport,
            electionTriggered,
            electionStart,
            votingTokenId,
            yesVoteAddress,
            noVoteAddress,
            executed
        ] = await Promise.all([
            proposalContract.description(),
            proposalContract.proposer(),
            proposalContract.createdAt(),
            proposalContract.supportTotal(),
            proposalContract.support(wallet.address),
            proposalContract.electionTriggered(),
            proposalContract.electionStart(),
            proposalContract.electionTriggered() ? proposalContract.votingTokenId() : 0,
            proposalContract.electionTriggered() ? proposalContract.yesVoteAddress() : ethers.constants.AddressZero,
            proposalContract.electionTriggered() ? proposalContract.noVoteAddress() : ethers.constants.AddressZero,
            proposalContract.executed()
        ]);
        
        // Additional properties based on proposal type
        let additionalProps = {};
        
        if (proposalType === CONFIG.proposalTypes.TREASURY) {
            const [recipient, amount, token, tokenId] = await Promise.all([
                proposalContract.recipient(),
                proposalContract.amount(),
                proposalContract.token(),
                proposalContract.tokenId()
            ]);
            
            additionalProps = { recipient, amount, token, tokenId };
        } else if (proposalType === CONFIG.proposalTypes.MINT) {
            const [recipient, amount] = await Promise.all([
                proposalContract.recipient(),
                proposalContract.amount()
            ]);
            
            additionalProps = { recipient, amount };
        } else if (proposalType === CONFIG.proposalTypes.TOKEN_PRICE) {
            const newPrice = await proposalContract.newPrice();
            additionalProps = { newPrice };
        }
        
        // Get voting information if election is triggered
        let voteInfo = null;
        
        if (electionTriggered && votingTokenId > 0) {
            const daoContract = contracts.daoContract;
            
            // Get vote counts
            const [yesVotes, noVotes, userVotingTokens, totalVotingTokens] = await Promise.all([
                daoContract.balanceOf(yesVoteAddress, votingTokenId),
                daoContract.balanceOf(noVoteAddress, votingTokenId),
                daoContract.balanceOf(wallet.address, votingTokenId),
                daoContract.totalSupply(votingTokenId)
            ]);
            
            voteInfo = {
                yesVotes: yesVotes.toNumber(),
                noVotes: noVotes.toNumber(),
                userVotingTokens: userVotingTokens.toNumber(),
                totalVotingTokens: totalVotingTokens.toNumber()
            };
        }
        
        // Construct the proposal object
        return {
            address,
            type: proposalType,
            description,
            proposer,
            createdAt: createdAt.toNumber(),
            supportTotal: supportTotal.toNumber(),
            userSupport: userSupport.toNumber(),
            electionTriggered,
            electionStart: electionStart.toNumber(),
            votingTokenId: votingTokenId ? votingTokenId.toNumber() : 0,
            yesVoteAddress,
            noVoteAddress,
            executed,
            voteInfo,
            ...additionalProps
        };
    }

    /**
     * Determine the type of a proposal contract
     * @param {string} address - The proposal contract address
     * @returns {string} The proposal type
     */
    async determineProposalType(address) {
        // We'll try to detect the type based on available methods
        const tempContract = new ethers.Contract(
            address,
            [
                "function description() view returns (string)",
                "function recipient() view returns (address)",
                "function amount() view returns (uint256)",
                "function token() view returns (address)",
                "function tokenId() view returns (uint256)",
                "function newPrice() view returns (uint256)"
            ],
            wallet.provider
        );
        
        try {
            // Try to detect treasury proposal
            await tempContract.token();
            return CONFIG.proposalTypes.TREASURY;
        } catch (error) {
            // Not a treasury proposal
        }
        
        try {
            // Try to detect mint proposal (has recipient and amount but no token)
            await tempContract.recipient();
            await tempContract.amount();
            return CONFIG.proposalTypes.MINT;
        } catch (error) {
            // Not a mint proposal
        }
        
        try {
            // Try to detect token price proposal
            await tempContract.newPrice();
            return CONFIG.proposalTypes.TOKEN_PRICE;
        } catch (error) {
            // Not a token price proposal
        }
        
        // If we couldn't detect a specific type, assume it's a resolution
        return CONFIG.proposalTypes.RESOLUTION;
    }

    /**
     * Update the proposals UI
     */
    updateProposalsUI() {
        const proposalsList = document.getElementById('proposalsList');
        
        // Clear the list
        proposalsList.innerHTML = '';
        
        if (this.activeProposals.length === 0) {
            proposalsList.innerHTML = '<p class="empty-message">No active proposals found.</p>';
            return;
        }
        
        // Add each proposal to the list
        for (const proposal of this.activeProposals) {
            const card = this.createProposalCard(proposal);
            proposalsList.appendChild(card);
        }
    }

    /**
     * Update the elections UI
     */
    updateElectionsUI() {
        const activeElectionsList = document.getElementById('electionsList');
        const completedElectionsList = document.getElementById('completedElectionsList');
        
        // Clear the lists
        activeElectionsList.innerHTML = '';
        completedElectionsList.innerHTML = '';
        
        // Active elections
        if (this.activeElections.length === 0) {
            activeElectionsList.innerHTML = '<p class="empty-message">No active elections found.</p>';
        } else {
            for (const election of this.activeElections) {
                const card = this.createElectionCard(election);
                activeElectionsList.appendChild(card);
            }
        }
        
        // Completed elections
        if (this.completedElections.length === 0) {
            completedElectionsList.innerHTML = '<p class="empty-message">No recent completed elections found.</p>';
        } else {
            for (const election of this.completedElections) {
                const card = this.createElectionCard(election, true);
                completedElectionsList.appendChild(card);
            }
        }
    }

    /**
     * Create HTML for a proposal card
     * @param {Object} proposal - The proposal object
     * @returns {HTMLElement} The proposal card element
     */
    createProposalCard(proposal) {
        const card = document.createElement('div');
        card.className = 'proposal-card';
        
        // Calculate needed support
        const supportNeeded = Math.ceil((daoManager.daoInfo.supportThreshold / 100) * daoManager.daoInfo.governanceTokenSupply);
        const supportPercentage = daoManager.daoInfo.governanceTokenSupply > 0 
            ? (proposal.supportTotal / daoManager.daoInfo.governanceTokenSupply) * 100 
            : 0;
        
        // Calculate age
        const age = this.currentBlock - proposal.createdAt;
        const agePercentage = (age / daoManager.daoInfo.maxProposalAge) * 100;
        
        // Proposal title based on type
        let proposalTitle = `${proposal.type} Proposal`;
        
        // Additional details based on proposal type
        let typeSpecificDetails = '';
        
        if (proposal.type === CONFIG.proposalTypes.TREASURY) {
            const tokenType = proposal.token === CONFIG.ZERO_ADDRESS ? 'ETH' : 
                              proposal.tokenId === 0 ? 'ERC20' : 
                              proposal.amount === 1 ? 'ERC721' : 'ERC1155';
            
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>Recipient:</strong> ${Utils.shortenAddress(proposal.recipient)}
                </div>
                <div class="proposal-detail">
                    <strong>Amount:</strong> ${proposal.amount.toString()}
                </div>
                <div class="proposal-detail">
                    <strong>Token Type:</strong> ${tokenType}
                </div>
            `;
            
            if (proposal.token !== CONFIG.ZERO_ADDRESS) {
                typeSpecificDetails += `
                    <div class="proposal-detail">
                        <strong>Token:</strong> ${Utils.shortenAddress(proposal.token)}
                    </div>
                `;
                
                if (proposal.tokenId > 0) {
                    typeSpecificDetails += `
                        <div class="proposal-detail">
                            <strong>Token ID:</strong> ${proposal.tokenId.toString()}
                        </div>
                    `;
                }
            }
        } else if (proposal.type === CONFIG.proposalTypes.MINT) {
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>Recipient:</strong> ${Utils.shortenAddress(proposal.recipient)}
                </div>
                <div class="proposal-detail">
                    <strong>Amount:</strong> ${proposal.amount.toString()} tokens
                </div>
            `;
        } else if (proposal.type === CONFIG.proposalTypes.TOKEN_PRICE) {
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>New Price:</strong> ${Utils.formatEth(proposal.newPrice)}
                </div>
            `;
        }
        
        card.innerHTML = `
            <h3>${proposalTitle}</h3>
            <div class="proposal-meta">
                <span>Proposed by: ${Utils.shortenAddress(proposal.proposer)}</span>
                <span>Age: ${age} blocks (${Utils.blocksToTime(age)})</span>
            </div>
            <div class="proposal-description">
                <p>${proposal.description}</p>
            </div>
            ${typeSpecificDetails}
            <div class="proposal-support">
                <div class="progress-bar">
                    <div class="progress-value" style="width: ${supportPercentage}%"></div>
                </div>
                <div class="progress-stats">
                    <span>Current Support: ${proposal.supportTotal} / ${supportNeeded} tokens (${supportPercentage.toFixed(2)}%)</span>
                    <span>Your Support: ${proposal.userSupport} tokens</span>
                </div>
            </div>
            <div class="proposal-age">
                <div class="progress-bar">
                    <div class="progress-value" style="width: ${agePercentage}%"></div>
                </div>
                <div class="progress-stats">
                    <span>Expires in: ${daoManager.daoInfo.maxProposalAge - age} blocks (${Utils.blocksToTime(daoManager.daoInfo.maxProposalAge - age)})</span>
                </div>
            </div>
            <div class="proposal-actions">
                <button class="add-support-btn" data-address="${proposal.address}">Support</button>
                <button class="remove-support-btn" data-address="${proposal.address}" ${proposal.userSupport <= 0 ? 'disabled' : ''}>Remove Support</button>
            </div>
        `;
        
        // Add event listeners for the buttons
        const addSupportBtn = card.querySelector('.add-support-btn');
        const removeSupportBtn = card.querySelector('.remove-support-btn');
        
        addSupportBtn.addEventListener('click', () => {
            this.showAddSupportModal(proposal);
        });
        
        removeSupportBtn.addEventListener('click', () => {
            this.showRemoveSupportModal(proposal);
        });
        
        return card;
    }

    /**
     * Create HTML for an election card
     * @param {Object} election - The election object
     * @param {boolean} isCompleted - Whether the election is completed
     * @returns {HTMLElement} The election card element
     */
    createElectionCard(election, isCompleted = false) {
        const card = document.createElement('div');
        card.className = 'election-card';
        
        // Determine if the election can be executed
        const canExecute = isCompleted && !election.executed &&
                         election.voteInfo && 
                         election.voteInfo.yesVotes > election.voteInfo.noVotes &&
                         (election.voteInfo.yesVotes + election.voteInfo.noVotes) >= 
                         ((daoManager.daoInfo.quorumPercentage / 100) * election.voteInfo.totalVotingTokens);
        
        // Calculate vote percentages
        const yesVotePercentage = election.voteInfo ? 
            (election.voteInfo.yesVotes / election.voteInfo.totalVotingTokens) * 100 : 0;
        const noVotePercentage = election.voteInfo ? 
            (election.voteInfo.noVotes / election.voteInfo.totalVotingTokens) * 100 : 0;
        const quorumPercentage = election.voteInfo ? 
            ((election.voteInfo.yesVotes + election.voteInfo.noVotes) / election.voteInfo.totalVotingTokens) * 100 : 0;
        
        // Remaining time for active elections
        let timeRemaining = '';
        if (!isCompleted) {
            const remainingBlocks = (election.electionStart + daoManager.daoInfo.electionDuration) - this.currentBlock;
            timeRemaining = `
                <div class="election-remaining-time">
                    <strong>Time Remaining:</strong> ${remainingBlocks} blocks (${Utils.blocksToTime(remainingBlocks)})
                </div>
            `;
        }
        
        // Election result for completed elections
        let resultSection = '';
        if (isCompleted) {
            let resultText = election.executed ? 'Executed' : 'Pending Execution';
            
            if (election.voteInfo && election.voteInfo.yesVotes <= election.voteInfo.noVotes) {
                resultText = 'Rejected (No votes won)';
            } else if (election.voteInfo && 
                     (election.voteInfo.yesVotes + election.voteInfo.noVotes) < 
                     ((daoManager.daoInfo.quorumPercentage / 100) * election.voteInfo.totalVotingTokens)) {
                resultText = 'Failed (Quorum not reached)';
            }
            
            resultSection = `
                <div class="election-result">
                    <strong>Result:</strong> <span class="badge ${election.executed ? 'badge-success' : ''}">${resultText}</span>
                </div>
            `;
        }
        
        // Proposal title based on type
        let proposalTitle = `${election.type} Proposal`;
        
        // Additional details based on proposal type
        let typeSpecificDetails = '';
        
        if (election.type === CONFIG.proposalTypes.TREASURY) {
            const tokenType = election.token === CONFIG.ZERO_ADDRESS ? 'ETH' : 
                            election.tokenId === 0 ? 'ERC20' : 
                            election.amount === 1 ? 'ERC721' : 'ERC1155';
            
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>Recipient:</strong> ${Utils.shortenAddress(election.recipient)}
                </div>
                <div class="proposal-detail">
                    <strong>Amount:</strong> ${election.amount.toString()}
                </div>
                <div class="proposal-detail">
                    <strong>Token Type:</strong> ${tokenType}
                </div>
            `;
            
            if (election.token !== CONFIG.ZERO_ADDRESS) {
                typeSpecificDetails += `
                    <div class="proposal-detail">
                        <strong>Token:</strong> ${Utils.shortenAddress(election.token)}
                    </div>
                `;
                
                if (election.tokenId > 0) {
                    typeSpecificDetails += `
                        <div class="proposal-detail">
                            <strong>Token ID:</strong> ${election.tokenId.toString()}
                        </div>
                    `;
                }
            }
        } else if (election.type === CONFIG.proposalTypes.MINT) {
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>Recipient:</strong> ${Utils.shortenAddress(election.recipient)}
                </div>
                <div class="proposal-detail">
                    <strong>Amount:</strong> ${election.amount.toString()} tokens
                </div>
            `;
        } else if (election.type === CONFIG.proposalTypes.TOKEN_PRICE) {
            typeSpecificDetails = `
                <div class="proposal-detail">
                    <strong>New Price:</strong> ${Utils.formatEth(election.newPrice)}
                </div>
            `;
        }
        
        card.innerHTML = `
            <h3>${proposalTitle} Election</h3>
            <div class="election-meta">
                <span>Proposed by: ${Utils.shortenAddress(election.proposer)}</span>
                <span>Started: ${Utils.getTimeFromBlocks(election.electionStart, this.currentBlock)} ago</span>
            </div>
            <div class="election-description">
                <p>${election.description}</p>
            </div>
            ${typeSpecificDetails}
            ${timeRemaining}
            ${resultSection}
            <div class="election-voting">
                <div class="vote-progress">
                    <div class="progress-bar">
                        <div class="progress-value" style="width: ${yesVotePercentage}%; background-color: #27ae60;"></div>
                    </div>
                    <div class="progress-stats">
                        <span>Yes Votes: ${election.voteInfo ? election.voteInfo.yesVotes : 0} (${yesVotePercentage.toFixed(2)}%)</span>
                    </div>
                </div>
                <div class="vote-progress">
                    <div class="progress-bar">
                        <div class="progress-value" style="width: ${noVotePercentage}%; background-color: #e74c3c;"></div>
                    </div>
                    <div class="progress-stats">
                        <span>No Votes: ${election.voteInfo ? election.voteInfo.noVotes : 0} (${noVotePercentage.toFixed(2)}%)</span>
                    </div>
                </div>
                <div class="vote-progress">
                    <div class="progress-bar">
                        <div class="progress-value" style="width: ${quorumPercentage}%; background-color: #3498db;"></div>
                    </div>
                    <div class="progress-stats">
                        <span>Quorum: ${quorumPercentage.toFixed(2)}% / ${daoManager.daoInfo.quorumPercentage}% needed</span>
                    </div>
                </div>
                <div class="your-tokens">
                    <span>Your Voting Tokens: ${election.voteInfo ? election.voteInfo.userVotingTokens : 0}</span>
                </div>
            </div>
            <div class="election-actions">
                ${!isCompleted ? `
                    <button class="vote-yes-btn" data-address="${election.address}" ${!election.voteInfo || election.voteInfo.userVotingTokens <= 0 ? 'disabled' : ''}>Vote Yes</button>
                    <button class="vote-no-btn" data-address="${election.address}" ${!election.voteInfo || election.voteInfo.userVotingTokens <= 0 ? 'disabled' : ''}>Vote No</button>
                ` : ''}
                ${canExecute ? `
                    <button class="execute-btn" data-address="${election.address}">Execute Proposal</button>
                ` : ''}
            </div>
        `;
        
        // Add event listeners for the buttons
        if (!isCompleted) {
            const voteYesBtn = card.querySelector('.vote-yes-btn');
            const voteNoBtn = card.querySelector('.vote-no-btn');
            
            if (voteYesBtn) {
                voteYesBtn.addEventListener('click', () => {
                    this.showVoteModal(election, true);
                });
            }
            
            if (voteNoBtn) {
                voteNoBtn.addEventListener('click', () => {
                    this.showVoteModal(election, false);
                });
            }
        }
        
        if (canExecute) {
            const executeBtn = card.querySelector('.execute-btn');
            
            if (executeBtn) {
                executeBtn.addEventListener('click', () => {
                    this.executeProposal(election);
                });
            }
        }
        
        return card;
    }

    /**
     * Show modal to add support to a proposal
     * @param {Object} proposal - The proposal object
     */
    showAddSupportModal(proposal) {
        const modalContent = document.createElement('div');
        
        modalContent.innerHTML = `
            <p>How much support would you like to add to this proposal?</p>
            <p>Your governance tokens: ${daoManager.userTokens}</p>
            <p>Your current support: ${proposal.userSupport}</p>
            
            <div class="form-group">
                <label for="supportAmount">Support Amount</label>
                <input type="number" id="supportAmount" min="1" max="${daoManager.userTokens - proposal.userSupport}" value="1">
            </div>
            
            <button id="confirmAddSupport">Add Support</button>
        `;
        
        Utils.showModal('Add Support', modalContent);
        
        // Add event listener for the confirm button
        document.getElementById('confirmAddSupport').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('supportAmount').value);
            
            if (isNaN(amount) || amount <= 0 || amount > (daoManager.userTokens - proposal.userSupport)) {
                Utils.showNotification('Invalid amount', 'error');
                return;
            }
            
            try {
                Utils.hideModal();
                await this.addSupport(proposal.address, amount);
            } catch (error) {
                console.error('Error adding support:', error);
            }
        });
    }

    /**
     * Show modal to remove support from a proposal
     * @param {Object} proposal - The proposal object
     */
    showRemoveSupportModal(proposal) {
        const modalContent = document.createElement('div');
        
        modalContent.innerHTML = `
            <p>How much support would you like to remove from this proposal?</p>
            <p>Your current support: ${proposal.userSupport}</p>
            
            <div class="form-group">
                <label for="supportAmount">Support Amount to Remove</label>
                <input type="number" id="supportAmount" min="1" max="${proposal.userSupport}" value="${proposal.userSupport}">
            </div>
            
            <button id="confirmRemoveSupport">Remove Support</button>
        `;
        
        Utils.showModal('Remove Support', modalContent);
        
        // Add event listener for the confirm button
        document.getElementById('confirmRemoveSupport').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('supportAmount').value);
            
            if (isNaN(amount) || amount <= 0 || amount > proposal.userSupport) {
                Utils.showNotification('Invalid amount', 'error');
                return;
            }
            
            try {
                Utils.hideModal();
                await this.removeSupport(proposal.address, amount);
            } catch (error) {
                console.error('Error removing support:', error);
            }
        });
    }

    /**
     * Show modal to vote on an election
     * @param {Object} election - The election object
     * @param {boolean} voteYes - Whether to vote yes or no
     */
    showVoteModal(election, voteYes) {
        const modalContent = document.createElement('div');
        
        modalContent.innerHTML = `
            <p>How many tokens would you like to use to vote ${voteYes ? 'YES' : 'NO'} on this proposal?</p>
            <p>Your voting tokens: ${election.voteInfo ? election.voteInfo.userVotingTokens : 0}</p>
            
            <div class="form-group">
                <label for="voteAmount">Vote Amount</label>
                <input type="number" id="voteAmount" min="1" max="${election.voteInfo ? election.voteInfo.userVotingTokens : 0}" value="${election.voteInfo ? election.voteInfo.userVotingTokens : 0}">
            </div>
            
            <button id="confirmVote">Cast Vote</button>
        `;
        
        Utils.showModal(`Vote ${voteYes ? 'YES' : 'NO'}`, modalContent);
        
        // Add event listener for the confirm button
        document.getElementById('confirmVote').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('voteAmount').value);
            
            if (isNaN(amount) || amount <= 0 || amount > election.voteInfo.userVotingTokens) {
                Utils.showNotification('Invalid amount', 'error');
                return;
            }
            
            try {
                Utils.hideModal();
                await this.vote(election, voteYes, amount);
            } catch (error) {
                console.error('Error voting:', error);
            }
        });
    }

    /**
     * Add support to a proposal
     * @param {string} proposalAddress - The proposal contract address
     * @param {number} amount - The amount of support to add
     */
    async addSupport(proposalAddress, amount) {
        try {
            const proposalContract = contracts.getProposalContract(proposalAddress);
            
            await Utils.waitForTransaction(
                proposalContract.addSupport(amount),
                `Adding ${amount} support to proposal...`,
                `Successfully added ${amount} support to proposal!`
            );
            
            // Refresh proposals
            await this.refreshProposals();
            await this.refreshElections();
        } catch (error) {
            console.error('Error adding support:', error);
            throw error;
        }
    }

    /**
     * Remove support from a proposal
     * @param {string} proposalAddress - The proposal contract address
     * @param {number} amount - The amount of support to remove
     */
    async removeSupport(proposalAddress, amount) {
        try {
            const proposalContract = contracts.getProposalContract(proposalAddress);
            
            await Utils.waitForTransaction(
                proposalContract.removeSupport(amount),
                `Removing ${amount} support from proposal...`,
                `Successfully removed ${amount} support from proposal!`
            );
            
            // Refresh proposals
            await this.refreshProposals();
        } catch (error) {
            console.error('Error removing support:', error);
            throw error;
        }
    }

    /**
     * Vote on an election
     * @param {Object} election - The election object
     * @param {boolean} voteYes - Whether to vote yes or no
     * @param {number} amount - The amount of tokens to vote with
     */
    async vote(election, voteYes, amount) {
        try {
            const voteAddress = voteYes ? election.yesVoteAddress : election.noVoteAddress;
            
            await Utils.waitForTransaction(
                contracts.daoContract.safeTransferFrom(
                    wallet.address,
                    voteAddress,
                    election.votingTokenId,
                    amount,
                    "0x"
                ),
                `Casting ${voteYes ? 'YES' : 'NO'} vote with ${amount} tokens...`,
                `Successfully voted ${voteYes ? 'YES' : 'NO'} with ${amount} tokens!`
            );
            
            // Refresh elections
            await this.refreshElections();
        } catch (error) {
            console.error('Error voting:', error);
            throw error;
        }
    }

    /**
     * Execute a proposal after a successful election
     * @param {Object} election - The election object
     */
    async executeProposal(election) {
        try {
            const proposalContract = contracts.getProposalContract(election.address);
            
            await Utils.waitForTransaction(
                proposalContract.execute(),
                `Executing proposal...`,
                `Successfully executed proposal!`
            );
            
            // Refresh elections and DAO info
            await this.refreshElections();
            await daoManager.refreshDAOInfo();
        } catch (error) {
            console.error('Error executing proposal:', error);
            throw error;
        }
    }

    /**
     * Create a new proposal
     * @param {string} type - The proposal type
     * @param {Object} data - The proposal data
     */
    async createProposal(type, data) {
        try {
            let tx;
            
            if (type === CONFIG.proposalTypes.RESOLUTION) {
                tx = await contracts.factoryContract.createResolutionProposal(
                    data.description
                );
            } else if (type === CONFIG.proposalTypes.TREASURY) {
                tx = await contracts.factoryContract.createTreasuryProposal(
                    data.description,
                    data.recipient,
                    data.amount,
                    data.token,
                    data.tokenId
                );
            } else if (type === CONFIG.proposalTypes.MINT) {
                tx = await contracts.factoryContract.createMintProposal(
                    data.description,
                    data.recipient,
                    data.amount
                );
            } else if (type === CONFIG.proposalTypes.TOKEN_PRICE) {
                tx = await contracts.factoryContract.createTokenPriceProposal(
                    data.description,
                    data.newPrice
                );
            } else {
                throw new Error(`Unknown proposal type: ${type}`);
            }
            
            await Utils.waitForTransaction(
                tx,
                `Creating ${type} proposal...`,
                `Successfully created ${type} proposal!`
            );
            
            // Refresh proposals
            await this.refreshProposals();
        } catch (error) {
            console.error('Error creating proposal:', error);
            throw error;
        }
    }

    /**
     * Setup refresh intervals
     */
    setupRefreshIntervals() {
        // Clear any existing intervals
        if (this.proposalsRefreshInterval) {
            clearInterval(this.proposalsRefreshInterval);
        }
        
        if (this.electionsRefreshInterval) {
            clearInterval(this.electionsRefreshInterval);
        }
        
        // Setup periodic refreshes
        this.proposalsRefreshInterval = setInterval(async () => {
            await this.refreshProposals();
        }, CONFIG.refreshIntervals.proposals);
        
        this.electionsRefreshInterval = setInterval(async () => {
            await this.refreshElections();
        }, CONFIG.refreshIntervals.elections);
    }

    /**
     * Clean up when disconnecting
     */
    cleanup() {
        if (this.proposalsRefreshInterval) {
            clearInterval(this.proposalsRefreshInterval);
            this.proposalsRefreshInterval = null;
        }
        
        if (this.electionsRefreshInterval) {
            clearInterval(this.electionsRefreshInterval);
            this.electionsRefreshInterval = null;
        }
    }
}

// Create a singleton instance and ensure it's defined in the global scope
window.proposalManager = new ProposalManager();
