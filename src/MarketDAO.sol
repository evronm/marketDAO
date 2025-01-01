// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MarketDAO is ERC1155 {
    using Counters for Counters.Counter;

    // Constants
    uint256 public constant GOVERNANCE_TOKEN_ID = 0;
    
    // Counters
    Counters.Counter private _electionIds;
    Counters.Counter private _proposalIds;

    // DAO Parameters
    string public name;
    uint256 public supportThreshold; // Percentage (1-100) needed for proposal to become election
    uint256 public quorumPercentage; // Percentage (1-100) needed for valid election
    uint256 public electionDelay; // Time between proposal support and election start
    uint256 public electionDuration; // Length of election period

    // Structures
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        address tokenRecipient;
        uint256 tokenAmount;
        uint256 supportCount;
        bool executed;
        mapping(address => bool) supporters;
    }

    struct Election {
        uint256 id;
        uint256 proposalId;
        uint256 votingTokenId;
        uint256 startTime;
        uint256 endTime;
        address yesAddress;
        address noAddress;
        bool executed;
        mapping(address => uint256) votingTokensIssued;
    }

    // Storage
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Election) public elections;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, bool isTokenProposal);
    event ProposalSupported(uint256 indexed proposalId, address indexed supporter);
    event ElectionStarted(uint256 indexed electionId, uint256 indexed proposalId);
    event VoteCast(uint256 indexed electionId, address indexed voter, bool support, uint256 amount);
    event ElectionExecuted(uint256 indexed electionId, bool passed);

    constructor(
        string memory _name,
        uint256 _supportThreshold,
        uint256 _quorumPercentage,
        uint256 _electionDelay,
        uint256 _electionDuration,
        string memory _uri
    ) ERC1155(_uri) {
        name = _name;
        supportThreshold = _supportThreshold;
        quorumPercentage = _quorumPercentage;
        electionDelay = _electionDelay;
        electionDuration = _electionDuration;
    }

    function createProposal(
        string calldata _description,
        address _tokenRecipient,
        uint256 _tokenAmount
    ) external returns (uint256) {
        require(balanceOf(msg.sender, GOVERNANCE_TOKEN_ID) > 0, "Must hold governance tokens");
        
        // Validate proposal parameters
        bool isTokenProposal = _tokenAmount > 0;
        if (isTokenProposal) {
            require(_tokenRecipient != address(0), "Invalid recipient address");
        } else {
            require(bytes(_description).length > 0, "Description required for text proposals");
            require(_tokenRecipient == address(0), "Token recipient should be zero for text proposals");
        }
        
        uint256 newProposalId = _proposalIds.current();
        _proposalIds.increment();

        Proposal storage newProposal = proposals[newProposalId];
        newProposal.id = newProposalId;
        newProposal.proposer = msg.sender;
        newProposal.description = _description;
        newProposal.tokenRecipient = _tokenRecipient;
        newProposal.tokenAmount = _tokenAmount;
        
        emit ProposalCreated(newProposalId, msg.sender, isTokenProposal);
        
        return newProposalId;
    }

    function supportProposal(uint256 _proposalId) external {
        require(balanceOf(msg.sender, GOVERNANCE_TOKEN_ID) > 0, "Must hold governance tokens");
        require(!proposals[_proposalId].supporters[msg.sender], "Already supported");
        
        Proposal storage proposal = proposals[_proposalId];
        proposal.supporters[msg.sender] = true;
        proposal.supportCount += balanceOf(msg.sender, GOVERNANCE_TOKEN_ID);
        
        emit ProposalSupported(_proposalId, msg.sender);
        
        // Check if proposal should become an election
        if (_shouldCreateElection(proposal)) {
            _createElection(_proposalId);
        }
    }

    function _shouldCreateElection(Proposal storage proposal) internal view returns (bool) {
        uint256 totalSupply = totalSupply(GOVERNANCE_TOKEN_ID);
        return (proposal.supportCount * 100) / totalSupply >= supportThreshold;
    }

    function _createElection(uint256 _proposalId) internal {
        uint256 newElectionId = _electionIds.current();
        _electionIds.increment();

        Election storage newElection = elections[newElectionId];
        newElection.id = newElectionId;
        newElection.proposalId = _proposalId;
        newElection.startTime = block.timestamp + electionDelay;
        newElection.endTime = newElection.startTime + electionDuration;
        
        // Create voting addresses
        // Note: In production we'd want to use CREATE2 or a more sophisticated method
        newElection.yesAddress = address(uint160(uint256(keccak256(abi.encodePacked("yes", newElectionId)))));
        newElection.noAddress = address(uint160(uint256(keccak256(abi.encodePacked("no", newElectionId)))));
        
        newElection.votingTokenId = _electionIds.current() + 1;
        _electionIds.increment();

        // Distribute voting tokens to all governance token holders
        address[] memory holders = _getGovernanceTokenHolders(); // This needs to be implemented
        for (uint i = 0; i < holders.length; i++) {
            uint256 governanceBalance = balanceOf(holders[i], GOVERNANCE_TOKEN_ID);
            if (governanceBalance > 0) {
                _mint(holders[i], votingTokenId, governanceBalance, "");
                newElection.votingTokensIssued[holders[i]] = governanceBalance;
            }
        }
        
        emit ElectionStarted(newElectionId, _proposalId);
    }

    function executeElection(uint256 _electionId) external {
        Election storage election = elections[_electionId];
        require(!election.executed, "Election already executed");
        require(block.timestamp > election.endTime, "Election still ongoing");
        
        uint256 votingTokenId = election.votingTokenId;
        uint256 yesVotes = balanceOf(election.yesAddress, votingTokenId);
        uint256 noVotes = balanceOf(election.noAddress, votingTokenId);
        uint256 totalVotes = yesVotes + noVotes;
        
        // Check quorum
        uint256 totalPossibleVotes = totalSupply(GOVERNANCE_TOKEN_ID);
        require((totalVotes * 100) / totalPossibleVotes >= quorumPercentage, "Quorum not reached");
        
        // Mark as executed
        election.executed = true;
        
        // If this is a token proposal, mint tokens if passed
        if (yesVotes > noVotes) {
            Proposal storage proposal = proposals[election.proposalId];
            if (proposal.tokenAmount > 0) {
                _mint(proposal.tokenRecipient, GOVERNANCE_TOKEN_ID, proposal.tokenAmount, "");
            }
        }
        
        // Zero out all voting tokens except those at yes/no addresses
        address[] memory holders = _getGovernanceTokenHolders(); // Need to implement this
        for (uint i = 0; i < holders.length; i++) {
            if (holders[i] != election.yesAddress && holders[i] != election.noAddress) {
                uint256 balance = balanceOf(holders[i], votingTokenId);
                if (balance > 0) {
                    _burn(holders[i], votingTokenId, balance);
                }
            }
        }
        
        emit ElectionExecuted(_electionId, yesVotes > noVotes);
    }
    
    // Helper function to get governance token holders
    // This needs a proper implementation - possibly through events or a separate mapping
    function _getGovernanceTokenHolders() internal view returns (address[] memory) {
        // Implementation needed
    }
}
