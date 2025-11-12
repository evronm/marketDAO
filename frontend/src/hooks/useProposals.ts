import { useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { Proposal, ProposalCache, ContractRefs, DAOInfo } from '../types';
import {
  BASE_PROPOSAL_ABI,
  TREASURY_PROPOSAL_ABI,
  MINT_PROPOSAL_ABI,
  PARAMETER_PROPOSAL_ABI,
  DISTRIBUTION_PROPOSAL_ABI,
  DISTRIBUTION_REDEMPTION_ABI,
} from '../types/abis';
import { ParameterType } from '../types';
import { retryContractCall } from '../utils/contractHelpers';

interface UseProposalsReturn {
  activeProposals: Proposal[];
  electionProposals: Proposal[];
  historyProposals: Proposal[];
  isLoading: boolean;
  error: string | null;
  loadAllProposals: () => Promise<void>;
  supportProposal: (proposalAddress: string, amount: string) => Promise<void>;
  triggerElection: (proposalAddress: string) => Promise<void>;
  voteOnProposal: (proposalAddress: string, voteYes: boolean, amount: string) => Promise<void>;
  claimVotingTokens: (proposalAddress: string) => Promise<void>;
  registerForDistribution: (proposalAddress: string) => Promise<void>;
  claimDistribution: (redemptionAddress: string) => Promise<void>;
  createResolutionProposal: (description: string) => Promise<void>;
  createTreasuryProposal: (
    description: string,
    recipient: string,
    amount: string,
    token: string,
    tokenId: string
  ) => Promise<void>;
  createMintProposal: (description: string, recipient: string, amount: string) => Promise<void>;
  createParameterProposal: (description: string, parameterType: ParameterType, newValue: string) => Promise<void>;
  createDistributionProposal: (description: string, token: string, tokenId: string, amountPerToken: string) => Promise<void>;
}

export const useProposals = (
  contractRefs: ContractRefs,
  walletAddress: string,
  daoInfo: DAOInfo,
  isConnected: boolean
): UseProposalsReturn => {
  const [activeProposals, setActiveProposals] = useState<Proposal[]>([]);
  const [electionProposals, setElectionProposals] = useState<Proposal[]>([]);
  const [historyProposals, setHistoryProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposalCacheRef = useRef<ProposalCache>({});
  const proposalListRef = useRef<Proposal[]>([]);

  const fetchProposalDetails = useCallback(
    async (proposalAddress: string): Promise<Proposal | null> => {
      // Check cache first
      if (proposalCacheRef.current[proposalAddress]) {
        return proposalCacheRef.current[proposalAddress];
      }

      if (!contractRefs.signer || !contractRefs.provider || !contractRefs.daoContract) {
        return null;
      }

      try {
        const baseContract = new ethers.Contract(
          proposalAddress,
          BASE_PROPOSAL_ABI,
          contractRefs.signer
        );

        // Get common proposal details
        const [
          description,
          proposer,
          createdAt,
          supportTotal,
          electionTriggered,
          executed,
          electionStart,
          canTrigger,
        ] = await Promise.all([
          baseContract.description(),
          baseContract.proposer(),
          baseContract.createdAt(),
          baseContract.supportTotal(),
          baseContract.electionTriggered(),
          baseContract.executed(),
          baseContract.electionStart(),
          baseContract.canTriggerElection(),
        ]);

        // Calculate if proposal has expired
        const currentBlock = await contractRefs.provider.getBlockNumber();
        const maxPropAge = ethers.BigNumber.from(daoInfo.maxProposalAge || '100');
        const expirationBlock = createdAt.add(maxPropAge);
        const isExpired = currentBlock >= expirationBlock.toNumber() && !electionTriggered;

        console.log('Expiration check:', {
          proposalAddress,
          createdAt: createdAt.toString(),
          currentBlock,
          maxPropAge: maxPropAge.toString(),
          expirationBlock: expirationBlock.toString(),
          isExpired
        });

        let proposalData: any = {
          address: proposalAddress,
          description,
          proposer,
          createdAt: createdAt.toString(),
          supportTotal: supportTotal.toString(),
          electionTriggered,
          executed,
          electionStart: electionStart.toString(),
          canTriggerElection: canTrigger,
          isExpired,
          expirationBlock: expirationBlock.toString(),
          type: 'resolution',
          details: {},
          isHistorical: executed,
          votes: { yes: '0', no: '0', total: '0', available: '0' },
          votingTokenId: '0',
          electionStatus: 'Unknown',
          isActive: false,
          result: executed ? 'EXECUTED' : '',
        };

        // If it's an election, get the voting details
        if (electionTriggered) {
          const [votingTokenId, yesVoteAddress, noVoteAddress] = await Promise.all([
            baseContract.votingTokenId(),
            baseContract.yesVoteAddress(),
            baseContract.noVoteAddress(),
          ]);

          proposalData.votingTokenId = votingTokenId.toString();

          // Get vote counts and claimable amounts
          const [yesVotes, noVotes, totalVotes, userVotingBalance, claimableAmount, hasClaimed] =
            await Promise.all([
              contractRefs.daoContract.balanceOf(yesVoteAddress, votingTokenId),
              contractRefs.daoContract.balanceOf(noVoteAddress, votingTokenId),
              contractRefs.daoContract.totalSupply(votingTokenId),
              contractRefs.daoContract.balanceOf(walletAddress, votingTokenId),
              baseContract.getClaimableAmount(walletAddress),
              baseContract.hasClaimed(walletAddress),
            ]);

          proposalData.votes = {
            yes: yesVotes.toString(),
            no: noVotes.toString(),
            total: totalVotes.toString(),
            available: userVotingBalance.toString(),
            claimable: claimableAmount.toString(),
            hasClaimed,
          };

          // Determine election status
          const electionDuration = ethers.BigNumber.from(daoInfo.electionDuration);
          const electionEnd = electionStart.add(electionDuration);

          if (currentBlock < parseInt(electionStart.toString())) {
            proposalData.electionStatus = 'Not Started';
            proposalData.isActive = false;
          } else if (currentBlock >= parseInt(electionEnd.toString())) {
            proposalData.electionStatus = 'Ended';
            proposalData.isActive = false;

            if (!executed) {
              proposalData.isHistorical = true;

              // Determine result
              const quorumPercentage = ethers.BigNumber.from(daoInfo.quorumPercentage);
              const quorum = totalVotes.mul(quorumPercentage).div(10000);

              if (yesVotes.add(noVotes).lt(quorum)) {
                proposalData.result = 'REJECTED (Quorum not met)';
              } else if (yesVotes.gt(noVotes)) {
                proposalData.result = 'APPROVED';
              } else {
                proposalData.result = 'REJECTED';
              }
            }
          } else {
            proposalData.electionStatus = 'Active';
            proposalData.isActive = true;
          }
        }

        // Try to determine proposal type
        try {
          const treasuryContract = new ethers.Contract(
            proposalAddress,
            TREASURY_PROPOSAL_ABI,
            contractRefs.signer
          );
          const recipient = await treasuryContract.recipient();
          const [amount, token, tokenId] = await Promise.all([
            treasuryContract.amount(),
            treasuryContract.token(),
            treasuryContract.tokenId(),
          ]);

          proposalData.type = 'treasury';
          proposalData.details = {
            recipient,
            amount: amount.toString(),
            token,
            tokenId: tokenId.toString(),
          };
        } catch (e) {
          try {
            const mintContract = new ethers.Contract(
              proposalAddress,
              MINT_PROPOSAL_ABI,
              contractRefs.signer
            );
            const recipient = await mintContract.recipient();
            const amount = await mintContract.amount();

            proposalData.type = 'mint';
            proposalData.details = {
              recipient,
              amount: amount.toString(),
            };
          } catch (e) {
            try {
              const parameterContract = new ethers.Contract(
                proposalAddress,
                PARAMETER_PROPOSAL_ABI,
                contractRefs.signer
              );
              const [parameterType, newValue] = await Promise.all([
                parameterContract.parameterType(),
                parameterContract.newValue(),
              ]);

              proposalData.type = 'parameter';
              proposalData.details = {
                parameterType: parameterType as ParameterType,
                newValue: newValue.toString(),
              };
            } catch (e) {
              try {
                const distributionContract = new ethers.Contract(
                  proposalAddress,
                  DISTRIBUTION_PROPOSAL_ABI,
                  contractRefs.signer
                );
                const [token, tokenId, amountPerToken, totalAmount, redemptionContract] = await Promise.all([
                  distributionContract.token(),
                  distributionContract.tokenId(),
                  distributionContract.amountPerGovernanceToken(),
                  distributionContract.totalAmount(),
                  distributionContract.redemptionContract(),
                ]);

                // Check if user has already claimed from the redemption contract
                let hasClaimedDistribution = false;
                let registeredBalance = '0';
                let isRegistered = false;
                if (redemptionContract && redemptionContract !== ethers.constants.AddressZero) {
                  try {
                    const redemptionContractInstance = new ethers.Contract(
                      redemptionContract,
                      DISTRIBUTION_REDEMPTION_ABI,
                      contractRefs.signer
                    );
                    [hasClaimedDistribution, registeredBalance] = await Promise.all([
                      redemptionContractInstance.hasClaimed(walletAddress),
                      redemptionContractInstance.registeredBalance(walletAddress),
                    ]);
                    isRegistered = !registeredBalance.isZero();
                  } catch (e) {
                    // If we can't check, assume false
                    console.warn('Could not check distribution claim status:', e);
                  }
                }

                proposalData.type = 'distribution';
                proposalData.details = {
                  token,
                  tokenId: tokenId.toString(),
                  amountPerGovernanceToken: amountPerToken.toString(),
                  totalAmount: totalAmount.toString(),
                  redemptionContract,
                  hasClaimedDistribution,
                  isRegistered,
                  registeredBalance: registeredBalance.toString(),
                };
              } catch (e) {
                // Must be a resolution proposal (already set as default)
              }
            }
          }
        }

        // Cache the result
        proposalCacheRef.current[proposalAddress] = proposalData as Proposal;
        return proposalData as Proposal;
      } catch (error) {
        console.error(`Error fetching proposal details for ${proposalAddress}:`, error);
        return null;
      }
    },
    [contractRefs, walletAddress, daoInfo]
  );

  const loadAllProposals = useCallback(async () => {
    if (!isConnected || !contractRefs.factoryContract || !contractRefs.signer) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Clear cache to ensure fresh data with current daoInfo values
    proposalCacheRef.current = {};

    try {
      // Get proposal count with retry logic
      const count = await retryContractCall<ethers.BigNumber>(() => contractRefs.factoryContract!.proposalCount());

      if (!count || (count as ethers.BigNumber).toNumber() === 0) {
        console.log('No proposals found');
        proposalListRef.current = [];
        setActiveProposals([]);
        setElectionProposals([]);
        setHistoryProposals([]);
        setIsLoading(false);
        return;
      }

      // Get all proposal addresses
      const proposalAddresses: string[] = [];
      for (let i = 0; i < (count as ethers.BigNumber).toNumber(); i++) {
        const address = await contractRefs.factoryContract.proposals(i);
        proposalAddresses.push(address);
      }

      // Fetch details for all proposals
      console.log('Loading proposals from addresses:', proposalAddresses);
      const proposalDetails = await Promise.all(
        proposalAddresses.map((addr) => fetchProposalDetails(addr))
      );

      // Filter out null results
      const allProposals = proposalDetails.filter((p) => p !== null) as Proposal[];
      console.log('Loaded proposals:', allProposals.map(p => ({ address: p.address, type: p.type, status: p.electionStatus })));

      // Store the full list
      proposalListRef.current = allProposals;

      // Update filtered lists
      setActiveProposals(allProposals.filter((p) => !p.executed && !p.electionTriggered));
      setElectionProposals(
        allProposals.filter(
          (p) =>
            !p.executed &&
            p.electionTriggered &&
            (p.electionStatus === 'Active' || p.electionStatus === 'Not Started')
        )
      );
      setHistoryProposals(
        allProposals.filter((p) => p.executed || (p.isHistorical && p.electionTriggered))
      );

      setIsLoading(false);
    } catch (err: any) {
      const message = err.message || 'Failed to load proposals';
      setError(message);
      console.error('Error loading proposals:', err);
      setIsLoading(false);
    }
  }, [isConnected, contractRefs, fetchProposalDetails]);

  const supportProposal = useCallback(
    async (proposalAddress: string, amount: string) => {
      if (!contractRefs.signer || !contractRefs.provider || !contractRefs.daoContract) {
        throw new Error('Contracts not initialized');
      }

      // Debug: Check current state before supporting
      const currentBlock = await contractRefs.provider.getBlockNumber();
      const vestedBal = await contractRefs.daoContract.vestedBalance(walletAddress, { blockTag: 'latest' });

      // Get proposal contract
      const proposalContract = new ethers.Contract(proposalAddress, BASE_PROPOSAL_ABI, contractRefs.signer);

      const [createdAt, electionTriggered] = await Promise.all([
        proposalContract.createdAt(),
        proposalContract.electionTriggered(),
      ]);

      const maxPropAge = ethers.BigNumber.from(daoInfo.maxProposalAge || '100');
      const expirationBlock = createdAt.add(maxPropAge);

      console.log('Support proposal attempt:', {
        proposalAddress,
        amount,
        currentBlock,
        vestedBalance: vestedBal.toString(),
        createdAt: createdAt.toString(),
        expirationBlock: expirationBlock.toString(),
        electionTriggered,
        isExpired: currentBlock >= expirationBlock.toNumber() && !electionTriggered,
      });

      if (currentBlock >= expirationBlock.toNumber() && !electionTriggered) {
        throw new Error(`Proposal has expired at block ${expirationBlock.toString()}. Current block is ${currentBlock}`);
      }

      if (vestedBal.lt(amount)) {
        throw new Error(`Insufficient vested balance. You have ${vestedBal.toString()} but trying to support with ${amount}`);
      }

      // Call addSupport on the proposal contract directly
      const tx = await proposalContract.addSupport(amount);
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs, walletAddress, daoInfo, loadAllProposals]
  );

  const triggerElection = useCallback(
    async (proposalAddress: string) => {
      if (!contractRefs.signer) {
        throw new Error('Signer not initialized');
      }

      // Elections trigger automatically when threshold is met
      // We can trigger it by adding 1 token of support
      const proposalContract = new ethers.Contract(proposalAddress, BASE_PROPOSAL_ABI, contractRefs.signer);
      const tx = await proposalContract.addSupport(1);
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.signer, loadAllProposals]
  );

  const voteOnProposal = useCallback(
    async (proposalAddress: string, voteYes: boolean, amount: string) => {
      if (!contractRefs.daoContract) {
        throw new Error('DAO contract not initialized');
      }

      const proposal = proposalListRef.current.find((p) => p.address === proposalAddress);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const baseContract = new ethers.Contract(
        proposalAddress,
        BASE_PROPOSAL_ABI,
        contractRefs.signer!
      );

      const yesVoteAddress = await baseContract.yesVoteAddress();
      const noVoteAddress = await baseContract.noVoteAddress();
      const votingTokenId = await baseContract.votingTokenId();

      const targetAddress = voteYes ? yesVoteAddress : noVoteAddress;

      const tx = await contractRefs.daoContract.safeTransferFrom(
        walletAddress,
        targetAddress,
        votingTokenId,
        amount,
        '0x'
      );
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs, walletAddress, loadAllProposals]
  );

  const claimVotingTokens = useCallback(
    async (proposalAddress: string) => {
      if (!contractRefs.signer) {
        throw new Error('Signer not initialized');
      }

      const proposalContract = new ethers.Contract(
        proposalAddress,
        BASE_PROPOSAL_ABI,
        contractRefs.signer
      );

      const tx = await proposalContract.claimVotingTokens();
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.signer, loadAllProposals]
  );

  const createResolutionProposal = useCallback(
    async (description: string) => {
      if (!contractRefs.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      const tx = await contractRefs.factoryContract.createResolutionProposal(description);
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.factoryContract, loadAllProposals]
  );

  const createTreasuryProposal = useCallback(
    async (description: string, recipient: string, amount: string, token: string, tokenId: string) => {
      if (!contractRefs.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      const tx = await contractRefs.factoryContract.createTreasuryProposal(
        description,
        recipient,
        amount,
        token,
        tokenId
      );
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.factoryContract, loadAllProposals]
  );

  const createMintProposal = useCallback(
    async (description: string, recipient: string, amount: string) => {
      if (!contractRefs.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      const tx = await contractRefs.factoryContract.createMintProposal(description, recipient, amount);
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.factoryContract, loadAllProposals]
  );

  const createParameterProposal = useCallback(
    async (description: string, parameterType: ParameterType, newValue: string) => {
      if (!contractRefs.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      const tx = await contractRefs.factoryContract.createParameterProposal(description, parameterType, newValue);
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.factoryContract, loadAllProposals]
  );

  const createDistributionProposal = useCallback(
    async (description: string, token: string, tokenId: string, amountPerToken: string) => {
      if (!contractRefs.factoryContract) {
        throw new Error('Factory contract not initialized');
      }

      const tx = await contractRefs.factoryContract.createDistributionProposal(
        description,
        token,
        tokenId,
        amountPerToken
      );
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.factoryContract, loadAllProposals]
  );

  const registerForDistribution = useCallback(
    async (proposalAddress: string) => {
      if (!contractRefs.signer) {
        throw new Error('Signer not initialized');
      }

      const proposalContract = new ethers.Contract(
        proposalAddress,
        DISTRIBUTION_PROPOSAL_ABI,
        contractRefs.signer
      );

      const tx = await proposalContract.registerForDistribution();
      await tx.wait();
      await loadAllProposals();
    },
    [contractRefs.signer, loadAllProposals]
  );

  const claimDistribution = useCallback(
    async (redemptionAddress: string) => {
      if (!contractRefs.signer) {
        throw new Error('Signer not initialized');
      }

      const redemptionContract = new ethers.Contract(
        redemptionAddress,
        DISTRIBUTION_REDEMPTION_ABI,
        contractRefs.signer
      );

      try {
        const tx = await redemptionContract.claim();
        await tx.wait();
        await loadAllProposals();
      } catch (error: any) {
        // Provide user-friendly error messages
        const errorMessage = error.message || error.toString();

        if (errorMessage.includes('NotRegistered')) {
          throw new Error('You are not registered for this distribution');
        } else if (errorMessage.includes('AlreadyClaimed')) {
          throw new Error('You have already claimed this distribution');
        } else if (errorMessage.includes('NothingToClaim')) {
          throw new Error('You have nothing to claim from this distribution');
        } else if (errorMessage.includes('InsufficientBalance')) {
          throw new Error('The distribution contract has insufficient balance');
        } else {
          throw new Error('Failed to claim distribution: ' + errorMessage);
        }
      }
    },
    [contractRefs.signer, loadAllProposals]
  );

  return {
    activeProposals,
    electionProposals,
    historyProposals,
    isLoading,
    error,
    loadAllProposals,
    supportProposal,
    triggerElection,
    voteOnProposal,
    claimVotingTokens,
    registerForDistribution,
    claimDistribution,
    createResolutionProposal,
    createTreasuryProposal,
    createMintProposal,
    createParameterProposal,
    createDistributionProposal,
  };
};
