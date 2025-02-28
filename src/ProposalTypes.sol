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
                IERC20(token).transfer(recipient, amount);
            } else {
                if(amount == 1) {
                    require(dao.acceptsERC721(), "ERC721 not accepted");
                    IERC721(token).transferFrom(address(dao), recipient, tokenId);
                } else {
                    require(dao.acceptsERC1155(), "ERC1155 not accepted");
                    IERC1155(token).safeTransferFrom(address(dao), recipient, tokenId, amount, "");
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
