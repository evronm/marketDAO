// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for MarketDAO distribution lock functions
interface IMarketDAO {
    function lockForDistribution(address user, uint256 amount) external;
    function unlockForDistribution(address user) external;
    function activeProposals(address proposal) external view returns (bool);
}

// Interface for checking proposal status
interface IDistributionProposal {
    function executed() external view returns (bool);
}

/**
 * @title DistributionRedemption
 * @notice Holds distributed treasury funds and allows eligible users to claim their share
 * @dev Deployed by DistributionProposal on election trigger, receives funds on execution
 * 
 * Security Fixes:
 * - H-02 FIX: Locks governance tokens in MarketDAO when users register, preventing
 *   the same tokens from being used to register multiple addresses for the same distribution.
 * - M-01 FIX: Uses pro-rata distribution to ensure all registered users can claim.
 *   Each user receives: (userShares / totalRegisteredShares) * actualPoolBalance
 *   This means amountPerGovernanceToken is a TARGET, not a guarantee.
 * - M-01 FIX (Part 2): Only the proposal can mark the pool as funded via markPoolFunded().
 *   This prevents griefing attacks where attackers send dust to snapshot a tiny balance.
 */
contract DistributionRedemption is ERC1155Holder, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core references
    address public immutable proposal;
    IMarketDAO public immutable dao;

    // Asset configuration
    address public immutable token;        // address(0) for ETH
    uint256 public immutable tokenId;      // 0 for ERC20/ETH
    uint256 public immutable amountPerGovernanceToken;  // Target amount (may differ from actual)

    // Claimant tracking
    mapping(address => uint256) public registeredBalance;  // Governance token balance at registration
    mapping(address => bool) public hasClaimed;
    uint256 public totalRegisteredGovernanceTokens;

    // ============ M-01 FIX: Track actual pool balance for pro-rata ============
    uint256 public totalPoolBalance;       // Actual funds received for distribution
    bool public poolFunded;                // True once funds have been received
    // ============ END M-01 FIX ============

    // Events
    event ClaimantRegistered(address indexed user, uint256 governanceTokenBalance);
    event FundsClaimed(address indexed user, uint256 amount);
    event LockReleased(address indexed user);
    event PoolFunded(uint256 amount);  // M-01 FIX: New event

    // Errors
    error OnlyProposal();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyClaimed();
    error NothingToClaim();
    error InsufficientBalance();
    error TransferFailed();
    error DistributionStillActive();
    error PoolNotFunded();  // M-01 FIX: New error

    /**
     * @notice Initialize redemption contract
     * @param _proposal The proposal that created this contract
     * @param _dao The MarketDAO contract (for locking governance tokens)
     * @param _token Token address (address(0) for ETH)
     * @param _tokenId Token ID (0 for ERC20/ETH)
     * @param _amountPerToken Target amount each governance token holder receives per token
     *        NOTE (M-01 FIX): This is now a TARGET, not a guarantee. Actual payout is pro-rata.
     */
    constructor(
        address _proposal,
        address _dao,
        address _token,
        uint256 _tokenId,
        uint256 _amountPerToken
    ) {
        proposal = _proposal;
        dao = IMarketDAO(_dao);
        token = _token;
        tokenId = _tokenId;
        amountPerGovernanceToken = _amountPerToken;
    }

    /**
     * @notice Register a user for distribution with their governance token balance
     * @dev Only callable by the proposal contract. Locks the user's governance tokens.
     * @param user Address to register
     * @param governanceTokenBalance User's vested governance token balance
     */
    function registerClaimant(address user, uint256 governanceTokenBalance) external {
        if (msg.sender != proposal) revert OnlyProposal();
        if (registeredBalance[user] > 0) revert AlreadyRegistered();
        if (governanceTokenBalance == 0) revert NothingToClaim();

        registeredBalance[user] = governanceTokenBalance;
        totalRegisteredGovernanceTokens += governanceTokenBalance;

        // ============ H-02 FIX: Lock governance tokens ============
        // This prevents the user from transferring these tokens to another address
        // and registering again with the same tokens
        dao.lockForDistribution(user, governanceTokenBalance);
        // ============ END H-02 FIX ============

        emit ClaimantRegistered(user, governanceTokenBalance);
    }

    /**
     * @notice Claim distributed funds based on registered governance token balance
     * @dev Can only claim once, must be registered first. Unlocks governance tokens.
     *      M-01 FIX: Payout is calculated pro-rata based on actual pool balance.
     */
    function claim() external nonReentrant {
        if (registeredBalance[msg.sender] == 0) revert NotRegistered();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        
        // ============ M-01 FIX: Require pool to be funded ============
        if (!poolFunded) revert PoolNotFunded();
        // ============ END M-01 FIX ============

        // ============ M-01 FIX: Calculate pro-rata claim amount ============
        // Instead of: claimAmount = registeredBalance[msg.sender] * amountPerGovernanceToken
        // We use:     claimAmount = (userShares / totalShares) * actualPoolBalance
        // This ensures the pool can never be over-claimed regardless of registration timing
        uint256 userShares = registeredBalance[msg.sender];
        uint256 claimAmount = (userShares * totalPoolBalance) / totalRegisteredGovernanceTokens;
        // ============ END M-01 FIX ============
        
        if (claimAmount == 0) revert NothingToClaim();

        // Check contract has sufficient balance (should always pass with pro-rata)
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

        // ============ H-02 FIX: Unlock governance tokens on claim ============
        dao.unlockForDistribution(msg.sender);
        // ============ END H-02 FIX ============

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
     * @notice Release lock for users who registered but the distribution ended (passed or failed)
     * @dev Can be called by anyone after the proposal is no longer active or has executed.
     *      This allows users to unlock their tokens without claiming if the proposal failed
     *      or if they simply don't want to claim.
     */
    function releaseLock() external {
        if (registeredBalance[msg.sender] == 0) revert NotRegistered();
        
        // Can only release if distribution has ended (proposal executed or no longer active)
        bool proposalEnded = IDistributionProposal(proposal).executed() || 
                             !dao.activeProposals(proposal);
        if (!proposalEnded) revert DistributionStillActive();
        
        // If already claimed, lock was already released
        if (hasClaimed[msg.sender]) {
            // No-op, lock already released during claim
            return;
        }

        // ============ H-02 FIX: Unlock governance tokens ============
        dao.unlockForDistribution(msg.sender);
        // ============ END H-02 FIX ============

        emit LockReleased(msg.sender);
    }

    /**
     * @notice Get the claimable amount for a user
     * @dev M-01 FIX: Returns pro-rata amount based on actual pool balance
     * @param user Address to check
     * @return The amount the user can claim (0 if pool not funded yet or already claimed)
     */
    function getClaimableAmount(address user) external view returns (uint256) {
        if (hasClaimed[user] || registeredBalance[user] == 0) {
            return 0;
        }
        
        // ============ M-01 FIX: Return pro-rata amount ============
        // Before pool is funded, return the target amount (for UI display)
        // After pool is funded, return the actual pro-rata amount
        if (!poolFunded || totalRegisteredGovernanceTokens == 0) {
            // Pool not funded yet - return target amount
            return registeredBalance[user] * amountPerGovernanceToken;
        }
        
        // Pool funded - return actual pro-rata amount
        return (registeredBalance[user] * totalPoolBalance) / totalRegisteredGovernanceTokens;
        // ============ END M-01 FIX ============
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
     * @notice Check if distribution has ended
     * @return True if proposal executed or no longer active
     */
    function isDistributionEnded() external view returns (bool) {
        return IDistributionProposal(proposal).executed() || 
               !dao.activeProposals(proposal);
    }

    // ============ M-01 FIX: Function to record pool funding ============
    // Only the proposal can mark the pool as funded to prevent griefing attacks
    // where an attacker sends dust to snapshot a tiny balance before real funds arrive
    
    /**
     * @notice Mark the pool as funded and snapshot the current balance
     * @dev Only callable by the proposal contract. Must be called AFTER funds are transferred.
     *      This prevents griefing attacks where attackers send dust to freeze the pool.
     */
    function markPoolFunded() external {
        if (msg.sender != proposal) revert OnlyProposal();
        if (poolFunded) return;  // Already funded, no-op
        
        uint256 balance;
        if (token == address(0)) {
            balance = address(this).balance;
        } else if (tokenId == 0) {
            balance = IERC20(token).balanceOf(address(this));
        } else {
            balance = IERC1155(token).balanceOf(address(this), tokenId);
        }
        
        if (balance > 0) {
            totalPoolBalance = balance;
            poolFunded = true;
            emit PoolFunded(balance);
        }
    }
    
    // ============ END M-01 FIX ============

    /**
     * @notice Receive ETH
     * @dev Does NOT auto-mark funding to prevent griefing attacks.
     *      The proposal must call markPoolFunded() after sending funds.
     */
    receive() external payable {
        // Accept ETH but don't auto-snapshot - proposal must call markPoolFunded()
    }
}
