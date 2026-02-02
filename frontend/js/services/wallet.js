// Wallet connection service
// Adapted from React hook to VanJS with ethers v6

// Global wallet state (will be initialized by app.js with van.state)
window.walletState = null

// Store event handler references for cleanup
let metamaskHandlers = {
  accountsChanged: null,
  chainChanged: null
}

// Initialize wallet state - call this from app.js
window.initWalletState = (van) => {
  window.walletState = {
    isConnected: van.state(false),
    walletAddress: van.state(''),
    error: van.state(null),
    provider: van.state(null),
    signer: van.state(null),
    daoContract: van.state(null),
    factoryContract: van.state(null)
  }

  // Set up MetaMask event listeners
  setupMetaMaskListeners()

  return window.walletState
}

/**
 * Connect wallet and initialize contracts
 */
window.connectWallet = async () => {
  try {
    walletState.error.val = null

    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
      throw new Error('Please install MetaMask to use this dApp')
    }

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const currentAccount = accounts[0]
    walletState.walletAddress.val = currentAccount

    // Initialize ethers provider and signer (v6 syntax)
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner() // Note: await in v6

    // Check network
    const network = await provider.getNetwork()
    const actualChainId = Number(network.chainId)
    const expectedChainId = CONFIG.network.chainId

    // Validate chain ID
    if (actualChainId !== expectedChainId) {
      const errorMsg = [
        `Wrong network detected!`,
        `Expected: ${CONFIG.network.name} (Chain ID: ${expectedChainId})`,
        `Connected: Chain ID ${actualChainId}`,
        `\nPlease switch MetaMask to the correct network.`,
        `\nFor Anvil/Hardhat local development:`,
        `1. Open MetaMask`,
        `2. Click network dropdown`,
        `3. Add network manually:`,
        `   - Network Name: ${CONFIG.network.name}`,
        `   - RPC URL: ${CONFIG.network.rpcUrl}`,
        `   - Chain ID: ${expectedChainId}`,
        `   - Currency: ETH`
      ].join('\n')

      console.error('❌ Network mismatch:', errorMsg)

      // Show a more user-friendly error in the UI
      throw new Error(
        `Wrong network! Please switch MetaMask to ${CONFIG.network.name} (Chain ID: ${expectedChainId}). ` +
        `Currently on Chain ID ${actualChainId}.`
      )
    }

    // Initialize contracts
    const daoContract = new ethers.Contract(CONFIG.contracts.dao, DAO_ABI, signer)
    const factoryContract = new ethers.Contract(CONFIG.contracts.factory, FACTORY_ABI, signer)

    // Update state
    walletState.provider.val = provider
    walletState.signer.val = signer
    walletState.daoContract.val = daoContract
    walletState.factoryContract.val = factoryContract
    walletState.isConnected.val = true
  } catch (err) {
    const message = err.message || 'Failed to connect wallet'
    walletState.error.val = message
    console.error('Wallet connection error:', err)
    throw err
  }
}

/**
 * Disconnect wallet
 */
window.disconnectWallet = () => {
  // Clean up event listeners first
  cleanupMetaMaskListeners()

  walletState.isConnected.val = false
  walletState.walletAddress.val = ''
  walletState.provider.val = null
  walletState.signer.val = null
  walletState.daoContract.val = null
  walletState.factoryContract.val = null
  walletState.error.val = null
}

/**
 * Set up MetaMask event listeners
 */
function setupMetaMaskListeners() {
  if (typeof window.ethereum === 'undefined') {
    return
  }

  // Clean up any existing listeners first (prevent duplicates)
  cleanupMetaMaskListeners()

  // Handle account changes
  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      disconnectWallet()
    } else if (accounts[0] !== walletState.walletAddress.val) {
      // User switched to a different account
      const newAccount = accounts[0]
      walletState.walletAddress.val = newAccount

      // Reinitialize contracts with new signer if we were connected
      if (walletState.isConnected.val) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum)
          const signer = await provider.getSigner()
          const daoContract = new ethers.Contract(CONFIG.contracts.dao, DAO_ABI, signer)
          const factoryContract = new ethers.Contract(CONFIG.contracts.factory, FACTORY_ABI, signer)

          walletState.provider.val = provider
          walletState.signer.val = signer
          walletState.daoContract.val = daoContract
          walletState.factoryContract.val = factoryContract
        } catch (err) {
          console.error('Error updating contracts after account change:', err)
        }
      }
    }
  }

  // Handle chain changes (reload page as recommended by MetaMask)
  const handleChainChanged = () => {
    window.location.reload()
  }

  // Store handler references for cleanup
  metamaskHandlers.accountsChanged = handleAccountsChanged
  metamaskHandlers.chainChanged = handleChainChanged

  // Add listeners
  window.ethereum.on('accountsChanged', handleAccountsChanged)
  window.ethereum.on('chainChanged', handleChainChanged)
}

/**
 * Clean up MetaMask event listeners
 */
function cleanupMetaMaskListeners() {
  if (typeof window.ethereum === 'undefined') {
    return
  }

  if (metamaskHandlers.accountsChanged) {
    window.ethereum.removeListener('accountsChanged', metamaskHandlers.accountsChanged)
    metamaskHandlers.accountsChanged = null
  }

  if (metamaskHandlers.chainChanged) {
    window.ethereum.removeListener('chainChanged', metamaskHandlers.chainChanged)
    metamaskHandlers.chainChanged = null
  }
}

/**
 * Check if MetaMask is installed
 */
window.isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined'
}
