// ProposalFactory contract ABI (generated from compiled contract)

window.FACTORY_ABI = [
  "function proposalCount() view returns (uint256)",
  "function proposals(uint256 index) view returns (address)",

  // Create proposals (single action, not arrays!)
  "function createProposal(string description, address target, uint256 value, bytes data) returns (address)",

  // Distribution proposals (separate type)
  "function createDistributionProposal(string description, address token, uint256 tokenId, uint256 amountPerToken) returns (address)"
]
