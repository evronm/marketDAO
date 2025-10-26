// Contract ABIs

export const BASE_PROPOSAL_ABI = [
  "function description() view returns (string)",
  "function proposer() view returns (address)",
  "function createdAt() view returns (uint256)",
  "function supportTotal() view returns (uint256)",
  "function electionTriggered() view returns (bool)",
  "function executed() view returns (bool)",
  "function electionStart() view returns (uint256)",
  "function votingTokenId() view returns (uint256)",
  "function yesVoteAddress() view returns (address)",
  "function noVoteAddress() view returns (address)",
  "function isElectionActive() view returns (bool)",
  "function canTriggerElection() view returns (bool)",
  "function checkEarlyTermination()",
  "function dao() view returns (address)",
  "function getClaimableAmount(address holder) view returns (uint256)",
  "function hasClaimed(address holder) view returns (bool)",
  "function addSupport(uint256 amount)",
  "function removeSupport(uint256 amount)",
  "function claimVotingTokens()"
];

export const TREASURY_PROPOSAL_ABI = BASE_PROPOSAL_ABI.concat([
  "function recipient() view returns (address)",
  "function amount() view returns (uint256)",
  "function token() view returns (address)",
  "function tokenId() view returns (uint256)"
]);

export const MINT_PROPOSAL_ABI = BASE_PROPOSAL_ABI.concat([
  "function recipient() view returns (address)",
  "function amount() view returns (uint256)"
]);

export const TOKEN_PRICE_PROPOSAL_ABI = BASE_PROPOSAL_ABI.concat([
  "function newPrice() view returns (uint256)"
]);

export const DAO_ABI = [
  "function name() view returns (string)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function totalSupply(uint256 id) view returns (uint256)",
  "function tokenSupply() view returns (uint256)",
  "function tokenPrice() view returns (uint256)",
  "function quorumPercentage() view returns (uint256)",
  "function supportThreshold() view returns (uint256)",
  "function vestingPeriod() view returns (uint256)",
  "function maxProposalAge() view returns (uint256)",
  "function electionDuration() view returns (uint256)",
  "function vestedBalance(address holder) view returns (uint256)",
  "function hasClaimableVesting(address holder) view returns (bool)",
  "function claimVestedTokens()",
  "function purchaseTokens() payable",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
];

export const FACTORY_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 index) view returns (address)",
  "function createResolutionProposal(string description) returns (address)",
  "function createTreasuryProposal(string description, address recipient, uint256 amount, address token, uint256 tokenId) returns (address)",
  "function createMintProposal(string description, address recipient, uint256 amount) returns (address)",
  "function createTokenPriceProposal(string description, uint256 newPrice) returns (address)"
];

export const VOTE_TOKEN_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
];
