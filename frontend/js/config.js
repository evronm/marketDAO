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
    dao: '0xfcb452f006ea7706be2eb7492f85774fbffc9c5c',
    factory: '0x2781dcb7acd800c94888c18f029d9bf1d0270610'
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
    dao: '0xfcb452f006ea7706be2eb7492f85774fbffc9c5c',
    factory: '0x2781dcb7acd800c94888c18f029d9bf1d0270610'
  },
  // Add other networks here as needed
  // sepolia: { ... },
  // mainnet: { ... }
}
