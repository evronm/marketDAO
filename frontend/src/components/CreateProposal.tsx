import React, { useState, useEffect } from 'react';
import { ProposalType, TokenType, DAOInfo } from '../types';
import { ethers } from 'ethers';

interface CreateProposalProps {
  onCreateResolution: (description: string) => Promise<void>;
  onCreateTreasury: (
    description: string,
    recipient: string,
    amount: string,
    token: string,
    tokenId: string
  ) => Promise<void>;
  onCreateMint: (description: string, recipient: string, amount: string) => Promise<void>;
  onCreateTokenPrice: (description: string, newPrice: string) => Promise<void>;
  daoInfo: DAOInfo | null;
  daoAddress: string;
  walletAddress: string | null;
  isLoading: boolean;
}

// Helper functions for localStorage
const getJoinRequestKey = (walletAddress: string, daoAddress: string) => {
  return `joinRequest_${daoAddress}_${walletAddress}`;
};

const hasSubmittedJoinRequest = (walletAddress: string | null, daoAddress: string): boolean => {
  if (!walletAddress) return false;
  const key = getJoinRequestKey(walletAddress, daoAddress);
  return localStorage.getItem(key) === 'true';
};

const setJoinRequestSubmitted = (walletAddress: string | null, daoAddress: string, submitted: boolean) => {
  if (!walletAddress) return;
  const key = getJoinRequestKey(walletAddress, daoAddress);
  if (submitted) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
};

