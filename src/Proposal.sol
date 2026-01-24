// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketDAO.sol";

abstract contract Proposal {
    MarketDAO public dao;
    address public proposer;
    uint256 public createdAt;
    string public description;

    uint256 public supportTotal;
    mapping(address => uint256) public support;

    // Election state
    bool public electionTriggered;
    uint256 public electionStart;
    uint256 public votingTokenId;
    address public yesVoteAddress;
    address public noVoteAddress;
    bool public executed;

    // Snapshot of total possible votes at election start (for gas efficiency)
    uint256 public snapshotTotalVotes;

    // Lazy minting for voting tokens
    mapping(address => bool) public hasClaimed;

    // Initialization guard
    bool private _initialized;
    
    // ============ H-03/H-04 FIX: Track locked amounts per user ============
    // How much governance tokens we locked for each user's support
    mapping(address => uint256) public supportLocked;
    // How much governance tokens we locked for each user's voting claim
    mapping(address => uint256) public votingLocked;
    // ============ END H-03/H-04 FIX ============
    
    modifier onlyBeforeElection() {
        require(!electionTriggered, "Election already triggered");
        _;
    }
    
    modifier onlyDuringElection() {
        require(
            electionTriggered && 
            block.number >= electionStart &&
            block.number < electionStart + dao.electionDuration(),
            "Not during election period"
        );
        _;
    }
    
    // Helper function for MarketDAO to check if an address is a vote address
    function isVoteAddress(address addr) external view returns (bool) {
        return addr == yesVoteAddress || addr == noVoteAddress;
    }
    
    // Helper function for MarketDAO to check if the election is active
    function isElectionActive() external virtual view returns (bool) {
        if (!electionTriggered) return false;
        if (executed) return false;
        if (block.number < electionStart) return false;
        if (block.number >= electionStart + dao.electionDuration()) return false;
        return true;
    }
    
    /**
     * @notice Check if the proposal has been resolved (executed, failed, or expired)
     * @return True if the proposal is no longer active
     */
    function isResolved() public view returns (bool) {
        // Executed proposals are resolved
        if (executed) return true;
        
        // Check if proposal expired before election
        if (!electionTriggered && block.number >= createdAt + dao.maxProposalAge()) {
            return true;
        }
        
        // Check if election ended (whether executed or not)
        if (electionTriggered && block.number >= electionStart + dao.electionDuration()) {
            return true;
        }
        
        return false;
    }
    
    function __Proposal_init(
        MarketDAO _dao,
        string memory _description,
        address _proposer
    ) internal {
        require(!_initialized, "Already initialized");
        _initialized = true;
        dao = _dao;
        proposer = _proposer;
        description = _description;
        createdAt = block.number;
        // Note: Factory will call dao.setActiveProposal(address(this)) after initialization
    }
    
    function addSupport(uint256 amount) external onlyBeforeElection {
        // Check if proposal has expired
        require(
            block.number < createdAt + dao.maxProposalAge(),
            "Proposal expired"
        );

        // Require user to claim vested tokens before participating in governance
        require(!dao.hasClaimableVesting(msg.sender), "Must claim vested tokens first");

        uint256 availableBalance = dao.vestedBalance(msg.sender);
        require(
            availableBalance >= amount,
            "Insufficient vested governance tokens"
        );
        require(
            support[msg.sender] + amount <= availableBalance,
            "Cannot support more than vested governance tokens held"
        );

        // ============ H-03 FIX: Lock governance tokens ============
        // Lock the additional support amount
        dao.addGovernanceLock(msg.sender, amount);
        supportLocked[msg.sender] += amount;
        // ============ END H-03 FIX ============

        support[msg.sender] += amount;
        supportTotal += amount;

        if (canTriggerElection()) {
            _triggerElection();
        }
    }
    
    function removeSupport(uint256 amount) external onlyBeforeElection {
        // Check if proposal has expired
        require(
            block.number < createdAt + dao.maxProposalAge(),
            "Proposal expired"
        );

        require(support[msg.sender] >= amount, "Insufficient support to remove");

        support[msg.sender] -= amount;
        supportTotal -= amount;
        
        // ============ H-03 FIX: Unlock governance tokens ============
        // Unlock the removed support amount
        if (supportLocked[msg.sender] >= amount) {
            supportLocked[msg.sender] -= amount;
        } else {
            supportLocked[msg.sender] = 0;
        }
        dao.removeGovernanceLock(msg.sender, amount);
        // ============ END H-03 FIX ============
    }
    
    function canTriggerElection() public view returns (bool) {
        // Check if proposal has expired
        if (block.number >= createdAt + dao.maxProposalAge()) {
            return false;
        }
        // Use vested supply for consistency with quorum calculation
        // This ensures threshold is based on tokens that can actually vote
        uint256 threshold = (dao.getTotalVestedSupply() * dao.supportThreshold()) / 10000;
        return supportTotal >= threshold;
    }
    
    function _triggerElection() internal {
        electionTriggered = true;
        electionStart = block.number;
        votingTokenId = dao.getNextVotingTokenId();

        // Generate deterministic vote addresses with enhanced entropy
        // Using multiple sources makes collision virtually impossible:
        // - address(dao): Unique per DAO instance
        // - votingTokenId: Sequential per DAO
        // - proposer: Transaction sender
        // - description: Proposal details
        // - block.timestamp: Time of election trigger (cannot be predicted)
        // - block.number: Block height at trigger (cannot be predicted)
        // - address(this): Unique proposal contract address
        bytes32 salt = keccak256(abi.encodePacked(
            address(dao),
            votingTokenId,
            proposer,
            description,
            block.timestamp,
            block.number,
            address(this)
        ));
        yesVoteAddress = address(uint160(uint256(keccak256(
            abi.encodePacked(salt, "yes")
        ))));
        noVoteAddress = address(uint160(uint256(keccak256(
            abi.encodePacked(salt, "no")
        ))));

        // Register vote addresses with the DAO (includes collision check)
        dao.registerVoteAddress(yesVoteAddress);
        dao.registerVoteAddress(noVoteAddress);

        // Snapshot total possible votes at election start
        // Uses vested supply for O(1) calculation (unlimited scalability)
        // This ensures quorum only counts tokens that can actually vote
        snapshotTotalVotes = dao.getTotalVestedSupply();

        // No upfront minting - users claim voting tokens lazily

        // Lock funds if this is a treasury proposal
        _lockFunds();
    }

    // Virtual function for treasury proposals to lock funds
    function _lockFunds() internal virtual {
        // Default: do nothing (only TreasuryProposal needs to lock funds)
    }

    // Virtual function to unlock funds on failure
    function _unlockFunds() internal virtual {
        // Default: do nothing (only TreasuryProposal needs to unlock funds)
    }

    function claimVotingTokens() external onlyDuringElection {
        require(!hasClaimed[msg.sender], "Already claimed voting tokens");

        // Require user to claim vested tokens before participating in voting
        require(!dao.hasClaimableVesting(msg.sender), "Must claim vested tokens first");

        // Use vested balance at election start to prevent tokens vesting during election from inflating voting power
        uint256 vestedBal = dao.vestedBalanceAt(msg.sender, electionStart);
        require(vestedBal > 0, "No vested governance tokens to claim");

        hasClaimed[msg.sender] = true;
        
        // ============ H-04 FIX: Lock governance tokens ============
        // Lock the tokens being used for voting to prevent double-claiming via transfer
        dao.addGovernanceLock(msg.sender, vestedBal);
        votingLocked[msg.sender] = vestedBal;
        // ============ END H-04 FIX ============
        
        dao.mintVotingTokens(msg.sender, votingTokenId, vestedBal);
    }

    function getClaimableAmount(address holder) external view returns (uint256) {
        if (!electionTriggered) return 0;
        if (hasClaimed[holder]) return 0;
        if (block.number >= electionStart + dao.electionDuration()) return 0;
        return dao.vestedBalanceAt(holder, electionStart);
    }
    
    function checkEarlyTermination() external virtual {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(block.number >= electionStart, "Election not started");

        // Use snapshot taken at election start (gas optimization)
        uint256 totalPossibleVotes = snapshotTotalVotes;

        uint256 halfVotes = totalPossibleVotes / 2;

        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);

        // For early termination, we need a strict majority (> 50%)
        // For odd total votes, halfVotes + 1 is a majority
        // For even total votes, halfVotes + 1 is a majority
        uint256 majorityThreshold = halfVotes + 1;

        if(yesVotes >= majorityThreshold) {
            _execute();
        } else if(noVotes >= majorityThreshold) {
            // Proposal rejected by majority NO votes
            executed = true;
            electionStart = 0;
            _unlockFunds();
            dao.clearActiveProposal();
        }
    }
    
    function execute() external virtual {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(
            block.number >= electionStart + dao.electionDuration(),
            "Election still active"
        );

        // Use snapshot taken at election start (gas optimization)
        uint256 totalPossibleVotes = snapshotTotalVotes;

        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);
        uint256 totalVotes = yesVotes + noVotes;

        // Check quorum
        uint256 quorumRequired = (totalPossibleVotes * dao.quorumPercentage()) / 10000;
        require(totalVotes >= quorumRequired, "Quorum not met");

        // Check majority
        require(yesVotes > noVotes, "Proposal not passed");

        _execute();
    }

    function _execute() internal virtual {
        executed = true;
    }

    function failProposal() external virtual {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(
            block.number >= electionStart + dao.electionDuration(),
            "Election still active"
        );

        uint256 totalPossibleVotes = snapshotTotalVotes;

        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);
        uint256 totalVotes = yesVotes + noVotes;

        // Check if quorum was not met OR proposal was rejected
        uint256 quorumRequired = (totalPossibleVotes * dao.quorumPercentage()) / 10000;
        bool quorumNotMet = totalVotes < quorumRequired;
        bool rejected = yesVotes <= noVotes;

        require(quorumNotMet || rejected, "Proposal passed, cannot fail");

        executed = true;
        _unlockFunds();
        dao.clearActiveProposal();
    }
    
    // ============ H-03/H-04 FIX: User-initiated lock release ============
    
    /**
     * @notice Release all governance locks held by this proposal for the caller
     * @dev Can only be called after the proposal is resolved (executed, failed, or expired)
     *      This shifts gas cost to users who need to transfer, rather than iterating on resolution
     */
    function releaseProposalLocks() external {
        require(isResolved(), "Proposal not yet resolved");
        
        uint256 totalToUnlock = 0;
        
        // Release support lock
        if (supportLocked[msg.sender] > 0) {
            totalToUnlock += supportLocked[msg.sender];
            supportLocked[msg.sender] = 0;
        }
        
        // Release voting lock
        if (votingLocked[msg.sender] > 0) {
            totalToUnlock += votingLocked[msg.sender];
            votingLocked[msg.sender] = 0;
        }
        
        require(totalToUnlock > 0, "No locks to release");
        
        dao.removeGovernanceLock(msg.sender, totalToUnlock);
    }
    
    /**
     * @notice Get the total amount locked by this proposal for a user
     * @param user Address to check
     * @return Total locked amount (support + voting)
     */
    function getLockedAmount(address user) external view returns (uint256) {
        return supportLocked[user] + votingLocked[user];
    }
    
    // ============ END H-03/H-04 FIX ============
}
