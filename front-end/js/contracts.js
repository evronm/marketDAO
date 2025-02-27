/**
 * Contract interaction layer for Market DAO
 * Provides access to the DAO and proposal contracts
 */
class ContractManager {
    constructor() {
        this.contracts = {
            dao: null,
            factory: null
        };
        this.initialized = false;
        
        // Initialize when ABIs are loaded
        window.addEventListener('abis-loaded', () => this.initialize());
        
        // Reconnect contracts when wallet changes
        window.addEventListener('wallet-connected', () => {
            if (AppConfig.abis.daoAbi) {
                this.connectContracts();
            }
        });
        
        window.addEventListener('wallet-account-changed', () => {
            if (this.initialized) {
                this.connectContracts();
            }
        });
    }
    
    /**
     * Initialize contract manager
     */
    initialize() {
        console.log('Initializing contract manager');
        // Create read-only contract instances
        this.createReadOnlyInstances();
        this.initialized = true;
        
        // Check if wallet is already connected
        if (Wallet.isWalletConnected()) {
            this.connectContracts();
        }
        
        // Dispatch event indicating contracts are ready
        window.dispatchEvent(new CustomEvent('contracts-initialized'));
    }
    
    /**
     * Create read-only contract instances using ethers.js
     */
    createReadOnlyInstances() {
        const provider = new ethers.providers.JsonRpcProvider(AppConfig.rpcUrl);
        
        // Create DAO contract instance
        this.contracts.dao = new ethers.Contract(
            AppConfig.contracts.daoAddress,
            AppConfig.abis.daoAbi,
            provider
        );
        
        // Create factory contract instance
        this.contracts.factory = new ethers.Contract(
            AppConfig.contracts.factoryAddress,
            AppConfig.abis.factoryAbi,
            provider
        );
        
        console.log('Read-only contract instances created');
    }
    
    /**
     * Connect contracts with signer for write operations
     */
    connectContracts() {
        if (!Wallet.isWalletConnected() || !Wallet.getSigner()) {
            console.warn('Cannot connect contracts: wallet not connected');
            return;
        }
        
        const signer = Wallet.getSigner();
        
        // Connect DAO contract with signer
        this.contracts.dao = new ethers.Contract(
            AppConfig.contracts.daoAddress,
            AppConfig.abis.daoAbi,
            signer
        );
        
        // Connect factory contract with signer
        this.contracts.factory = new ethers.Contract(
            AppConfig.contracts.factoryAddress,
            AppConfig.abis.factoryAbi,
            signer
        );
        
        console.log('Contract instances connected with signer');
    }
    
    /**
     * Get the DAO contract instance
     */
    getDAOContract() {
        if (!this.contracts.dao) {
            console.warn("DAO contract not initialized, attempting to reconnect");
            this.createReadOnlyInstances();
        }
        return this.contracts.dao;
    }
    
    /**
     * Get the factory contract instance
     */
    getFactoryContract() {
        if (!this.contracts.factory) {
            console.warn("Factory contract not initialized, attempting to reconnect");
            this.createReadOnlyInstances();
        }
        return this.contracts.factory;
    }
    
    /**
     * Create a contract instance for a proposal
     * @param {string} address - The proposal contract address
     * @param {string} type - The proposal type (optional)
     */
    getProposalContract(address, type = null) {
        if (!address) {
            throw new Error('Proposal address is required');
        }
        
        let abi = AppConfig.abis.proposalAbi; // Default to base proposal ABI
        
        // Use specific ABI if type is provided
        if (type) {
            switch (type.toLowerCase()) {
                case 'resolution':
                    abi = AppConfig.abis.resolutionProposalAbi;
                    break;
                case 'treasury':
                    abi = AppConfig.abis.treasuryProposalAbi;
                    break;
                case 'mint':
                    abi = AppConfig.abis.mintProposalAbi;
                    break;
                case 'token-price':
                    abi = AppConfig.abis.tokenPriceProposalAbi;
                    break;
            }
        }
        
        // Create contract instance
        const provider = Wallet.isWalletConnected() ? Wallet.getSigner() : new ethers.providers.JsonRpcProvider(AppConfig.rpcUrl);
        return new ethers.Contract(address, abi, provider);
    }
    
