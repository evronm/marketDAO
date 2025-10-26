import { ethers } from 'ethers';

/**
 * Safely converts a value to string, handling BigNumber objects
 */
export const safeValue = (value: unknown): string => {
  if (value === undefined || value === null) return '0';
  if (typeof value === 'object' && '_isBigNumber' in value) {
    return (value as ethers.BigNumber).toString();
  }
  return String(value);
};

/**
 * Safely formats ether values
 */
export const safeFormatEther = (value: unknown): string => {
  try {
    if (typeof value === 'object' && value && '_isBigNumber' in value) {
      return ethers.utils.formatEther(value as ethers.BigNumber);
    } else if (typeof value === 'string' && value.match(/^[0-9]+$/)) {
      return ethers.utils.formatEther(value);
    }
    return String(value);
  } catch (error) {
    console.error('Error formatting ether value:', error, value);
    return String(value);
  }
};

/**
 * Converts basis points (10000 = 100%) to percentage string
 */
export const basisPointsToPercent = (basisPoints: string | number | ethers.BigNumber): string => {
  try {
    let value: number;
    if (typeof basisPoints === 'object' && '_isBigNumber' in basisPoints) {
      value = (basisPoints as ethers.BigNumber).toNumber();
    } else if (typeof basisPoints === 'string') {
      value = parseInt(basisPoints);
    } else {
      value = basisPoints;
    }
    return (value / 100).toFixed(2);
  } catch (error) {
    console.error('Error converting basis points:', error, basisPoints);
    return '0';
  }
};

/**
 * Truncates an Ethereum address for display
 */
export const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(38)}`;
};

/**
 * Calculates percentage for display
 */
export const calculatePercentage = (part: string, total: string): number => {
  const partNum = parseInt(part);
  const totalNum = parseInt(total);

  if (totalNum === 0) return 0;
  return Math.round((partNum / totalNum) * 100);
};
