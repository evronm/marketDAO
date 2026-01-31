// MarketDAO Configuration
// Easy to modify for different networks and deployments

window.CONFIG = {
  // Network Configuration
  network: {
    chainId: 31337, // Anvil local development
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545'
  },

  // Contract Addresses (Deployed)
  contracts: {
    dao: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    factory: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9'
  },

  // UI Settings
  ui: {
    notificationDuration: 3000, // ms
    maxRetries: 3,
    retryDelayMs: 1000
  }
}

// Helper to quickly change to different networks
const NETWORKS = {
  anvil: {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545',
    dao: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    factory: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9'
  },
  // Add other networks here as needed
  // sepolia: { ... },
  // mainnet: { ... }
}

// Uncomment to switch networks:
// Object.assign(CONFIG.network, { chainId: NETWORKS.sepolia.chainId, ... })
// CONFIG.contracts.dao = NETWORKS.sepolia.dao
// CONFIG.contracts.factory = NETWORKS.sepolia.factory
