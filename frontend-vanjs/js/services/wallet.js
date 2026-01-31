// Wallet connection service
// Adapted from React hook to VanJS with ethers v6

// Global wallet state (will be initialized by app.js with van.state)
window.walletState = null

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

    console.log('Connecting wallet with addresses:', CONFIG.contracts)

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
    console.log('Connected to network:', network)
    console.log('Network chain ID:', network.chainId)
    console.log('Network name:', network.name)

    if (Number(network.chainId) !== CONFIG.network.chainId) {
      const errorMsg = `Wrong network! Please switch MetaMask to ${CONFIG.network.name} (Chain ID: ${CONFIG.network.chainId}). Currently on chain ID: ${network.chainId}`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`✅ Network check passed - on chain ID ${CONFIG.network.chainId}`)

    // Initialize contracts
    const daoContract = new ethers.Contract(CONFIG.contracts.dao, DAO_ABI, signer)
    const factoryContract = new ethers.Contract(CONFIG.contracts.factory, FACTORY_ABI, signer)

    // Update state
    walletState.provider.val = provider
    walletState.signer.val = signer
    walletState.daoContract.val = daoContract
    walletState.factoryContract.val = factoryContract
    walletState.isConnected.val = true

    console.log('✅ Wallet connected successfully')
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

  // Handle account changes
  const handleAccountsChanged = async (accounts) => {
    console.log('MetaMask accounts changed:', accounts)

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

          console.log('✅ Contracts updated for new account')
        } catch (err) {
          console.error('Error updating contracts after account change:', err)
        }
      }
    }
  }

  // Handle chain changes (reload page as recommended by MetaMask)
  const handleChainChanged = () => {
    console.log('Chain changed, reloading page...')
    window.location.reload()
  }

  // Add listeners
  window.ethereum.on('accountsChanged', handleAccountsChanged)
  window.ethereum.on('chainChanged', handleChainChanged)

  console.log('✅ MetaMask event listeners set up')
}

/**
 * Check if MetaMask is installed
 */
window.isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined'
}
