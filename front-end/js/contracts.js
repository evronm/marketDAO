// Contract interfaces and functionality for the Market DAO application

// ABI definitions
const DAO_ABI = [
    // General info
    "function name() view returns (string)",
    "function supportThreshold() view returns (uint256)",
    "function quorumPercentage() view returns (uint256)",
    "function maxProposalAge() view returns (uint256)",
    "function electionDuration() view returns (uint256)",
    "function allowMinting() view returns (bool)",
    "function tokenPrice() view returns (uint256)",
    "function hasTreasury() view returns (bool)",
    "function acceptsETH() view returns (bool)",
    "function acceptsERC20() view returns (bool)",
    "function acceptsERC721() view returns (bool)",
    "function acceptsERC1155() view returns (bool)",
    "function activeProposal() view returns (address)",
    "function getGovernanceTokenHolders() view returns (address[])",
    "function totalSupply(uint256 tokenId) view returns (uint256)",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    
    // Actions
    "function purchaseTokens() payable",
    "function setActiveProposal(address proposal)",
    "function clearActiveProposal()",
    "function mintGovernanceTokens(address to, uint256 amount)",
    "function mintVotingTokens(address to, uint256 tokenId, uint256 amount)",
    "function transferETH(address recipient, uint256 amount)",
    "function setTokenPrice(uint256 newPrice)",
    "function getNextVotingTokenId() returns (uint256)",
    "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
];

const FACTORY_ABI = [
    "function dao() view returns (address)",
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (address)",
    "function getProposal(uint256 index) view returns (address)",
    
    // Create proposal functions
    "function createResolutionProposal(string description) returns (address)",
    "function createTreasuryProposal(string description, address recipient, uint256 amount, address token, uint256 tokenId) returns (address)",
    "function createMintProposal(string description, address recipient, uint256 amount) returns (address)",
    "function createTokenPriceProposal(string description, uint256 newPrice) returns (address)"
];

const PROPOSAL_ABI = [
    // Base proposal fields
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
    
    // Actions
    "function addSupport(uint256 amount)",
    "function removeSupport(uint256 amount)",
    "function canTriggerElection() view returns (bool)",
    "function execute()"
];

// Additional ABIs for different proposal types
const TREASURY_PROPOSAL_ABI = [
    ...PROPOSAL_ABI,
    "function recipient() view returns (address)",
    "function amount() view returns (uint256)",
    "function token() view returns (address)",
    "function tokenId() view returns (uint256)"
];

const MINT_PROPOSAL_ABI = [
    ...PROPOSAL_ABI,
    "function recipient() view returns (address)",
    "function amount() view returns (uint256)"
];

const TOKEN_PRICE_PROPOSAL_ABI = [
    ...PROPOSAL_ABI,
    "function newPrice() view returns (uint256)"
];

// Contract class to manage contracts interaction
class Contracts {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.daoContract = null;
        this.factoryContract = null;
        this.proposalContracts = {};
    }

    /**
     * Initialize the contract instances
     * @param {ethers.providers.Web3Provider} provider - The Ethereum provider
     * @param {ethers.Signer} signer - The signer to use for transactions
     */
    initialize(provider, signer) {
        this.provider = provider;
        this.signer = signer;
        
        // Create contract instances
        this.daoContract = new ethers.Contract(
            CONFIG.contracts.dao,
            DAO_ABI,
            this.signer
        );
        
        this.factoryContract = new ethers.Contract(
            CONFIG.contracts.factory,
            FACTORY_ABI,
            this.signer
        );
    }

    /**
     * Get a proposal contract instance by address
     * @param {string} address - The proposal contract address
     * @param {string} type - The proposal type (optional, used for specific ABIs)
     * @returns {ethers.Contract} The proposal contract
     */
    getProposalContract(address, type = null) {
        if (this.proposalContracts[address]) {
            return this.proposalContracts[address];
        }
        
        let abi = PROPOSAL_ABI;
        
        // Use the appropriate ABI based on the proposal type
        if (type === CONFIG.proposalTypes.TREASURY) {
            abi = TREASURY_PROPOSAL_ABI;
        } else if (type === CONFIG.proposalTypes.MINT) {
            abi = MINT_PROPOSAL_ABI;
        } else if (type === CONFIG.proposalTypes.TOKEN_PRICE) {
            abi = TOKEN_PRICE_PROPOSAL_ABI;
        }
        
        const contract = new ethers.Contract(address, abi, this.signer);
        this.proposalContracts[address] = contract;
        return contract;
    }

    /**
     * Reset the contract instances
     */
    reset() {
        this.provider = null;
        this.signer = null;
        this.daoContract = null;
        this.factoryContract = null;
        this.proposalContracts = {};
    }

    /**
     * Check if contracts are initialized
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this.daoContract !== null && this.factoryContract !== null;
    }
}

// Create a singleton instance and ensure it's defined in the global scope
window.contracts = new Contracts();