export const CreateProposal: React.FC<CreateProposalProps> = ({
  onCreateResolution,
  onCreateTreasury,
  onCreateMint,
  onCreateTokenPrice,
  daoInfo,
  daoAddress,
  walletAddress,
  isLoading,
}) => {
  // Check if user has vested tokens (can participate in governance)
  const isTokenHolder = Boolean(daoInfo && daoInfo.vestedBalance !== '0');

  // Check if join request section should be shown
  // Only show when purchases are disabled (price = 0) AND user has no tokens at all
  const shouldShowJoinRequest = Boolean(
    daoInfo &&
    daoInfo.tokenPrice === '0' &&
    daoInfo.tokenBalance === '0'
  );

  const [proposalType, setProposalType] = useState<ProposalType>(shouldShowJoinRequest ? 'mint' : 'resolution');
  const [description, setDescription] = useState('');
  const [joinRequestSubmitted, setJoinRequestSubmittedState] = useState(
    hasSubmittedJoinRequest(walletAddress, daoAddress)
  );

  // Load join request status from localStorage when wallet or DAO changes
  useEffect(() => {
    const hasSubmitted = hasSubmittedJoinRequest(walletAddress, daoAddress);
    console.log('Checking join request status:', { walletAddress, daoAddress, hasSubmitted });
    setJoinRequestSubmittedState(hasSubmitted);
  }, [walletAddress, daoAddress]);

  // Update proposal type when join request status changes
  useEffect(() => {
    if (shouldShowJoinRequest) {
      setProposalType('mint');
    }
  }, [shouldShowJoinRequest]);

  // Clear join request submitted state when user becomes a token holder
  useEffect(() => {
    if (isTokenHolder && joinRequestSubmitted) {
      setJoinRequestSubmitted(walletAddress, daoAddress, false);
      setJoinRequestSubmittedState(false);
    }
  }, [isTokenHolder, joinRequestSubmitted, walletAddress, daoAddress]);

  // Treasury form state
  const [treasuryRecipient, setTreasuryRecipient] = useState('');
  const [treasuryAmount, setTreasuryAmount] = useState('');
  const [tokenType, setTokenType] = useState<TokenType>('eth');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenId, setTokenId] = useState('');

  // Mint form state
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintAmount, setMintAmount] = useState('');

  // Price form state
  const [newPrice, setNewPrice] = useState('');

  const handleCreateResolution = async () => {
    await onCreateResolution(description);
    setDescription('');
  };

  const handleCreateTreasury = async () => {
    const token = tokenType === 'eth' ? ethers.constants.AddressZero : tokenAddress;
    const tid = tokenType === 'erc721' || tokenType === 'erc1155' ? tokenId : '0';
    await onCreateTreasury(description, treasuryRecipient, treasuryAmount, token, tid);
    setDescription('');
    setTreasuryRecipient('');
    setTreasuryAmount('');
    setTokenAddress('');
    setTokenId('');
  };

  const handleCreateMint = async () => {
    // For join requests, use their wallet address and amount of 1
    const recipient = shouldShowJoinRequest ? (walletAddress || '') : mintRecipient;
    const amount = shouldShowJoinRequest ? '1' : mintAmount;

    await onCreateMint(description, recipient, amount);
    setDescription('');
    setMintRecipient('');
    setMintAmount('');

    // Set flag for join requests
    if (shouldShowJoinRequest) {
      console.log('Setting join request submitted for:', { walletAddress, daoAddress });
      setJoinRequestSubmitted(walletAddress, daoAddress, true);
      setJoinRequestSubmittedState(true);
      console.log('localStorage after setting:', localStorage.getItem(getJoinRequestKey(walletAddress || '', daoAddress)));
    }
  };

  const handleCreateTokenPrice = async () => {
    const priceInWei = ethers.utils.parseEther(newPrice).toString();
    await onCreateTokenPrice(description, priceInWei);
    setDescription('');
    setNewPrice('');
  };

  // Don't render if user can't create proposals and can't request to join
  if (!isTokenHolder && !shouldShowJoinRequest) {
    return null;
  }

  return (
    <div className="card shadow mx-auto mb-4" style={{ maxWidth: '700px' }}>
      <div className="card-body">
        <h2 className="card-title mb-4">{shouldShowJoinRequest ? 'Request to Join DAO' : 'Create Proposal'}</h2>

        {shouldShowJoinRequest && joinRequestSubmitted && (
          <div className="alert alert-success mb-4">
            <h5 className="alert-heading">Request Received!</h5>
            <p>Your request to join the DAO has been received. Existing members will vote on your membership.</p>
            <hr />
            <p className="mb-0">
              You can track your request in the <strong>Proposals</strong> tab (while gathering support)
              and then in the <strong>Elections</strong> tab (once voting begins).
            </p>
          </div>
        )}

        {shouldShowJoinRequest && !joinRequestSubmitted && (
          <div className="alert alert-info mb-4">
            You don't have governance tokens yet. You can request to join the DAO by creating a membership request.
            Existing members will vote on whether to admit you.
          </div>
        )}

        {isTokenHolder && (
          <div className="mb-4">
            <label className="form-label text-center d-block">Proposal Type</label>
            <div className="btn-group d-flex flex-wrap" role="group">
              <button
                type="button"
                className={`btn ${proposalType === 'resolution' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setProposalType('resolution')}
              >
                Resolution
              </button>
              <button
                type="button"
                className={`btn ${proposalType === 'treasury' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setProposalType('treasury')}
              >
                Treasury
              </button>
              <button
                type="button"
                className={`btn ${proposalType === 'mint' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setProposalType('mint')}
              >
                Mint Tokens
              </button>
              <button
                type="button"
                className={`btn ${proposalType === 'price' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setProposalType('price')}
              >
                Token Price
              </button>
            </div>
          </div>
        )}

        {proposalType === 'resolution' && (
          <div>
            <div className="mb-3">
              <label htmlFor="proposal-description" className="form-label">
                Description
              </label>
              <textarea
                className="form-control"
                id="proposal-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter proposal description"
              />
            </div>
            <div className="text-center">
              <button
                className="btn btn-primary"
                onClick={handleCreateResolution}
                disabled={isLoading || !description}
              >
                Create Resolution Proposal
              </button>
            </div>
          </div>
        )}

        {proposalType === 'treasury' && (
          <div>
            <div className="mb-3">
              <label htmlFor="treasury-description" className="form-label">
                Description
              </label>
              <textarea
                className="form-control"
                id="treasury-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description for this treasury transfer"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="treasury-recipient" className="form-label">
                Recipient Address
              </label>
              <input
                type="text"
                className="form-control"
                id="treasury-recipient"
                value={treasuryRecipient}
                onChange={(e) => setTreasuryRecipient(e.target.value)}
                placeholder="0x..."
              />
            </div>

            <div className="mb-3">
              <label htmlFor="treasury-amount" className="form-label">
                Amount
              </label>
              <input
                type="number"
                className="form-control"
                id="treasury-amount"
                min="0"
                step="any"
                value={treasuryAmount}
                onChange={(e) => setTreasuryAmount(e.target.value)}
                placeholder="Amount to transfer"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="treasury-token-type" className="form-label">
                Token Type
              </label>
              <select
                className="form-select"
                id="treasury-token-type"
                value={tokenType}
                onChange={(e) => setTokenType(e.target.value as TokenType)}
              >
                <option value="eth">ETH</option>
                <option value="erc20">ERC20</option>
                <option value="erc721">ERC721</option>
                <option value="erc1155">ERC1155</option>
              </select>
            </div>

            {tokenType !== 'eth' && (
              <div className="mb-3">
                <label htmlFor="treasury-token-address" className="form-label">
                  Token Address
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="treasury-token-address"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            )}

            {(tokenType === 'erc721' || tokenType === 'erc1155') && (
              <div className="mb-3">
                <label htmlFor="treasury-token-id" className="form-label">
                  Token ID
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="treasury-token-id"
                  min="0"
                  step="1"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  placeholder="Token ID"
                />
              </div>
            )}

            <div className="text-center">
              <button
                className="btn btn-primary"
                onClick={handleCreateTreasury}
                disabled={isLoading || !description || !treasuryRecipient || !treasuryAmount}
              >
                Create Treasury Proposal
              </button>
            </div>
          </div>
        )}

        {proposalType === 'mint' && (!joinRequestSubmitted || !shouldShowJoinRequest) && (
          <div>
            <div className="mb-3">
              <label htmlFor="mint-description" className="form-label">
                {shouldShowJoinRequest ? 'Tell us about yourself' : 'Description'}
              </label>
              <textarea
                className="form-control"
                id="mint-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  shouldShowJoinRequest
                    ? 'Who are you and why do you want to join the DAO?'
                    : 'Enter a description for this mint proposal'
                }
              />
            </div>

            {!shouldShowJoinRequest && (
              <>
                <div className="mb-3">
                  <label htmlFor="mint-recipient" className="form-label">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="mint-recipient"
                    value={mintRecipient}
                    onChange={(e) => setMintRecipient(e.target.value)}
                    placeholder="0x..."
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="mint-amount" className="form-label">
                    Amount
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="mint-amount"
                    min="1"
                    step="1"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="Number of tokens to mint"
                  />
                </div>
              </>
            )}

            {shouldShowJoinRequest && (
              <div className="alert alert-secondary mb-3">
                <small>
                  <strong>Request Details:</strong>
                  <br />
                  Recipient: {walletAddress || 'Not connected'}
                  <br />
                  Amount: 1 governance token
                </small>
              </div>
            )}

            <div className="text-center">
              <button
                className="btn btn-primary"
                onClick={handleCreateMint}
                disabled={
                  isLoading ||
                  !description ||
                  (!shouldShowJoinRequest && (!mintRecipient || !mintAmount))
                }
              >
                {shouldShowJoinRequest ? 'Submit Join Request' : 'Create Mint Proposal'}
              </button>
            </div>
          </div>
        )}

        {proposalType === 'price' && (
          <div>
            <div className="mb-3">
              <label htmlFor="price-description" className="form-label">
                Description
              </label>
              <textarea
                className="form-control"
                id="price-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter a description for this price change"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="new-price" className="form-label">
                New Token Price (ETH)
              </label>
              <input
                type="number"
                className="form-control"
                id="new-price"
                min="0"
                step="any"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="New price in ETH"
              />
            </div>

            <div className="text-center">
              <button
                className="btn btn-primary"
                onClick={handleCreateTokenPrice}
                disabled={isLoading || !description || !newPrice}
              >
                Create Token Price Proposal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
