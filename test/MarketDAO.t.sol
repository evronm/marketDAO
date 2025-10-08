// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";

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
            20, // 20% support threshold
            51, // 51% quorum
            100, // 100 blocks max proposal age
            50,  // 50 blocks election duration
            true, // allow minting
            0, //token sales off
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }
    
    function testInitialState() public {
        assertEq(dao.name(), "Test DAO");
        assertEq(dao.supportThreshold(), 20);
        assertEq(dao.quorumPercentage(), 51);
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
            20,
            51,
            100,
            50,
            true,
            0, //token sales off
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
        
        payable(address(noTreasuryDao)).transfer(1 ether);
    }
}
