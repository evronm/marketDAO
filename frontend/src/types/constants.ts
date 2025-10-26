// Contract addresses (these are from local deployment - should be configurable)
export const DAO_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
export const FACTORY_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Rarible testnet URL template
export const RARIBLE_TESTNET_URL = (daoAddress: string, tokenId: string) =>
  `https://testnet.rarible.com/token/polygon/${daoAddress}:${tokenId}`;

// Notification display duration (ms)
export const NOTIFICATION_DURATION = 3000;

// Retry configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
