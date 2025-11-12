import { useState, useCallback, useEffect } from 'react';
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

      console.log('Connecting wallet with addresses:', { daoAddress, factoryAddress });

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

      // Check network
      const network = await provider.getNetwork();
      console.log('Connected to network:', network);
      console.log('Network chain ID:', network.chainId);
      console.log('Network name:', network.name);

      if (network.chainId !== 31337) {
        const errorMsg = `Wrong network! Please switch MetaMask to Localhost 8545 (Chain ID: 31337). Currently on chain ID: ${network.chainId}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Network check passed - on chain ID 31337');

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

  // Listen for account changes in MetaMask
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      return;
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      console.log('MetaMask accounts changed:', accounts);

      if (accounts.length === 0) {
        // User disconnected their wallet
        setIsConnected(false);
        setWalletAddress('');
        setContractRefs({
          provider: null,
          signer: null,
          daoContract: null,
          factoryContract: null,
        });
      } else if (accounts[0] !== walletAddress) {
        // User switched to a different account
        const newAccount = accounts[0];
        setWalletAddress(newAccount);

        // Reinitialize contracts with new signer if we were connected
        if (isConnected) {
          try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const daoContract = new ethers.Contract(daoAddress, DAO_ABI, signer);
            const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

            setContractRefs({
              provider,
              signer,
              daoContract,
              factoryContract,
            });
          } catch (err) {
            console.error('Error updating contracts after account change:', err);
          }
        }
      }
    };

    const handleChainChanged = () => {
      // Reload the page when chain changes (recommended by MetaMask)
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup listeners
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, walletAddress, daoAddress, factoryAddress]);

  return {
    isConnected,
    walletAddress,
    contractRefs,
    connectWallet,
    error,
  };
};
