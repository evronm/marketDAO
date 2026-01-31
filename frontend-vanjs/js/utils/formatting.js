// Utility functions for formatting values
// Ported from TypeScript to vanilla JS with ethers v6 updates

/**
 * Safely converts a value to string, handling BigInt
 */
window.safeValue = (value) => {
  if (value === undefined || value === null) return '0'
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

/**
 * Safely formats ether values
 * ethers v6: ethers.formatEther (no utils namespace)
 */
window.safeFormatEther = (value) => {
  try {
    if (typeof value === 'bigint') {
      return ethers.formatEther(value)
    } else if (typeof value === 'string' && value.match(/^[0-9]+$/)) {
      return ethers.formatEther(value)
    }
    return String(value)
  } catch (error) {
    console.error('Error formatting ether value:', error, value)
    return String(value)
  }
}

/**
 * Converts basis points (10000 = 100%) to percentage string
 */
window.basisPointsToPercent = (basisPoints) => {
  try {
    let value
    if (typeof basisPoints === 'bigint') {
      value = Number(basisPoints)
    } else if (typeof basisPoints === 'string') {
      value = parseInt(basisPoints)
    } else {
      value = basisPoints
    }
    return (value / 100).toFixed(2)
  } catch (error) {
    console.error('Error converting basis points:', error, basisPoints)
    return '0'
  }
}

/**
 * Truncates an Ethereum address for display (0x1234...abcd)
 */
window.truncateAddress = (address) => {
  if (!address || address.length < 10) return address
  return `${address.substring(0, 6)}...${address.substring(38)}`
}

/**
 * Calculates percentage for display
 */
window.calculatePercentage = (part, total) => {
  const partNum = typeof part === 'bigint' ? Number(part) : parseInt(part)
  const totalNum = typeof total === 'bigint' ? Number(total) : parseInt(total)

  if (totalNum === 0) return 0
  return Math.round((partNum / totalNum) * 100)
}
