// ProposalFactory contract ABI
// Updated for unified proposal architecture

window.FACTORY_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 index) view returns (address)",

  // Unified creation (single action, not arrays)
  "function createProposal(string description, address target, uint256 value, bytes data) returns (address)",

  // Distribution (separate)
  "function createDistributionProposal(string description, address token, uint256 tokenId, uint256 amountPerToken) returns (address)"
]
