// Unified Proposal contract ABI
// New simplified architecture with arbitrary execution

window.PROPOSAL_ABI = [
  // Base proposal info
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
  "function canTriggerElection() view returns (bool)",
  "function dao() view returns (address)",

  // GenericProposal: single action (not arrays)
  "function target() view returns (address)",
  "function value() view returns (uint256)",
  "function data() view returns (bytes)",

  // Voting
  "function getClaimableAmount(address holder) view returns (uint256)",
  "function hasClaimed(address holder) view returns (bool)",
  "function addSupport(uint256 amount)",
  "function removeSupport(uint256 amount)",
  "function claimVotingTokens()"
]

// DistributionProposal remains separate due to unique lifecycle
window.DISTRIBUTION_PROPOSAL_ABI = [
  // Base proposal fields (subset)
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
  "function canTriggerElection() view returns (bool)",
  "function dao() view returns (address)",

  // Distribution-specific
  "function token() view returns (address)",
  "function tokenId() view returns (uint256)",
  "function amountPerGovernanceToken() view returns (uint256)",
  "function totalAmount() view returns (uint256)",
  "function redemptionContract() view returns (address)",
  "function registerForDistribution()",

  // Voting
  "function getClaimableAmount(address holder) view returns (uint256)",
  "function hasClaimed(address holder) view returns (bool)",
  "function addSupport(uint256 amount)",
  "function removeSupport(uint256 amount)",
  "function claimVotingTokens()"
]

window.DISTRIBUTION_REDEMPTION_ABI = [
  "function proposal() view returns (address)",
  "function token() view returns (address)",
  "function tokenId() view returns (uint256)",
  "function amountPerGovernanceToken() view returns (uint256)",
  "function registeredBalance(address user) view returns (uint256)",
  "function hasClaimed(address user) view returns (bool)",
  "function totalRegisteredGovernanceTokens() view returns (uint256)",
  "function getClaimableAmount(address user) view returns (uint256)",
  "function isRegistered(address user) view returns (bool)",
  "function claim()"
]

window.VOTE_TOKEN_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
]
