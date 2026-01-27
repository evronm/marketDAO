// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";
import "./DistributionRedemption.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

contract ResolutionProposal is Proposal {
    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer
    ) external {
        require(bytes(_description).length > 0, "Description required");
        __Proposal_init(_dao, _description, _proposer);
    }

    function _execute() internal override {
        super._execute();
        executed = true;
        // The DAO needs to keep track of active proposals for vote validation
        // Only clear the active proposal status at the very end
        dao.clearActiveProposal();
    }
}

contract TreasuryProposal is Proposal {
    address public recipient;
    uint256 public amount;
    address public token;
    uint256 public tokenId;

    // Override to lock funds when election is triggered
    function _lockFunds() internal override {
        dao.lockFunds(token, tokenId, amount);
    }

    // Override to unlock funds when proposal fails
    function _unlockFunds() internal override {
        dao.unlockFunds();
    }

    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer,
        address _recipient,
        uint256 _amount,
        address _token,
        uint256 _tokenId
    ) external {
        __Proposal_init(_dao, _description, _proposer);
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        require(dao.hasTreasury(), "DAO has no treasury");

        // Validate treasury has sufficient AVAILABLE balance (total - locked)
        if(_token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            require(dao.getAvailableETH() >= _amount, "Insufficient available ETH balance");
        } else {
            if (_tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                require(
                    dao.getAvailableERC20(_token) >= _amount,
                    "Insufficient available ERC20 balance"
                );
            } else {
                // ERC721 or ERC1155 - check using ERC165
                bytes4 ERC721_INTERFACE_ID = 0x80ac58cd;
                bytes4 ERC1155_INTERFACE_ID = 0xd9b67a26;

                if (ERC165Checker.supportsInterface(_token, ERC721_INTERFACE_ID)) {
                    // ERC721
                    require(dao.acceptsERC721(), "ERC721 not accepted");
                    require(_amount == 1, "ERC721 amount must be 1");
                    // Verify the DAO owns this specific token
                    require(
                        IERC721(_token).ownerOf(_tokenId) == address(dao),
                        "DAO does not own this NFT"
                    );
                } else if (ERC165Checker.supportsInterface(_token, ERC1155_INTERFACE_ID)) {
                    // ERC1155
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    require(
                        dao.getAvailableERC1155(_token, _tokenId) >= _amount,
                        "Insufficient available ERC1155 balance"
                    );
                } else {
                    revert("Token must support ERC721 or ERC1155 interface");
                }
            }
        }

        recipient = _recipient;
        amount = _amount;
        token = _token;
        tokenId = _tokenId;
    }

    function _execute() internal override {
        super._execute();

        // Transfer based on asset type
        if (token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            dao.transferETH(payable(recipient), amount);
        } else {
            if (tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                dao.transferERC20(token, recipient, amount);
            } else {
                // ERC721 or ERC1155 - check using ERC165
                bytes4 ERC721_INTERFACE_ID = 0x80ac58cd;
                bytes4 ERC1155_INTERFACE_ID = 0xd9b67a26;

                if (ERC165Checker.supportsInterface(token, ERC721_INTERFACE_ID)) {
                    // ERC721
                    require(dao.acceptsERC721(), "ERC721 not accepted");
                    require(amount == 1, "ERC721 amount must be 1");
                    dao.transferERC721(token, recipient, tokenId);
                } else if (ERC165Checker.supportsInterface(token, ERC1155_INTERFACE_ID)) {
                    // ERC1155
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    dao.transferERC1155(token, recipient, tokenId, amount);
                } else {
                    revert("Token must support ERC721 or ERC1155 interface");
                }
            }
        }
        executed = true;

        // Unlock funds (they've been consumed by the transfer)
        dao.unlockFunds();

        // Clear the active proposal status at the very end of execution
        dao.clearActiveProposal();
    }
}

contract MintProposal is Proposal {
    address public recipient;
    uint256 public amount;

    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer,
        address _recipient,
        uint256 _amount
    ) external {
        __Proposal_init(_dao, _description, _proposer);
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        require(dao.allowMinting(), "Minting not allowed");

        recipient = _recipient;
        amount = _amount;
    }

    function _execute() internal override {
        super._execute();
        dao.mintGovernanceTokens(recipient, amount);
        executed = true;
        // Clear the active proposal status at the very end of execution
        dao.clearActiveProposal();
    }
}

contract ParameterProposal is Proposal {
    enum ParameterType {
        SupportThreshold,
        QuorumPercentage,
        MaxProposalAge,
        ElectionDuration,
        VestingPeriod,
        TokenPrice,
        Flags
    }

    ParameterType public parameterType;
    uint256 public newValue;

    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer,
        ParameterType _parameterType,
        uint256 _newValue
    ) external {
        require(bytes(_description).length > 0, "Description required");
        __Proposal_init(_dao, _description, _proposer);

        // Validate parameter-specific constraints
        if (_parameterType == ParameterType.SupportThreshold) {
            require(_newValue > 0 && _newValue <= 10000, "Threshold must be > 0 and <= 10000");
        } else if (_parameterType == ParameterType.QuorumPercentage) {
            require(_newValue >= 100 && _newValue <= 10000, "Quorum must be >= 1% and <= 100%");
        } else if (_parameterType == ParameterType.MaxProposalAge) {
            require(_newValue > 0, "Proposal age must be greater than 0");
        } else if (_parameterType == ParameterType.ElectionDuration) {
            require(_newValue > 0, "Election duration must be greater than 0");
        } else if (_parameterType == ParameterType.TokenPrice) {
            require(_newValue > 0, "Price must be greater than 0");
        } else if (_parameterType == ParameterType.Flags) {
            require(_newValue <= 7, "Invalid flags - only bits 0-2 are valid");
        }
        // VestingPeriod can be any value (including 0)

        parameterType = _parameterType;
        newValue = _newValue;
    }

    function _execute() internal override {
        super._execute();

        if (parameterType == ParameterType.SupportThreshold) {
            dao.setSupportThreshold(newValue);
        } else if (parameterType == ParameterType.QuorumPercentage) {
            dao.setQuorumPercentage(newValue);
        } else if (parameterType == ParameterType.MaxProposalAge) {
            dao.setMaxProposalAge(newValue);
        } else if (parameterType == ParameterType.ElectionDuration) {
            dao.setElectionDuration(newValue);
        } else if (parameterType == ParameterType.VestingPeriod) {
            dao.setVestingPeriod(newValue);
        } else if (parameterType == ParameterType.TokenPrice) {
            dao.setTokenPrice(newValue);
        } else if (parameterType == ParameterType.Flags) {
            dao.setFlags(newValue);
        }

        executed = true;
        dao.clearActiveProposal();
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
