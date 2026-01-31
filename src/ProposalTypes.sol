// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";
import "./DistributionRedemption.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/**
 * @notice DEPRECATED: Use GenericProposal with empty data instead
 * @dev Resolution: factory.createProposal("Description", address(dao), 0, "")
 */
contract ResolutionProposal is Proposal {
    function initialize(
        MarketDAO,
        string memory,
        address
    ) external pure {
        revert("Deprecated: Use GenericProposal with empty data for Resolution proposals");
    }
}

/**
 * @notice DEPRECATED: Use GenericProposal with appropriate calldata instead
 * @dev Examples:
 *      ETH:     factory.createProposal("Send ETH", address(dao), 0, abi.encodeWithSelector(dao.transferETH.selector, recipient, amount))
 *      ERC20:   factory.createProposal("Send tokens", address(dao), 0, abi.encodeWithSelector(dao.transferERC20.selector, token, recipient, amount))
 *      ERC721:  factory.createProposal("Send NFT", address(dao), 0, abi.encodeWithSelector(dao.transferERC721.selector, token, recipient, tokenId))
 *      ERC1155: factory.createProposal("Send ERC1155", address(dao), 0, abi.encodeWithSelector(dao.transferERC1155.selector, token, recipient, tokenId, amount))
 */
contract TreasuryProposal is Proposal {
    function initialize(
        MarketDAO,
        string memory,
        address,
        address,
        uint256,
        address,
        uint256
    ) external pure {
        revert("Deprecated: Use GenericProposal with transferETH/ERC20/ERC721/ERC1155 calldata");
    }
}

/**
 * @notice DEPRECATED: Use GenericProposal with mintGovernanceTokens calldata instead
 * @dev Mint: factory.createProposal("Mint tokens", address(dao), 0, abi.encodeWithSelector(dao.mintGovernanceTokens.selector, recipient, amount))
 */
contract MintProposal is Proposal {
    function initialize(
        MarketDAO,
        string memory,
        address,
        address,
        uint256
    ) external pure {
        revert("Deprecated: Use GenericProposal with mintGovernanceTokens calldata");
    }
}

/**
 * @notice DEPRECATED: Use GenericProposal with appropriate setter calldata instead
 * @dev Examples:
 *      Support threshold: factory.createProposal("Change threshold", address(dao), 0, abi.encodeWithSelector(dao.setSupportThreshold.selector, newValue))
 *      Quorum:           factory.createProposal("Change quorum", address(dao), 0, abi.encodeWithSelector(dao.setQuorumPercentage.selector, newValue))
 *      Proposal age:     factory.createProposal("Change age", address(dao), 0, abi.encodeWithSelector(dao.setMaxProposalAge.selector, newValue))
 *      Election period:  factory.createProposal("Change duration", address(dao), 0, abi.encodeWithSelector(dao.setElectionDuration.selector, newValue))
 *      Vesting period:   factory.createProposal("Change vesting", address(dao), 0, abi.encodeWithSelector(dao.setVestingPeriod.selector, newValue))
 *      Token price:      factory.createProposal("Change price", address(dao), 0, abi.encodeWithSelector(dao.setTokenPrice.selector, newValue))
 *      Flags:            factory.createProposal("Change flags", address(dao), 0, abi.encodeWithSelector(dao.setFlags.selector, newValue))
 */
contract ParameterProposal is Proposal {
    // Keep enum for backwards compatibility (tests may reference it)
    enum ParameterType {
        SupportThreshold,
        QuorumPercentage,
        MaxProposalAge,
        ElectionDuration,
        VestingPeriod,
        TokenPrice,
        Flags
    }

    function initialize(
        MarketDAO,
        string memory,
        address,
        ParameterType,
        uint256
    ) external pure {
        revert("Deprecated: Use GenericProposal with setSupportThreshold/setQuorum/etc calldata");
    }
}

