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
        dao.setActiveProposal(address(this));
    }
    
    function addSupport(uint256 amount) external onlyBeforeElection {
        require(
            dao.balanceOf(msg.sender, 0) >= amount,
            "Insufficient governance tokens"
        );
        require(
            support[msg.sender] + amount <= dao.balanceOf(msg.sender, 0),
            "Cannot support more than governance tokens held"
        );
        
        support[msg.sender] += amount;
        supportTotal += amount;
        
        if (canTriggerElection()) {
            _triggerElection();
        }
    }
    
    function removeSupport(uint256 amount) external onlyBeforeElection {
        require(support[msg.sender] >= amount, "Insufficient support to remove");
        
        support[msg.sender] -= amount;
        supportTotal -= amount;
    }
    
    function canTriggerElection() public view returns (bool) {
        uint256 threshold = (dao.totalSupply(0) * dao.supportThreshold()) / 100;
        return supportTotal >= threshold;
    }
    
    function _triggerElection() internal {
        electionTriggered = true;
        electionStart = block.number;
        votingTokenId = dao.getNextVotingTokenId();
        
        // Generate deterministic vote addresses
        bytes32 salt = keccak256(abi.encodePacked(
            votingTokenId,
            proposer,
            description
        ));
        yesVoteAddress = address(uint160(uint256(keccak256(
            abi.encodePacked(salt, "yes")
        ))));
        noVoteAddress = address(uint160(uint256(keccak256(
            abi.encodePacked(salt, "no")
        ))));
        
        // Register vote addresses with the DAO
        dao.registerVoteAddress(yesVoteAddress);
        dao.registerVoteAddress(noVoteAddress);
        
        // Mint voting tokens to all governance token holders
        address[] memory holders = dao.getGovernanceTokenHolders();
        for(uint i = 0; i < holders.length; i++) {
            uint256 balance = dao.balanceOf(holders[i], 0);
            if(balance > 0) {
                dao.mintVotingTokens(holders[i], votingTokenId, balance);
            }
        }
    }
    
    function checkEarlyTermination() external virtual {
        require(electionTriggered, "Election not triggered");
        require(!executed, "Already executed");
        require(block.number >= electionStart, "Election not started");
        require(block.number < electionStart + dao.electionDuration(), "Election ended");
        
        uint256 totalVotes = dao.totalSupply(votingTokenId);
        uint256 halfVotes = totalVotes / 2;
        
        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);
        
        // For early termination, we need a strict majority (> 50%)
        // For odd total votes, halfVotes + 1 is a majority
        // For even total votes, halfVotes + 1 is a majority
        uint256 majorityThreshold = halfVotes + 1;
        
        if(yesVotes >= majorityThreshold) {
            _execute();
        } else if(noVotes >= majorityThreshold) {
            electionStart = 0; // End election
        }
    }
    
    function execute() external {
        require(electionTriggered, "Election not triggered");
        require(
            block.number >= electionStart + dao.electionDuration(),
            "Election still ongoing"
        );
        
        uint256 totalVotes = dao.totalSupply(votingTokenId);
        uint256 quorum = (totalVotes * dao.quorumPercentage()) / 100;
        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);
        
        require(yesVotes + noVotes >= quorum, "Quorum not met");
        require(yesVotes > noVotes, "Proposal not passed");
        
        _execute();
    }
    
    function _execute() internal virtual {
        require(!executed, "Already executed");
        // We don't set executed=true here as it's done in the derived classes
    }
}
