// Contract addresses (these are from local deployment - should be configurable)
export const DAO_ADDRESS = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
export const FACTORY_ADDRESS = '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512';

// Rarible testnet URL template
export const RARIBLE_TESTNET_URL = (daoAddress: string, tokenId: string) =>
  `https://testnet.rarible.com/token/polygon/${daoAddress}:${tokenId}`;

// Notification display duration (ms)
export const NOTIFICATION_DURATION = 3000;

// Retry configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
