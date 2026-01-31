// DAO service - handles loading DAO info and user interactions
// Ported from React useDAO hook with ethers v6 updates

// Default DAO info structure
const DEFAULT_DAO_INFO = {
  name: 'Loading...',
  tokenBalance: '0',
  vestedBalance: '0',
  unvestedBalance: '0',
  tokenSupply: '0',
  tokenPrice: '0',
  quorumPercentage: '0',
  supportThreshold: '0',
  treasuryBalance: '0',
  vestingPeriod: '0',
  maxProposalAge: '0',
  electionDuration: '0',
  hasClaimableVesting: false,
  restrictPurchases: false,
  allowMinting: false,
  mintToPurchase: false,
  availableTokensForPurchase: '0'
}

// Global DAO state
window.daoState = null

/**
 * Initialize DAO state
 */
window.initDAOState = (van) => {
  window.daoState = {
    info: van.state({ ...DEFAULT_DAO_INFO }),
    isLoading: van.state(false),
    error: van.state(null)
  }
  return window.daoState
}

/**
 * Load DAO information
 */
window.loadDAOInfo = async () => {
  if (!walletState.isConnected.val || !walletState.daoContract.val || !walletState.provider.val) {
    console.warn('Cannot load DAO info: not connected')
    return
  }

  daoState.isLoading.val = true
  daoState.error.val = null

  try {
    const daoContract = walletState.daoContract.val
    const provider = walletState.provider.val
    const walletAddress = walletState.walletAddress.val

    console.log('Loading DAO info for address:', walletAddress)

    // Wait for blockchain state to settle (important after transactions)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Get current block to verify we're reading latest state
    const currentBlock = await provider.getBlockNumber()
    console.log('Reading state at block:', currentBlock)

    // Get treasury balance
    let treasuryBalance
    try {
      treasuryBalance = await provider.getBalance(CONFIG.contracts.dao)
    } catch (balanceError) {
      console.warn('Error getting treasury balance:', balanceError)
      treasuryBalance = 0n
    }

    // Helper to load individual fields with error handling
    const loadField = async (fn, fallback, fieldName) => {
      try {
        return await fn()
      } catch (e) {
        console.warn(`Error getting ${fieldName}:`, e)
        return fallback
      }
    }

    // Load all contract data in parallel
    const [
      daoName,
      tokenPrice,
      tokenBalance,
      vestedBal,
      tokenSupply,
      quorumPercentage,
      supportThreshold,
      vestingPer,
      maxPropAge,
      elecDuration,
      hasClaimable,
      restrictPurchases,
      allowMinting,
      mintToPurchase,
      availableTokens
    ] = await Promise.all([
      loadField(() => daoContract.name(), 'Market DAO', 'DAO name'),
      loadField(() => daoContract.tokenPrice(), ethers.parseEther('0.1'), 'token price'),
      loadField(() => daoContract.balanceOf(walletAddress, 0), 0n, 'token balance'),
      loadField(() => daoContract.vestedBalance(walletAddress), 0n, 'vested balance'),
      loadField(() => daoContract.totalSupply(0), 0n, 'token supply'),
      loadField(() => daoContract.quorumPercentage(), 2500n, 'quorum percentage'),
      loadField(() => daoContract.supportThreshold(), 1500n, 'support threshold'),
      loadField(() => daoContract.vestingPeriod(), 0n, 'vesting period'),
      loadField(() => daoContract.maxProposalAge(), 100n, 'max proposal age'),
      loadField(() => daoContract.electionDuration(), 50n, 'election duration'),
      loadField(() => daoContract.hasClaimableVesting(walletAddress), false, 'has claimable vesting'),
      loadField(() => daoContract.restrictPurchasesToHolders(), false, 'restrict purchases'),
      loadField(() => daoContract.allowMinting(), false, 'allow minting'),
      loadField(() => daoContract.mintToPurchase(), false, 'mint to purchase'),
      loadField(() => daoContract.getAvailableTokensForPurchase(), 0n, 'available tokens for purchase')
    ])

    // Calculate unvested balance (ethers v6: BigInt arithmetic)
    const unvestedBal = tokenBalance - vestedBal

    console.log('✅ DAO Info loaded:', {
      walletAddress,
      tokenBalance: tokenBalance.toString(),
      vestedBalance: vestedBal.toString(),
      unvestedBalance: unvestedBal.toString(),
      tokenPrice: tokenPrice.toString(),
      tokenPriceFormatted: ethers.formatEther(tokenPrice),
      hasClaimable,
      totalSupply: tokenSupply.toString()
    })

    // Update state (ethers v6: formatEther directly on BigInt)
    daoState.info.val = {
      name: daoName,
      tokenBalance: tokenBalance.toString(),
      vestedBalance: vestedBal.toString(),
      unvestedBalance: unvestedBal.toString(),
      tokenSupply: tokenSupply.toString(),
      tokenPrice: ethers.formatEther(tokenPrice),
      quorumPercentage: quorumPercentage.toString(),
      supportThreshold: supportThreshold.toString(),
      treasuryBalance: ethers.formatEther(treasuryBalance),
      vestingPeriod: vestingPer.toString(),
      maxProposalAge: maxPropAge.toString(),
      electionDuration: elecDuration.toString(),
      hasClaimableVesting: hasClaimable,
      restrictPurchases,
      allowMinting,
      mintToPurchase,
      availableTokensForPurchase: availableTokens.toString()
    }

    console.log('✅ DAO info loaded successfully')
  } catch (err) {
    const message = err.message || 'Failed to load DAO information'
    daoState.error.val = message
    console.error('Error loading DAO info:', err)
  } finally {
    daoState.isLoading.val = false
  }
}

/**
 * Purchase governance tokens
 */
window.purchaseTokens = async (amount) => {
  if (!walletState.daoContract.val) {
    throw new Error('DAO contract not initialized')
  }

  const daoContract = walletState.daoContract.val
  const pricePerToken = ethers.parseEther(daoState.info.val.tokenPrice)
  const totalCost = pricePerToken * BigInt(amount)

  console.log(`Purchasing ${amount} tokens for ${ethers.formatEther(totalCost)} ETH`)

  // purchaseTokens() takes no parameters - amount is calculated from msg.value
  const tx = await daoContract.purchaseTokens({ value: totalCost })
  console.log('Transaction sent:', tx.hash)

  const receipt = await tx.wait()
  console.log('✅ Transaction mined in block:', receipt.blockNumber)
  console.log('✅ Tokens purchased successfully')

  // Wait a bit longer and reload DAO info
  await new Promise(resolve => setTimeout(resolve, 1000))
  console.log('Reloading DAO info after purchase...')
  await loadDAOInfo()
}

/**
 * Claim vested tokens
 */
window.claimVestedTokens = async () => {
  if (!walletState.daoContract.val) {
    throw new Error('DAO contract not initialized')
  }

  const daoContract = walletState.daoContract.val
  console.log('Claiming vested tokens...')

  const tx = await daoContract.claimVestedTokens()
  console.log('Transaction sent:', tx.hash)

  await tx.wait()
  console.log('✅ Vested tokens claimed successfully')

  // Reload DAO info
  await loadDAOInfo()
}
