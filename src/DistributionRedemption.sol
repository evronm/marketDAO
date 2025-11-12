// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DistributionRedemption
 * @notice Holds distributed treasury funds and allows eligible users to claim their share
 * @dev Deployed by DistributionProposal on election trigger, receives funds on execution
 */
contract DistributionRedemption is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core references
    address public immutable proposal;

    // Asset configuration
    address public immutable token;        // address(0) for ETH
    uint256 public immutable tokenId;      // 0 for ERC20/ETH
    uint256 public immutable amountPerGovernanceToken;

    // Claimant tracking
    mapping(address => uint256) public registeredBalance;  // Governance token balance at registration
    mapping(address => bool) public hasClaimed;
    uint256 public totalRegisteredGovernanceTokens;

    // Events
    event ClaimantRegistered(address indexed user, uint256 governanceTokenBalance);
    event FundsClaimed(address indexed user, uint256 amount);

    // Errors
    error OnlyProposal();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyClaimed();
    error NothingToClaim();
    error InsufficientBalance();
    error TransferFailed();

    /**
     * @notice Initialize redemption contract
     * @param _proposal The proposal that created this contract
     * @param _token Token address (address(0) for ETH)
     * @param _tokenId Token ID (0 for ERC20/ETH)
     * @param _amountPerToken Amount each governance token holder receives per token
     */
    constructor(
        address _proposal,
        address _token,
        uint256 _tokenId,
        uint256 _amountPerToken
    ) {
        proposal = _proposal;
        token = _token;
        tokenId = _tokenId;
        amountPerGovernanceToken = _amountPerToken;
    }

    /**
     * @notice Register a user for distribution with their governance token balance
     * @dev Only callable by the proposal contract
     * @param user Address to register
     * @param governanceTokenBalance User's vested governance token balance
     */
    function registerClaimant(address user, uint256 governanceTokenBalance) external {
        if (msg.sender != proposal) revert OnlyProposal();
        if (registeredBalance[user] > 0) revert AlreadyRegistered();
        if (governanceTokenBalance == 0) revert NothingToClaim();

        registeredBalance[user] = governanceTokenBalance;
        totalRegisteredGovernanceTokens += governanceTokenBalance;

        emit ClaimantRegistered(user, governanceTokenBalance);
    }

    /**
     * @notice Claim distributed funds based on registered governance token balance
     * @dev Can only claim once, must be registered first
     */
    function claim() external nonReentrant {
        if (registeredBalance[msg.sender] == 0) revert NotRegistered();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 claimAmount = registeredBalance[msg.sender] * amountPerGovernanceToken;
        if (claimAmount == 0) revert NothingToClaim();

        // Check contract has sufficient balance
        uint256 contractBalance;
        if (token == address(0)) {
            contractBalance = address(this).balance;
        } else if (tokenId == 0) {
            contractBalance = IERC20(token).balanceOf(address(this));
        } else {
            contractBalance = IERC1155(token).balanceOf(address(this), tokenId);
        }

        if (contractBalance < claimAmount) revert InsufficientBalance();

        hasClaimed[msg.sender] = true;

        // Transfer based on asset type
        if (token == address(0)) {
            // ETH transfer
            (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
            if (!success) revert TransferFailed();
        } else if (tokenId == 0) {
            // ERC20 transfer
            IERC20(token).safeTransfer(msg.sender, claimAmount);
        } else {
            // ERC1155 transfer
            IERC1155(token).safeTransferFrom(address(this), msg.sender, tokenId, claimAmount, "");
        }

        emit FundsClaimed(msg.sender, claimAmount);
    }

    /**
     * @notice Get the claimable amount for a user
     * @param user Address to check
     * @return The amount the user can claim
     */
    function getClaimableAmount(address user) external view returns (uint256) {
        if (hasClaimed[user] || registeredBalance[user] == 0) {
            return 0;
        }
        return registeredBalance[user] * amountPerGovernanceToken;
    }

    /**
     * @notice Check if user has registered for distribution
     * @param user Address to check
     * @return True if registered
     */
    function isRegistered(address user) external view returns (bool) {
        return registeredBalance[user] > 0;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
