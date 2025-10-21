// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Proposal.sol";

contract MarketDAO is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;
    string public name;
    uint256 public supportThreshold;        // basis points (10000 = 100%) needed to trigger election
    uint256 public quorumPercentage;        // basis points (10000 = 100%) needed for valid election
    uint256 public maxProposalAge;          // max age of proposal without election
    uint256 public electionDuration;        // length of election in blocks
    bool public allowMinting;               // whether new governance tokens can be minted
    uint256 public tokenPrice;              // price per token in wei (0 = direct sales disabled)
    
    uint256 private constant GOVERNANCE_TOKEN_ID = 0;
    uint256 private nextVotingTokenId = 1;
    uint256 private constant MAX_VESTING_SCHEDULES = 10;
    mapping(address => bool) public activeProposals;

    // Vesting configuration
    uint256 public vestingPeriod;  // vesting period in blocks

    struct VestingSchedule {
        uint256 amount;
        uint256 unlockBlock;
    }

    mapping(address => VestingSchedule[]) private vestingSchedules;
    
    // Vote address tracking
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
    
    constructor(
        string memory _name,
        uint256 _supportThreshold,
        uint256 _quorumPercentage,
        uint256 _maxProposalAge,
        uint256 _electionDuration,
        bool _allowMinting,
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
        allowMinting = _allowMinting;
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

    // Remove expired vesting schedules for gas optimization
    function _cleanupExpiredSchedules(address holder) internal {
        VestingSchedule[] storage schedules = vestingSchedules[holder];
        uint256 writeIndex = 0;

        // Copy only non-expired schedules
        for (uint256 readIndex = 0; readIndex < schedules.length; readIndex++) {
            if (block.number < schedules[readIndex].unlockBlock) {
                // Still locked, keep it
                if (writeIndex != readIndex) {
                    schedules[writeIndex] = schedules[readIndex];
                }
                writeIndex++;
            }
            // Expired schedules are skipped (deleted)
        }

        // Trim array to new size
        while (schedules.length > writeIndex) {
            schedules.pop();
        }
    }

    // Public function for users to manually cleanup their schedules
    function cleanupMyVestingSchedules() external {
        _cleanupExpiredSchedules(msg.sender);
    }

    // Cleanup function callable by active proposals or the holder themselves
    function cleanupVestingSchedules(address holder) external {
        require(
            msg.sender == holder || activeProposals[msg.sender],
            "Only holder or active proposal can cleanup"
        );
        _cleanupExpiredSchedules(holder);
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
            if (amount == 1) {
                require(acceptsERC721, "ERC721 not accepted");
                try IERC721(token).ownerOf(tokenId) returns (address owner) {
                    require(owner == address(this), "DAO does not own this ERC721 token");
                    require(!isERC721Locked(token, tokenId), "ERC721 token already locked");
                } catch {
                    revert("Invalid ERC721 token");
                }
            } else {
                require(acceptsERC1155, "ERC1155 not accepted");
                require(getAvailableERC1155(token, tokenId) >= amount, "Insufficient available ERC1155");
            }
        }

        // Lock the funds
        lockedFunds[msg.sender] = LockedFunds({
            token: token,
            tokenId: tokenId,
            amount: amount,
            lockedAt: block.number
        });

        lockedFundsIndex[msg.sender] = proposalsWithLockedFunds.length;
        proposalsWithLockedFunds.push(msg.sender);
    }

    // Unlock funds when proposal fails or completes
    function unlockFunds() external {
        require(activeProposals[msg.sender] || lockedFunds[msg.sender].amount > 0, "No locked funds or not active");

        if (lockedFunds[msg.sender].amount > 0) {
            // Remove from array using swap-and-pop
            uint256 index = lockedFundsIndex[msg.sender];
            address lastProposal = proposalsWithLockedFunds[proposalsWithLockedFunds.length - 1];

            proposalsWithLockedFunds[index] = lastProposal;
            lockedFundsIndex[lastProposal] = index;

            proposalsWithLockedFunds.pop();
            delete lockedFundsIndex[msg.sender];
            delete lockedFunds[msg.sender];
        }
    }

    // Try to release locked proposals when new funds arrive
    function _tryReleaseLockedProposals() internal {
        // Note: This is a simple implementation that doesn't actually release proposals
        // In a full implementation, we would track "waiting" proposals and check if they
        // can now be funded. For MVP, we'll keep this simple and let proposal creators
        // retry failed proposals manually.
    }

    function transferETH(address payable recipient, uint256 amount) external nonReentrant {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    function transferERC20(address token, address recipient, uint256 amount) external nonReentrant {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        IERC20(token).safeTransfer(recipient, amount);
    }

    function transferERC721(address token, address recipient, uint256 tokenId) external nonReentrant {
        require(activeProposals[msg.sender], "Only active proposal can transfer");
        IERC721(token).safeTransferFrom(address(this), recipient, tokenId);
    }

    function transferERC1155(address token, address recipient, uint256 tokenId, uint256 amount) external nonReentrant {
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

    function setFactory(address _factory) external {
        require(msg.sender == deployer, "Only deployer can set factory");
        require(factory == address(0), "Factory already set");
        require(_factory != address(0), "Invalid factory address");
        factory = _factory;
    }

    function setActiveProposal(address proposal) external {
        require(msg.sender == factory, "Only factory can register proposals");
        require(proposal != address(0), "Invalid proposal address");
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

    // Helper functions to calculate available (unlocked) balances

    function getTotalLockedETH() public view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < proposalsWithLockedFunds.length; i++) {
            address proposal = proposalsWithLockedFunds[i];
            if (lockedFunds[proposal].token == address(0)) {
                total += lockedFunds[proposal].amount;
            }
        }
        return total;
    }

    function getAvailableETH() public view returns (uint256) {
        uint256 totalLocked = getTotalLockedETH();
        uint256 balance = address(this).balance;
        return balance > totalLocked ? balance - totalLocked : 0;
    }

    function getTotalLockedERC20(address token) public view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < proposalsWithLockedFunds.length; i++) {
            address proposal = proposalsWithLockedFunds[i];
            LockedFunds memory locked = lockedFunds[proposal];
            if (locked.token == token && locked.tokenId == 0) {
                total += locked.amount;
            }
        }
        return total;
    }

    function getAvailableERC20(address token) public view returns (uint256) {
        uint256 totalLocked = getTotalLockedERC20(token);
        uint256 balance = IERC20(token).balanceOf(address(this));
        return balance > totalLocked ? balance - totalLocked : 0;
    }

    function isERC721Locked(address token, uint256 tokenId) public view returns (bool) {
        for (uint i = 0; i < proposalsWithLockedFunds.length; i++) {
            address proposal = proposalsWithLockedFunds[i];
            LockedFunds memory locked = lockedFunds[proposal];
            if (locked.token == token && locked.tokenId == tokenId && locked.amount == 1) {
                return true;
            }
        }
        return false;
    }

    function getTotalLockedERC1155(address token, uint256 tokenId) public view returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < proposalsWithLockedFunds.length; i++) {
            address proposal = proposalsWithLockedFunds[i];
            LockedFunds memory locked = lockedFunds[proposal];
            if (locked.token == token && locked.tokenId == tokenId && locked.amount > 1) {
                total += locked.amount;
            }
        }
        return total;
    }

    function getAvailableERC1155(address token, uint256 tokenId) public view returns (uint256) {
        uint256 totalLocked = getTotalLockedERC1155(token, tokenId);
        uint256 balance = IERC1155(token).balanceOf(address(this), tokenId);
        return balance > totalLocked ? balance - totalLocked : 0;
    }

    function getProposalsWithLockedFunds() external view returns (address[] memory) {
        return proposalsWithLockedFunds;
    }
}
