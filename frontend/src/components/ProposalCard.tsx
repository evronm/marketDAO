import React from 'react';
import { Proposal, ParameterType } from '../types';
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
  parameter: '#2196f3',
  distribution: '#00bcd4',
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

    if (proposal.type === 'parameter') {
      const parameterNames: Record<ParameterType, string> = {
        [ParameterType.TokenPrice]: 'Token Price',
        [ParameterType.SupportThreshold]: 'Support Threshold',
        [ParameterType.QuorumPercentage]: 'Quorum Percentage',
        [ParameterType.MaxProposalAge]: 'Max Proposal Age',
        [ParameterType.ElectionDuration]: 'Election Duration',
        [ParameterType.VestingPeriod]: 'Vesting Period',
        [ParameterType.Flags]: 'Configuration Flags',
      };

      const formatValue = (type: ParameterType, value: string): string => {
        switch (type) {
          case ParameterType.TokenPrice:
            return `${safeFormatEther(value)} ETH`;
          case ParameterType.SupportThreshold:
          case ParameterType.QuorumPercentage:
            // Convert from basis points to percentage
            return `${(parseInt(value) / 100).toFixed(2)}%`;
          case ParameterType.MaxProposalAge:
          case ParameterType.ElectionDuration:
          case ParameterType.VestingPeriod:
            return `${value} blocks`;
          case ParameterType.Flags:
            return value;
          default:
            return value;
        }
      };

      const renderFlagsValue = (flagsValue: string) => {
        const flags = parseInt(flagsValue);
        const allowMinting = (flags & 1) !== 0;
        const restrictPurchases = (flags & 2) !== 0;
        const mintToPurchase = (flags & 4) !== 0;

        return (
          <dl className="row mb-0">
            <dt className="col-sm-8">Allow Minting:</dt>
            <dd className="col-sm-4">{allowMinting ? '✓ Enabled' : '✗ Disabled'}</dd>

            <dt className="col-sm-8">Restrict Purchases:</dt>
            <dd className="col-sm-4">{restrictPurchases ? '✓ Enabled' : '✗ Disabled'}</dd>

            <dt className="col-sm-8">Mint to Purchase:</dt>
            <dd className="col-sm-4">{mintToPurchase ? '✓ Enabled' : '✗ Disabled'}</dd>
          </dl>
        );
      };

      return (
        <div className="bg-light p-3 rounded mb-3">
          <div>
            <strong>Parameter:</strong> {parameterNames[proposal.details.parameterType]}
          </div>
          {proposal.details.parameterType === ParameterType.Flags ? (
            <div className="mt-2">
              {renderFlagsValue(proposal.details.newValue)}
            </div>
          ) : (
            <div>
              <strong>New Value:</strong> {formatValue(proposal.details.parameterType, proposal.details.newValue)}
            </div>
          )}
        </div>
      );
    }

    if (proposal.type === 'distribution') {
      const isETH = proposal.details.token === ethers.constants.AddressZero;
      const isERC20 = proposal.details.tokenId === '0' && !isETH;
      const isERC1155 = proposal.details.tokenId !== '0';

      const tokenTypeLabel = isETH ? 'ETH' : isERC20 ? 'ERC20' : 'ERC1155';

      return (
        <div className="bg-light p-3 rounded mb-3">
          <div>
            <strong>Token Type:</strong> {tokenTypeLabel}
          </div>
          {!isETH && (
            <div>
              <strong>Token Address:</strong> {truncateAddress(proposal.details.token)}
            </div>
          )}
          {isERC1155 && (
            <div>
              <strong>Token ID:</strong> {safeValue(proposal.details.tokenId)}
            </div>
          )}
          <div>
            <strong>Amount per Governance Token:</strong>{' '}
            {isETH
              ? `${safeFormatEther(proposal.details.amountPerGovernanceToken)} ETH`
              : `${safeValue(proposal.details.amountPerGovernanceToken)} tokens`}
          </div>
          <div>
            <strong>Total Distribution:</strong>{' '}
            {isETH
              ? `${safeFormatEther(proposal.details.totalAmount)} ETH`
              : `${safeValue(proposal.details.totalAmount)} tokens`}
          </div>
          {proposal.details.redemptionContract && proposal.details.redemptionContract !== ethers.constants.AddressZero && (
            <div>
              <strong>Redemption Contract:</strong> {truncateAddress(proposal.details.redemptionContract)}
            </div>
          )}
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
          <div>
            <strong>Proposal:</strong>{' '}
            <code style={{ fontSize: '0.85em', cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(proposal.address)} title="Click to copy">
              {proposal.address}
            </code>
          </div>
          <div>
            <strong>Proposer:</strong>{' '}
            <code style={{ fontSize: '0.85em', cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(proposal.proposer)} title="Click to copy">
              {proposal.proposer}
            </code>
          </div>
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
