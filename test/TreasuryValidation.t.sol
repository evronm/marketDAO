// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract TreasuryValidationTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;
    address proposer = address(0x1);

    function setUp() public {
        address[] memory initialHolders = new address[](1);
        initialHolders[0] = proposer;
        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, 5100, 100, 50, 0, 0, 0,  // flags=0 (no minting)
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Give DAO only 1 ETH
        vm.deal(address(dao), 1 ether);
    }

    function testFailCreateProposalWithInsufficientBalance() public {
        vm.prank(proposer);
        // Try to create proposal for 10 ETH when DAO only has 1 ETH
        // Should revert with "Insufficient ETH balance"
        factory.createTreasuryProposal(
            "Send too much ETH",
            address(0x999),
            10 ether,
            address(0),
            0
        );
    }

    function testCreateProposalWithSufficientBalance() public {
        vm.prank(proposer);
        // This should succeed - DAO has 1 ETH, proposal for 0.5 ETH
        factory.createTreasuryProposal(
            "Send valid amount",
            address(0x999),
            0.5 ether,
            address(0),
            0
        );
    }
}
