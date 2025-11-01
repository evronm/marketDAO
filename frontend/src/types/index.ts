import { ethers } from 'ethers';

// Tab types
export type TabType = 'dashboard' | 'proposals' | 'elections' | 'history' | 'members';

// Proposal types
export type ProposalType = 'resolution' | 'treasury' | 'mint' | 'price';

// Token type for treasury proposals
export type TokenType = 'eth' | 'erc20' | 'erc721' | 'erc1155';

// Notification types
export type NotificationType = 'info' | 'success' | 'warning' | 'danger';

// Election status
export type ElectionStatus = 'Not Started' | 'Active' | 'Ended' | 'Unknown' | 'Error';

// Proposal result
export type ProposalResult = '' | 'EXECUTED' | 'APPROVED' | 'REJECTED' | 'REJECTED (Quorum not met)';

// DAO Information
export interface DAOInfo {
  name: string;
  tokenBalance: string;
  vestedBalance: string;
  unvestedBalance: string;
  tokenSupply: string;
  tokenPrice: string;
  quorumPercentage: string;
  supportThreshold: string;
  treasuryBalance: string;
  vestingPeriod: string;
  maxProposalAge: string;
  electionDuration: string;
  hasClaimableVesting: boolean;
}

// Member Information
export interface MemberInfo {
  address: string;
  totalBalance: string;
  vestedBalance: string;
  unvestedBalance: string;
}

// Voting information
export interface VoteInfo {
  yes: string;
  no: string;
  total: string;
  available: string;
  claimable?: string;
  hasClaimed?: boolean;
}

// Base proposal details
export interface BaseProposal {
  address: string;
  description: string;
  proposer: string;
  createdAt: string;
  supportTotal: string;
  electionTriggered: boolean;
  executed: boolean;
  electionStart: string;
  canTriggerElection: boolean;
  isExpired: boolean;
  expirationBlock: string;
  isHistorical: boolean;
  votes: VoteInfo;
  votingTokenId: string;
  electionStatus: ElectionStatus;
  isActive: boolean;
  result: ProposalResult;
}

// Resolution proposal
export interface ResolutionProposal extends BaseProposal {
  type: 'resolution';
  details: Record<string, never>;
}

// Treasury proposal details
export interface TreasuryProposalDetails {
  recipient: string;
  amount: string;
  token: string;
  tokenId: string;
}

export interface TreasuryProposal extends BaseProposal {
  type: 'treasury';
  details: TreasuryProposalDetails;
}

// Mint proposal details
export interface MintProposalDetails {
  recipient: string;
  amount: string;
}

export interface MintProposal extends BaseProposal {
  type: 'mint';
  details: MintProposalDetails;
}

// Token price proposal details
export interface TokenPriceProposalDetails {
  newPrice: string;
}

export interface TokenPriceProposal extends BaseProposal {
  type: 'price';
  details: TokenPriceProposalDetails;
}

// Union type for all proposals
export type Proposal = ResolutionProposal | TreasuryProposal | MintProposal | TokenPriceProposal;

// Form data interfaces
export interface TreasuryFormData {
  description: string;
  recipient: string;
  amount: string;
  tokenType: TokenType;
  tokenAddress: string;
  tokenId: string;
}

export interface MintFormData {
  description: string;
  recipient: string;
  amount: string;
}

export interface PriceFormData {
  description: string;
  newPrice: string;
}

// Notification state
export interface NotificationState {
  show: boolean;
  message: string;
  type: NotificationType;
}

// Contract references
export interface ContractRefs {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.providers.JsonRpcSigner | null;
  daoContract: ethers.Contract | null;
  factoryContract: ethers.Contract | null;
}

// Proposal cache
export interface ProposalCache {
  [address: string]: Proposal;
}
