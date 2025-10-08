// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract VestingTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    address alice = address(0x1);
    address bob = address(0x2);
    address attacker = address(0x3);
    uint256 constant TOKEN_PRICE = 0.1 ether;
    uint256 constant VESTING_PERIOD = 100; // blocks

    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = alice;
        initialHolders[1] = bob;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            20,
            51,
            100,
            50,
            true,
            TOKEN_PRICE,
            VESTING_PERIOD,
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
    }

    function testSinglePurchaseWithVesting() public {
        vm.deal(attacker, 1 ether);

        uint256 purchaseAmount = 0.5 ether; // 5 tokens
        uint256 expectedTokens = purchaseAmount / TOKEN_PRICE;

        vm.prank(attacker);
        dao.purchaseTokens{value: purchaseAmount}();

        // Attacker should have the tokens
        assertEq(dao.balanceOf(attacker, 0), expectedTokens);

        // But vested balance should be 0 (all tokens are locked)
        assertEq(dao.vestedBalance(attacker), 0);
    }

    function testMultiplePurchasesSeparateVesting() public {
        vm.deal(attacker, 1 ether);

        vm.startPrank(attacker);

        // First purchase
        dao.purchaseTokens{value: 0.2 ether}(); // 2 tokens
        assertEq(dao.balanceOf(attacker, 0), 2);
        assertEq(dao.vestedBalance(attacker), 0);

        // Advance 50 blocks
        vm.roll(block.number + 50);

        // Second purchase
        dao.purchaseTokens{value: 0.3 ether}(); // 3 tokens
        assertEq(dao.balanceOf(attacker, 0), 5);
        assertEq(dao.vestedBalance(attacker), 0); // Still all locked

        vm.stopPrank();
    }

    function testVestingExpiry() public {
        vm.deal(attacker, 1 ether);

        vm.prank(attacker);
        dao.purchaseTokens{value: 0.5 ether}(); // 5 tokens

        uint256 initialBlock = block.number;

        // Before vesting period ends
        vm.roll(initialBlock + VESTING_PERIOD - 1);
        assertEq(dao.vestedBalance(attacker), 0);

        // After vesting period ends
        vm.roll(initialBlock + VESTING_PERIOD);
        assertEq(dao.vestedBalance(attacker), 5);
    }

    function testMultiplePurchasesPartialVesting() public {
        vm.deal(attacker, 1 ether);

        vm.startPrank(attacker);

        uint256 block1 = block.number;
        dao.purchaseTokens{value: 0.2 ether}(); // 2 tokens at block1

        vm.roll(block1 + 50);
        dao.purchaseTokens{value: 0.3 ether}(); // 3 tokens at block1+50

        // At block1 + 100: first purchase vests
        vm.roll(block1 + VESTING_PERIOD);
        assertEq(dao.vestedBalance(attacker), 2); // Only first purchase vested

        // At block1 + 150: second purchase vests
        vm.roll(block1 + VESTING_PERIOD + 50);
        assertEq(dao.vestedBalance(attacker), 5); // Both purchases vested

        vm.stopPrank();
    }

    function testCannotCreateProposalWithVestedTokens() public {
        vm.deal(attacker, 1 ether);

        vm.prank(attacker);
        dao.purchaseTokens{value: 1 ether}(); // 10 tokens

        // Attacker has tokens but they're all vesting
        assertEq(dao.balanceOf(attacker, 0), 10);
        assertEq(dao.vestedBalance(attacker), 0);

        // Try to create proposal - should fail due to insufficient vested balance
        // (assuming proposal creation requires some minimum balance)
        // This test depends on your ProposalFactory implementation
    }

    function testCannotSupportProposalWithVestedTokens() public {
        // Fund DAO treasury
        vm.deal(address(dao), 10 ether);

        // Setup: Alice creates a proposal
        vm.prank(alice);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Transfer 1 ETH",
            bob,
            1 ether,
            address(0), // ETH transfer
            0
        );

        // Attacker buys tokens
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        dao.purchaseTokens{value: 1 ether}(); // 10 tokens

        // Attacker tries to support with vesting tokens - should fail
        vm.prank(attacker);
        vm.expectRevert("Insufficient vested governance tokens");
        proposal.addSupport(5);
    }

    function testCanSupportAfterVesting() public {
        // Fund DAO treasury
        vm.deal(address(dao), 10 ether);

        // Setup: Alice creates a proposal
        vm.prank(alice);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Transfer 1 ETH",
            bob,
            1 ether,
            address(0), // ETH transfer
            0
        );

        // Attacker buys tokens
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        dao.purchaseTokens{value: 1 ether}(); // 10 tokens
        uint256 purchaseBlock = block.number;

        // Wait for vesting to complete
        vm.roll(purchaseBlock + VESTING_PERIOD);
        assertEq(dao.vestedBalance(attacker), 10);

        // Now attacker can support with vested tokens
        vm.prank(attacker);
        proposal.addSupport(5);
    }

    function testVotingTokensMintedOnlyForVestedBalance() public {
        // Fund DAO treasury
        vm.deal(address(dao), 10 ether);

        // Attacker buys tokens
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        dao.purchaseTokens{value: 1 ether}(); // 10 tokens
        uint256 purchaseBlock = block.number;

        // Alice creates a proposal
        vm.prank(alice);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Transfer 1 ETH",
            bob,
            1 ether,
            address(0), // ETH transfer
            0
        );

        // Alice and Bob support to trigger election
        // Total supply is 160 (100 + 50 + 10 attacker's locked), need 20% = 32 for election
        vm.prank(alice);
        proposal.addSupport(32); // Just enough to trigger election
        assertTrue(proposal.electionTriggered(), "Election should be triggered");

        // Check voting token distribution
        // Alice should get 100 voting tokens
        // Bob should get 50 voting tokens
        // Attacker should get 0 voting tokens (all tokens still vesting)
        uint256 votingTokenId = proposal.votingTokenId();

        assertEq(dao.balanceOf(alice, votingTokenId), 100);
        assertEq(dao.balanceOf(bob, votingTokenId), 50);
        assertEq(dao.balanceOf(attacker, votingTokenId), 0);

        // Wait for vesting to complete
        vm.roll(purchaseBlock + VESTING_PERIOD);
        assertEq(dao.vestedBalance(attacker), 10);

        // Create and trigger election for second proposal AFTER vesting completes
        vm.prank(alice);
        TreasuryProposal proposal2 = factory.createTreasuryProposal(
            "Transfer 2 ETH",
            bob,
            2 ether,
            address(0), // ETH transfer
            0
        );

        // Trigger election - Total vested supply is now 160 (100 + 50 + 10), need 20% = 32
        vm.prank(alice);
        proposal2.addSupport(32); // Triggers election

        // Now attacker should get voting tokens based on vested balance
        uint256 votingTokenId2 = proposal2.votingTokenId();

        assertEq(dao.balanceOf(attacker, votingTokenId2), 10);
    }

    function testInitialHoldersNotAffectedByVesting() public {
        // Initial holders (alice, bob) should not be affected by vesting
        assertEq(dao.balanceOf(alice, 0), 100);
        assertEq(dao.vestedBalance(alice), 100);

        assertEq(dao.balanceOf(bob, 0), 50);
        assertEq(dao.vestedBalance(bob), 50);
    }

    function testNoVestingWhenPeriodIsZero() public {
        // Create DAO without vesting
        address[] memory initialHolders = new address[](0);
        uint256[] memory initialAmounts = new uint256[](0);
        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        MarketDAO noVestingDao = new MarketDAO(
            "No Vesting DAO",
            20,
            51,
            100,
            50,
            true,
            TOKEN_PRICE,
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        noVestingDao.purchaseTokens{value: 0.5 ether}();

        // Tokens should be immediately available
        assertEq(noVestingDao.balanceOf(attacker, 0), 5);
        assertEq(noVestingDao.vestedBalance(attacker), 5);
    }
}
