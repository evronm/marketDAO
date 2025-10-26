import React from 'react';
import { Proposal } from '../types';
import { ProposalCard } from './ProposalCard';

interface ProposalListProps {
  proposals: Proposal[];
  title: string;
  emptyMessage?: string;
  children?: (proposal: Proposal) => React.ReactNode;
}

export const ProposalList: React.FC<ProposalListProps> = ({
  proposals,
  title,
  emptyMessage = 'No proposals found.',
  children,
}) => {
  return (
    <div className="card shadow mx-auto" style={{ maxWidth: '700px' }}>
      <div className="card-body">
        <h2 className="card-title mb-4">{title}</h2>
        {proposals.length === 0 ? (
          <p className="text-center">{emptyMessage}</p>
        ) : (
          proposals.map((proposal) => (
            <ProposalCard key={proposal.address} proposal={proposal}>
              {children && children(proposal)}
            </ProposalCard>
          ))
        )}
      </div>
    </div>
  );
};
