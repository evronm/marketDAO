// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GenericProposal.sol";
import "./ProposalTypes.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract ProposalFactory {
    MarketDAO public dao;
    mapping(uint256 => address) public proposals;
    uint256 public proposalCount;

    // Implementation contracts for cloning
    address public genericImpl;
    address public distributionImpl;

    constructor(
        MarketDAO _dao,
        address _genericImpl,
        address _distributionImpl
    ) {
        dao = _dao;
        genericImpl = _genericImpl;
        distributionImpl = _distributionImpl;
    }

    modifier onlyTokenHolder() {
        require(dao.vestedBalance(msg.sender) > 0, "Must hold vested governance tokens");
        _;
    }

    /**
     * @notice Create a generic proposal that executes an arbitrary call
     * @param description Human-readable proposal description
     * @param target Target contract address for the call
     * @param value ETH value to send with the call (in wei)
     * @param data Encoded function call data (empty for Resolution)
     * @return The created GenericProposal instance
     *
     * Examples:
     * - Resolution: createProposal("Symbolic vote", address(dao), 0, "")
     * - Treasury ETH: createProposal("Send 1 ETH", address(dao), 0, abi.encodeWithSelector(dao.transferETH.selector, recipient, 1 ether))
     * - Mint: createProposal("Mint 100 tokens", address(dao), 0, abi.encodeWithSelector(dao.mintGovernanceTokens.selector, recipient, 100))
     * - Parameter: createProposal("Change price", address(dao), 0, abi.encodeWithSelector(dao.setTokenPrice.selector, 2 ether))
     * - External: createProposal("Vote in external DAO", externalDAO, 0, abi.encodeWithSelector(externalDAO.vote.selector, proposalId, true))
     */
    function createProposal(
        string memory description,
        address target,
        uint256 value,
        bytes memory data
    ) external returns (GenericProposal) {
        uint256 callerBalance = dao.vestedBalance(msg.sender);

        // Special case: Non-holders can create proposals to mint 1 token to themselves (join request)
        // This allows anyone to request membership
        bool isJoinRequest = false;
        if (callerBalance == 0) {
            // Check if this is a valid join request
            if (target == address(dao) && data.length >= 4) {
                bytes4 selector = bytes4(data[0]) | (bytes4(data[1]) >> 8) |
                                 (bytes4(data[2]) >> 16) | (bytes4(data[3]) >> 24);
                if (selector == dao.mintGovernanceTokens.selector) {
                    // Decode mintGovernanceTokens(address recipient, uint256 amount)
                    // Skip first 4 bytes (selector) and decode the rest
                    bytes memory params = new bytes(data.length - 4);
                    for (uint i = 0; i < params.length; i++) {
                        params[i] = data[i + 4];
                    }
                    (address recipient, uint256 amount) = abi.decode(params, (address, uint256));
                    require(amount == 1, "Non-holders can only request 1 token");
                    require(recipient == msg.sender, "Non-holders can only request tokens for themselves");
                    isJoinRequest = true;
                }
            }
            require(isJoinRequest, "Must hold vested governance tokens");
        }

        require(bytes(description).length > 0, "Description required");

        address clone = Clones.clone(genericImpl);
        GenericProposal(clone).initialize(dao, description, msg.sender, target, value, data);
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return GenericProposal(clone);
    }

    function createDistributionProposal(
        string memory description,
        address token,
        uint256 tokenId,
        uint256 amountPerToken
    ) external onlyTokenHolder returns (DistributionProposal) {
        address clone = Clones.clone(distributionImpl);
        DistributionProposal(clone).initialize(
            dao,
            description,
            msg.sender,
            token,
            tokenId,
            amountPerToken
        );
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return DistributionProposal(clone);
    }

    function getProposal(uint256 index) external view returns (address) {
        require(index < proposalCount, "Invalid proposal index");
        return proposals[index];
    }
}
