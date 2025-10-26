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
    
    constructor(
        MarketDAO _dao,
        string memory _description
    ) {
        dao = _dao;
        proposer = msg.sender;
        description = _description;
        createdAt = block.number;
        // Note: Factory will call dao.setActiveProposal(address(this)) after construction
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
        require(block.number < electionStart + dao.electionDuration(), "Election ended");

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
    
    function execute() external {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(
            block.number >= electionStart + dao.electionDuration(),
            "Election still ongoing"
        );

        // Use snapshot taken at election start (gas optimization)
        uint256 totalPossibleVotes = snapshotTotalVotes;

        uint256 quorum = (totalPossibleVotes * dao.quorumPercentage()) / 10000;
        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);

        // Check if quorum was met and proposal passed
        require(yesVotes + noVotes >= quorum, "Quorum not met");
        require(yesVotes > noVotes, "Proposal not passed");

        // Proposal passed - execute it
        _execute();
    }

    // Allow anyone to explicitly fail a proposal after election ends
    function failProposal() external {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(
            block.number >= electionStart + dao.electionDuration(),
            "Election still ongoing"
        );

        // Use snapshot taken at election start (gas optimization)
        uint256 totalPossibleVotes = snapshotTotalVotes;

        uint256 quorum = (totalPossibleVotes * dao.quorumPercentage()) / 10000;
        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);

        // Verify proposal actually failed
        require(
            (yesVotes + noVotes < quorum) || (yesVotes <= noVotes),
            "Proposal did not fail"
        );

        // Mark as executed (failed) and unlock funds
        executed = true;
        _unlockFunds();
        dao.clearActiveProposal();
    }
    
    function _execute() internal virtual {
        require(!executed, "Already executed");
        // We don't set executed=true here as it's done in the derived classes
    }
}
