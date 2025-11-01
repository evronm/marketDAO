import { useState, useEffect } from 'react';
import { TabType, NotificationState } from './types';
import { useWallet } from './hooks/useWallet';
import { useDAO } from './hooks/useDAO';
import { useProposals } from './hooks/useProposals';
import { Dashboard } from './components/Dashboard';
import { ProposalList } from './components/ProposalList';
import { ProposalActions } from './components/ProposalActions';
import { ElectionActions } from './components/ElectionActions';
import { CreateProposal } from './components/CreateProposal';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Notification } from './components/Notification';
import { showNotificationWithTimeout, hideNotification } from './utils/notification';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [notification, setNotification] = useState<NotificationState>(hideNotification());
  const [isLoading, setIsLoading] = useState(false);

  const { isConnected, walletAddress, contractRefs, connectWallet, error: walletError } = useWallet();

  const {
    daoInfo,
    isLoading: daoLoading,
    error: daoError,
    refreshDAOInfo,
    purchaseTokens,
    claimVestedTokens,
  } = useDAO(contractRefs, walletAddress, isConnected);

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
    createResolutionProposal,
    createTreasuryProposal,
    createMintProposal,
    createTokenPriceProposal,
  } = useProposals(contractRefs, walletAddress, daoInfo, isConnected);

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

  const handleCreateTokenPrice = async (description: string, newPrice: string) => {
    try {
      setIsLoading(true);
      await createTokenPriceProposal(description, newPrice);
      showNotificationWithTimeout(setNotification, 'Token price proposal created!', 'success');
    } catch (err: any) {
      showNotificationWithTimeout(setNotification, err.message || 'Failed to create proposal', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (!isConnected) {
      return (
        <div className="card shadow">
          <div className="card-body text-center p-5">
            <h2 className="mb-4">Welcome to Market DAO</h2>
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
              onCreateTokenPrice={handleCreateTokenPrice}
              daoInfo={daoInfo}
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
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '900px' }}>
      <div className="text-center mb-4">
        <h1 className="mb-1">{isConnected && daoInfo ? daoInfo.name : 'Market DAO'}</h1>
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
        </ul>
      )}

      {renderContent()}

      {(isLoading || daoLoading || proposalsLoading) && <LoadingSpinner />}
      <Notification notification={notification} />
    </div>
  );
}

export default App;
