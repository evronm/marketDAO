import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TabType, NotificationState, ParameterType } from './types';
import { useDAOAddress } from './contexts/DAOContext';
import { useWallet } from './hooks/useWallet';
import { useDAO } from './hooks/useDAO';
import { useProposals } from './hooks/useProposals';
import { useMembers } from './hooks/useMembers';
import { Dashboard } from './components/Dashboard';
import { ProposalList } from './components/ProposalList';
import { ProposalActions } from './components/ProposalActions';
import { ElectionActions } from './components/ElectionActions';
import { CreateProposal } from './components/CreateProposal';
import { Members } from './components/Members';
import { DAOSelector } from './components/DAOSelector';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Notification } from './components/Notification';
import { showNotificationWithTimeout, hideNotification } from './utils/notification';
import { DAO_ABI } from './types/abis';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [notification, setNotification] = useState<NotificationState>(hideNotification());
  const [isLoading, setIsLoading] = useState(false);
  const [preConnectDAOName, setPreConnectDAOName] = useState<string>('Market DAO');

  const { daoAddress, factoryAddress } = useDAOAddress();
  const { isConnected, walletAddress, contractRefs, connectWallet, error: walletError } = useWallet({
    daoAddress,
    factoryAddress,
  });

  const {
    daoInfo,
    isLoading: daoLoading,
    error: daoError,
    refreshDAOInfo,
    purchaseTokens,
    claimVestedTokens,
  } = useDAO(contractRefs, walletAddress, isConnected, daoAddress);

  const {
    activeProposals,
    electionProposals,
    historyProposals,
    isLoading: proposalsLoading,
    error: proposalsError,
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
  } = useProposals(contractRefs, walletAddress, daoInfo, isConnected);

  const {
    members,
    isLoading: membersLoading,
    error: membersError,
    refreshMembers,
  } = useMembers(contractRefs, isConnected);

  // Show errors as notifications
  useEffect(() => {
    if (walletError) {
      showNotificationWithTimeout(setNotification, walletError, 'danger');
    }
  }, [walletError]);

  useEffect(() => {
    if (daoError) {
      showNotificationWithTimeout(setNotification, daoError, 'danger');
    }
  }, [daoError]);

  useEffect(() => {
    if (proposalsError) {
      showNotificationWithTimeout(setNotification, proposalsError, 'danger');
    }
  }, [proposalsError]);

  useEffect(() => {
    if (membersError) {
      showNotificationWithTimeout(setNotification, membersError, 'danger');
    }
  }, [membersError]);

  // Load DAO name before wallet connection using read-only provider
  useEffect(() => {
    const loadDAOName = async () => {
      try {
        // Always use direct JsonRpcProvider for localhost to avoid MetaMask network issues
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

        const daoContract = new ethers.Contract(daoAddress, DAO_ABI, provider);
        const name = await daoContract.name();
        setPreConnectDAOName(name);
      } catch (err) {
        console.warn('Failed to load DAO name:', err);
        setPreConnectDAOName('Market DAO');
      }
    };

    loadDAOName();
  }, [daoAddress]);

  // Load proposals when connected
  useEffect(() => {
    if (isConnected && !daoLoading) {
      loadAllProposals();
    }
  }, [isConnected, daoLoading]);

  const handleConnectWallet = async () => {
    setIsLoading(true);
    await connectWallet();
    showNotificationWithTimeout(setNotification, 'Wallet connected successfully!', 'success');
    setIsLoading(false);
  };

  const handlePurchaseTokens = async (amount: number) => {
    try {
      setIsLoading(true);
      await purchaseTokens(amount);
      showNotificationWithTimeout(setNotification, 'Tokens purchased successfully!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Purchase failed', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimVested = async () => {
    try {
      setIsLoading(true);
      await claimVestedTokens();
      showNotificationWithTimeout(setNotification, 'Vested tokens claimed!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Claim failed', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateResolution = async (description: string) => {
    try {
      setIsLoading(true);
      await createResolutionProposal(description);
      showNotificationWithTimeout(setNotification, 'Resolution proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTreasury = async (
    description: string,
    recipient: string,
    amount: string,
    token: string,
    tokenId: string
  ) => {
    try {
      setIsLoading(true);
      await createTreasuryProposal(description, recipient, amount, token, tokenId);
      showNotificationWithTimeout(setNotification, 'Treasury proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMint = async (description: string, recipient: string, amount: string) => {
    try {
      setIsLoading(true);
      await createMintProposal(description, recipient, amount);
      showNotificationWithTimeout(setNotification, 'Mint proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateParameter = async (description: string, parameterType: ParameterType, newValue: string) => {
    try {
      setIsLoading(true);
      await createParameterProposal(description, parameterType, newValue);
      showNotificationWithTimeout(setNotification, 'Parameter proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDistribution = async (
    description: string,
    token: string,
    tokenId: string,
    amountPerToken: string
  ) => {
    try {
      setIsLoading(true);
      await createDistributionProposal(description, token, tokenId, amountPerToken);
      showNotificationWithTimeout(setNotification, 'Distribution proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterForDistribution = async (proposalAddress: string) => {
    try {
      setIsLoading(true);
      await registerForDistribution(proposalAddress);
      showNotificationWithTimeout(setNotification, 'Registered for distribution!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to register', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimDistribution = async (redemptionAddress: string) => {
    try {
      setIsLoading(true);
      await claimDistribution(redemptionAddress);
      showNotificationWithTimeout(setNotification, 'Distribution claimed!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to claim', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="card shadow">
          <div className="card-body text-center p-5">
            <h2 className="mb-4">Welcome to {preConnectDAOName}</h2>
            <p className="mb-4">Please connect your wallet to interact with the DAO</p>
            <button className="btn btn-primary btn-lg" onClick={handleConnectWallet}>
              Connect Wallet
            </button>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            <Dashboard
              daoInfo={daoInfo}
              daoAddress={daoAddress}
              onPurchaseTokens={handlePurchaseTokens}
              onClaimVested={handleClaimVested}
              onRefresh={async () => {
                setIsLoading(true);
                try {
                  await Promise.all([refreshDAOInfo(), loadAllProposals()]);
                  showNotificationWithTimeout(setNotification, 'Data refreshed!', 'success');
                } catch (err: any) {
                  showNotificationWithTimeout(setNotification, 'Failed to refresh', 'danger');
                } finally {
                  setIsLoading(false);
                }
              }}
              isLoading={isLoading}
            />
            <CreateProposal
              onCreateResolution={handleCreateResolution}
              onCreateTreasury={handleCreateTreasury}
              onCreateMint={handleCreateMint}
              onCreateParameter={handleCreateParameter}
              onCreateDistribution={handleCreateDistribution}
              daoInfo={daoInfo}
              daoAddress={daoAddress}
              walletAddress={walletAddress}
              isLoading={isLoading}
            />
          </>
        );

      case 'proposals':
        return (
          <ProposalList
            proposals={activeProposals}
            title="Active Proposals"
            emptyMessage="No active proposals found."
          >
            {(proposal) => (
              <ProposalActions
                proposal={proposal}
                daoInfo={daoInfo}
                onSupport={async (address, amount) => {
                  try {
                    setIsLoading(true);
                    await supportProposal(address, amount);
                    showNotificationWithTimeout(setNotification, 'Support added!', 'success');
                  } catch (err: any) {
                    showNotificationWithTimeout(setNotification, err.message || 'Failed to support', 'danger');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                onTriggerElection={async (address) => {
                  try {
                    setIsLoading(true);
                    await triggerElection(address);
                    showNotificationWithTimeout(setNotification, 'Election triggered!', 'success');
                  } catch (err: any) {
                    showNotificationWithTimeout(setNotification, err.message || 'Failed to trigger', 'danger');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                isLoading={isLoading}
              />
            )}
          </ProposalList>
        );

      case 'elections':
        return (
          <ProposalList
            proposals={electionProposals}
            title="Elections"
            emptyMessage="No active elections found."
          >
            {(proposal) => (
              <ElectionActions
                proposal={proposal}
                daoInfo={daoInfo}
                onClaimVotingTokens={async (address) => {
                  try {
                    setIsLoading(true);
                    await claimVotingTokens(address);
                    showNotificationWithTimeout(setNotification, 'Voting tokens claimed!', 'success');
                  } catch (err: any) {
                    showNotificationWithTimeout(setNotification, err.message || 'Failed to claim tokens', 'danger');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                onVote={async (address, voteYes, amount) => {
                  try {
                    setIsLoading(true);
                    await voteOnProposal(address, voteYes, amount);
                    // Refresh DAO info in case proposal executed and changed state
                    await refreshDAOInfo();
                    showNotificationWithTimeout(setNotification, `Vote cast: ${voteYes ? 'Yes' : 'No'}!`, 'success');
                  } catch (err: any) {
                    showNotificationWithTimeout(setNotification, err.message || 'Failed to vote', 'danger');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                onRegisterForDistribution={handleRegisterForDistribution}
                isLoading={isLoading}
              />
            )}
          </ProposalList>
        );

      case 'history':
        return (
          <ProposalList
            proposals={historyProposals}
            title="Proposal History"
            emptyMessage="No proposal history found."
          >
            {(proposal) => {
              // Show claim button for distribution proposals with redemption contracts
              // Distribution proposals don't have a traditional "execute" step - users claim directly from redemption contract
              if (
                proposal.type === 'distribution' &&
                proposal.details.redemptionContract &&
                proposal.details.redemptionContract !== ethers.constants.AddressZero
              ) {
                // Check if already claimed
                if (proposal.details.hasClaimedDistribution) {
                  return (
                    <div className="alert alert-success mb-0">
                      ✅ You have already claimed this distribution
                    </div>
                  );
                }

                // Check if not registered
                if (!proposal.details.isRegistered) {
                  return (
                    <div className="alert alert-info mb-0">
                      ℹ️ You did not register for this distribution
                    </div>
                  );
                }

                // User is registered and hasn't claimed yet
                return (
                  <div className="d-grid">
                    <button
                      className="btn btn-success"
                      onClick={async () => {
                        await handleClaimDistribution(proposal.details.redemptionContract);
                      }}
                      disabled={isLoading}
                    >
                      💰 Claim Distribution
                    </button>
                  </div>
                );
              }
              return null;
            }}
          </ProposalList>
        );

      case 'members':
        return (
          <Members
            members={members}
            isLoading={isLoading}
            onRefresh={async () => {
              setIsLoading(true);
              try {
                await refreshMembers();
                showNotificationWithTimeout(setNotification, 'Members data refreshed!', 'success');
              } catch (err: any) {
                showNotificationWithTimeout(setNotification, 'Failed to refresh', 'danger');
              } finally {
                setIsLoading(false);
              }
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '900px' }}>
      <div className="text-center mb-4">
        <h1 className="mb-1">{isConnected && daoInfo ? daoInfo.name : preConnectDAOName}</h1>
        <h2 className="h5 text-muted mb-0">
          a{' '}
          <a
            href="https://marketdao.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
          >
            MarketDAO
          </a>
        </h2>
      </div>

      <DAOSelector />

      {isConnected && (
        <ul className="nav nav-tabs nav-fill mb-4">
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('dashboard');
              }}
            >
              Dashboard
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'proposals' ? 'active' : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('proposals');
              }}
            >
              Proposals
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'elections' ? 'active' : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('elections');
              }}
            >
              Elections
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('history');
              }}
            >
              History
            </a>
          </li>
          <li className="nav-item">
            <a
              className={`nav-link ${activeTab === 'members' ? 'active' : ''}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('members');
              }}
            >
              Members
            </a>
          </li>
        </ul>
      )}

      {renderContent()}

      {(isLoading || daoLoading || proposalsLoading || membersLoading) && <LoadingSpinner />}
      <Notification notification={notification} />
    </div>
  );
}

export default App;
