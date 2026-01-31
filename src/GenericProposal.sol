// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";

/**
 * @title GenericProposal
 * @notice Unified proposal type that executes arbitrary calls
 * @dev Replaces Resolution, Treasury, Mint, and Parameter proposals with a single flexible type
 *
 * Features:
 * - Single call execution: target address, value (ETH), and calldata
 * - Empty calldata on DAO target = Resolution (symbolic vote, no execution)
 * - External calls supported (enables DeFi participation, external governance)
 * - Automatic fund locking for DAO treasury operations
 * - Security: Community voting is the safeguard (no target restrictions)
 */
contract GenericProposal is Proposal {
    // Single call storage
    address public target;
    uint256 public value;
    bytes public data;

    // Parsed fund lock (extracted during initialization, if applicable)
    bool private needsFundLock;
    address private lockToken;
    uint256 private lockTokenId;
    uint256 private lockAmount;

    /**
     * @notice Initialize the generic proposal
     * @param _dao The MarketDAO instance
     * @param _description Human-readable proposal description
     * @param _proposer Address of the proposer
     * @param _target Target contract address for the call
     * @param _value ETH value to send with the call (in wei)
     * @param _data Encoded function call data (empty for Resolution)
     */
    function initialize(
        MarketDAO _dao,
        string memory _description,
        address _proposer,
        address _target,
        uint256 _value,
        bytes memory _data
    ) external {
        __Proposal_init(_dao, _description, _proposer);

        target = _target;
        value = _value;
        data = _data;

        // Parse and validate if this is a DAO treasury operation
        _parseAndValidateFunds();
    }

    /**
     * @notice Parse calldata to detect DAO treasury operations and validate fund availability
     * @dev Only locks funds if: (1) target is DAO, (2) selector matches known transfer functions
     *      External calls don't trigger fund locking (community must ensure external contract safety)
     */
    function _parseAndValidateFunds() internal {
        // Only parse if target is the DAO
        if (target != address(dao)) {
            needsFundLock = false;
            return;
        }

        // Empty data = Resolution (no funds needed)
        if (data.length == 0) {
            needsFundLock = false;
            return;
        }

        // Extract selector (first 4 bytes)
        if (data.length < 4) {
            needsFundLock = false;
            return;
        }

        // Extract selector correctly using bitwise operations
        bytes4 selector = bytes4(data[0]) | (bytes4(data[1]) >> 8) |
                         (bytes4(data[2]) >> 16) | (bytes4(data[3]) >> 24);

        // Copy data to memory for slicing (required for abi.decode)
        bytes memory dataMemory = data;

        // Check if this is a treasury transfer function
        if (selector == dao.transferETH.selector) {
            // transferETH(address payable recipient, uint256 amount)
            // Skip first 4 bytes (selector) and decode the rest
            bytes memory params = new bytes(dataMemory.length - 4);
            for (uint i = 0; i < params.length; i++) {
                params[i] = dataMemory[i + 4];
            }
            (, uint256 amount) = abi.decode(params, (address, uint256));
            require(dao.getAvailableETH() >= amount, "Insufficient available ETH balance");
            needsFundLock = true;
            lockToken = address(0);
            lockTokenId = 0;
            lockAmount = amount;
        } else if (selector == dao.transferERC20.selector) {
            // transferERC20(address token, address recipient, uint256 amount)
            bytes memory params = new bytes(dataMemory.length - 4);
            for (uint i = 0; i < params.length; i++) {
                params[i] = dataMemory[i + 4];
            }
            (address token, , uint256 amount) = abi.decode(params, (address, address, uint256));
            require(dao.getAvailableERC20(token) >= amount, "Insufficient available ERC20 balance");
            needsFundLock = true;
            lockToken = token;
            lockTokenId = 0;
            lockAmount = amount;
        } else if (selector == dao.transferERC721.selector) {
            // transferERC721(address token, address recipient, uint256 tokenId)
            bytes memory params = new bytes(dataMemory.length - 4);
            for (uint i = 0; i < params.length; i++) {
                params[i] = dataMemory[i + 4];
            }
            (address token, , uint256 tokenId) = abi.decode(params, (address, address, uint256));
            needsFundLock = true;
            lockToken = token;
            lockTokenId = tokenId;
            lockAmount = 1;
        } else if (selector == dao.transferERC1155.selector) {
            // transferERC1155(address token, address recipient, uint256 tokenId, uint256 amount)
            bytes memory params = new bytes(dataMemory.length - 4);
            for (uint i = 0; i < params.length; i++) {
                params[i] = dataMemory[i + 4];
            }
            (address token, , uint256 tokenId, uint256 amount) =
                abi.decode(params, (address, address, uint256, uint256));
            require(dao.getAvailableERC1155(token, tokenId) >= amount, "Insufficient available ERC1155 balance");
            needsFundLock = true;
            lockToken = token;
            lockTokenId = tokenId;
            lockAmount = amount;
        } else {
            // Not a treasury transfer function - no fund locking needed
            // This includes: mintGovernanceTokens, setTokenPrice, setSupportThreshold, etc.
            // Also includes any external contract calls
            needsFundLock = false;
        }
    }

    /**
     * @notice Lock funds at election trigger (overrides base Proposal)
     * @dev Called automatically when election is triggered
     */
    function _lockFunds() internal override {
        if (needsFundLock) {
            dao.lockFunds(lockToken, lockTokenId, lockAmount);
        }
    }

    /**
     * @notice Unlock funds on failure or early rejection (overrides base Proposal)
     * @dev Called automatically when proposal fails or is rejected
     */
    function _unlockFunds() internal override {
        if (needsFundLock) {
            dao.unlockFunds();
        }
    }

    /**
     * @notice Execute the proposal call (overrides base Proposal)
     * @dev Called after successful vote. Executes the call and unlocks funds.
     *      Empty data on DAO target = Resolution (symbolic vote, no execution)
     */
    function _execute() internal override {
        super._execute();

        // Execute the call (if data is not empty or target is not DAO)
        // This allows:
        // - Resolution: target=DAO, data="" (no execution, just mark executed)
        // - Treasury ops: target=DAO, data=encoded call (execute on DAO)
        // - External calls: target=external, data=any (execute on external contract)
        if (data.length > 0 || target != address(dao)) {
            (bool success, bytes memory result) = target.call{value: value}(data);
            if (!success) {
                // Include revert reason in error message for debugging
                if (result.length > 0) {
                    // Bubble up the revert reason
                    assembly {
                        let result_size := mload(result)
                        revert(add(32, result), result_size)
                    }
                } else {
                    revert("Execution failed: no revert reason");
                }
            }
        }
        // else: Resolution proposal with empty data on DAO - just mark executed

        executed = true;
        _unlockFunds();
        dao.clearActiveProposal();
    }
}
