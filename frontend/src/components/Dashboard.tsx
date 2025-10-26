import React, { useState } from 'react';
import { DAOInfo } from '../types';
import { basisPointsToPercent, safeFormatEther } from '../utils/formatting';
import { DAO_ADDRESS, RARIBLE_TESTNET_URL } from '../types/constants';

interface DashboardProps {
  daoInfo: DAOInfo;
  onPurchaseTokens: (amount: number) => Promise<void>;
  onClaimVested: () => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  daoInfo,
  onPurchaseTokens,
  onClaimVested,
  onRefresh,
  isLoading,
}) => {
  const [purchaseAmount, setPurchaseAmount] = useState(1);

  const handlePurchase = async () => {
    await onPurchaseTokens(purchaseAmount);
  };

  return (
    <div className="card shadow mb-4 mx-auto" style={{ maxWidth: '700px' }}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="card-title mb-0">DAO Information</h2>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh DAO data from blockchain"
          >
            🔄 Refresh
          </button>
        </div>
        <div className="container" style={{ maxWidth: '560px' }}>
          <div className="row row-cols-1 row-cols-md-3 g-2 mb-3 justify-content-center">
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.name}</div>
                  <div className="text-muted small">DAO Name</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.tokenBalance}</div>
                  <div className="text-muted small">Total Balance</div>
                  <div className="small">
                    <a
                      href={RARIBLE_TESTNET_URL(DAO_ADDRESS, '0')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary"
                      style={{ fontSize: '0.7rem' }}
                    >
                      Buy/Sell
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-success bg-opacity-10 rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold text-success">{daoInfo.vestedBalance}</div>
                  <div className="text-muted small">Vested (Available)</div>
                  <div className="text-success" style={{ fontSize: '0.65rem' }}>
                    Can vote & support
                  </div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-warning bg-opacity-10 rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold text-warning">{daoInfo.unvestedBalance}</div>
                  <div className="text-muted small">Unvested (Locked)</div>
                  <div className="text-warning" style={{ fontSize: '0.65rem' }}>
                    {parseInt(daoInfo.unvestedBalance) > 0
                      ? 'Still vesting'
                      : 'Fully vested'}
                  </div>
                  {daoInfo.hasClaimableVesting && (
                    <button
                      className="btn btn-warning btn-sm mt-2"
                      onClick={onClaimVested}
                      disabled={isLoading}
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                    >
                      Claim Vested
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.tokenSupply}</div>
                  <div className="text-muted small">Total Supply</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.tokenPrice} ETH</div>
                  <div className="text-muted small">Token Price</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">
                    {daoInfo.treasuryBalance ? safeFormatEther(daoInfo.treasuryBalance) : '0'} ETH
                  </div>
                  <div className="text-muted small">Treasury</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{basisPointsToPercent(daoInfo.quorumPercentage)}%</div>
                  <div className="text-muted small">Quorum Requirement</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">
                    {basisPointsToPercent(daoInfo.supportThreshold)}%
                  </div>
                  <div className="text-muted small">Support Threshold</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.maxProposalAge}</div>
                  <div className="text-muted small">Max Proposal Age (blocks)</div>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="bg-light rounded p-2" style={{ height: '100%' }}>
                <div className="text-center">
                  <div className="fw-bold">{daoInfo.electionDuration}</div>
                  <div className="text-muted small">Election Duration (blocks)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h3 className="mb-3">Purchase Tokens</h3>
        {Number(daoInfo.tokenPrice) === 0 ? (
          <div className="alert alert-info">
            <p className="mb-0">
              Direct token purchases are currently disabled (token price is set to 0).
            </p>
          </div>
        ) : (
          <>
            <div className="row g-3 align-items-end justify-content-center mb-3">
              <div className="col-12 col-md-4">
                <label htmlFor="purchase-amount" className="form-label">
                  Amount
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="purchase-amount"
                  min="1"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                />
              </div>
              <div className="col-12 col-md-4 text-center">
                <button
                  className="btn btn-primary w-100"
                  onClick={handlePurchase}
                  disabled={isLoading}
                >
                  Purchase Tokens
                </button>
              </div>
            </div>
            <div className="text-center text-muted small">
              Cost: {(Number(daoInfo.tokenPrice) * purchaseAmount).toFixed(4)} ETH
            </div>
          </>
        )}
      </div>
    </div>
  );
};
