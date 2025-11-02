import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { ContractRefs } from '../types';
import { DAO_ABI, FACTORY_ABI } from '../types/abis';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface UseWalletReturn {
  isConnected: boolean;
  walletAddress: string;
  contractRefs: ContractRefs;
  connectWallet: () => Promise<void>;
  error: string | null;
}

interface UseWalletParams {
  daoAddress: string;
  factoryAddress: string;
}

export const useWallet = ({ daoAddress, factoryAddress }: UseWalletParams): UseWalletReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contractRefs, setContractRefs] = useState<ContractRefs>({
    provider: null,
    signer: null,
    daoContract: null,
    factoryContract: null,
  });

  const connectWallet = useCallback(async () => {
    try {
      setError(null);

      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask to use this dApp');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const currentAccount = accounts[0];
      setWalletAddress(currentAccount);

      // Initialize ethers provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Initialize contracts
      const daoContract = new ethers.Contract(daoAddress, DAO_ABI, signer);
      const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

      setContractRefs({
        provider,
        signer,
        daoContract,
        factoryContract,
      });

      setIsConnected(true);
    } catch (err: any) {
      const message = err.message || 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    }
  }, [daoAddress, factoryAddress]);

  return {
    isConnected,
    walletAddress,
    contractRefs,
    connectWallet,
    error,
  };
};
