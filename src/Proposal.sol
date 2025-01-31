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
    
    constructor(
        MarketDAO _dao,
        string memory _description
    ) {
        dao = _dao;
        proposer = msg.sender;
        description = _description;
        createdAt = block.number;
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
        
        // Mint voting tokens to all governance token holders
        address[] memory holders = dao.getGovernanceTokenHolders();
        for(uint i = 0; i < holders.length; i++) {
            uint256 balance = dao.balanceOf(holders[i], 0);
            if(balance > 0) {
                dao.mintVotingTokens(holders[i], votingTokenId, balance);
            }
        }
    }
    
    function _checkEarlyTermination() internal {
        uint256 totalVotes = dao.totalSupply(votingTokenId);
        uint256 halfVotes = totalVotes / 2;
        
        uint256 yesVotes = dao.balanceOf(yesVoteAddress, votingTokenId);
        uint256 noVotes = dao.balanceOf(noVoteAddress, votingTokenId);
        
        if(yesVotes > halfVotes) {
            _execute();
        } else if(noVotes > halfVotes) {
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
    
    // To be implemented by specific proposal types
    function _execute() internal virtual;
}
