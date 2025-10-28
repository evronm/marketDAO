// Contract addresses (these are from local deployment - should be configurable)
export const DAO_ADDRESS = '0x0B306BF915C4d645ff596e518fAf3F9669b97016';
export const FACTORY_ADDRESS = '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1';

// Rarible testnet URL template
export const RARIBLE_TESTNET_URL = (daoAddress: string, tokenId: string) =>
  `https://testnet.rarible.com/token/polygon/${daoAddress}:${tokenId}`;

// Notification display duration (ms)
export const NOTIFICATION_DURATION = 3000;

// Retry configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
