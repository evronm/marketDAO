// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProposalTypes.sol";

contract ProposalFactory {
    MarketDAO public dao;
    mapping(uint256 => address) public proposals;
    uint256 public proposalCount;

    constructor(MarketDAO _dao) {
        dao = _dao;
    }

    function createResolutionProposal(
        string memory description
    ) external returns (ResolutionProposal) {
        ResolutionProposal proposal = new ResolutionProposal(dao, description);
        proposals[proposalCount++] = address(proposal);
        return proposal;
    }

    function createTreasuryProposal(
        string memory description,
        address recipient,
        uint256 amount,
        address token,
        uint256 tokenId
    ) external returns (TreasuryProposal) {
        TreasuryProposal proposal = new TreasuryProposal(
            dao,
            description,
            recipient,
            amount,
            token,
            tokenId
        );
        proposals[proposalCount++] = address(proposal);
        return proposal;
    }

    function createMintProposal(
        string memory description,
        address recipient,
        uint256 amount
    ) external returns (MintProposal) {
        MintProposal proposal = new MintProposal(
            dao,
            description,
            recipient,
            amount
        );
        proposals[proposalCount++] = address(proposal);
        return proposal;
    }

    
    function createTokenPriceProposal(
        string memory description,
        uint256 newPrice
    ) external returns (TokenPriceProposal) {
        TokenPriceProposal proposal = new TokenPriceProposal(
            dao,
            description,
            newPrice
        );
        proposals[proposalCount++] = address(proposal);
        return proposal;
    }

    function getProposal(uint256 index) external view returns (address) {
        require(index < proposalCount, "Invalid proposal index");
        return proposals[index];
    }
}
