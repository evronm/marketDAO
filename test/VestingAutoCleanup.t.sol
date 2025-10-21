// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";

contract VestingAutoCleanupTest is Test {
    MarketDAO dao;
    address user1 = address(0x1);
    address user2 = address(0x2);

    function setUp() public {
        address[] memory initialHolders = new address[](1);
        initialHolders[0] = user1;

        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 1000;

        string[] memory treasuryConfig = new string[](0);

        dao = new MarketDAO(
            "Test DAO",
            2000,  // 20% support threshold
            5100,  // 51% quorum
            100,   // max proposal age
            50,    // election duration
            false, // no minting
            1e14,  // token price
            100,   // vesting period of 100 blocks
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }

    function testAutoCleanupOnTransfer() public {
        // User1 purchases tokens with vesting
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        dao.purchaseTokens{value: 1e14}(); // Buy 1 token

        // Check initial state
        assertEq(dao.totalUnvestedGovernanceTokens(), 1, "Should have 1 unvested token");
        assertEq(dao.vestedBalance(user1), 1000, "User1 should have 1000 vested tokens from initial");
        assertEq(dao.balanceOf(user1, 0), 1001, "User1 should have 1001 total tokens");

        // Fast forward past vesting period
        vm.roll(block.number + 101);

        // totalUnvestedGovernanceTokens hasn't been updated yet
        assertEq(dao.totalUnvestedGovernanceTokens(), 1, "Counter not updated yet");

        // User1 transfers tokens - this should trigger automatic cleanup
        vm.prank(user1);
        dao.safeTransferFrom(user1, user2, 0, 100, "");

        // Now totalUnvestedGovernanceTokens should be updated
        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "Counter should be cleaned up after transfer");
        assertEq(dao.getTotalVestedSupply(), 1001, "All tokens should now be vested");
    }

    function testAutoCleanupOnBatchTransfer() public {
        // User1 purchases tokens with vesting
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        dao.purchaseTokens{value: 2e14}(); // Buy 2 tokens

        assertEq(dao.totalUnvestedGovernanceTokens(), 2, "Should have 2 unvested tokens");

        // Fast forward past vesting period
        vm.roll(block.number + 101);

        // Batch transfer should also trigger cleanup
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50;

        vm.prank(user1);
        dao.safeBatchTransferFrom(user1, user2, ids, amounts, "");

        // Counter should be cleaned up
        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "Counter should be cleaned up after batch transfer");
    }

    function testMultipleTransfersKeepCounterAccurate() public {
        // User1 purchases tokens multiple times with different vesting schedules
        vm.deal(user1, 10 ether);

        // Purchase 1: block 1, vests at block 101
        vm.roll(1);
        vm.prank(user1);
        dao.purchaseTokens{value: 1e14}();

        // Purchase 2: block 50, vests at block 150
        vm.roll(50);
        vm.prank(user1);
        dao.purchaseTokens{value: 1e14}();

        assertEq(dao.totalUnvestedGovernanceTokens(), 2, "Should have 2 unvested tokens");

        // Move to block 120 - first schedule expired, second still locked
        vm.roll(120);

        // Transfer triggers cleanup - should remove first schedule only
        vm.prank(user1);
        dao.safeTransferFrom(user1, user2, 0, 100, "");

        assertEq(dao.totalUnvestedGovernanceTokens(), 1, "Should have 1 unvested token remaining");

        // Move past second vesting period
        vm.roll(151);

        // Another transfer cleans up the second schedule
        vm.prank(user1);
        dao.safeTransferFrom(user1, user2, 0, 100, "");

        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "All vesting should be cleaned up");
    }

    function testCleanupDoesNotAffectVestedBalance() public {
        // Purchase with vesting
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        dao.purchaseTokens{value: 1e14}();

        // Before vesting expires
        uint256 vestedBefore = dao.vestedBalance(user1);
        assertEq(vestedBefore, 1000, "Only initial tokens are vested");

        // After vesting expires
        vm.roll(block.number + 101);
        uint256 vestedAfter = dao.vestedBalance(user1);
        assertEq(vestedAfter, 1001, "All tokens should be vested now");

        // Transfer triggers cleanup
        vm.prank(user1);
        dao.safeTransferFrom(user1, user2, 0, 100, "");

        // vestedBalance should still be correct
        assertEq(dao.vestedBalance(user1), 901, "Vested balance correct after cleanup");
    }
}
