// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Forward declaration for Proposal interface
interface IProposal {
    function isElectionActive() external view returns (bool);
    function checkEarlyTermination() external;
}

contract MarketDAO is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Constants
    uint256 public constant GOVERNANCE_TOKEN_ID = 0;
    uint256 private constant MAX_VESTING_SCHEDULES = 10;
    
    // Configuration flags (bitfield)
    uint256 private constant FLAG_ALLOW_MINTING = 1 << 0;
    uint256 private constant FLAG_RESTRICT_PURCHASES = 1 << 1;
    uint256 private constant FLAG_MINT_TO_PURCHASE = 1 << 2;
    
    // Flag getters
    function allowMinting() public view returns (bool) {
        return (flags & FLAG_ALLOW_MINTING) != 0;
    }
    
    function restrictPurchasesToHolders() public view returns (bool) {
        return (flags & FLAG_RESTRICT_PURCHASES) != 0;
    }
    
    function mintToPurchase() public view returns (bool) {
        return (flags & FLAG_MINT_TO_PURCHASE) != 0;
    }
    
    // Governance parameters
    string public name;
    uint256 public supportThreshold;  // basis points (e.g., 2000 = 20%)
    uint256 public quorumPercentage;  // basis points
    uint256 public maxProposalAge;    // in blocks
    uint256 public electionDuration;  // in blocks
    uint256 public flags;
    uint256 public tokenPrice;        // price per governance token in wei
    uint256 public vestingPeriod;     // vesting period in blocks
    
    // Vesting
    struct VestingSchedule {
        uint256 amount;
        uint256 unlockBlock;
    }
    mapping(address => VestingSchedule[]) public vestingSchedules;
    
    // Voting token management
    uint256 public nextVotingTokenId = 1;
    mapping(address => bool) public activeProposals;
    mapping(address => bool) public isVoteAddress;
    mapping(address => address) public voteAddressToProposal;

    // Fund locking for treasury proposals
    struct LockedFunds {
        address token;      // address(0) for ETH
        uint256 tokenId;    // 0 for ETH and ERC20
        uint256 amount;
        uint256 lockedAt;   // Block number for chronological ordering
    }
    address[] public proposalsWithLockedFunds;
    mapping(address => LockedFunds) public lockedFunds;
    mapping(address => uint256) private lockedFundsIndex; // For O(1) removal

    // Proposal factory for access control
    address public factory;
    address private immutable deployer;

    // Treasury configuration
    bool public hasTreasury;
    bool public acceptsETH;
    bool public acceptsERC20;
    bool public acceptsERC721;
    bool public acceptsERC1155;

    // Governance token holder tracking
    address[] private governanceTokenHolders;
    mapping(address => bool) private isGovernanceTokenHolder;
    mapping(address => uint256) private holderIndex; // O(1) lookup for holder removal
    mapping(uint256 => uint256) private tokenSupply;

    // Track total unvested governance tokens for efficient quorum calculation
    uint256 public totalUnvestedGovernanceTokens;
    
    // ============ H-02 FIX: Distribution Lock Mechanism ============
    // Tracks governance tokens locked during distribution registration
    // Prevents the same tokens from being used to register multiple addresses
    mapping(address => uint256) public distributionLock;
    
    // The currently active redemption contract authorized to manage locks
    address public activeRedemptionContract;
    // ============ END H-02 FIX ============
    
    // ============ H-03/H-04 FIX: Governance Lock Mechanism ============
    // Tracks governance tokens locked for proposal support and voting
    // Cumulative across all active proposals
    mapping(address => uint256) public governanceLock;
    // ============ END H-03/H-04 FIX ============
    
    constructor(
        string memory _name,
        uint256 _supportThreshold,
        uint256 _quorumPercentage,
        uint256 _maxProposalAge,
        uint256 _electionDuration,
        uint256 _flags,
        uint256 _tokenPrice,
        uint256 _vestingPeriod,
        string[] memory _treasuryConfig,
        address[] memory _initialHolders,
        uint256[] memory _initialAmounts
    ) ERC1155("") {  // URI will be set later if needed
        require(_supportThreshold <= 10000, "Support threshold must be <= 10000");
        require(_quorumPercentage <= 10000, "Quorum must be <= 10000");
        require(_initialHolders.length == _initialAmounts.length, "Arrays length mismatch");

        deployer = msg.sender;
        name = _name;
        supportThreshold = _supportThreshold;
        quorumPercentage = _quorumPercentage;
        maxProposalAge = _maxProposalAge;
        electionDuration = _electionDuration;
        flags = _flags;
        tokenPrice = _tokenPrice;
        vestingPeriod = _vestingPeriod;
        
        // Set up treasury configuration
        hasTreasury = _treasuryConfig.length > 0;
        for(uint i = 0; i < _treasuryConfig.length; i++) {
            bytes32 config = keccak256(abi.encodePacked(_treasuryConfig[i]));
            if(config == keccak256(abi.encodePacked("ETH"))) acceptsETH = true;
            if(config == keccak256(abi.encodePacked("ERC20"))) acceptsERC20 = true;
            if(config == keccak256(abi.encodePacked("ERC721"))) acceptsERC721 = true;
            if(config == keccak256(abi.encodePacked("ERC1155"))) acceptsERC1155 = true;
        }
        
        // Mint initial governance tokens
        for(uint i = 0; i < _initialHolders.length; i++) {
            if(_initialAmounts[i] > 0) {
                _mint(_initialHolders[i], GOVERNANCE_TOKEN_ID, _initialAmounts[i], "");
                tokenSupply[GOVERNANCE_TOKEN_ID] += _initialAmounts[i];
                _addGovernanceTokenHolder(_initialHolders[i]);
            }
        }
    }
    
    // Calculate the amount of tokens available for governance (unlocked)
    function vestedBalance(address holder) public view returns (uint256) {
        uint256 locked = 0;
        VestingSchedule[] storage schedules = vestingSchedules[holder];
        for (uint256 i = 0; i < schedules.length; i++) {
            if (block.number < schedules[i].unlockBlock) {
                locked += schedules[i].amount;
            }
        }
        return balanceOf(holder, GOVERNANCE_TOKEN_ID) - locked;
    }

    // Calculate vested balance at a specific block number (for election snapshots)
    function vestedBalanceAt(address holder, uint256 blockNumber) public view returns (uint256) {
        uint256 locked = 0;
        VestingSchedule[] storage schedules = vestingSchedules[holder];
        for (uint256 i = 0; i < schedules.length; i++) {
            if (blockNumber < schedules[i].unlockBlock) {
                locked += schedules[i].amount;
            }
        }
        uint256 currentBalance = balanceOf(holder, GOVERNANCE_TOKEN_ID);
        // If locked amount exceeds balance, return 0 (user transferred vested tokens)
        if (locked >= currentBalance) {
            return 0;
        }
        return currentBalance - locked;
    }

    // Remove expired vesting schedules for gas optimization
    function _cleanupExpiredSchedules(address holder) internal {
        VestingSchedule[] storage schedules = vestingSchedules[holder];
        uint256 writeIndex = 0;

        // Copy only non-expired schedules and track what was removed
        for (uint256 readIndex = 0; readIndex < schedules.length; readIndex++) {
            if (block.number < schedules[readIndex].unlockBlock) {
                // Still locked, keep it
                if (writeIndex != readIndex) {
                    schedules[writeIndex] = schedules[readIndex];
                }
                writeIndex++;
            } else {
                // Expired schedule - decrement unvested counter
                totalUnvestedGovernanceTokens -= schedules[readIndex].amount;
            }
        }

        // Trim array to new size
        while (schedules.length > writeIndex) {
            schedules.pop();
        }
    }

    // Check if holder has any expired vesting schedules that need claiming
    function hasClaimableVesting(address holder) public view returns (bool) {
        VestingSchedule[] storage schedules = vestingSchedules[holder];
        for (uint256 i = 0; i < schedules.length; i++) {
            if (block.number >= schedules[i].unlockBlock) {
                return true; // Has expired schedules that need claiming
            }
        }
        return false;
    }

    // Public function for users to manually claim their vested tokens
    function claimVestedTokens() external {
        require(hasClaimableVesting(msg.sender), "No vested tokens to claim");
        _cleanupExpiredSchedules(msg.sender);
    }

    // Direct token purchase function
    function purchaseTokens() external payable nonReentrant {
        require(tokenPrice > 0, "Direct token sales disabled");
        require(msg.value > 0, "Payment required");
        require(msg.value % tokenPrice == 0, "Payment must be multiple of token price");

        // If restricted, only existing holders can purchase
        if (restrictPurchasesToHolders()) {
            require(balanceOf(msg.sender, GOVERNANCE_TOKEN_ID) > 0, "Only existing holders can purchase");
        }

        uint256 tokenAmount = msg.value / tokenPrice;

        // Handle token acquisition based on FLAG_MINT_TO_PURCHASE
        if (!mintToPurchase()) {
            // Default behavior: mint new tokens
            _mint(msg.sender, GOVERNANCE_TOKEN_ID, tokenAmount, "");
            tokenSupply[GOVERNANCE_TOKEN_ID] += tokenAmount;
        } else {
            // New behavior (when FLAG_MINT_TO_PURCHASE is set): transfer from DAO's token balance
            require(
                balanceOf(address(this), GOVERNANCE_TOKEN_ID) >= tokenAmount,
                "Insufficient tokens available for purchase"
            );
            _safeTransferFrom(address(this), msg.sender, GOVERNANCE_TOKEN_ID, tokenAmount, "");
        }

        _addGovernanceTokenHolder(msg.sender);

        // Add vesting schedule if vesting period is set
        if (vestingPeriod > 0) {
            // Clean up expired schedules first
            _cleanupExpiredSchedules(msg.sender);

            uint256 unlockBlock = block.number + vestingPeriod;
            VestingSchedule[] storage schedules = vestingSchedules[msg.sender];

            // Try to consolidate with existing schedule at same unlock time
            bool merged = false;
            for (uint256 i = 0; i < schedules.length; i++) {
                if (schedules[i].unlockBlock == unlockBlock) {
                    schedules[i].amount += tokenAmount;
                    merged = true;
                    break;
                }
            }

            // If no match, create new schedule (with limit check)
            if (!merged) {
                require(
                    schedules.length < MAX_VESTING_SCHEDULES,
                    "Too many vesting schedules"
                );
                schedules.push(VestingSchedule({
                    amount: tokenAmount,
                    unlockBlock: unlockBlock
                }));
            }

            // Increment unvested counter (whether merged or new)
            totalUnvestedGovernanceTokens += tokenAmount;
        }
    }
    
    // Treasury functions
    receive() external payable {
        require(acceptsETH, "DAO does not accept ETH");
        _tryReleaseLockedProposals();
    }

    // Lock funds for a treasury proposal when election is triggered
    function lockFunds(address token, uint256 tokenId, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can lock");
        require(lockedFunds[msg.sender].amount == 0, "Already locked funds");
        require(amount > 0, "Amount must be positive");

        // Verify sufficient available funds
        if (token == address(0)) {
            require(acceptsETH, "ETH not accepted");
            require(getAvailableETH() >= amount, "Insufficient available ETH");
        } else if (tokenId == 0) {
            require(acceptsERC20, "ERC20 not accepted");
            require(getAvailableERC20(token) >= amount, "Insufficient available ERC20");
        } else {
            // ERC721 or ERC1155
            require(acceptsERC1155, "ERC1155 not accepted");
            require(getAvailableERC1155(token, tokenId) >= amount, "Insufficient available ERC1155");
        }

        lockedFunds[msg.sender] = LockedFunds({
            token: token,
            tokenId: tokenId,
            amount: amount,
            lockedAt: block.number
        });

        // Add to tracking array
        lockedFundsIndex[msg.sender] = proposalsWithLockedFunds.length;
        proposalsWithLockedFunds.push(msg.sender);
    }

    // Unlock funds when a treasury proposal completes (pass or fail)
    function unlockFunds() external {
        require(activeProposals[msg.sender], "Only active proposal can unlock");
        require(lockedFunds[msg.sender].amount > 0, "No funds locked");

        // Remove from tracking array using swap-and-pop
        uint256 index = lockedFundsIndex[msg.sender];
        address lastProposal = proposalsWithLockedFunds[proposalsWithLockedFunds.length - 1];
        
        proposalsWithLockedFunds[index] = lastProposal;
        lockedFundsIndex[lastProposal] = index;
        
        proposalsWithLockedFunds.pop();
        delete lockedFundsIndex[msg.sender];
        delete lockedFunds[msg.sender];
    }

    // Try to release any proposals that are no longer active but still have locked funds
    function _tryReleaseLockedProposals() internal {
        // Iterate backwards to allow safe removal
        for (uint256 i = proposalsWithLockedFunds.length; i > 0; i--) {
            address proposal = proposalsWithLockedFunds[i - 1];
            if (!activeProposals[proposal]) {
                // Proposal is no longer active, release its locked funds
                uint256 index = i - 1;
                address lastProposal = proposalsWithLockedFunds[proposalsWithLockedFunds.length - 1];
                
                proposalsWithLockedFunds[index] = lastProposal;
                lockedFundsIndex[lastProposal] = index;
                
                proposalsWithLockedFunds.pop();
                delete lockedFundsIndex[proposal];
                delete lockedFunds[proposal];
            }
        }
    }

    // ============ H-02 FIX: Distribution Lock Functions ============
    
    /**
     * @notice Set the active redemption contract (called by DistributionProposal)
     * @dev Only callable by an active proposal
     * @param _redemptionContract Address of the redemption contract
     */
    function setActiveRedemptionContract(address _redemptionContract) external {
        require(activeProposals[msg.sender], "Only active proposal can set redemption contract");
        activeRedemptionContract = _redemptionContract;
    }
    
    /**
     * @notice Clear the active redemption contract
     * @dev Callable by the redemption contract itself or an active proposal
     */
    function clearActiveRedemptionContract() external {
        require(
            msg.sender == activeRedemptionContract || activeProposals[msg.sender],
            "Not authorized"
        );
        activeRedemptionContract = address(0);
    }
    
    /**
     * @notice Lock governance tokens for distribution registration
     * @dev Only callable by the active redemption contract
     * @param user Address to lock tokens for
     * @param amount Amount of tokens to lock
     */
    function lockForDistribution(address user, uint256 amount) external {
        require(msg.sender == activeRedemptionContract, "Only active redemption contract");
        require(activeRedemptionContract != address(0), "No active redemption contract");
        distributionLock[user] = amount;
    }
    
    /**
     * @notice Unlock governance tokens after claim or distribution end
     * @dev Only callable by the active redemption contract
     * @param user Address to unlock tokens for
     */
    function unlockForDistribution(address user) external {
        require(msg.sender == activeRedemptionContract, "Only active redemption contract");
        distributionLock[user] = 0;
    }
    
    /**
     * @notice Get the transferable balance (vested minus all locks)
     * @param holder Address to check
     * @return The amount of tokens that can be transferred
     */
    function transferableBalance(address holder) public view returns (uint256) {
        uint256 vested = vestedBalance(holder);
        uint256 totalLocked = distributionLock[holder] + governanceLock[holder];
        if (totalLocked >= vested) {
            return 0;
        }
        return vested - totalLocked;
    }
    
    // ============ H-03/H-04 FIX: Governance Lock Functions ============
    
    /**
     * @notice Add to a user's governance lock (for support or voting)
     * @dev Only callable by active proposals
     * @param user Address to lock tokens for
     * @param amount Amount to add to lock
     */
    function addGovernanceLock(address user, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal");
        governanceLock[user] += amount;
    }
    
    /**
     * @notice Remove from a user's governance lock
     * @dev Callable by active OR resolved proposals (to allow post-resolution unlocks)
     * @param user Address to unlock tokens for
     * @param amount Amount to remove from lock
     */
    function removeGovernanceLock(address user, uint256 amount) external {
        require(activeProposals[msg.sender] || wasActiveProposal[msg.sender], "Not authorized proposal");
        if (governanceLock[user] >= amount) {
            governanceLock[user] -= amount;
        } else {
            governanceLock[user] = 0;
        }
    }
    
    // ============ END H-03/H-04 FIX ============
    
    // ============ END H-02 FIX ============

    function setFactory(address _factory) external {
        require(msg.sender == deployer, "Only deployer can set factory");
        require(factory == address(0), "Factory already set");
        require(_factory != address(0), "Invalid factory address");
        require(_factory.code.length > 0, "Factory must be a contract");
        factory = _factory;
    }
    
    function registerProposal(address proposal) external {
        require(msg.sender == factory, "Only factory can register");
        activeProposals[proposal] = true;
        wasActiveProposal[proposal] = true;  // Track for post-resolution lock management
    }

    // Alias for registerProposal - used by ProposalFactory
    function setActiveProposal(address proposal) external {
        require(msg.sender == factory, "Only factory can register");
        activeProposals[proposal] = true;
        wasActiveProposal[proposal] = true;  // Track for post-resolution lock management
    }

    function clearActiveProposal() external {
        require(activeProposals[msg.sender], "Not an active proposal");
        activeProposals[msg.sender] = false;
    }
    
    // Track proposals that were ever active (for lock management after resolution)
    mapping(address => bool) public wasActiveProposal;

    function registerVoteAddresses(address yesAddr, address noAddr) external {
        require(activeProposals[msg.sender], "Only active proposal can register");
        isVoteAddress[yesAddr] = true;
        isVoteAddress[noAddr] = true;
        voteAddressToProposal[yesAddr] = msg.sender;
        voteAddressToProposal[noAddr] = msg.sender;
    }

    // Singular version - used by Proposal.sol
    function registerVoteAddress(address voteAddr) external {
        require(activeProposals[msg.sender], "Only active proposal can register");
        isVoteAddress[voteAddr] = true;
        voteAddressToProposal[voteAddr] = msg.sender;
    }

    function transferETH(address payable recipient, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function transferERC20(address token, address recipient, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        IERC20(token).safeTransfer(recipient, amount);
    }

    function transferERC721(address token, address recipient, uint256 tokenId) external {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        IERC721(token).safeTransferFrom(address(this), recipient, tokenId);
    }

    function transferERC1155(address token, address recipient, uint256 tokenId, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        IERC1155(token).safeTransferFrom(address(this), recipient, tokenId, amount, "");
    }
    
    // Override ERC1155 transfer functions to handle voting tokens
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override nonReentrant {
        require(
            id == GOVERNANCE_TOKEN_ID || _isActiveVotingToken(id),
            "Invalid token transfer"
        );

        // Prevent transfer of unvested or distribution-locked governance tokens
        if (id == GOVERNANCE_TOKEN_ID && from != address(0)) {
            // Require user to claim vested tokens before transferring
            require(!hasClaimableVesting(from), "Must claim vested tokens first");
            
            // ============ H-02 FIX: Check distribution lock ============
            // Use transferableBalance which accounts for both vesting and distribution locks
            require(transferableBalance(from) >= amount, "Cannot transfer locked/unvested tokens");
            // ============ END H-02 FIX ============
        }

        // Add check for vote transfers to ensure election is still active
        if (_isActiveVotingToken(id) && msg.sender == from) {
            // Check if destination is a registered vote address
            if (isVoteAddress[to]) {
                // Get the associated proposal
                address proposalAddr = voteAddressToProposal[to];
                
                // Check if the election is still active
                if (proposalAddr != address(0) && activeProposals[proposalAddr]) {
                    try IProposal(proposalAddr).isElectionActive() returns (bool isActive) {
                        if (!isActive) {
                            revert("Election has ended");
                        }
                        // Check for early termination after vote
                        try IProposal(proposalAddr).checkEarlyTermination() {} catch {}
                    } catch {
                        revert("Error checking election status");
                    }
                }
            }
        }
        
        uint256 fromBalanceBefore = balanceOf(from, GOVERNANCE_TOKEN_ID);
        uint256 toBalanceBefore = balanceOf(to, GOVERNANCE_TOKEN_ID);
        
        super.safeTransferFrom(from, to, id, amount, data);
        
        if(id == GOVERNANCE_TOKEN_ID) {
            if(balanceOf(from, GOVERNANCE_TOKEN_ID) == 0 && fromBalanceBefore > 0) {
                _removeGovernanceTokenHolder(from);
            }
            if(balanceOf(to, GOVERNANCE_TOKEN_ID) > 0 && toBalanceBefore == 0) {
                _addGovernanceTokenHolder(to);
            }
        }
    }
    
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override nonReentrant {
        // Calculate total governance tokens being transferred
        uint256 totalGovernanceAmount = 0;
        for(uint i = 0; i < ids.length; i++) {
            require(
                ids[i] == GOVERNANCE_TOKEN_ID || _isActiveVotingToken(ids[i]),
                "Invalid token transfer"
            );

            if (ids[i] == GOVERNANCE_TOKEN_ID) {
                totalGovernanceAmount += amounts[i];
            }
        }

        // Prevent transfer of unvested or distribution-locked governance tokens
        if (totalGovernanceAmount > 0 && from != address(0)) {
            // Require user to claim vested tokens before transferring
            require(!hasClaimableVesting(from), "Must claim vested tokens first");
            
            // ============ H-02 FIX: Check distribution lock ============
            require(transferableBalance(from) >= totalGovernanceAmount, "Cannot transfer locked/unvested tokens");
            // ============ END H-02 FIX ============
        }

        for(uint i = 0; i < ids.length; i++) {
            // Add check for vote transfers to ensure election is still active
            if (_isActiveVotingToken(ids[i]) && msg.sender == from) {
                // Check if destination is a registered vote address
                if (isVoteAddress[to]) {
                    // Get the associated proposal
                    address proposalAddr = voteAddressToProposal[to];
                    
                    // Check if the election is still active
                    if (proposalAddr != address(0) && activeProposals[proposalAddr]) {
                        try IProposal(proposalAddr).isElectionActive() returns (bool isActive) {
                            if (!isActive) {
                                revert("Election has ended");
                            }
                            // Check for early termination after vote
                            try IProposal(proposalAddr).checkEarlyTermination() {} catch {}
                        } catch {
                            revert("Error checking election status");
                        }
                    }
                }
            }
        }
        
        uint256 fromBalanceBefore = balanceOf(from, GOVERNANCE_TOKEN_ID);
        uint256 toBalanceBefore = balanceOf(to, GOVERNANCE_TOKEN_ID);
        
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
        
        if(balanceOf(from, GOVERNANCE_TOKEN_ID) == 0 && fromBalanceBefore > 0) {
            _removeGovernanceTokenHolder(from);
        }
        if(balanceOf(to, GOVERNANCE_TOKEN_ID) > 0 && toBalanceBefore == 0) {
            _addGovernanceTokenHolder(to);
        }
    }
    
    function _addGovernanceTokenHolder(address holder) private {
        if(!isGovernanceTokenHolder[holder]) {
            isGovernanceTokenHolder[holder] = true;
            holderIndex[holder] = governanceTokenHolders.length;
            governanceTokenHolders.push(holder);
        }
    }
    
    function _removeGovernanceTokenHolder(address holder) private {
        if(isGovernanceTokenHolder[holder]) {
            isGovernanceTokenHolder[holder] = false;

            uint256 index = holderIndex[holder];
            address lastHolder = governanceTokenHolders[governanceTokenHolders.length - 1];

            // Swap with last element
            governanceTokenHolders[index] = lastHolder;
            holderIndex[lastHolder] = index;

            // Remove last element
            governanceTokenHolders.pop();
            delete holderIndex[holder];
        }
    }
    
    // Internal helper to check if a token ID is an active voting token
    function _isActiveVotingToken(uint256 tokenId) internal view returns (bool) {
        // Check if the token ID is in the valid range for voting tokens
        return tokenId > GOVERNANCE_TOKEN_ID && tokenId < nextVotingTokenId;
    }
    
    function getNextVotingTokenId() external returns (uint256) {
        require(activeProposals[msg.sender], "Only active proposal can request voting token ID");
        uint256 tokenId = nextVotingTokenId;
        nextVotingTokenId += 1;
        return tokenId;
    }

    function mintVotingTokens(address to, uint256 tokenId, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can mint");
        _mint(to, tokenId, amount, "");
        tokenSupply[tokenId] += amount;
    }
    
    function mintGovernanceTokens(address to, uint256 amount) external {
        require(activeProposals[msg.sender], "Only active proposal can mint");
        require(allowMinting(), "Minting not allowed");
        _mint(to, GOVERNANCE_TOKEN_ID, amount, "");
        _addGovernanceTokenHolder(to);
        tokenSupply[GOVERNANCE_TOKEN_ID] += amount;
    }

    function setTokenPrice(uint256 newPrice) external {
        require(activeProposals[msg.sender], "Only active proposal can set price");
        require(newPrice > 0, "Price must be greater than 0");
        tokenPrice = newPrice;
    }

    function setSupportThreshold(uint256 newThreshold) external {
        require(activeProposals[msg.sender], "Only active proposal can set threshold");
        require(newThreshold > 0 && newThreshold <= 10000, "Threshold must be > 0 and <= 10000");
        supportThreshold = newThreshold;
    }

    function setQuorumPercentage(uint256 newQuorum) external {
        require(activeProposals[msg.sender], "Only active proposal can set quorum");
        require(newQuorum >= 100 && newQuorum <= 10000, "Quorum must be >= 1% and <= 100%");
        quorumPercentage = newQuorum;
    }

    function setMaxProposalAge(uint256 newAge) external {
        require(activeProposals[msg.sender], "Only active proposal can set proposal age");
        require(newAge > 0, "Proposal age must be greater than 0");
        maxProposalAge = newAge;
    }

    function setElectionDuration(uint256 newDuration) external {
        require(activeProposals[msg.sender], "Only active proposal can set election duration");
        require(newDuration > 0, "Election duration must be greater than 0");
        electionDuration = newDuration;
    }

    function setVestingPeriod(uint256 newPeriod) external {
        require(activeProposals[msg.sender], "Only active proposal can set vesting period");
        vestingPeriod = newPeriod;
    }

    function setFlags(uint256 newFlags) external {
        require(activeProposals[msg.sender], "Only active proposal can set flags");
        flags = newFlags;
    }

    // View functions
    function getGovernanceTokenHolders() external view returns (address[] memory) {
        return governanceTokenHolders;
    }

    function getGovernanceTokenHolderCount() external view returns (uint256) {
        return governanceTokenHolders.length;
    }

    function getTokenSupply(uint256 tokenId) external view returns (uint256) {
        return tokenSupply[tokenId];
    }

    // Alias for getTokenSupply - used by tests
    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return tokenSupply[tokenId];
    }

    function getTotalVestedSupply() public view returns (uint256) {
        uint256 total = tokenSupply[GOVERNANCE_TOKEN_ID];
        return total - totalUnvestedGovernanceTokens;
    }

    function getVestingSchedules(address holder) external view returns (VestingSchedule[] memory) {
        return vestingSchedules[holder];
    }

    // Treasury balance functions
    function getTotalLockedETH() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < proposalsWithLockedFunds.length; i++) {
            LockedFunds storage locked = lockedFunds[proposalsWithLockedFunds[i]];
            if (locked.token == address(0)) {
                total += locked.amount;
            }
        }
        return total;
    }

    function getAvailableETH() public view returns (uint256) {
        uint256 total = address(this).balance;
        uint256 locked = getTotalLockedETH();
        return total > locked ? total - locked : 0;
    }

    function getTotalLockedERC20(address token) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < proposalsWithLockedFunds.length; i++) {
            LockedFunds storage locked = lockedFunds[proposalsWithLockedFunds[i]];
            if (locked.token == token && locked.tokenId == 0) {
                total += locked.amount;
            }
        }
        return total;
    }

    function getAvailableERC20(address token) public view returns (uint256) {
        uint256 total = IERC20(token).balanceOf(address(this));
        uint256 locked = getTotalLockedERC20(token);
        return total > locked ? total - locked : 0;
    }

    function getTotalLockedERC1155(address token, uint256 tokenId) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < proposalsWithLockedFunds.length; i++) {
            LockedFunds storage locked = lockedFunds[proposalsWithLockedFunds[i]];
            if (locked.token == token && locked.tokenId == tokenId) {
                total += locked.amount;
            }
        }
        return total;
    }

    function getAvailableERC1155(address token, uint256 tokenId) public view returns (uint256) {
        uint256 total = IERC1155(token).balanceOf(address(this), tokenId);
        uint256 locked = getTotalLockedERC1155(token, tokenId);
        return total > locked ? total - locked : 0;
    }

    // Get list of proposals with locked funds
    function getProposalsWithLockedFunds() external view returns (address[] memory) {
        return proposalsWithLockedFunds;
    }

    // Get tokens available for purchase (DAO's own governance token balance)
    function getAvailableTokensForPurchase() external view returns (uint256) {
        return balanceOf(address(this), GOVERNANCE_TOKEN_ID);
    }

    // ERC1155 receiver functions for treasury
    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes memory
    ) public virtual returns (bytes4) {
        // Always allow governance token transfers (internal)
        if (id == GOVERNANCE_TOKEN_ID) {
            return this.onERC1155Received.selector;
        }
        // For other tokens, check treasury config
        require(acceptsERC1155, "DAO does not accept ERC1155");
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory ids,
        uint256[] memory,
        bytes memory
    ) public virtual returns (bytes4) {
        // Check if any non-governance tokens are being received
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] != GOVERNANCE_TOKEN_ID) {
                require(acceptsERC1155, "DAO does not accept ERC1155");
                break;
            }
        }
        return this.onERC1155BatchReceived.selector;
    }

    // ERC721 receiver for treasury
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual returns (bytes4) {
        require(acceptsERC721, "DAO does not accept ERC721");
        return this.onERC721Received.selector;
    }
}
