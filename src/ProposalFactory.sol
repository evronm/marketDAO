// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ProposalTypes.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract ProposalFactory {
    MarketDAO public dao;
    mapping(uint256 => address) public proposals;
    uint256 public proposalCount;

    // Implementation contracts for cloning
    address public resolutionImpl;
    address public treasuryImpl;
    address public mintImpl;
    address public parameterImpl;

    constructor(MarketDAO _dao) {
        dao = _dao;

        // Deploy implementation contracts once
        resolutionImpl = address(new ResolutionProposal());
        treasuryImpl = address(new TreasuryProposal());
        mintImpl = address(new MintProposal());
        parameterImpl = address(new ParameterProposal());
    }

    modifier onlyTokenHolder() {
        require(dao.vestedBalance(msg.sender) > 0, "Must hold vested governance tokens");
        _;
    }

    function createResolutionProposal(
        string memory description
    ) external onlyTokenHolder returns (ResolutionProposal) {
        address clone = Clones.clone(resolutionImpl);
        ResolutionProposal(clone).initialize(dao, description, msg.sender);
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return ResolutionProposal(clone);
    }

    function createTreasuryProposal(
        string memory description,
        address recipient,
        uint256 amount,
        address token,
        uint256 tokenId
    ) external onlyTokenHolder returns (TreasuryProposal) {
        address clone = Clones.clone(treasuryImpl);
        TreasuryProposal(clone).initialize(
            dao,
            description,
            msg.sender,
            recipient,
            amount,
            token,
            tokenId
        );
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return TreasuryProposal(clone);
    }

    function createMintProposal(
        string memory description,
        address recipient,
        uint256 amount
    ) external returns (MintProposal) {
        uint256 callerBalance = dao.vestedBalance(msg.sender);

        // Non-holders can only create a mint proposal for 1 token to themselves (join request)
        if (callerBalance == 0) {
            require(amount == 1, "Non-holders can only request 1 token");
            require(recipient == msg.sender, "Non-holders can only request tokens for themselves");
        }

        address clone = Clones.clone(mintImpl);
        MintProposal(clone).initialize(
            dao,
            description,
            msg.sender,
            recipient,
            amount
        );
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return MintProposal(clone);
    }


    function createParameterProposal(
        string memory description,
        ParameterProposal.ParameterType parameterType,
        uint256 newValue
    ) external onlyTokenHolder returns (ParameterProposal) {
        address clone = Clones.clone(parameterImpl);
        ParameterProposal(clone).initialize(
            dao,
            description,
            msg.sender,
            parameterType,
            newValue
        );
        dao.setActiveProposal(clone);
        proposals[proposalCount++] = clone;
        return ParameterProposal(clone);
    }

    function getProposal(uint256 index) external view returns (address) {
        require(index < proposalCount, "Invalid proposal index");
        return proposals[index];
    }
}
