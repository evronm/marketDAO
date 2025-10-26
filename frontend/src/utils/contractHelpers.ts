import { ethers } from 'ethers';
import { MAX_RETRIES, RETRY_DELAY_MS } from '../types/constants';

/**
 * Retries a contract call with exponential backoff
 */
export const retryContractCall = async <T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS
): Promise<T> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} failed:`, err);
      if (attempt === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  throw new Error('Retry limit exceeded');
};

/**
 * Checks if an address is the zero address
 */
export const isZeroAddress = (address: string): boolean => {
  return address === ethers.constants.AddressZero;
};

/**
 * Safely parses ether input to wei
 */
export const parseEtherSafe = (value: string): ethers.BigNumber | null => {
  try {
    return ethers.utils.parseEther(value);
  } catch (error) {
    console.error('Error parsing ether value:', error);
    return null;
  }
};

/**
 * Validates Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  try {
    ethers.utils.getAddress(address);
    return true;
  } catch {
    return false;
  }
};
