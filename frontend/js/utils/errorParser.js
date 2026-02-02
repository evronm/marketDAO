// Error parsing utilities for better user experience

/**
 * Parse contract error and return user-friendly message
 * @param {Error} error - Error object from ethers.js
 * @param {string} context - Context of the operation (e.g., 'purchase', 'vote', 'support')
 * @returns {object} { message: string, retryable: boolean, technical: string }
 */
window.parseContractError = (error, context = 'operation') => {
  const errorMsg = error?.message || error?.toString() || 'Unknown error'
  const errorCode = error?.code
  const errorData = error?.data

  console.error(`Error during ${context}:`, {
    message: errorMsg,
    code: errorCode,
    data: errorData,
    error
  })

  // User rejection
  if (errorMsg.includes('user rejected') ||
      errorMsg.includes('User denied') ||
      errorMsg.includes('user denied') ||
      errorCode === 'ACTION_REJECTED') {
    return {
      message: 'Transaction cancelled',
      retryable: true,
      technical: errorMsg
    }
  }

  // Network errors (retryable)
  if (errorMsg.includes('network') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('could not detect network') ||
      errorCode === 'NETWORK_ERROR' ||
      errorCode === 'TIMEOUT') {
    return {
      message: 'Network error. Please check your connection and try again.',
      retryable: true,
      technical: errorMsg
    }
  }

  // Insufficient funds for gas
  if (errorMsg.includes('insufficient funds') ||
      errorCode === 'INSUFFICIENT_FUNDS') {
    return {
      message: 'Insufficient ETH to pay for gas fees. Please add ETH to your wallet.',
      retryable: false,
      technical: errorMsg
    }
  }

  // Nonce too low (transaction already processed)
  if (errorMsg.includes('nonce too low') ||
      errorMsg.includes('already known')) {
    return {
      message: 'Transaction already processed. Please refresh the page.',
      retryable: false,
      technical: errorMsg
    }
  }

  // Gas estimation failed (usually means transaction would revert)
  if (errorMsg.includes('cannot estimate gas') ||
      errorMsg.includes('gas required exceeds allowance') ||
      errorCode === 'UNPREDICTABLE_GAS_LIMIT') {
    return {
      message: 'Transaction would fail. ' + extractRevertReason(errorMsg, context),
      retryable: false,
      technical: errorMsg
    }
  }

  // Execution reverted (contract explicitly rejected)
  if (errorMsg.includes('execution reverted') ||
      errorMsg.includes('revert') ||
      errorCode === 'CALL_EXCEPTION') {
    const reason = extractRevertReason(errorMsg, context)
    return {
      message: reason,
      retryable: false,
      technical: errorMsg
    }
  }

  // Contract-specific errors (parse from error data if available)
  if (errorData) {
    const customReason = parseCustomError(errorData, context)
    if (customReason) {
      return {
        message: customReason,
        retryable: false,
        technical: errorMsg
      }
    }
  }

  // Default fallback
  return {
    message: `Failed to ${context}. ${extractHelpfulPart(errorMsg)}`,
    retryable: false,
    technical: errorMsg
  }
}

/**
 * Extract revert reason from error message
 * @param {string} errorMsg - Full error message
 * @param {string} context - Operation context
 * @returns {string} User-friendly reason
 */
function extractRevertReason(errorMsg, context) {
  // Common patterns in revert messages
  const patterns = [
    /reason="([^"]+)"/,
    /reverted with reason string '([^']+)'/,
    /reverted: ([^\n]+)/,
    /'([^']+)'/
  ]

  for (const pattern of patterns) {
    const match = errorMsg.match(pattern)
    if (match && match[1]) {
      return translateRevertReason(match[1], context)
    }
  }

  // Context-specific guesses
  return guessReasonFromContext(context)
}

/**
 * Translate contract revert reason to user-friendly message
 * @param {string} reason - Raw revert reason from contract
 * @param {string} context - Operation context
 * @returns {string} User-friendly message
 */
function translateRevertReason(reason, context) {
  const translations = {
    // Vesting related
    'Must claim vested tokens first': 'You need to claim your vested tokens before participating in governance.',
    'Insufficient vested governance tokens': 'You don\'t have enough vested tokens. Your tokens may still be locked in vesting.',
    'Must hold vested governance tokens': 'You need vested tokens to perform this action.',

    // Proposal related
    'Proposal expired': 'This proposal has expired and can no longer receive support.',
    'Election already triggered': 'This proposal\'s election has already been triggered.',
    'Not during election period': 'Voting is only allowed during the active election period.',
    'Cannot support more than vested governance tokens held': 'You cannot add more support than your vested token balance.',

    // Election related
    'Insufficient support to remove': 'You don\'t have that much support to remove.',
    'Already claimed': 'You have already claimed your voting tokens for this election.',
    'No claimable amount': 'You have no voting tokens to claim for this election.',

    // Execution
    'Proposal not approved': 'This proposal was not approved and cannot be executed.',
    'Already executed': 'This proposal has already been executed.',

    // Treasury
    'Insufficient available ETH balance': 'The DAO treasury doesn\'t have enough ETH for this transfer.',
    'Insufficient available ERC20 balance': 'The DAO treasury doesn\'t have enough tokens for this transfer.',
    'Insufficient available ERC1155 balance': 'The DAO treasury doesn\'t have enough of this token.',

    // General
    'require(false)': guessReasonFromContext(context)
  }

  return translations[reason] || reason
}

/**
 * Guess error reason based on operation context
 * @param {string} context - Operation context
 * @returns {string} Guessed reason
 */
function guessReasonFromContext(context) {
  const guesses = {
    purchase: 'You may not have permission to purchase tokens, or the DAO may be out of tokens.',
    vote: 'You may not have voting tokens, or the election period may have ended.',
    support: 'You may not have enough vested tokens, or the proposal may have expired.',
    claim: 'You may have already claimed, or have no tokens to claim.',
    trigger: 'The proposal may not have enough support to trigger an election.',
    execute: 'The proposal may not have been approved, or the execution failed.',
    create: 'You may not have vested tokens, or the proposal parameters are invalid.'
  }

  return guesses[context] || 'The transaction was rejected by the contract.'
}

/**
 * Parse custom error from error data
 * @param {any} errorData - Error data from ethers
 * @param {string} context - Operation context
 * @returns {string|null} Parsed error or null
 */
function parseCustomError(errorData, context) {
  // Try to decode custom error if we have the data
  // This would require the contract ABI with custom errors
  // For now, return null (could be enhanced later)
  return null
}

/**
 * Extract the most helpful part of a complex error message
 * @param {string} errorMsg - Full error message
 * @returns {string} Simplified message
 */
function extractHelpfulPart(errorMsg) {
  // Remove common prefixes
  let msg = errorMsg
    .replace(/^Error: /, '')
    .replace(/^execution reverted: /, '')
    .replace(/^Error: execution reverted: /, '')
    .trim()

  // Take only the first line/sentence if it's too long
  if (msg.length > 100) {
    const firstLine = msg.split('\n')[0]
    const firstSentence = msg.split('.')[0]
    msg = firstLine.length < firstSentence.length ? firstLine : firstSentence
  }

  return msg
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise} Result of operation
 */
window.retryOperation = async (operation, maxRetries = 3, initialDelay = 1000) => {
  let lastError

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      const parsedError = parseContractError(error)

      // Don't retry if not retryable
      if (!parsedError.retryable) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        throw error
      }

      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt)
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
