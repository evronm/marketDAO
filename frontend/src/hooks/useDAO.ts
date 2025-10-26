import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { DAOInfo, ContractRefs } from '../types';
import { DAO_ADDRESS } from '../types/constants';

interface UseDAOReturn {
  daoInfo: DAOInfo;
  isLoading: boolean;
  error: string | null;
  refreshDAOInfo: () => Promise<void>;
  purchaseTokens: (amount: number) => Promise<void>;
  claimVestedTokens: () => Promise<void>;
}

const DEFAULT_DAO_INFO: DAOInfo = {
  name: 'Loading...',
  tokenBalance: '0',
  vestedBalance: '0',
  unvestedBalance: '0',
  tokenSupply: '0',
  tokenPrice: '0',
  quorumPercentage: '0',
  supportThreshold: '0',
  treasuryBalance: '0',
  vestingPeriod: '0',
  maxProposalAge: '0',
  electionDuration: '0',
  hasClaimableVesting: false,
};

export const useDAO = (
  contractRefs: ContractRefs,
  walletAddress: string,
  isConnected: boolean
): UseDAOReturn => {
  const [daoInfo, setDaoInfo] = useState<DAOInfo>(DEFAULT_DAO_INFO);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDAOInfo = useCallback(async () => {
    if (!isConnected || !contractRefs.daoContract || !contractRefs.provider) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { daoContract, provider } = contractRefs;

      // Wait for provider to be ready
      const network = await provider.getNetwork();
      console.log('Connected to network:', network);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get treasury balance - force latest block
      let treasuryBalance: ethers.BigNumber;
      try {
        treasuryBalance = await provider.getBalance(DAO_ADDRESS, 'latest');
      } catch (balanceError) {
        console.warn('Error getting treasury balance:', balanceError);
        treasuryBalance = ethers.BigNumber.from(0);
      }

      // Load contract data with individual error handling
      const loadField = async <T>(
        fn: () => Promise<T>,
        fallback: T,
        fieldName: string
      ): Promise<T> => {
        try {
          return await fn();
        } catch (e) {
          console.warn(`Error getting ${fieldName}:`, e);
          return fallback;
        }
      };

      // Force fresh data by using latest block
      const blockTag = 'latest';

      const [
        daoName,
        tokenPrice,
        tokenBalance,
        vestedBal,
        tokenSupply,
        quorumPercentage,
        supportThreshold,
        vestingPer,
        maxPropAge,
        elecDuration,
        hasClaimable,
      ] = await Promise.all([
        loadField(() => daoContract.name({ blockTag }), 'Market DAO', 'DAO name'),
        loadField(() => daoContract.tokenPrice({ blockTag }), ethers.utils.parseEther('0.1'), 'token price'),
        loadField(() => daoContract.balanceOf(walletAddress, 0, { blockTag }), ethers.BigNumber.from(0), 'token balance'),
        loadField(() => daoContract.vestedBalance(walletAddress, { blockTag }), ethers.BigNumber.from(0), 'vested balance'),
        loadField(() => daoContract.totalSupply(0, { blockTag }), ethers.BigNumber.from(0), 'token supply'),
        loadField(() => daoContract.quorumPercentage({ blockTag }), ethers.BigNumber.from(2500), 'quorum percentage'),
        loadField(() => daoContract.supportThreshold({ blockTag }), ethers.BigNumber.from(1500), 'support threshold'),
        loadField(() => daoContract.vestingPeriod({ blockTag }), ethers.BigNumber.from(0), 'vesting period'),
        loadField(() => daoContract.maxProposalAge({ blockTag }), ethers.BigNumber.from(100), 'max proposal age'),
        loadField(() => daoContract.electionDuration({ blockTag }), ethers.BigNumber.from(50), 'election duration'),
        loadField(() => daoContract.hasClaimableVesting(walletAddress, { blockTag }), false, 'has claimable vesting'),
      ]);

      const unvestedBal = tokenBalance.sub(vestedBal);

      console.log('DAO Info loaded:', {
        tokenBalance: tokenBalance.toString(),
        vestedBalance: vestedBal.toString(),
        unvestedBalance: unvestedBal.toString(),
        hasClaimable
      });

      setDaoInfo({
        name: daoName,
        tokenBalance: tokenBalance.toString(),
        vestedBalance: vestedBal.toString(),
        unvestedBalance: unvestedBal.toString(),
        tokenSupply: tokenSupply.toString(),
        tokenPrice: ethers.utils.formatEther(tokenPrice),
        quorumPercentage: quorumPercentage.toString(),
        supportThreshold: supportThreshold.toString(),
        treasuryBalance: ethers.utils.formatEther(treasuryBalance),
        vestingPeriod: vestingPer.toString(),
        maxProposalAge: maxPropAge.toString(),
        electionDuration: elecDuration.toString(),
        hasClaimableVesting: hasClaimable,
      });
    } catch (err: any) {
      const message = err.message || 'Failed to load DAO information';
      setError(message);
      console.error('Error loading DAO info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contractRefs, walletAddress, isConnected]);

  const purchaseTokens = useCallback(
    async (amount: number) => {
      if (!contractRefs.daoContract) {
        throw new Error('DAO contract not initialized');
      }

      const pricePerToken = ethers.utils.parseEther(daoInfo.tokenPrice);
      const totalCost = pricePerToken.mul(amount);

      // purchaseTokens() takes no parameters - amount is calculated from msg.value
      const tx = await contractRefs.daoContract.purchaseTokens({
        value: totalCost,
      });
      await tx.wait();
      await loadDAOInfo();
    },
    [contractRefs.daoContract, daoInfo.tokenPrice, loadDAOInfo]
  );

  const claimVestedTokens = useCallback(async () => {
    if (!contractRefs.daoContract) {
      throw new Error('DAO contract not initialized');
    }

    const tx = await contractRefs.daoContract.claimVestedTokens();
    await tx.wait();
    await loadDAOInfo();
  }, [contractRefs.daoContract, loadDAOInfo]);

  // Load DAO info on mount and when connected
  useEffect(() => {
    if (isConnected) {
      loadDAOInfo();
    }
  }, [isConnected, loadDAOInfo]);

  return {
    daoInfo,
    isLoading,
    error,
    refreshDAOInfo: loadDAOInfo,
    purchaseTokens,
    claimVestedTokens,
  };
};
