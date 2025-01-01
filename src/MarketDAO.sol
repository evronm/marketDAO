// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MarketDAO is ERC1155, Ownable {
    // Constants
    uint256 public constant GOVERNANCE_TOKEN_ID = 0;
    
    // ID trackers
    uint256 private _currentProposalId;
    uint256 private _currentElectionId;
    
    // Token tracking
    uint256 private _governanceTokenSupply;
    address[] private _holders;
    
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

    // Mint function for initial token distribution
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, GOVERNANCE_TOKEN_ID, amount, "");
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

        uint256 currentSupply = _governanceTokenSupply;
        emit ProposalSupported(proposalId, msg.sender, proposal.supportCount, currentSupply);
        
        // Check if we have enough support to trigger election
        // supportThreshold is in percentage points, so 30 means 30%
        if (proposal.supportCount * 100 >= currentSupply * supportThreshold) {
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
        address[] memory holders = _getGovernanceTokenHolders();
        uint256 totalVotingTokens = 0;
        
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 balance = balanceOf(holders[i], GOVERNANCE_TOKEN_ID);
            if (balance > 0) {
                _mint(holders[i], votingTokenId, balance, "");
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

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal virtual override {        
        super._update(from, to, ids, amounts);
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] != GOVERNANCE_TOKEN_ID) continue;
            
            // Update total supply for mints and burns
            if (from == address(0)) {  // mint
                _governanceTokenSupply += amounts[i];
            }
            if (to == address(0)) {    // burn
                _governanceTokenSupply -= amounts[i];
            }
            
            // Add new holder if receiving tokens
            if (to != address(0) && balanceOf(to, GOVERNANCE_TOKEN_ID) == 0) {
                _holders.push(to);
            }
            
            // Remove holder if sending all tokens
            if (from != address(0) && from != to) {  // Skip on mints and self-transfers
                uint256 remainingBalance = balanceOf(from, GOVERNANCE_TOKEN_ID) - amounts[i];
                if (remainingBalance == 0) {
                    for (uint256 j = 0; j < _holders.length; j++) {
                        if (_holders[j] == from) {
                            _holders[j] = _holders[_holders.length - 1];
                            _holders.pop();
                            break;
                        }
                    }
                }
            }
        }
    }

    function totalSupply(uint256 id) public view returns (uint256) {
        require(id == GOVERNANCE_TOKEN_ID, "Only governance token has tracked supply");
        return _governanceTokenSupply;
    }

    function _getGovernanceTokenHolders() internal view returns (address[] memory) {
        return _holders;
    }
}
