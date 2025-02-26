// Configuration settings for the Market DAO application
const CONFIG = {
    // Contract addresses
    contracts: {
        dao: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        factory: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
    },
    
    // Default gas settings
    gas: {
        limit: 3000000,
        price: null // Will use the network's suggested gas price
    },
    
    // Refresh intervals (in milliseconds)
    refreshIntervals: {
        daoInfo: 60000, // 1 minute
        proposals: 30000, // 30 seconds
        elections: 20000, // 20 seconds
        userInfo: 10000 // 10 seconds
    },
    
    // Block time estimation (in seconds)
    blockTime: 15,
    
    // Zero address constant
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    
    // Governance token ID
    GOVERNANCE_TOKEN_ID: 0,
    
    // Number of blocks to show in the past (for completed elections)
    PAST_BLOCKS_TO_QUERY: 10000,
    
    // Proposal types
    proposalTypes: {
        RESOLUTION: 'Resolution',
        TREASURY: 'Treasury',
        MINT: 'Mint',
        TOKEN_PRICE: 'TokenPrice'
    }
};
