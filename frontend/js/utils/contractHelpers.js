// Contract interaction helper functions
// Ported from TypeScript to vanilla JS with ethers v6 updates

/**
 * Retries a contract call with exponential backoff
 */
window.retryContractCall = async (
  fn,
  retries = CONFIG.ui.maxRetries,
  delay = CONFIG.ui.retryDelayMs
) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} failed:`, err)
      if (attempt === retries - 1) throw err
      await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)))
    }
  }
  throw new Error('Retry limit exceeded')
}

/**
 * Checks if an address is the zero address
 * ethers v6: ethers.ZeroAddress (was ethers.constants.AddressZero)
 */
window.isZeroAddress = (address) => {
  return address === ethers.ZeroAddress
}

/**
 * Safely parses ether input to wei
 * ethers v6: ethers.parseEther (no utils namespace)
 * Returns BigInt or null on error
 */
window.parseEtherSafe = (value) => {
  try {
    return ethers.parseEther(value)
  } catch (error) {
    console.error('Error parsing ether value:', error)
    return null
  }
}

/**
 * Validates Ethereum address
 * ethers v6: ethers.getAddress (no utils namespace)
 */
window.isValidAddress = (address) => {
  try {
    ethers.getAddress(address)
    return true
  } catch {
    return false
  }
}
