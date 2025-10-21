// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract ResolutionProposal is Proposal {
    constructor(
        MarketDAO _dao,
        string memory _description
    ) Proposal(_dao, _description) {
        require(bytes(_description).length > 0, "Description required");
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

    constructor(
        MarketDAO _dao,
        string memory _description,
        address _recipient,
        uint256 _amount,
        address _token,
        uint256 _tokenId
    ) Proposal(_dao, _description) {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be positive");
        require(dao.hasTreasury(), "DAO has no treasury");

        // Validate treasury has sufficient AVAILABLE balance (total - locked)
        if(_token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            require(dao.getAvailableETH() >= _amount, "Insufficient available ETH balance");
        } else {
            if(_tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                require(dao.getAvailableERC20(_token) >= _amount, "Insufficient available ERC20 balance");
            } else {
                // ERC721 or ERC1155 - check using ERC165
                try IERC165(_token).supportsInterface(0x80ac58cd) returns (bool isERC721) {
                    if (isERC721) {
                        // ERC721
                        require(dao.acceptsERC721(), "ERC721 not accepted");
                        require(_amount == 1, "ERC721 amount must be 1");
                        try IERC721(_token).ownerOf(_tokenId) returns (address owner) {
                            require(owner == address(dao), "DAO does not own this ERC721 token");
                        } catch {
                            revert("Invalid ERC721 token");
                        }
                        require(!dao.isERC721Locked(_token, _tokenId), "ERC721 token already locked");
                    } else {
                        // ERC1155
                        require(dao.acceptsERC1155(), "ERC1155 not accepted");
                        require(dao.getAvailableERC1155(_token, _tokenId) >= _amount, "Insufficient available ERC1155 balance");
                    }
                } catch {
                    revert("Token does not support ERC165");
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

        if(token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            dao.transferETH(payable(recipient), amount);
        } else {
            if(tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                dao.transferERC20(token, recipient, amount);
            } else {
                // ERC721 or ERC1155 - check using ERC165
                try IERC165(token).supportsInterface(0x80ac58cd) returns (bool isERC721) {
                    if (isERC721) {
                        // ERC721
                        require(dao.acceptsERC721(), "ERC721 not accepted");
                        require(amount == 1, "ERC721 amount must be 1");
                        dao.transferERC721(token, recipient, tokenId);
                    } else {
                        // ERC1155
                        require(dao.acceptsERC1155(), "ERC1155 not accepted");
                        dao.transferERC1155(token, recipient, tokenId, amount);
                    }
                } catch {
                    revert("Token does not support ERC165");
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

    constructor(
        MarketDAO _dao,
        string memory _description,
        address _recipient,
        uint256 _amount
    ) Proposal(_dao, _description) {
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

contract TokenPriceProposal is Proposal {
    uint256 public newPrice;

    constructor(
        MarketDAO _dao,
        string memory _description,
        uint256 _newPrice
    ) Proposal(_dao, _description) {
        require(bytes(_description).length > 0, "Description required");
        newPrice = _newPrice;
    }

    function _execute() internal override {
        super._execute();
        dao.setTokenPrice(newPrice);
        executed = true;
        // Clear the active proposal status at the very end of execution
        dao.clearActiveProposal();
    }
}
