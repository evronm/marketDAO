import React, { useState } from 'react';
import { useDAOAddress } from '../contexts/DAOContext';
import { ethers } from 'ethers';

export const DAOSelector: React.FC = () => {
  const { daoAddress, factoryAddress: _factoryAddress, setDAOAddress, recentDAOs } = useDAOAddress();
  const [isOpen, setIsOpen] = useState(false);
  const [customDAO, setCustomDAO] = useState('');
  const [customFactory, setCustomFactory] = useState('');
  const [error, setError] = useState('');

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCustomSubmit = () => {
    setError('');

    if (!ethers.utils.isAddress(customDAO)) {
      setError('Invalid DAO address');
      return;
    }

    if (!ethers.utils.isAddress(customFactory)) {
      setError('Invalid Factory address');
      return;
    }

    setDAOAddress(customDAO, customFactory);
    setCustomDAO('');
    setCustomFactory('');
    setIsOpen(false);
  };

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <small className="text-muted">Current DAO:</small>
          <div className="d-flex align-items-center gap-2">
            <code className="text-primary" title={daoAddress}>
              {truncateAddress(daoAddress)}
            </code>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setIsOpen(!isOpen)}
              title="Switch DAO"
            >
              Switch DAO
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="card mt-2">
          <div className="card-body">
            <h6>Switch DAO Deployment</h6>

            {recentDAOs.length > 0 && (
              <div className="mb-3">
                <label className="form-label">Recent DAOs:</label>
                <div className="list-group">
                  {recentDAOs.map((recent, index) => (
                    <button
                      key={index}
                      className={`list-group-item list-group-item-action ${
                        recent.dao === daoAddress ? 'active' : ''
                      }`}
                      onClick={() => {
                        setDAOAddress(recent.dao, recent.factory);
                        setIsOpen(false);
                      }}
                    >
                      <div className="d-flex justify-content-between">
                        <div>
                          <code className="small">{truncateAddress(recent.dao)}</code>
                        </div>
                        {recent.dao === daoAddress && <span>✓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Or enter new addresses:</label>
              <div className="mb-2">
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="DAO Address (0x...)"
                  value={customDAO}
                  onChange={(e) => setCustomDAO(e.target.value)}
                />
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Factory Address (0x...)"
                  value={customFactory}
                  onChange={(e) => setCustomFactory(e.target.value)}
                />
              </div>
              {error && <div className="alert alert-danger alert-sm py-1">{error}</div>}
              <div className="d-flex gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCustomSubmit}
                  disabled={!customDAO || !customFactory}
                >
                  Connect to DAO
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
