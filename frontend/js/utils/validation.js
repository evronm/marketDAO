// Input validation utilities for MarketDAO frontend

/**
 * Validate Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid address
 */
window.isValidAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return false
  }
  return ethers.isAddress(address)
}

/**
 * Validate amount is positive and not zero
 * @param {string|number|BigInt} amount - Amount to validate
 * @returns {boolean} True if valid amount
 */
window.isValidAmount = (amount) => {
  try {
    if (amount === '' || amount === null || amount === undefined) {
      return false
    }

    // Handle string, number, or BigInt
    const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount)
    return amountBigInt > 0n
  } catch {
    return false
  }
}

/**
 * Validate amount is within a maximum limit
 * @param {string|number|BigInt} amount - Amount to validate
 * @param {string|number|BigInt} max - Maximum allowed amount
 * @returns {boolean} True if amount is valid and within limit
 */
window.isValidAmountWithMax = (amount, max) => {
  try {
    if (!isValidAmount(amount)) return false

    const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount)
    const maxBigInt = typeof max === 'bigint' ? max : BigInt(max)

    return amountBigInt <= maxBigInt
  } catch {
    return false
  }
}

/**
 * Validate ETH amount string (e.g., "0.1" for 0.1 ETH)
 * @param {string} ethAmount - ETH amount as string
 * @returns {boolean} True if valid ETH amount
 */
window.isValidEthAmount = (ethAmount) => {
  if (!ethAmount || typeof ethAmount !== 'string') {
    return false
  }

  try {
    // Check if it's a valid number
    const parsed = parseFloat(ethAmount)
    if (isNaN(parsed) || parsed <= 0) {
      return false
    }

    // Try to parse as ether
    ethers.parseEther(ethAmount)
    return true
  } catch {
    return false
  }
}

/**
 * Validate ETH amount is within available balance
 * @param {string} ethAmount - ETH amount as string
 * @param {string|BigInt} maxBalance - Maximum balance in wei
 * @returns {boolean} True if valid and within balance
 */
window.isValidEthAmountWithBalance = (ethAmount, maxBalance) => {
  try {
    if (!isValidEthAmount(ethAmount)) return false

    const amountWei = ethers.parseEther(ethAmount)
    const maxBigInt = typeof maxBalance === 'bigint' ? maxBalance : BigInt(maxBalance)

    return amountWei <= maxBigInt
  } catch {
    return false
  }
}

/**
 * Validate description is not empty
 * @param {string} description - Description to validate
 * @returns {boolean} True if non-empty description
 */
window.isValidDescription = (description) => {
  return description && typeof description === 'string' && description.trim().length > 0
}

/**
 * Get validation error message
 * @param {string} field - Field name
 * @param {string} type - Validation type ('required', 'invalid', 'insufficient')
 * @param {object} context - Additional context (e.g., max value)
 * @returns {string} Error message
 */
window.getValidationError = (field, type, context = {}) => {
  const errors = {
    required: {
      address: 'Please enter an address',
      amount: 'Please enter an amount',
      description: 'Please enter a description',
      recipient: 'Please enter a recipient address',
      value: 'Please enter a value'
    },
    invalid: {
      address: 'Invalid Ethereum address. Must start with 0x and be 42 characters long.',
      amount: 'Invalid amount. Must be a positive number.',
      ethAmount: 'Invalid ETH amount. Must be a positive number (e.g., 0.1).',
      description: 'Description cannot be empty'
    },
    insufficient: {
      balance: context.max
        ? `Insufficient balance. Maximum available: ${formatAmount(context.max)}`
        : 'Insufficient balance',
      vestedBalance: 'Insufficient vested tokens. Please claim vested tokens first.',
      treasuryBalance: context.max
        ? `Insufficient treasury balance. Available: ${safeFormatEther(context.max)} ETH`
        : 'Insufficient treasury balance'
    }
  }

  return errors[type]?.[field] || `Invalid ${field}`
}

/**
 * Validate proposal creation inputs
 * @param {string} type - Proposal type
 * @param {string} description - Proposal description
 * @param {object} params - Type-specific parameters
 * @param {object} daoInfo - Current DAO info state
 * @returns {object} { valid: boolean, error: string }
 */
window.validateProposalInputs = (type, description, params, daoInfo) => {
  // Check vested balance
  const vestedBalance = BigInt(daoInfo.vestedBalance || '0')
  if (vestedBalance === 0n) {
    return {
      valid: false,
      error: 'You need vested tokens to create proposals. Your tokens are still locked in vesting.'
    }
  }

  // Type-specific validation
  switch (type) {
    case 'treasury':
      // Description required for treasury proposals
      if (!isValidDescription(description)) {
        return { valid: false, error: getValidationError('description', 'required') }
      }
      if (!isValidAddress(params.treasuryRecipient)) {
        return { valid: false, error: getValidationError('recipient', 'invalid') }
      }
      if (!isValidEthAmount(params.treasuryAmount)) {
        return { valid: false, error: getValidationError('ethAmount', 'invalid') }
      }
      // Check treasury balance
      const treasuryBalance = ethers.parseEther(daoInfo.treasuryBalance || '0')
      const requestedAmount = ethers.parseEther(params.treasuryAmount)
      if (requestedAmount > treasuryBalance) {
        return {
          valid: false,
          error: getValidationError('treasuryBalance', 'insufficient', { max: treasuryBalance })
        }
      }
      break

    case 'mint':
      // Description required for mint proposals
      if (!isValidDescription(description)) {
        return { valid: false, error: getValidationError('description', 'required') }
      }
      if (!isValidAddress(params.mintRecipient)) {
        return { valid: false, error: getValidationError('recipient', 'invalid') }
      }
      if (!isValidAmount(params.mintAmount)) {
        return { valid: false, error: getValidationError('amount', 'invalid') }
      }
      break

    case 'parameter':
      // Description optional for parameter proposals (parameter name is self-explanatory)
      if (!params.parameterName) {
        return { valid: false, error: 'Please select a parameter' }
      }
      if (!params.parameterValue || params.parameterValue.trim() === '') {
        return { valid: false, error: 'Please enter a value for the parameter' }
      }

      // Token price accepts ETH values (will be converted to wei)
      if (params.parameterName === 'tokenPrice') {
        if (!isValidEthAmount(params.parameterValue)) {
          return { valid: false, error: 'Token price must be a valid ETH amount (e.g., 0.1)' }
        }
      } else {
        // Other parameters must be positive integers
        try {
          const value = BigInt(params.parameterValue)
          if (value <= 0n) {
            return { valid: false, error: 'Parameter value must be a positive integer' }
          }
        } catch (err) {
          return { valid: false, error: 'Parameter value must be a valid integer (no decimals)' }
        }
      }
      break

    case 'resolution':
      // Description required for resolutions (that's the whole point)
      if (!isValidDescription(description)) {
        return { valid: false, error: getValidationError('description', 'required') }
      }
      break

    default:
      return { valid: false, error: 'Unknown proposal type' }
  }

  return { valid: true }
}
