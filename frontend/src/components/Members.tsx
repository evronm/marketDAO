import React from 'react';
import { MemberInfo } from '../types';

interface MembersProps {
  members: MemberInfo[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export const Members: React.FC<MembersProps> = ({ members, isLoading, onRefresh }) => {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="card shadow">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="card-title mb-0">Token Holders</h2>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh member data"
          >
            🔄 Refresh
          </button>
        </div>

        {members.length === 0 ? (
          <div className="alert alert-info">
            No token holders found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Address</th>
                  <th className="text-end">Total Tokens</th>
                  <th className="text-end">Vested</th>
                  <th className="text-end">Unvested</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.address}>
                    <td>
                      {member.ensName ? (
                        <div>
                          <div className="fw-bold">{member.ensName}</div>
                          <code className="text-muted small" title={member.address}>
                            {truncateAddress(member.address)}
                          </code>
                        </div>
                      ) : (
                        <code className="text-muted" title={member.address}>
                          {truncateAddress(member.address)}
                        </code>
                      )}
                    </td>
                    <td className="text-end fw-bold">{member.totalBalance}</td>
                    <td className="text-end">
                      <span className="text-success">{member.vestedBalance}</span>
                    </td>
                    <td className="text-end">
                      <span className="text-warning">{member.unvestedBalance}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
