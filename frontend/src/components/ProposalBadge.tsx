import React from 'react';
import { ProposalType } from '../types';

interface ProposalBadgeProps {
  type: ProposalType;
}

const BADGE_CONFIG: Record<ProposalType, { label: string; className: string }> = {
  resolution: { label: 'Resolution', className: 'badge-resolution' },
  treasury: { label: 'Treasury', className: 'badge-treasury' },
  mint: { label: 'Mint', className: 'badge-mint' },
  price: { label: 'Token Price', className: 'badge-price' },
};

export const ProposalBadge: React.FC<ProposalBadgeProps> = ({ type }) => {
  const config = BADGE_CONFIG[type];

  return (
    <span className={`badge ${config.className} me-2`}>
      {config.label}
    </span>
  );
};
