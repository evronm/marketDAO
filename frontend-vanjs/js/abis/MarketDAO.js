// MarketDAO contract ABI
// Updated for simplified backend architecture

window.DAO_ABI = [
  // Token operations
  "function name() view returns (string)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function totalSupply(uint256 id) view returns (uint256)",
  "function vestedBalance(address holder) view returns (uint256)",
  "function hasClaimableVesting(address holder) view returns (bool)",
  "function claimVestedTokens()",
  "function purchaseTokens() payable",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function getGovernanceTokenHolders() view returns (address[])",

  // Parameters (read)
  "function tokenPrice() view returns (uint256)",
  "function quorumPercentage() view returns (uint256)",
  "function supportThreshold() view returns (uint256)",
  "function vestingPeriod() view returns (uint256)",
  "function maxProposalAge() view returns (uint256)",
  "function electionDuration() view returns (uint256)",
  "function restrictPurchasesToHolders() view returns (bool)",
  "function allowMinting() view returns (bool)",
  "function mintToPurchase() view returns (bool)",
  "function getAvailableTokensForPurchase() view returns (uint256)",

  // Execution (called by proposals)
  "function executeCall(address target, uint256 value, bytes calldata data) returns (bytes)",

  // Parameter setters (for calldata encoding)
  "function setSupportThreshold(uint256 newThreshold)",
  "function setQuorumPercentage(uint256 newQuorum)",
  "function setMaxProposalAge(uint256 newAge)",
  "function setElectionDuration(uint256 newDuration)",
  "function setVestingPeriod(uint256 newPeriod)",
  "function setTokenPrice(uint256 newPrice)",
  "function setFlags(uint256 newFlags)",

  // Treasury operations (for calldata encoding)
  "function transferETH(address recipient, uint256 amount)",
  "function transferERC20(address token, address recipient, uint256 amount)",
  "function transferERC721(address token, address recipient, uint256 tokenId)",
  "function transferERC1155(address token, address recipient, uint256 tokenId, uint256 amount)",

  // Minting (for calldata encoding)
  "function mint(address recipient, uint256 amount)"
]
