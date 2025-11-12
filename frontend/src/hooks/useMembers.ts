import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { MemberInfo, ContractRefs } from '../types';

interface UseMembersReturn {
  members: MemberInfo[];
  isLoading: boolean;
  error: string | null;
  refreshMembers: () => Promise<void>;
}

export const useMembers = (
  contractRefs: ContractRefs,
  isConnected: boolean
): UseMembersReturn => {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!isConnected || !contractRefs.daoContract || !contractRefs.provider) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { daoContract, provider } = contractRefs;
      const blockTag = 'latest';

      // Get all token holders
      console.log('Fetching token holders...');
      const holders: string[] = await daoContract.getGovernanceTokenHolders();
      console.log('Token holders:', holders);
      console.log('Number of holders:', holders.length);

      // Fetch balance data and ENS names for each holder
      const memberData = await Promise.all(
        holders.map(async (address) => {
          try {
            const [totalBalance, vestedBal, ensName] = await Promise.all([
              daoContract.balanceOf(address, 0, { blockTag }),
              daoContract.vestedBalance(address, { blockTag }),
              provider ? provider.lookupAddress(address).catch(() => null) : Promise.resolve(null),
            ]);

            const total = ethers.BigNumber.from(totalBalance);
            const vested = ethers.BigNumber.from(vestedBal);
            const unvested = total.sub(vested);

            return {
              address,
              ensName,
              totalBalance: total.toString(),
              vestedBalance: vested.toString(),
              unvestedBalance: unvested.toString(),
            };
          } catch (err) {
            console.warn(`Error loading data for ${address}:`, err);
            return {
              address,
              ensName: null,
              totalBalance: '0',
              vestedBalance: '0',
              unvestedBalance: '0',
            };
          }
        })
      );

      // Sort by total balance (descending)
      memberData.sort((a, b) => {
        const balanceA = ethers.BigNumber.from(a.totalBalance);
        const balanceB = ethers.BigNumber.from(b.totalBalance);
        return balanceB.gt(balanceA) ? 1 : balanceB.lt(balanceA) ? -1 : 0;
      });

      setMembers(memberData);
    } catch (err: any) {
      console.error('Error loading members:', err);
      setError(err.message || 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, contractRefs]);

  useEffect(() => {
    if (isConnected) {
      loadMembers();
    }
  }, [isConnected, loadMembers]);

  return {
    members,
    isLoading,
    error,
    refreshMembers: loadMembers,
  };
};