contract DistributionProposal is Proposal {
    address public token;
    uint256 public tokenId;
    uint256 public amountPerGovernanceToken;
    uint256 public totalAmount;
    DistributionRedemption public redemptionContract;

    // Events
    event RedemptionContractDeployed(address indexed redemptionContract);
    event UserRegisteredForDistribution(address indexed user, uint256 governanceTokenBalance);

    // Errors
    error RedemptionNotDeployed();
    error ElectionNotTriggered();

    // Override to lock funds and deploy redemption contract when election is triggered
    function _lockFunds() internal override {
        dao.lockFunds(token, tokenId, totalAmount);

        // ============ H-02 FIX: Deploy redemption contract with DAO reference ============
        // Pass the DAO address so the redemption contract can manage distribution locks
        redemptionContract = new DistributionRedemption(
            address(this),
            address(dao),  // NEW: Pass DAO for locking mechanism
            token,
            tokenId,
            amountPerGovernanceToken
        );

        // Set this redemption contract as the active one in the DAO
        // This authorizes it to call lockForDistribution/unlockForDistribution
        dao.setActiveRedemptionContract(address(redemptionContract));
        // ============ END H-02 FIX ============

        emit RedemptionContractDeployed(address(redemptionContract));
    }

    // Override to unlock funds when proposal fails
    function _unlockFunds() internal override {
        dao.unlockFunds();
        
        // ============ H-02 FIX: Clear redemption contract on failure ============
        // Allow users to release their locks via the redemption contract
        // The redemption contract's releaseLock() will check if proposal is no longer active
        // ============ END H-02 FIX ============
    }

    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer,
        address _token,
        uint256 _tokenId,
        uint256 _amountPerToken
    ) external {
        __Proposal_init(_dao, _description, _proposer);
        require(_amountPerToken > 0, "Amount per token must be positive");
        require(dao.hasTreasury(), "DAO has no treasury");

        // Calculate total amount needed: amountPerToken * total vested supply
        uint256 vestedSupply = dao.getTotalVestedSupply();
        require(vestedSupply > 0, "No vested governance tokens exist");
        uint256 requiredAmount = _amountPerToken * vestedSupply;

        // Validate treasury has sufficient AVAILABLE balance (total - locked)
        if (_token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            require(dao.getAvailableETH() >= requiredAmount, "Insufficient available ETH balance");
        } else {
            if (_tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                require(
                    dao.getAvailableERC20(_token) >= requiredAmount,
                    "Insufficient available ERC20 balance"
                );
            } else {
                // ERC721 or ERC1155 - check using ERC165
                bytes4 ERC721_INTERFACE_ID = 0x80ac58cd;
                bytes4 ERC1155_INTERFACE_ID = 0xd9b67a26;

                if (ERC165Checker.supportsInterface(_token, ERC721_INTERFACE_ID)) {
                    revert("Cannot distribute ERC721 tokens");
                } else if (ERC165Checker.supportsInterface(_token, ERC1155_INTERFACE_ID)) {
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    require(
                        dao.getAvailableERC1155(_token, _tokenId) >= requiredAmount,
                        "Insufficient available ERC1155 balance"
                    );
                } else {
                    revert("Token must support ERC721 or ERC1155 interface");
                }
            }
        }

        token = _token;
        tokenId = _tokenId;
        amountPerGovernanceToken = _amountPerToken;
        totalAmount = requiredAmount;
    }

    /**
     * @notice Register caller for distribution based on their current vested governance token balance
     * @dev Can be called during or after election trigger. Users don't need to claim voting tokens.
     *      H-02 FIX: Registration now locks the user's governance tokens to prevent double-registration.
     *      M-01 NOTE: The amountPerGovernanceToken is a TARGET. Actual payout is pro-rata based on
     *                 total registered shares vs actual pool balance.
     */
    function registerForDistribution() external {
        if (!electionTriggered) revert ElectionNotTriggered();
        if (address(redemptionContract) == address(0)) revert RedemptionNotDeployed();

        uint256 vestedBal = dao.vestedBalance(msg.sender);
        redemptionContract.registerClaimant(msg.sender, vestedBal);

        emit UserRegisteredForDistribution(msg.sender, vestedBal);
    }

    function _execute() internal override {
        super._execute();

        // Transfer funds to redemption contract
        if (token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            dao.transferETH(payable(address(redemptionContract)), totalAmount);
        } else {
            if (tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                dao.transferERC20(token, address(redemptionContract), totalAmount);
            } else {
                // ERC1155 (ERC721 already rejected in initialize)
                bytes4 ERC1155_INTERFACE_ID = 0xd9b67a26;
                require(
                    ERC165Checker.supportsInterface(token, ERC1155_INTERFACE_ID),
                    "Token must support ERC1155 interface"
                );
                require(dao.acceptsERC1155(), "ERC1155 not accepted");
                dao.transferERC1155(token, address(redemptionContract), tokenId, totalAmount);
            }
        }
        
        // ============ M-01 FIX: Mark pool as funded after transfer ============
        // Only the proposal can mark funding, preventing griefing attacks where
        // attackers send dust to snapshot a tiny balance before real funds arrive
        redemptionContract.markPoolFunded();
        // ============ END M-01 FIX ============

        executed = true;

        // Unlock funds (they've been transferred to redemption contract)
        dao.unlockFunds();

        // Clear the active proposal status at the very end of execution
        dao.clearActiveProposal();
    }
}
