import React from 'react';
import { Proposal } from '../types';
import { ProposalBadge } from './ProposalBadge';
import { truncateAddress, safeValue, safeFormatEther } from '../utils/formatting';
import { ethers } from 'ethers';

interface ProposalCardProps {
  proposal: Proposal;
  children?: React.ReactNode;
}

const BORDER_COLORS: Record<string, string> = {
  treasury: '#4caf50',
  mint: '#ff9800',
  price: '#2196f3',
  resolution: '#9c27b0',
};

export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, children }) => {
  const borderColor = BORDER_COLORS[proposal.type] || '#9c27b0';

  const renderProposalDetails = () => {
    if (proposal.type === 'treasury') {
      return (
        <div className="bg-light p-3 rounded mb-3">
          <div>
            <strong>Recipient:</strong> {truncateAddress(proposal.details.recipient)}
          </div>
          <div>
            <strong>Amount:</strong>{' '}
            {proposal.details.token === ethers.constants.AddressZero
              ? `${safeFormatEther(proposal.details.amount)} ETH`
              : `${safeValue(proposal.details.amount)} tokens`}
          </div>
          {proposal.details.token !== ethers.constants.AddressZero && (
            <div>
              <strong>Token:</strong> {truncateAddress(proposal.details.token)}
            </div>
          )}
          {proposal.details.tokenId !== '0' && (
            <div>
              <strong>Token ID:</strong> {safeValue(proposal.details.tokenId)}
            </div>
          )}
        </div>
      );
    }

    if (proposal.type === 'mint') {
      return (
        <div className="bg-light p-3 rounded mb-3">
          <div>
            <strong>Recipient:</strong> {truncateAddress(proposal.details.recipient)}
          </div>
          <div>
            <strong>Amount:</strong> {safeValue(proposal.details.amount)} tokens
          </div>
        </div>
      );
    }

    if (proposal.type === 'price') {
      return (
        <div className="bg-light p-3 rounded mb-3">
          <div>
            <strong>New Price:</strong> {safeFormatEther(proposal.details.newPrice)} ETH
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="card mb-3 proposal-card"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="card-body">
        <ProposalBadge type={proposal.type} />
        {proposal.result && (
          <span className="badge bg-secondary ms-2">{proposal.result}</span>
        )}

        <h3 className="mb-2">{proposal.description}</h3>

        <div className="text-muted small mb-3">
          Proposer: {truncateAddress(proposal.proposer)}
        </div>

        {renderProposalDetails()}

        <div className="d-flex justify-content-between mb-3 small text-muted">
          <div>Created at block: {proposal.createdAt}</div>
          <div>Support: {proposal.supportTotal}</div>
        </div>

        {children}
      </div>
    </div>
  );
};
