// contract.js - Handles contract initialization and interaction

import { getSigner } from './web3.js';

// Contract addresses
const DAO_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const FACTORY_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';

// ABIs
const DAO_ABI = [
    "function name() view returns (string)",
    "function supportThreshold() view returns (uint256)",
    "function quorumPercentage() view returns (uint256)",
    "function maxProposalAge() view returns (uint256)",
    "function electionDuration() view returns (uint256)",
    "function allowMinting() view returns (bool)",
    "function tokenPrice() view returns (uint256)",
    "function activeProposal() view returns (address)",
    "function totalSupply(uint256) view returns (uint256)",
    "function balanceOf(address, uint256) view returns (uint256)",
    "function hasTreasury() view returns (bool)",
    "function acceptsETH() view returns (bool)",
    "function acceptsERC20() view returns (bool)",
    "function acceptsERC721() view returns (bool)",
    "function acceptsERC1155() view returns (bool)",
    "function getGovernanceTokenHolders() view returns (address[])",
    "function purchaseTokens() payable",
    "function isApprovedForAll(address, address) view returns (bool)",
    "function setApprovalForAll(address, bool)",
    "function safeTransferFrom(address, address, uint256, uint256, bytes)",
    "function setActiveProposal(address)",
    "function clearActiveProposal()",
    "function mintGovernanceTokens(address, uint256)",
    "function mintVotingTokens(address, uint256, uint256)",
    "function getNextVotingTokenId() returns (uint256)",
    "function transferETH(address, uint256)",
    "function setTokenPrice(uint256)"
];

const FACTORY_ABI = [
    "function dao() view returns (address)",
    "function proposalCount() view returns (uint256)",
    "function proposals(uint256) view returns (address)",
    "function getProposal(uint256) view returns (address)",
    "function createResolutionProposal(string) returns (address)",
    "function createTreasuryProposal(string, address, uint256, address, uint256) returns (address)",
    "function createMintProposal(string, address, uint256) returns (address)",
    "function createTokenPriceProposal(string, uint256) returns (address)"
];

const PROPOSAL_ABI = [
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
    "function addSupport(uint256)",
    "function removeSupport(uint256)",
    "function canTriggerElection() view returns (bool)",
    "function execute()"
];

// Additional ABIs for specific proposal types
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

/**
 * Initialize contract instances
 * @param {ethers.providers.Web3Provider} provider - The Web3 provider
 * @returns {Promise<Object>} - Object containing contract instances
 */
export async function initContract(provider) {
    if (!provider) {
        throw new Error('Provider not initialized');
    }
    
    try {
        // Get the signer
        const signer = await getSigner(provider);
        
        // Create contract instances
        const dao = new ethers.Contract(
            DAO_ADDRESS,
            DAO_ABI,
            signer
        );
        
        const factory = new ethers.Contract(
            FACTORY_ADDRESS,
            FACTORY_ABI,
            signer
        );
        
        return {
            dao,
            factory,
            provider,
            signer
        };
    } catch (error) {
        console.error('Error initializing contracts:', error);
        throw error;
    }
}

/**
 * Get a proposal contract instance
 * @param {ethers.Signer} signer - The signer
 * @param {string} proposalAddress - Address of the proposal
 * @param {string} proposalType - Type of the proposal
 * @returns {ethers.Contract} - Proposal contract instance
 */
export function getProposalContract(signer, proposalAddress, proposalType) {
    let abi = PROPOSAL_ABI;
    
    // Use specific ABI based on proposal type
    switch (proposalType) {
        case 'treasury':
            abi = TREASURY_PROPOSAL_ABI;
            break;
        case 'mint':
            abi = MINT_PROPOSAL_ABI;
            break;
        case 'price':
            abi = TOKEN_PRICE_PROPOSAL_ABI;
            break;
        default:
            abi = PROPOSAL_ABI;
    }
    
    return new ethers.Contract(
        proposalAddress,
        abi,
        signer
    );
}

/**
 * Get all active proposals
 * @param {Object} contracts - Object containing contract instances
 * @returns {Promise<Array>} - Array of proposal data
 */
export async function getActiveProposals(contracts) {
    try {
        const { factory, signer } = contracts;
        
        // Get the proposal count
        const count = await factory.proposalCount();
        
        // Get all proposals
        const proposals = [];
        for (let i = 0; i < count; i++) {
            try {
                const proposalAddress = await factory.getProposal(i);
                
                // Create a proposal contract instance with base ABI
                const proposalContract = new ethers.Contract(
                    proposalAddress,
                    PROPOSAL_ABI,
                    signer
                );
                
                // Get basic proposal data
                const [
                    description,
                    supportTotal,
                    electionTriggered,
                    executed,
                    createdAt,
                    proposer
                ] = await Promise.all([
                    proposalContract.description(),
                    proposalContract.supportTotal(),
                    proposalContract.electionTriggered(),
                    proposalContract.executed(),
                    proposalContract.createdAt(),
                    proposalContract.proposer()
                ]);
                
                // Skip executed proposals
                if (executed) continue;
                
                // Determine proposal type based on the address
                // This is a simplified approach - in a real app, you might want to use instanceof checks or other methods
                let proposalType = 'resolution';
                let proposalDetails = {};
                
                // Try to determine proposal type by checking for type-specific methods
                try {
                    const recipient = await proposalContract.recipient();
                    const amount = await proposalContract.amount();
                    
                    if (await proposalContract.token) {
                        const token = await proposalContract.token();
                        const tokenId = await proposalContract.tokenId();
                        proposalType = 'treasury';
                        proposalDetails = { recipient, amount, token, tokenId };
                    } else if (await proposalContract.newPrice) {
                        const newPrice = await proposalContract.newPrice();
                        proposalType = 'price';
                        proposalDetails = { newPrice };
                    } else {
                        proposalType = 'mint';
                        proposalDetails = { recipient, amount };
                    }
                } catch (e) {
                    // If no specific properties are found, it's a resolution proposal
                    proposalType = 'resolution';
                }
                
                proposals.push({
                    address: proposalAddress,
                    description,
                    supportTotal,
                    electionTriggered,
                    executed,
                    createdAt: createdAt.toNumber(),
                    proposer,
                    type: proposalType,
                    details: proposalDetails
                });
            } catch (e) {
                console.error(`Error loading proposal ${i}:`, e);
            }
        }
        
        return proposals;
    } catch (error) {
        console.error('Error getting active proposals:', error);
        throw error;
    }
}
