// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

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

        // Validate treasury has sufficient balance
        if(_token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            require(address(dao).balance >= _amount, "Insufficient ETH balance");
        } else {
            if(_tokenId == 0) {
                require(dao.acceptsERC20(), "ERC20 not accepted");
                require(IERC20(_token).balanceOf(address(dao)) >= _amount, "Insufficient ERC20 balance");
            } else {
                if(_amount == 1) {
                    require(dao.acceptsERC721(), "ERC721 not accepted");
                    try IERC721(_token).ownerOf(_tokenId) returns (address owner) {
                        require(owner == address(dao), "DAO does not own this ERC721 token");
                    } catch {
                        revert("Invalid ERC721 token");
                    }
                } else {
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    require(IERC1155(_token).balanceOf(address(dao), _tokenId) >= _amount, "Insufficient ERC1155 balance");
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
                if(amount == 1) {
                    require(dao.acceptsERC721(), "ERC721 not accepted");
                    dao.transferERC721(token, recipient, tokenId);
                } else {
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    dao.transferERC1155(token, recipient, tokenId, amount);
                }
            }
        }
        executed = true;
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
