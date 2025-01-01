// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "forge-std/console.sol";

contract MarketDAO is ERC1155, Ownable {
    // Constants
    uint256 public constant GOVERNANCE_TOKEN_ID = 0;
    
    // ID trackers
    uint256 private _currentProposalId;
    uint256 private _currentElectionId;
    
    // Token tracking
    uint256 private _governanceTokenSupply;
    address[] private _holders;
    mapping(address => bool) private _isHolder;
    
    // DAO Parameters
    string public daoName;
    uint256 public supportThreshold; // percentage needed to trigger election
    uint256 public quorumPercentage;
    uint256 public proposalMaxAge;
    uint256 public electionDuration;
    
    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address mintTo;
        uint256 mintAmount;
        uint256 createdAt;
        uint256 supportCount;
        bool triggered;
        mapping(address => bool) supporters;
    }
    
    struct Election {
        uint256 id;
        uint256 proposalId;
        uint256 startTime;
        uint256 endTime;
        address yesVoteAddress;
        address noVoteAddress;
        uint256 totalVotingTokens;
        bool executed;
        uint256 votingTokenId;
    }
    
    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Election) public elections;
    
    // Events
    event HolderAdded(address holder);
    event HolderRemoved(address holder);
    event ProposalCreated(uint256 indexed proposalId, address proposer);
    event ProposalSupported(uint256 indexed proposalId, address supporter, uint256 supportCount, uint256 totalSupply);
    event ElectionStarted(uint256 indexed electionId, uint256 proposalId);
    event ElectionExecuted(uint256 indexed electionId, bool passed);
    
    constructor(
        string memory _daoName,
        uint256 _supportThreshold,
        uint256 _quorumPercentage,
        uint256 _proposalMaxAge,
        uint256 _electionDuration,
        string memory _uri
    ) ERC1155(_uri) Ownable(msg.sender) {
        daoName = _daoName;
        supportThreshold = _supportThreshold;
        quorumPercentage = _quorumPercentage;
        proposalMaxAge = _proposalMaxAge;
        electionDuration = _electionDuration;
    }

    function addHolder(address holder) internal {
        if (!_isHolder[holder]) {
            _holders.push(holder);
            _isHolder[holder] = true;
            emit HolderAdded(holder);
        }
    }

    function removeHolder(address holder) internal {
        if (_isHolder[holder]) {
            for (uint i = 0; i < _holders.length; i++) {
                if (_holders[i] == holder) {
                    _holders[i] = _holders[_holders.length - 1];
                    _holders.pop();
                    break;
                }
            }
            _isHolder[holder] = false;
            emit HolderRemoved(holder);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        _mint(to, GOVERNANCE_TOKEN_ID, amount, "");
        addHolder(to);
        _governanceTokenSupply += amount;
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal virtual override {
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] != GOVERNANCE_TOKEN_ID) continue;
            
            console.log("Processing transfer:");
            console.log("From:", from);
            console.log("To:", to);
            
            // Add new holder if receiving tokens
            if (to != address(0)) {
                addHolder(to);
            }
            
            // Remove holder if sending all tokens
            if (from != address(0)) {
                uint256 remainingBalance = balanceOf(from, GOVERNANCE_TOKEN_ID);
                if (remainingBalance == amounts[i]) { // Will have 0 after transfer
                    removeHolder(from);
                }
            }
        }
        
        super._update(from, to, ids, amounts);
    }

    function createProposal(
        string memory description,
        address mintTo,
        uint256 mintAmount
    ) external returns (uint256) {
        require(balanceOf(msg.sender, GOVERNANCE_TOKEN_ID) > 0, "Must hold governance tokens");
        require(bytes(description).length > 0, "Description required");
        
        if (mintAmount > 0) {
            require(mintTo != address(0), "Invalid mint address");
        }
        
        uint256 proposalId = _currentProposalId++;
        
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.description = description;
        newProposal.mintTo = mintTo;
        newProposal.mintAmount = mintAmount;
        newProposal.createdAt = block.timestamp;
        
        emit ProposalCreated(proposalId, msg.sender);
        
        return proposalId;
    }
    
    function supportProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.supporters[msg.sender], "Already supported");
        require(!proposal.triggered, "Already triggered");
        require(
            block.timestamp <= proposal.createdAt + proposalMaxAge,
            "Proposal expired"
        );
        
        uint256 supporterBalance = balanceOf(msg.sender, GOVERNANCE_TOKEN_ID);
        require(supporterBalance > 0, "Must hold governance tokens");
        
        proposal.supporters[msg.sender] = true;
        proposal.supportCount += supporterBalance;
        
        emit ProposalSupported(proposalId, msg.sender, proposal.supportCount, _governanceTokenSupply);
        
        // Check if we have enough support to trigger election
        if (proposal.supportCount * 100 >= _governanceTokenSupply * supportThreshold) {
            _triggerElection(proposalId);
        }
    }
    
    function _triggerElection(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.triggered, "Already triggered");
        
        uint256 electionId = _currentElectionId++;
        
        // Create unique addresses for yes and no votes
        // In practice, these would be deterministic contract addresses
        address yesAddress = address(uint160(uint256(keccak256(abi.encodePacked("yes", electionId)))));
        address noAddress = address(uint160(uint256(keccak256(abi.encodePacked("no", electionId)))));
        
        uint256 votingTokenId = electionId + 1000; // Offset to avoid collision with governance token
        
        Election storage newElection = elections[electionId];
        newElection.id = electionId;
        newElection.proposalId = proposalId;
        newElection.startTime = block.timestamp;
        newElection.endTime = block.timestamp + electionDuration;
        newElection.yesVoteAddress = yesAddress;
        newElection.noVoteAddress = noAddress;
        newElection.votingTokenId = votingTokenId;
        
        // Mint voting tokens to all governance token holders
        uint256 totalVotingTokens = 0;
        for (uint256 i = 0; i < _holders.length; i++) {
            uint256 balance = balanceOf(_holders[i], GOVERNANCE_TOKEN_ID);
            if (balance > 0) {
                _mint(_holders[i], votingTokenId, balance, "");
                totalVotingTokens += balance;
            }
        }
        
        newElection.totalVotingTokens = totalVotingTokens;
        proposal.triggered = true;
        
        emit ElectionStarted(electionId, proposalId);
    }

    function executeElection(uint256 electionId) external {
        Election storage election = elections[electionId];
        require(!election.executed, "Election already executed");
        require(hasElectionPassed(electionId), "Election has not passed");
        
        Proposal storage proposal = proposals[election.proposalId];
        
        // If proposal includes token minting, do it
        if (proposal.mintAmount > 0 && proposal.mintTo != address(0)) {
            _mint(proposal.mintTo, GOVERNANCE_TOKEN_ID, proposal.mintAmount, "");
            addHolder(proposal.mintTo);
            _governanceTokenSupply += proposal.mintAmount;
        }
        
        election.executed = true;
        emit ElectionExecuted(electionId, true);
    }

    function hasElectionPassed(uint256 electionId) public view returns (bool) {
        Election storage election = elections[electionId];
        require(election.startTime > 0, "Election does not exist");
        
        uint256 yesVotes = balanceOf(election.yesVoteAddress, election.votingTokenId);
        uint256 noVotes = balanceOf(election.noVoteAddress, election.votingTokenId);
        uint256 totalVotesCast = yesVotes + noVotes;
        
        // During the election, only pass by early victory
        if (block.timestamp <= election.endTime) {
            return yesVotes * 2 > election.totalVotingTokens;
        }
        
        // After the election ends, check quorum and majority
        if (totalVotesCast * 100 < election.totalVotingTokens * quorumPercentage) {
            return false;
        }
        
        return yesVotes > noVotes;
    }

    function _getGovernanceTokenHolders() public view returns (address[] memory) {
        return _holders;
    }
}
