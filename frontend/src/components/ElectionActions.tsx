import React, { useState } from 'react';
import { Proposal, DAOInfo } from '../types';
import { basisPointsToPercent } from '../utils/formatting';

interface ElectionActionsProps {
  proposal: Proposal;
  daoInfo: DAOInfo;
  onClaimVotingTokens: (address: string) => Promise<void>;
  onVote: (address: string, voteYes: boolean, amount: string) => Promise<void>;
  isLoading: boolean;
}

export const ElectionActions: React.FC<ElectionActionsProps> = ({
  proposal,
  daoInfo,
  onClaimVotingTokens,
  onVote,
  isLoading,
}) => {
  const [voteAmount, setVoteAmount] = useState('');
  const [selectedVote, setSelectedVote] = useState<'yes' | 'no' | null>(null);

  const handleClaimVotingTokens = async () => {
    await onClaimVotingTokens(proposal.address);
  };

  const handleVote = async (voteYes: boolean) => {
    if (!voteAmount || parseInt(voteAmount) <= 0) return;
    await onVote(proposal.address, voteYes, voteAmount);
    setVoteAmount('');
    setSelectedVote(null);
  };

  // Calculate vote percentages
  const totalVotes = parseInt(proposal.votes.total) || 1; // Avoid division by zero
  const yesVotes = parseInt(proposal.votes.yes);
  const noVotes = parseInt(proposal.votes.no);
  const yesPercentage = Math.round((yesVotes / totalVotes) * 100);
  const noPercentage = Math.round((noVotes / totalVotes) * 100);

  // Calculate quorum
  const quorumPercentage = parseFloat(basisPointsToPercent(daoInfo.quorumPercentage));
  const votedPercentage = Math.round(((yesVotes + noVotes) / totalVotes) * 100);

  const hasClaimableTokens = proposal.votes.claimable && parseInt(proposal.votes.claimable) > 0;
  const hasVotingTokens = proposal.votes.available && parseInt(proposal.votes.available) > 0;
  const hasClaimed = proposal.votes.hasClaimed;

  return (
    <div>
      {/* Election Status */}
      <div className="alert alert-info mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <strong>Election Status:</strong> {proposal.electionStatus}
          </div>
          {proposal.electionStatus === 'Active' && (
            <div className="badge bg-primary">Voting Now</div>
          )}
        </div>
      </div>

      {/* Vote Progress */}
      <div className="mb-3">
        <div className="d-flex justify-content-between small mb-1">
          <span className="text-success">Yes: {yesVotes} ({yesPercentage}%)</span>
          <span className="text-danger">No: {noVotes} ({noPercentage}%)</span>
        </div>
        <div className="progress mb-2" style={{ height: '20px' }}>
          <div
            className="progress-bar bg-success"
            role="progressbar"
            style={{ width: `${yesPercentage}%` }}
            aria-valuenow={yesPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {yesPercentage > 10 && `${yesPercentage}%`}
          </div>
          <div
            className="progress-bar bg-danger"
            role="progressbar"
            style={{ width: `${noPercentage}%` }}
            aria-valuenow={noPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {noPercentage > 10 && `${noPercentage}%`}
          </div>
        </div>
        <div className="small text-muted text-center">
          Quorum: {quorumPercentage}% required | Current participation: {votedPercentage}%
        </div>
      </div>

      {/* Claim Voting Tokens */}
      {proposal.electionStatus === 'Active' && !hasClaimed && (
        <div className="mb-3">
          <div className="alert alert-warning py-2 small mb-2">
            You must claim voting tokens before you can vote
          </div>
          {hasClaimableTokens ? (
            <div className="d-grid">
              <button
                className="btn btn-primary"
                onClick={handleClaimVotingTokens}
                disabled={isLoading}
              >
                🎫 Claim {proposal.votes.claimable} Voting Tokens
              </button>
            </div>
          ) : (
            <div className="alert alert-secondary py-2 small mb-0">
              You have no vested tokens to claim for voting
            </div>
          )}
        </div>
      )}

      {/* Vote Buttons */}
      {proposal.electionStatus === 'Active' && hasClaimed && hasVotingTokens && (
        <div className="mb-3">
          <label className="form-label small">
            Cast Your Vote (Available: {proposal.votes.available} voting tokens)
          </label>
          <div className="row g-2 mb-2">
            <div className="col">
              <input
                type="number"
                className="form-control"
                min="1"
                max={proposal.votes.available}
                value={voteAmount}
                onChange={(e) => setVoteAmount(e.target.value)}
                placeholder="Amount"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="row g-2">
            <div className="col">
              <button
                className="btn btn-success w-100"
                onClick={() => handleVote(true)}
                disabled={isLoading || !voteAmount || parseInt(voteAmount) <= 0}
              >
                👍 Vote Yes
              </button>
            </div>
            <div className="col">
              <button
                className="btn btn-danger w-100"
                onClick={() => handleVote(false)}
                disabled={isLoading || !voteAmount || parseInt(voteAmount) <= 0}
              >
                👎 Vote No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Already Voted Message */}
      {proposal.electionStatus === 'Active' && hasClaimed && !hasVotingTokens && (
        <div className="alert alert-success py-2 small mb-0">
          ✅ You have cast your vote
        </div>
      )}

      {/* Ended Election Info */}
      {proposal.electionStatus === 'Ended' && (
        <div className="alert alert-secondary py-2 small mb-0">
          Election has ended. {proposal.result || 'Awaiting final result'}
        </div>
      )}
    </div>
  );
};
