// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
    address public activeProposal;
    
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
    
    // Rest of the contract remains unchanged... 
    // Treasury functions
    receive() external payable {
        require(acceptsETH, "DAO does not accept ETH");
    }

    function transferETH(address payable recipient, uint256 amount) external {
        require(msg.sender == activeProposal, "Only active proposal can transfer");
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
        // TODO: Implement check against active elections
        return tokenId > GOVERNANCE_TOKEN_ID && tokenId < nextVotingTokenId;
    }
    
    function getNextVotingTokenId() external returns (uint256) {
        return nextVotingTokenId++;
    }

    function mintVotingTokens(address to, uint256 tokenId, uint256 amount) external {
        require(msg.sender == activeProposal, "Only active proposal can mint");
        _mint(to, tokenId, amount, "");
        tokenSupply[tokenId] += amount;
    }
    
    function mintGovernanceTokens(address to, uint256 amount) external {
        require(msg.sender == activeProposal, "Only active proposal can mint");
        require(allowMinting, "Minting not allowed");
        _mint(to, GOVERNANCE_TOKEN_ID, amount, "");
        _addGovernanceTokenHolder(to);
        tokenSupply[GOVERNANCE_TOKEN_ID] += amount;
    }

    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return tokenSupply[tokenId];
    }

    function getGovernanceTokenHolders() external view returns (address[] memory) {
        return governanceTokenHolders;
    }

    function setActiveProposal(address proposal) external {
        require(activeProposal == address(0), "Proposal already active");
        activeProposal = proposal;
    }

    function clearActiveProposal() external {
        require(msg.sender == activeProposal, "Only active proposal can clear");
        activeProposal = address(0);
    }
}
