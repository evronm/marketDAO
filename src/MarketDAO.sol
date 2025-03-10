// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Proposal.sol";

contract MarketDAO is ERC1155, ReentrancyGuard {
    string public name;
    uint256 public supportThreshold;        // percentage needed to trigger election
    uint256 public quorumPercentage;        // percentage needed for valid election
    uint256 public maxProposalAge;          // max age of proposal without election
    uint256 public electionDuration;        // length of election in blocks
    bool public allowMinting;               // whether new governance tokens can be minted
    uint256 public tokenPrice;              // price per token in wei (0 = direct sales disabled)
    
    uint256 private constant GOVERNANCE_TOKEN_ID = 0;
    uint256 private nextVotingTokenId = 1;
    mapping(address => bool) public activeProposals;
    
    // Vote address tracking
    mapping(address => bool) public isVoteAddress;
    mapping(address => address) public voteAddressToProposal;
    
    // Treasury configuration
    bool public hasTreasury;
    bool public acceptsETH;
    bool public acceptsERC20;
    bool public acceptsERC721;
    bool public acceptsERC1155;

    // Governance token holder tracking
    address[] private governanceTokenHolders;
    mapping(address => bool) private isGovernanceTokenHolder;
    mapping(uint256 => uint256) private tokenSupply;
    
    constructor(
        string memory _name,
        uint256 _supportThreshold,
        uint256 _quorumPercentage,
        uint256 _maxProposalAge,
        uint256 _electionDuration,
        bool _allowMinting,
        uint256 _tokenPrice,
        string[] memory _treasuryConfig,
        address[] memory _initialHolders,
        uint256[] memory _initialAmounts
    ) ERC1155("") {  // URI will be set later if needed
        require(_supportThreshold <= 100, "Support threshold must be <= 100");
        require(_quorumPercentage <= 100, "Quorum must be <= 100");
        require(_initialHolders.length == _initialAmounts.length, "Arrays length mismatch");
        
        name = _name;
        supportThreshold = _supportThreshold;
        quorumPercentage = _quorumPercentage;
        maxProposalAge = _maxProposalAge;
        electionDuration = _electionDuration;
        allowMinting = _allowMinting;
        tokenPrice = _tokenPrice;
        
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
    
    // Direct token purchase function
    function purchaseTokens() external payable nonReentrant {
        require(tokenPrice > 0, "Direct token sales disabled");
        require(msg.value > 0, "Payment required");
        require(msg.value % tokenPrice == 0, "Payment must be multiple of token price");
        
        uint256 tokenAmount = msg.value / tokenPrice;
        _mint(msg.sender, GOVERNANCE_TOKEN_ID, tokenAmount, "");
        tokenSupply[GOVERNANCE_TOKEN_ID] += tokenAmount;
        _addGovernanceTokenHolder(msg.sender);
    }
    
    // Treasury functions
    receive() external payable {
        require(acceptsETH, "DAO does not accept ETH");
    }

    function transferETH(address payable recipient, uint256 amount) external nonReentrant {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        recipient.transfer(amount);
    }
    
    // Override ERC1155 transfer functions to handle voting tokens
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(
            id == GOVERNANCE_TOKEN_ID || _isActiveVotingToken(id),
            "Invalid token transfer"
        );
        
        // Add check for vote transfers to ensure election is still active
        if (_isActiveVotingToken(id) && msg.sender == from) {
            // Check if destination is a registered vote address
            if (isVoteAddress[to]) {
                // Get the associated proposal
                address proposalAddr = voteAddressToProposal[to];
                
                // Check if the election is still active
                if (proposalAddr != address(0) && activeProposals[proposalAddr]) {
                    try Proposal(proposalAddr).isElectionActive() returns (bool isActive) {
                        if (!isActive) {
                            revert("Election has ended");
                        }
                        // Check for early termination after vote
                        try Proposal(proposalAddr).checkEarlyTermination() {} catch {}
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
    ) public virtual override {
        for(uint i = 0; i < ids.length; i++) {
            require(
                ids[i] == GOVERNANCE_TOKEN_ID || _isActiveVotingToken(ids[i]),
                "Invalid token transfer"
            );
            
            // Add check for vote transfers to ensure election is still active
            if (_isActiveVotingToken(ids[i]) && msg.sender == from) {
                // Check if destination is a registered vote address
                if (isVoteAddress[to]) {
                    // Get the associated proposal
                    address proposalAddr = voteAddressToProposal[to];
                    
                    // Check if the election is still active
                    if (proposalAddr != address(0) && activeProposals[proposalAddr]) {
                        try Proposal(proposalAddr).isElectionActive() returns (bool isActive) {
                            if (!isActive) {
                                revert("Election has ended");
                            }
                            // Check for early termination after vote
                            try Proposal(proposalAddr).checkEarlyTermination() {} catch {}
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
            governanceTokenHolders.push(holder);
        }
    }
    
    function _removeGovernanceTokenHolder(address holder) private {
        if(isGovernanceTokenHolder[holder]) {
            isGovernanceTokenHolder[holder] = false;
            for(uint i = 0; i < governanceTokenHolders.length; i++) {
                if(governanceTokenHolders[i] == holder) {
                    governanceTokenHolders[i] = governanceTokenHolders[governanceTokenHolders.length - 1];
                    governanceTokenHolders.pop();
                    break;
                }
            }
        }
    }
    
    // Internal helper to check if a token ID is an active voting token
    function _isActiveVotingToken(uint256 tokenId) internal view returns (bool) {
        // Check if the token ID is in the valid range for voting tokens
        return tokenId > GOVERNANCE_TOKEN_ID && tokenId < nextVotingTokenId;
    }
    
    // This function is no longer needed as the check is implemented directly in safeTransferFrom
    /* 
    function _isValidVoteTransfer(address from, address to, uint256 tokenId) internal view returns (bool) {
        // If it's not a voting token, or it's not a user-initiated transfer, allow it
        if (!_isActiveVotingToken(tokenId) || from == address(0) || to == address(0)) {
            return true;
        }
        
        // Check all active proposals to see if this is a vote transfer
        for (uint i = 0; i < governanceTokenHolders.length; i++) {
            address proposalAddr = governanceTokenHolders[i]; // Reusing the holders array to avoid creating a new array
            if (activeProposals[proposalAddr]) {
                try Proposal(proposalAddr).isVoteAddress(to) returns (bool isVoteAddr) {
                    if (isVoteAddr) {
                        // This is a vote transfer to an active proposal's vote address
                        // Check if the election is still active
                        try Proposal(proposalAddr).isElectionActive() returns (bool isActive) {
                            if (isActive) {
                                return true; // Valid vote during an active election
                            }
                        } catch {
                            // Ignore errors and continue checking
                        }
                    }
                } catch {
                    // Ignore errors and continue checking
                }
            }
        }
        
        // If we're transferring to what looks like a vote address, but couldn't verify it's for an active election,
        // default to allowing the transfer - user may be sending tokens for another purpose
        return true;
    }
    */
    
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
        require(allowMinting, "Minting not allowed");
        _mint(to, GOVERNANCE_TOKEN_ID, amount, "");
        _addGovernanceTokenHolder(to);
        tokenSupply[GOVERNANCE_TOKEN_ID] += amount;
    }

    function setTokenPrice(uint256 newPrice) external {
        require(activeProposals[msg.sender], "Only active proposal can set price");
        tokenPrice = newPrice;
    }

    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return tokenSupply[tokenId];
    }

    function getGovernanceTokenHolders() external view returns (address[] memory) {
        return governanceTokenHolders;
    }

    function setActiveProposal(address proposal) external {
        // Only allow this function to be called from a contract that's being constructed
        // by checking if the caller's code size is 0 (it's still being created)
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(caller())
        }
        require(codeSize == 0, "Only contracts being deployed can call this");
        activeProposals[proposal] = true;
    }

    function clearActiveProposal() external {
        require(activeProposals[msg.sender], "Only active proposal can clear itself");
        activeProposals[msg.sender] = false;
    }
    
    function registerVoteAddress(address voteAddr) external {
        require(activeProposals[msg.sender], "Only active proposal can register vote address");
        isVoteAddress[voteAddr] = true;
        voteAddressToProposal[voteAddr] = msg.sender;
    }
    
    // Helper function to check if a proposal is active
    function isProposalActive(address proposal) external view returns (bool) {
        return activeProposals[proposal];
    }
    
    // Helper function to get a proposal address by index from the ProposalFactory
    function getProposal(uint256 index) external virtual view returns (address) {
        // In a real implementation, this would fetch from the ProposalFactory
        // For testing purposes, we'll just return address(0) if not found
        return address(0);
    }
}
