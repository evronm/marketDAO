// Contract addresses (these are from local deployment - should be configurable)
export const DAO_ADDRESS = '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9';
export const FACTORY_ADDRESS = '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9';

// Rarible testnet URL template
export const RARIBLE_TESTNET_URL = (daoAddress: string, tokenId: string) =>
  `https://testnet.rarible.com/token/polygon/${daoAddress}:${tokenId}`;

// Notification display duration (ms)
export const NOTIFICATION_DURATION = 3000;

// Retry configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
