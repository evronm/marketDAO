// proposals.js - Handles proposal creation and management

/**
 * ProposalManager class to handle proposal-related operations
 */
export class ProposalManager {
    /**
     * Create a new ProposalManager instance
     * @param {Object} state - Application state
     */
    constructor(state) {
        this.state = state;
        this.activeProposalsContainer = document.getElementById('active-proposals');
        
        // Initialize the proposals list
        this.refreshProposals();
    }
    
    /**
     * Refresh the list of active proposals
     */
    async refreshProposals() {
        if (!this.state.contracts.factory) {
            console.error('Factory contract not initialized');
            return;
        }
        
        try {
            // Clear existing proposals
            this.activeProposalsContainer.innerHTML = '';
            
            // Get the proposal count
            const count = await this.state.contracts.factory.proposalCount();
            
            if (count.toNumber() === 0) {
                this.activeProposalsContainer.innerHTML = '<p class="empty-message">No active proposals found.</p>';
                return;
            }
            
            // Load all proposals
            const proposals = [];
            for (let i = 0; i < count.toNumber(); i++) {
                const proposalAddress = await this.state.contracts.factory.getProposal(i);
                
                // Create a proposal contract instance
                const proposal = new ethers.Contract(
                    proposalAddress,
                    [
                        "function description() view returns (string)",
                        "function supportTotal() view returns (uint256)",
                        "function electionTriggered() view returns (bool)",
                        "function executed() view returns (bool)",
                        "function createdAt() view returns (uint256)",
                        "function proposer() view returns (address)",
                        "function canTriggerElection() view returns (bool)"
                    ],
                    this.state.contracts.signer
                );
                
                // Get proposal data
                const [description, supportTotal, electionTriggered, executed, createdAt, proposer, canTrigger] = 
                    await Promise.all([
                        proposal.description(),
                        proposal.supportTotal(),
                        proposal.electionTriggered(),
                        proposal.executed(),
                        proposal.createdAt(),
                        proposal.proposer(),
                        proposal.canTriggerElection()
                    ]);
                
                // Skip executed proposals
                if (executed) continue;
                
                // Create proposal object
                const proposalData = {
                    address: proposalAddress,
                    description,
                    supportTotal: supportTotal.toString(),
                    electionTriggered,
                    executed,
                    createdAt: createdAt.toNumber(),
                    proposer,
                    canTriggerElection: canTrigger
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
                        proposalData.type = 'treasury';
                        proposalData.details = { recipient, amount, token, tokenId };
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
                            proposalData.type = 'mint';
                            proposalData.details = { recipient: mintRecipient, amount: mintAmount };
                        } else {
                            // Try to get price proposal details
                            const priceProposal = new ethers.Contract(
                                proposalAddress,
                                ["function newPrice() view returns (uint256)"],
                                this.state.contracts.signer
                            );
                            
                            const newPrice = await priceProposal.newPrice().catch(() => null);
                            
                            if (newPrice) {
                                proposalData.type = 'price';
                                proposalData.details = { newPrice };
                            } else {
                                proposalData.type = 'resolution';
                                proposalData.details = {};
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error determining proposal type for ${proposalAddress}:`, e);
                    proposalData.type = 'resolution';
                    proposalData.details = {};
                }
                
                proposals.push(proposalData);
            }
            
            // Update state
            this.state.proposals = proposals;
            
            // Render proposals
            if (proposals.length === 0) {
                this.activeProposalsContainer.innerHTML = '<p class="empty-message">No active proposals found.</p>';
                return;
            }
            
            // Render each proposal
            proposals.forEach(proposal => {
                this.renderProposalCard(proposal);
            });
        } catch (error) {
            console.error('Error refreshing proposals:', error);
            window.notify('Failed to load proposals: ' + error.message, 'error');
        }
    }
    
    /**
     * Render a proposal card
     * @param {Object} proposal - Proposal data
     */
    renderProposalCard(proposal) {
        const cardElement = document.createElement('div');
        cardElement.className = 'proposal-card';
        cardElement.setAttribute('data-address', proposal.address);
        
        // Format the proposal type display name
        const typeDisplayNames = {
            'resolution': 'Resolution',
            'treasury': 'Treasury Transfer',
            'mint': 'Mint Tokens',
            'price': 'Price Change'
        };
        
        // Create support percentage
        const totalSupply = this.state.contracts.dao.totalSupply ? 
            this.state.contracts.dao.totalSupply(0) : 0;
        const supportPercentage = totalSupply > 0 ? 
            (proposal.supportTotal / totalSupply) * 100 : 0;
        
        // Create details content based on proposal type
        let detailsContent = '';
        switch (proposal.type) {
            case 'treasury':
                const tokenAddress = proposal.details.token === ethers.constants.AddressZero ? 
                    'ETH' : proposal.details.token;
                detailsContent = `
                    <p><strong>Recipient:</strong> ${this.formatAddress(proposal.details.recipient)}</p>
                    <p><strong>Amount:</strong> ${ethers.utils.formatEther(proposal.details.amount)}</p>
                    <p><strong>Token:</strong> ${tokenAddress === 'ETH' ? 'ETH' : this.formatAddress(tokenAddress)}</p>
                    ${tokenAddress !== 'ETH' ? `<p><strong>Token ID:</strong> ${proposal.details.tokenId}</p>` : ''}
                `;
                break;
            case 'mint':
                detailsContent = `
                    <p><strong>Recipient:</strong> ${this.formatAddress(proposal.details.recipient)}</p>
                    <p><strong>Amount:</strong> ${proposal.details.amount.toString()}</p>
                `;
                break;
            case 'price':
                detailsContent = `
                    <p><strong>New Price:</strong> ${ethers.utils.formatEther(proposal.details.newPrice)} ETH</p>
                `;
                break;
            default:
                // No additional details for resolution proposals
                break;
        }
        
        // Determine the card actions based on proposal state
        let cardActions = '';
        if (proposal.electionTriggered) {
            cardActions = `
                <p class="proposal-status">Election triggered</p>
            `;
        } else {
            cardActions = `
                <div class="support-actions">
                    <div class="input-group">
                        <input type="number" min="1" placeholder="Amount" class="support-amount" />
                        <button class="btn add-support" data-address="${proposal.address}">Support</button>
                    </div>
                </div>
            `;
        }
        
        cardElement.innerHTML = `
            <div class="card-header">
                <span class="proposal-type ${proposal.type}">${typeDisplayNames[proposal.type]}</span>
                <h3>${proposal.description}</h3>
            </div>
            <div class="card-body">
                <p><strong>Proposer:</strong> ${this.formatAddress(proposal.proposer)}</p>
                <p><strong>Created:</strong> Block ${proposal.createdAt}</p>
                <p><strong>Support:</strong> ${proposal.supportTotal} tokens (${supportPercentage.toFixed(2)}%)</p>
                ${detailsContent}
                <div class="card-actions">
                    ${cardActions}
                </div>
            </div>
        `;
        
        // Add event listeners for the support button
        if (!proposal.electionTriggered) {
            const supportBtn = cardElement.querySelector('.add-support');
            if (supportBtn) {
                supportBtn.addEventListener('click', () => {
                    this.addSupportToProposal(proposal.address);
                });
            }
        }
        
        this.activeProposalsContainer.appendChild(cardElement);
    }
    
    /**
     * Add support to a proposal
     * @param {string} proposalAddress - Address of the proposal
     */
    async addSupportToProposal(proposalAddress) {
        if (!this.state.connected) {
            window.notify('Please connect your wallet first', 'warning');
            return;
        }
        
        const cardElement = document.querySelector(`.proposal-card[data-address="${proposalAddress}"]`);
        if (!cardElement) return;
        
        const amountInput = cardElement.querySelector('.support-amount');
        const amount = amountInput.value.trim();
        
        if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
            window.notify('Please enter a valid amount', 'warning');
            return;
        }
        
        try {
            // Create proposal contract instance
            const proposal = new ethers.Contract(
                proposalAddress,
                ["function addSupport(uint256)"],
                this.state.contracts.signer
            );
            
            // Add support
            const tx = await proposal.addSupport(amount);
            
            window.notify('Adding support, please wait...', 'info');
            
            await tx.wait();
            
            window.notify('Support added successfully', 'success');
            
            // Refresh proposals
            await this.refreshProposals();
        } catch (error) {
            console.error('Error adding support:', error);
            window.notify('Failed to add support: ' + error.message, 'error');
        }
    }
    
    /**
     * Create a new proposal
     */
    async createProposal() {
        if (!this.state.connected) {
            window.notify('Please connect your wallet first', 'warning');
            return;
        }
        
        // Get form values
        const proposalType = document.getElementById('proposal-type').value;
        const description = document.getElementById('proposal-description').value.trim();
        
        if (!description) {
            window.notify('Please enter a description', 'warning');
            return;
        }
        
        try {
            let tx;
            
            switch (proposalType) {
                case 'resolution':
                    tx = await this.state.contracts.factory.createResolutionProposal(description);
                    break;
                case 'treasury':
                    const treasuryRecipient = document.getElementById('treasury-recipient').value.trim();
                    const treasuryAmount = document.getElementById('treasury-amount').value.trim();
                    const treasuryToken = document.getElementById('treasury-token').value.trim() || ethers.constants.AddressZero;
                    const treasuryTokenId = document.getElementById('treasury-token-id').value.trim() || '0';
                    
                    if (!treasuryRecipient || !ethers.utils.isAddress(treasuryRecipient)) {
                        window.notify('Please enter a valid recipient address', 'warning');
                        return;
                    }
                    
                    if (!treasuryAmount || isNaN(treasuryAmount) || parseFloat(treasuryAmount) <= 0) {
                        window.notify('Please enter a valid amount', 'warning');
                        return;
                    }
                    
                    if (treasuryToken !== ethers.constants.AddressZero && !ethers.utils.isAddress(treasuryToken)) {
                        window.notify('Please enter a valid token address', 'warning');
                        return;
                    }
                    
                    tx = await this.state.contracts.factory.createTreasuryProposal(
                        description,
                        treasuryRecipient,
                        ethers.utils.parseEther(treasuryAmount),
                        treasuryToken,
                        treasuryTokenId
                    );
                    break;
                case 'mint':
                    const mintRecipient = document.getElementById('mint-recipient').value.trim();
                    const mintAmount = document.getElementById('mint-amount').value.trim();
                    
                    if (!mintRecipient || !ethers.utils.isAddress(mintRecipient)) {
                        window.notify('Please enter a valid recipient address', 'warning');
                        return;
                    }
                    
                    if (!mintAmount || isNaN(mintAmount) || parseInt(mintAmount) <= 0) {
                        window.notify('Please enter a valid amount', 'warning');
                        return;
                    }
                    
                    tx = await this.state.contracts.factory.createMintProposal(
                        description,
                        mintRecipient,
                        mintAmount
                    );
                    break;
                case 'price':
                    const priceAmount = document.getElementById('price-amount').value.trim();
                    
                    if (!priceAmount || isNaN(priceAmount) || parseFloat(priceAmount) < 0) {
                        window.notify('Please enter a valid price', 'warning');
                        return;
                    }
                    
                    tx = await this.state.contracts.factory.createTokenPriceProposal(
                        description,
                        ethers.utils.parseEther(priceAmount)
                    );
                    break;
            }
            
            window.notify('Creating proposal, please wait...', 'info');
            
            await tx.wait();
            
            window.notify('Proposal created successfully', 'success');
            
            // Reset form
            document.getElementById('proposal-description').value = '';
            document.getElementById('proposal-type').value = 'resolution';
            
            // Hide all proposal type fields
            document.querySelectorAll('.proposal-field').forEach(field => {
                field.style.display = 'none';
            });
            
            // Clear specific fields
            document.getElementById('treasury-recipient').value = '';
            document.getElementById('treasury-amount').value = '';
            document.getElementById('treasury-token').value = '';
            document.getElementById('treasury-token-id').value = '';
            document.getElementById('mint-recipient').value = '';
            document.getElementById('mint-amount').value = '';
            document.getElementById('price-amount').value = '';
            
            // Refresh proposals
            await this.refreshProposals();
        } catch (error) {
            console.error('Error creating proposal:', error);
            window.notify('Failed to create proposal: ' + error.message, 'error');
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
