import React, { useState } from 'react';
import { Proposal, DAOInfo } from '../types';
import { basisPointsToPercent } from '../utils/formatting';

interface ProposalActionsProps {
  proposal: Proposal;
  daoInfo: DAOInfo;
  onSupport: (address: string, amount: string) => Promise<void>;
  onTriggerElection: (address: string) => Promise<void>;
  isLoading: boolean;
}

export const ProposalActions: React.FC<ProposalActionsProps> = ({
  proposal,
  daoInfo,
  onSupport,
  onTriggerElection,
  isLoading,
}) => {
  const [supportAmount, setSupportAmount] = useState('');

  const handleSupport = async () => {
    if (!supportAmount || parseInt(supportAmount) <= 0) return;
    await onSupport(proposal.address, supportAmount);
    setSupportAmount('');
  };

  const handleTriggerElection = async () => {
    await onTriggerElection(proposal.address);
  };

  // Calculate support percentage
  const supportPercentage = parseInt(daoInfo.tokenSupply) > 0
    ? Math.round((parseInt(proposal.supportTotal) / parseInt(daoInfo.tokenSupply)) * 10000) / 100
    : 0;

  const thresholdPercentage = parseFloat(basisPointsToPercent(daoInfo.supportThreshold));
  const canTrigger = proposal.canTriggerElection && !proposal.isExpired;

  return (
    <div>
      {/* Support Progress */}
      <div className="mb-3">
        <div className="d-flex justify-content-between small mb-1">
          <span>Support: {proposal.supportTotal} tokens ({supportPercentage}%)</span>
          <span>Threshold: {thresholdPercentage}%</span>
        </div>
        <div className="progress" style={{ height: '8px' }}>
          <div
            className={`progress-bar ${canTrigger ? 'bg-success' : 'bg-primary'}`}
            role="progressbar"
            style={{ width: `${Math.min(supportPercentage, 100)}%` }}
            aria-valuenow={supportPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Expired warning */}
      {proposal.isExpired && (
        <div className="alert alert-warning py-2 small mb-3">
          ⚠️ This proposal has expired at block {proposal.expirationBlock}
        </div>
      )}

      {/* Support Input */}
      {!proposal.isExpired && (
        <div className="mb-3">
          <label htmlFor={`support-${proposal.address}`} className="form-label small">
            Add Support (Available: {daoInfo.vestedBalance} vested tokens)
          </label>
          <div className="row g-2">
            <div className="col">
              <input
                type="number"
                className="form-control form-control-sm"
                id={`support-${proposal.address}`}
                min="1"
                max={daoInfo.vestedBalance}
                value={supportAmount}
                onChange={(e) => setSupportAmount(e.target.value)}
                placeholder="Amount"
                disabled={isLoading}
              />
            </div>
            <div className="col-auto">
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSupport}
                disabled={isLoading || !supportAmount || parseInt(supportAmount) <= 0}
              >
                Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Election Button */}
      {canTrigger && (
        <div className="d-grid">
          <button
            className="btn btn-success"
            onClick={handleTriggerElection}
            disabled={isLoading}
          >
            🗳️ Trigger Election
          </button>
        </div>
      )}

      {/* Info message */}
      {!canTrigger && !proposal.isExpired && (
        <div className="text-muted small text-center">
          Need {thresholdPercentage}% support to trigger an election
        </div>
      )}
    </div>
  );
};
