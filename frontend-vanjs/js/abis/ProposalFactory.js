// ProposalFactory contract ABI
// Updated for unified proposal architecture

window.FACTORY_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 index) view returns (address)",

  // Unified creation
  "function createProposal(string description, address[] targets, uint256[] values, bytes[] calldatas) returns (address)",

  // Distribution (separate)
  "function createDistributionProposal(string description, address token, uint256 tokenId, uint256 amountPerToken) returns (address)"
]
