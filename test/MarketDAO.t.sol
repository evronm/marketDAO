// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract MarketDAOTest is Test {
    MarketDAO dao;
    address alice = address(0x1);
    address bob = address(0x2);
    address charlie = address(0x3);
    
    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = alice;
        initialHolders[1] = bob;
        
        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        
        string[] memory treasuryConfig = new string[](2);
        treasuryConfig[0] = "ETH";
        treasuryConfig[1] = "ERC20";
        
        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold (basis points)
            5100, // 51% quorum (basis points)
            100, // 100 blocks max proposal age
            50,  // 50 blocks election duration
            1, // flags (allowMinting=True)
            0, //token sales off
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }
    
    function testInitialState() public {
        assertEq(dao.name(), "Test DAO");
        assertEq(dao.supportThreshold(), 2000);  // 20% in basis points
        assertEq(dao.quorumPercentage(), 5100);  // 51% in basis points
        assertEq(dao.maxProposalAge(), 100);
        assertEq(dao.electionDuration(), 50);
        assertTrue(dao.allowMinting());
        assertTrue(dao.hasTreasury());
        assertTrue(dao.acceptsETH());
        assertTrue(dao.acceptsERC20());
        assertFalse(dao.acceptsERC721());
        assertFalse(dao.acceptsERC1155());
    }
    
    function testInitialTokenDistribution() public {
        assertEq(dao.balanceOf(alice, 0), 100);
        assertEq(dao.balanceOf(bob, 0), 50);
        assertEq(dao.balanceOf(charlie, 0), 0);
        
        address[] memory holders = dao.getGovernanceTokenHolders();
        assertEq(holders.length, 2);
        assertTrue(holders[0] == alice || holders[1] == alice);
        assertTrue(holders[0] == bob || holders[1] == bob);
    }
    
    function testTransferUpdatesHoldersList() public {
        vm.prank(alice);
        dao.safeTransferFrom(alice, charlie, 0, 50, "");
        
        address[] memory holders = dao.getGovernanceTokenHolders();
        assertEq(holders.length, 3);
        
        vm.prank(alice);
        dao.safeTransferFrom(alice, charlie, 0, 50, "");
        
        holders = dao.getGovernanceTokenHolders();
        assertEq(holders.length, 2);
        assertTrue(holders[0] == bob || holders[1] == bob);
        assertTrue(holders[0] == charlie || holders[1] == charlie);
    }
    
    function testReceiveETH() public {
        (bool success,) = address(dao).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(dao).balance, 1 ether);
    }
    
    function testFailReceiveETHWhenNotConfigured() public {
        address[] memory initialHolders = new address[](0);
        uint256[] memory initialAmounts = new uint256[](0);
        string[] memory treasuryConfig = new string[](0);

        MarketDAO noTreasuryDao = new MarketDAO(
            "No Treasury",
            2000,  // 20% (basis points)
            5100,  // 51% (basis points)
            100,
            50,
            1, // flags (allowMinting=True)
            0, //token sales off
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        payable(address(noTreasuryDao)).transfer(1 ether);
    }

    function testDeployerCanSetFactory() public {
        // The test contract is the deployer since it deployed in setUp
        ProposalFactory factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));
        assertEq(dao.factory(), address(factory));
    }

    function testFailNonDeployerCannotSetFactory() public {
        ProposalFactory factory = new ProposalFactory(dao);
        // Try to set factory from alice's account (not deployer)
        vm.prank(alice);
        dao.setFactory(address(factory));
    }

    function testFailCannotSetFactoryTwice() public {
        ProposalFactory factory1 = new ProposalFactory(dao);
        ProposalFactory factory2 = new ProposalFactory(dao);

        dao.setFactory(address(factory1));
        dao.setFactory(address(factory2)); // Should fail
    }
}
