/**
 * Configuration for the Market DAO application
 */
const AppConfig = {
    // Contract addresses
    contracts: {
        daoAddress: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
        factoryAddress: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853'
    },
    
    // ABI paths (loaded dynamically)
    abis: {
        daoAbi: null,
        factoryAbi: null,
        proposalAbi: null,
        resolutionProposalAbi: null,
        treasuryProposalAbi: null,
        mintProposalAbi: null,
        tokenPriceProposalAbi: null
    },
    
    // RPC provider URL - using local hardhat node
    rpcUrl: 'http://localhost:8545',
    
    // Proposal types
    proposalTypes: {
        RESOLUTION: 'resolution',
        TREASURY: 'treasury',
        MINT: 'mint',
        TOKEN_PRICE: 'token-price'
    },
    
    // Block explorer URL - for local hardhat, using null
    blockExplorerUrl: null,
    
    // UI settings
    ui: {
        notificationDuration: 5000, // 5 seconds
        pollingInterval: 15000, // 15 seconds
    }
};

// Load ABIs - using hardcoded minimal versions for development
const loadContractAbis = async () => {
    console.log('Loading contract ABIs...');
    
    // Minimal ABI for MarketDAO with required functions
    AppConfig.abis.daoAbi = [
        // Basic ERC1155 functions
        "function balanceOf(address account, uint256 id) external view returns (uint256)",
        "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) public",
        "function setApprovalForAll(address operator, bool approved) external",
        "function isApprovedForAll(address account, address operator) external view returns (bool)",
        
        // MarketDAO specific functions
        "function name() external view returns (string memory)",
        "function supportThreshold() external view returns (uint256)",
        "function quorumPercentage() external view returns (uint256)",
        "function maxProposalAge() external view returns (uint256)",
        "function electionDuration() external view returns (uint256)",
        "function allowMinting() external view returns (bool)",
        "function tokenPrice() external view returns (uint256)",
        "function hasTreasury() external view returns (bool)",
        "function acceptsETH() external view returns (bool)",
        "function acceptsERC20() external view returns (bool)",
        "function acceptsERC721() external view returns (bool)",
        "function acceptsERC1155() external view returns (bool)",
        "function totalSupply(uint256 tokenId) external view returns (uint256)",
        "function getGovernanceTokenHolders() external view returns (address[] memory)",
        "function purchaseTokens() external payable"
    ];
    
    // Minimal ABI for ProposalFactory with required functions
    AppConfig.abis.factoryAbi = [
        "function proposalCount() external view returns (uint256)",
        "function proposals(uint256 index) external view returns (address)",
        "function getProposal(uint256 index) external view returns (address)",
        "function createResolutionProposal(string memory description) external returns (address)",
        "function createTreasuryProposal(string memory description, address recipient, uint256 amount, address token, uint256 tokenId) external returns (address)",
        "function createMintProposal(string memory description, address recipient, uint256 amount) external returns (address)",
        "function createTokenPriceProposal(string memory description, uint256 newPrice) external returns (address)"
    ];
    
    // Minimal ABI for Proposal with required functions
    AppConfig.abis.proposalAbi = [
        "function dao() external view returns (address)",
        "function proposer() external view returns (address)",
        "function createdAt() external view returns (uint256)",
        "function description() external view returns (string memory)",
        "function supportTotal() external view returns (uint256)",
        "function support(address) external view returns (uint256)",
        "function electionTriggered() external view returns (bool)",
        "function electionStart() external view returns (uint256)",
        "function votingTokenId() external view returns (uint256)",
        "function yesVoteAddress() external view returns (address)",
        "function noVoteAddress() external view returns (address)",
        "function executed() external view returns (bool)",
        "function addSupport(uint256 amount) external",
        "function removeSupport(uint256 amount) external",
        "function canTriggerElection() external view returns (bool)",
        "function execute() external"
    ];
    
    // Use proposal ABI as base for all proposal types
    AppConfig.abis.resolutionProposalAbi = AppConfig.abis.proposalAbi;
    
    // Add specific functions for TreasuryProposal
    AppConfig.abis.treasuryProposalAbi = [
        ...AppConfig.abis.proposalAbi,
        "function recipient() external view returns (address)",
        "function amount() external view returns (uint256)",
        "function token() external view returns (address)",
        "function tokenId() external view returns (uint256)"
    ];
    
    // Add specific functions for MintProposal
    AppConfig.abis.mintProposalAbi = [
        ...AppConfig.abis.proposalAbi,
        "function recipient() external view returns (address)",
        "function amount() external view returns (uint256)"
    ];
    
    // Add specific functions for TokenPriceProposal
    AppConfig.abis.tokenPriceProposalAbi = [
        ...AppConfig.abis.proposalAbi,
        "function newPrice() external view returns (uint256)"
    ];
    
    // Dispatch event to signal ABIs are loaded
    window.dispatchEvent(new CustomEvent('abis-loaded'));
    console.log('Using hardcoded minimal ABIs for development');
};

// Initialize by loading ABIs
document.addEventListener('DOMContentLoaded', loadContractAbis);
