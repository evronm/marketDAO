// GenericProposal contract ABI (generated from compiled contract)

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

  // GenericProposal: single action (not arrays!)
  "function target() view returns (address)",
  "function value() view returns (uint256)",
  "function data() view returns (bytes)",

  // Support
  "function support(address) view returns (uint256)",
  "function addSupport(uint256 amount)",
  "function removeSupport(uint256 amount)",

  // Voting
  "function getClaimableAmount(address holder) view returns (uint256)",
  "function hasClaimed(address) view returns (bool)",
  "function claimVotingTokens()",

  // Execution
  "function execute()",
  "function isElectionActive() view returns (bool)",
  "function isResolved() view returns (bool)"
]
