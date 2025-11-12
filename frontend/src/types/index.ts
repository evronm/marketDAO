import { ethers } from 'ethers';

// Tab types
export type TabType = 'dashboard' | 'proposals' | 'elections' | 'history' | 'members';

// Proposal types
export type ProposalType = 'resolution' | 'treasury' | 'mint' | 'parameter' | 'distribution';

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
  restrictPurchases: boolean;
  allowMinting: boolean;
  mintToPurchase: boolean;
  availableTokensForPurchase: string;
}

// Member Information
export interface MemberInfo {
  address: string;
  ensName?: string | null;
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

// Parameter types enum matching Solidity
export enum ParameterType {
  SupportThreshold = 0,
  QuorumPercentage = 1,
  MaxProposalAge = 2,
  ElectionDuration = 3,
  VestingPeriod = 4,
  TokenPrice = 5,
  Flags = 6
}

// Parameter proposal details
export interface ParameterProposalDetails {
  parameterType: ParameterType;
  newValue: string;
}

export interface ParameterProposal extends BaseProposal {
  type: 'parameter';
  details: ParameterProposalDetails;
}

// Distribution proposal details
export interface DistributionProposalDetails {
  token: string;
  tokenId: string;
  amountPerGovernanceToken: string;
  totalAmount: string;
  redemptionContract: string;
  hasClaimedDistribution?: boolean;
  isRegistered?: boolean;
  registeredBalance?: string;
}

export interface DistributionProposal extends BaseProposal {
  type: 'distribution';
  details: DistributionProposalDetails;
}

// Union type for all proposals
export type Proposal = ResolutionProposal | TreasuryProposal | MintProposal | ParameterProposal | DistributionProposal;

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

export interface ParameterFormData {
  description: string;
  parameterType: ParameterType;
  newValue: string;
}

export interface DistributionFormData {
  description: string;
  tokenType: TokenType;
  tokenAddress: string;
  tokenId: string;
  amountPerToken: string;
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