    /**
     * Fetch basic DAO information
     */
    async fetchDAOInfo() {
        try {
            const dao = this.getDAOContract();
            
            // Ensure contract is available
            if (!dao) {
                console.error("DAO contract is not initialized");
                
                // Try to reconnect contracts
                this.createReadOnlyInstances();
                
                // Check again
                if (!this.contracts.dao) {
                    throw new Error("Cannot connect to DAO contract");
                }
                
                // Use the reconnected contract
                console.log("Successfully reconnected to contracts");
            }
            
            const [
                name,
                supportThreshold,
                quorumPercentage,
                maxProposalAge,
                electionDuration,
                allowMinting,
                tokenPrice,
                hasTreasury,
                acceptsETH,
                acceptsERC20,
                acceptsERC721,
                acceptsERC1155,
                tokenSupply
            ] = await Promise.all([
                this.contracts.dao.name(),
                this.contracts.dao.supportThreshold(),
                this.contracts.dao.quorumPercentage(),
                this.contracts.dao.maxProposalAge(),
                this.contracts.dao.electionDuration(),
                this.contracts.dao.allowMinting(),
                this.contracts.dao.tokenPrice(),
                this.contracts.dao.hasTreasury(),
                this.contracts.dao.acceptsETH(),
                this.contracts.dao.acceptsERC20(),
                this.contracts.dao.acceptsERC721(),
                this.contracts.dao.acceptsERC1155(),
                this.contracts.dao.totalSupply(0)
            ]);
            
            return {
                name,
                supportThreshold: supportThreshold.toNumber(),
                quorumPercentage: quorumPercentage.toNumber(),
                maxProposalAge: maxProposalAge.toNumber(),
                electionDuration: electionDuration.toNumber(),
                allowMinting,
                tokenPrice: ethers.utils.formatEther(tokenPrice),
                hasTreasury,
                acceptsETH,
                acceptsERC20,
                acceptsERC721,
                acceptsERC1155,
                tokenSupply: tokenSupply.toNumber()
            };
        } catch (error) {
            console.error('Error fetching DAO info:', error);
            throw error;
        }
    }
    
    /**
     * Fetch governance token balance for an address
     * @param {string} address - The address to check
     */
    async fetchTokenBalance(address) {
        try {
            if (!address) {
                return 0;
            }
            
            const dao = this.getDAOContract();
            const balance = await dao.balanceOf(address, 0);
            return balance.toNumber();
        } catch (error) {
            console.error('Error fetching token balance:', error);
            return 0;
        }
    }
    
    /**
     * Fetch token holders and their balances
     */
    async fetchTokenHolders() {
        try {
            const dao = this.getDAOContract();
            const holders = await dao.getGovernanceTokenHolders();
            
            const balances = await Promise.all(
                holders.map(async (holder) => {
                    const balance = await dao.balanceOf(holder, 0);
                    return {
                        address: holder,
                        balance: balance.toNumber()
                    };
                })
            );
            
            return balances;
        } catch (error) {
            console.error('Error fetching token holders:', error);
            return [];
        }
    }
    
