// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Proposal.sol";

contract ResolutionProposal is Proposal {
    constructor(
        MarketDAO _dao,
        string memory _description
    ) Proposal(_dao, _description) {
        require(bytes(_description).length > 0, "Description required");
    }

    function _execute() internal override {
        executed = true;
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
        require(!executed, "Already executed");
        executed = true;

        if(token == address(0)) {
            require(dao.acceptsETH(), "ETH not accepted");
            payable(recipient).transfer(amount);
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
        require(!executed, "Already executed");
        executed = true;
        dao.mintGovernanceTokens(recipient, amount);
    }
}
