import React, { useState } from 'react';
import { DAOInfo } from '../types';
import { basisPointsToPercent, safeFormatEther } from '../utils/formatting';
import { RARIBLE_TESTNET_URL } from '../types/constants';

interface DashboardProps {
  daoInfo: DAOInfo;
  daoAddress: string;
  onPurchaseTokens: (amount: number) => Promise<void>;
  onClaimVested: () => Promise<void>;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  daoInfo,
  daoAddress,
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
    <div className="mb-4">
      <div className="d-flex justify-content-end mb-3">
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh DAO data from blockchain"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <h3 className="h5 mb-3 border-bottom pb-2">Your Info</h3>
          <dl className="row">
            <dt className="col-sm-6">Total Balance</dt>
            <dd className="col-sm-6">
              {daoInfo.tokenBalance}
              <div className="small">
                <a
                  href={RARIBLE_TESTNET_URL(daoAddress, '0')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  Buy/Sell
                </a>
              </div>
            </dd>

            <dt className="col-sm-6">Vested (Available)</dt>
            <dd className="col-sm-6">
              <span className="text-success fw-bold">{daoInfo.vestedBalance}</span>
              <div className="text-success small">Can vote & support</div>
            </dd>

            <dt className="col-sm-6">Unvested (Locked)</dt>
            <dd className="col-sm-6">
              <span className="text-warning fw-bold">{daoInfo.unvestedBalance}</span>
              <div className="text-warning small">
                {parseInt(daoInfo.unvestedBalance) > 0
                  ? 'Still vesting'
                  : 'Fully vested'}
              </div>
              {daoInfo.hasClaimableVesting && (
                <button
                  className="btn btn-warning btn-sm mt-2"
                  onClick={onClaimVested}
                  disabled={isLoading}
                >
                  Claim Vested
                </button>
              )}
            </dd>
          </dl>
        </div>

        <div className="col-md-6">
          <h3 className="h5 mb-3 border-bottom pb-2">DAO Info</h3>
          <dl className="row">
            <dt className="col-sm-6">Total Supply</dt>
            <dd className="col-sm-6">{daoInfo.tokenSupply}</dd>

            <dt className="col-sm-6">Token Price</dt>
            <dd className="col-sm-6">{daoInfo.tokenPrice} ETH</dd>

            <dt className="col-sm-6">Treasury</dt>
            <dd className="col-sm-6">
              {daoInfo.treasuryBalance ? safeFormatEther(daoInfo.treasuryBalance) : '0'} ETH
            </dd>

            <dt className="col-sm-6">Quorum</dt>
            <dd className="col-sm-6">{basisPointsToPercent(daoInfo.quorumPercentage)}%</dd>

            <dt className="col-sm-6">Support Threshold</dt>
            <dd className="col-sm-6">{basisPointsToPercent(daoInfo.supportThreshold)}%</dd>

            <dt className="col-sm-6">Max Proposal Age</dt>
            <dd className="col-sm-6">{daoInfo.maxProposalAge} blocks</dd>

            <dt className="col-sm-6">Election Duration</dt>
            <dd className="col-sm-6">{daoInfo.electionDuration} blocks</dd>
          </dl>
        </div>
      </div>

      <div className="card shadow">
        <div className="card-body">
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
    </div>
  );
};