    /**
     * Fetch proposals from the factory
     */
    async fetchProposals() {
        try {
            const factory = this.getFactoryContract();
            const count = await factory.proposalCount();
            
            const proposals = [];
            
            for (let i = 0; i < count; i++) {
                try {
                    const proposalAddress = await factory.getProposal(i);
                    const proposal = this.getProposalContract(proposalAddress);
                    
                    // Fetch basic proposal info
                    const [
                        description,
                        proposer,
                        createdAt,
                        supportTotal,
                        electionTriggered,
                        electionStart,
                        executed
                    ] = await Promise.all([
                        proposal.description(),
                        proposal.proposer(),
                        proposal.createdAt(),
                        proposal.supportTotal(),
                        proposal.electionTriggered(),
                        proposal.electionStart(),
                        proposal.executed()
                    ]);
                    
                    // Determine proposal type by checking for type-specific properties
                    let proposalType = 'resolution';
                    let additionalInfo = {};
                    
                    try {
                        // Try to get recipient - for treasury and mint proposals
                        const recipient = await proposal.recipient();
                        if (recipient) {
                            const amount = await proposal.amount();
                            
                            try {
                                // Try to get token and tokenId - for treasury proposals
                                const token = await proposal.token();
                                const tokenId = await proposal.tokenId();
                                
                                proposalType = 'treasury';
                                additionalInfo = {
                                    recipient,
                                    amount: ethers.utils.formatEther(amount),
                                    token,
                                    tokenId: tokenId.toNumber()
                                };
                            } catch (e) {
                                // If token/tokenId fail, it's a mint proposal
                                proposalType = 'mint';
                                additionalInfo = {
                                    recipient,
                                    amount: amount.toNumber()
                                };
                            }
                        }
                    } catch (e) {
                        // Not a treasury or mint proposal
                        try {
                            // Try to get newPrice - for token price proposals
                            const newPrice = await proposal.newPrice();
                            if (newPrice) {
                                proposalType = 'token-price';
                                additionalInfo = {
                                    newPrice: ethers.utils.formatEther(newPrice)
                                };
                            }
                        } catch (e2) {
                            // It's a resolution proposal
                        }
                    }
                    
                    // Get detailed election info if triggered
                    let electionInfo = {};
                    if (electionTriggered) {
                        const [
                            votingTokenId,
                            yesVoteAddress,
                            noVoteAddress
                        ] = await Promise.all([
                            proposal.votingTokenId(),
                            proposal.yesVoteAddress(),
                            proposal.noVoteAddress()
                        ]);
                        
                                                    // Get vote counts
                        const [
                            yesVotes,
                            noVotes,
                            totalVotes
                        ] = await Promise.all([
                            this.contracts.dao.balanceOf(yesVoteAddress, votingTokenId),
                            this.contracts.dao.balanceOf(noVoteAddress, votingTokenId),
                            this.contracts.dao.totalSupply(votingTokenId)
                        ]);
                        
                        electionInfo = {
                            votingTokenId: votingTokenId.toNumber(),
                            yesVoteAddress,
                            noVoteAddress,
                            yesVotes: yesVotes.toNumber(),
                            noVotes: noVotes.toNumber(),
                            totalVotes: totalVotes.toNumber(),
                            endBlock: electionStart.toNumber() + await this.contracts.dao.electionDuration()
                        };
                    }
                    
                    proposals.push({
                        id: i,
                        address: proposalAddress,
                        description,
                        proposer,
                        createdAt: createdAt.toNumber(),
                        supportTotal: supportTotal.toNumber(),
                        electionTriggered,
                        electionStart: electionTriggered ? electionStart.toNumber() : 0,
                        executed,
                        type: proposalType,
                        ...additionalInfo,
                        election: electionTriggered ? electionInfo : null
                    });
                } catch (error) {
                    console.error(`Error fetching proposal ${i}:`, error);
                }
            }
            
            return proposals;
        } catch (error) {
            console.error('Error fetching proposals:', error);
            return [];
        }
    }
    
    /**
     * Purchase governance tokens
     * @param {number} amount - Number of tokens to purchase
     * @param {string} price - Price per token in ETH
     */
    async purchaseTokens(amount, price) {
        try {
            if (!Wallet.isWalletConnected()) {
                throw new Error('Wallet not connected');
            }
            
            const dao = this.getDAOContract();
            const totalCost = ethers.utils.parseEther(
                (parseFloat(amount) * parseFloat(price)).toString()
            );
            
            const tx = await dao.purchaseTokens({
                value: totalCost
            });
            
            return await tx.wait();
        } catch (error) {
            console.error('Error purchasing tokens:', error);
            throw error;
        }
    }
}
