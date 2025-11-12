// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";

contract MarketDAOTokenSaleTest is TestHelper {
    MarketDAO dao;
    address alice = address(0x1);
    address bob = address(0x2);
    uint256 constant TOKEN_PRICE = 0.1 ether;
    
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
            2000,  // 20% (basis points)
            5100,  // 51% (basis points)
            100,
            50,
            1, // flags (allowMinting=True)
            TOKEN_PRICE,
            0, // No vesting for these tests
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }

    function testTokenPrice() public {
        assertEq(dao.tokenPrice(), TOKEN_PRICE);
    }
    
    function testPurchaseTokens() public {
        address buyer = address(0x3);
        vm.deal(buyer, 1 ether);
        
        uint256 purchaseAmount = 0.5 ether; // Should get 5 tokens
        uint256 expectedTokens = purchaseAmount / TOKEN_PRICE;
        
        vm.prank(buyer);
        dao.purchaseTokens{value: purchaseAmount}();
        
        assertEq(dao.balanceOf(buyer, 0), expectedTokens);
        assertEq(address(dao).balance, purchaseAmount);
        
        // Check that buyer was added to governance token holders
        address[] memory holders = dao.getGovernanceTokenHolders();
        bool foundBuyer = false;
        for(uint i = 0; i < holders.length; i++) {
            if(holders[i] == buyer) {
                foundBuyer = true;
                break;
            }
        }
        assertTrue(foundBuyer);
    }
    
    function testMultiplePurchases() public {
        address buyer = address(0x3);
        vm.deal(buyer, 1 ether);
        
        vm.startPrank(buyer);
        
        dao.purchaseTokens{value: 0.2 ether}();
        assertEq(dao.balanceOf(buyer, 0), 2);
        
        dao.purchaseTokens{value: 0.3 ether}();
        assertEq(dao.balanceOf(buyer, 0), 5);
        
        vm.stopPrank();
    }

    function testFailPurchaseWithIncorrectAmount() public {
        address buyer = address(0x3);
        vm.deal(buyer, 1 ether);
        
        // Try to purchase with amount not divisible by token price
        vm.prank(buyer);
        dao.purchaseTokens{value: 0.15 ether}();
    }

    function testFailPurchaseWithZeroPayment() public {
        vm.prank(address(0x3));
        dao.purchaseTokens{value: 0}();
    }

    function testFailPurchaseWhenDisabled() public {
        // Create new DAO with token price = 0
        address[] memory initialHolders = new address[](0);
        uint256[] memory initialAmounts = new uint256[](0);
        string[] memory treasuryConfig = new string[](0);
        
        MarketDAO disabledSalesDao = new MarketDAO(
            "No Sales DAO",
            2000,  // 20% (basis points)
            5100,  // 51% (basis points)
            100,
            50,
            1, // flags (allowMinting=True)
            0, // disable direct sales
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
        
        address buyer = address(0x3);
        vm.deal(buyer, 1 ether);
        
        vm.prank(buyer);
        disabledSalesDao.purchaseTokens{value: 0.1 ether}();
    }
}
