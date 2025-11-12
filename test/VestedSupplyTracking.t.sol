// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract VestedSupplyTrackingTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address user1 = address(0x1);
    address user2 = address(0x2);
    address user3 = address(0x3);

    function setUp() public {
        address[] memory initialHolders = new address[](1);
        initialHolders[0] = user1;

        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100; // Initial holder has 100 vested tokens

        string[] memory treasuryConfig = new string[](0);

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support
            5100, // 51% quorum
            100,
            50,
            0, // flags (allowMinting=False)
            1 ether, // Token price
            100, // 100 block vesting period
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));
    }

    function testInitialSupplyAllVested() public {
        // Initial holders should have fully vested tokens
        assertEq(dao.totalSupply(0), 100, "Total supply should be 100");
        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "No unvested tokens initially");
        assertEq(dao.getTotalVestedSupply(), 100, "All tokens should be vested");
    }

    function testPurchaseCreatesUnvestedTokens() public {
        vm.deal(user2, 10 ether);

        vm.prank(user2);
        dao.purchaseTokens{value: 5 ether}();

        // User bought 5 tokens with vesting
        assertEq(dao.totalSupply(0), 105, "Total supply should be 105");
        assertEq(dao.totalUnvestedGovernanceTokens(), 5, "5 tokens should be unvested");
        assertEq(dao.getTotalVestedSupply(), 100, "Only original 100 should be vested");
    }

    function testMultiplePurchasesAccumulateUnvested() public {
        vm.deal(user2, 20 ether);

        // First purchase
        vm.prank(user2);
        dao.purchaseTokens{value: 3 ether}();

        assertEq(dao.totalUnvestedGovernanceTokens(), 3, "3 tokens unvested after first purchase");

        // Second purchase
        vm.prank(user2);
        dao.purchaseTokens{value: 7 ether}();

        assertEq(dao.totalUnvestedGovernanceTokens(), 10, "10 tokens unvested after second purchase");
        assertEq(dao.getTotalVestedSupply(), 100, "Vested supply unchanged");
    }

    function testCleanupDecrementsUnvestedCounter() public {
        vm.deal(user2, 10 ether);

        // Purchase tokens at block 1
        vm.roll(1);
        vm.prank(user2);
        dao.purchaseTokens{value: 5 ether}();

        assertEq(dao.totalUnvestedGovernanceTokens(), 5, "5 tokens unvested");
        assertEq(dao.getTotalVestedSupply(), 100, "100 vested");

        // Fast forward past vesting period (100 blocks)
        vm.roll(102);

        // Claim vested tokens
        vm.prank(user2);
        dao.claimVestedTokens();

        // Unvested counter should be decremented
        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "All tokens now vested");
        assertEq(dao.getTotalVestedSupply(), 105, "105 total vested");
    }

    function testVestingScheduleMergeTracksUnvested() public {
        vm.deal(user2, 20 ether);

        // Two purchases in same block with same vesting period
        vm.roll(1);
        vm.prank(user2);
        dao.purchaseTokens{value: 3 ether}();

        vm.prank(user2);
        dao.purchaseTokens{value: 2 ether}();

        // Should have 5 unvested tokens (merged into one schedule)
        assertEq(dao.totalUnvestedGovernanceTokens(), 5, "5 tokens unvested (merged)");
        assertEq(dao.getTotalVestedSupply(), 100, "100 vested");
    }

    function testQuorumUsesVestedSupply() public {
        vm.deal(user2, 500 ether);

        // Purchase 200 tokens with vesting
        vm.roll(1);
        vm.prank(user2);
        dao.purchaseTokens{value: 200 ether}();

        // Total supply = 300, but only 100 vested
        assertEq(dao.totalSupply(0), 300, "Total supply 300");
        assertEq(dao.getTotalVestedSupply(), 100, "Only 100 vested");

        // Create proposal and trigger election
        vm.prank(user1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test");

        vm.startPrank(user1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60); // 60% of 100 vested tokens
        vm.stopPrank();

        // Snapshot should use vested supply (100), not total (300)
        assertEq(proposal.snapshotTotalVotes(), 100, "Snapshot should be 100 (vested)");

        // Quorum = 51% of 100 = 51 tokens needed
        uint256 expectedQuorum = (100 * 5100) / 10000;
        assertEq(expectedQuorum, 51, "Expected quorum is 51");

        // User1 has 100 vested tokens, so they can meet quorum
        vm.prank(user1);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();
        assertEq(dao.balanceOf(user1, votingTokenId), 100, "User1 claimed 100 voting tokens");
    }

    function testVestedSupplyIncreasesAfterVestingExpires() public {
        vm.deal(user2, 100 ether);

        // Purchase at block 1
        vm.roll(1);
        vm.prank(user2);
        dao.purchaseTokens{value: 50 ether}();

        assertEq(dao.getTotalVestedSupply(), 100, "100 vested initially");

        // At block 50, still vesting
        vm.roll(50);
        assertEq(dao.getTotalVestedSupply(), 100, "Still 100 vested at block 50");

        // At block 101, vesting should be complete
        vm.roll(101);

        // Trigger cleanup by calling vestedBalance
        uint256 vestedBalance = dao.vestedBalance(user2);
        assertEq(vestedBalance, 50, "User2 should have 50 vested");

        // Claiming vested tokens needs to be done explicitly
        vm.prank(user2);
        dao.claimVestedTokens();

        assertEq(dao.getTotalVestedSupply(), 150, "150 total vested after cleanup");
    }

    function testMultipleUsersVestingTrackedCorrectly() public {
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);

        // User2 purchases at block 1
        vm.roll(1);
        vm.prank(user2);
        dao.purchaseTokens{value: 30 ether}();

        // User3 purchases at block 10
        vm.roll(10);
        vm.prank(user3);
        dao.purchaseTokens{value: 20 ether}();

        // Both users' tokens are unvested
        assertEq(dao.totalUnvestedGovernanceTokens(), 50, "50 tokens unvested");
        assertEq(dao.getTotalVestedSupply(), 100, "100 vested");

        // Fast forward to block 102 (user2's vesting complete, user3 still vesting)
        vm.roll(102);

        // Claim user2's vested tokens
        vm.prank(user2);
        dao.claimVestedTokens();

        assertEq(dao.totalUnvestedGovernanceTokens(), 20, "20 tokens still unvested (user3)");
        assertEq(dao.getTotalVestedSupply(), 130, "130 vested (100 + 30)");

        // Fast forward to block 111 (user3's vesting complete)
        vm.roll(111);

        // Claim user3's vested tokens
        vm.prank(user3);
        dao.claimVestedTokens();

        assertEq(dao.totalUnvestedGovernanceTokens(), 0, "All tokens vested");
        assertEq(dao.getTotalVestedSupply(), 150, "150 total vested");
    }

    function testProposalSupportChecksVestedBalance() public {
        vm.deal(user2, 100 ether);

        // User2 purchases 50 tokens with vesting
        vm.prank(user2);
        dao.purchaseTokens{value: 50 ether}();

        // Create proposal
        vm.prank(user1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test");

        // User2 tries to add support with unvested tokens - should fail
        vm.startPrank(user2);
        dao.setApprovalForAll(address(proposal), true);
        vm.expectRevert("Insufficient vested governance tokens");
        proposal.addSupport(10);
        vm.stopPrank();

        // User1 can add support with vested tokens
        vm.startPrank(user1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60); // Has 100 vested
        vm.stopPrank();

        assertTrue(proposal.electionTriggered(), "Election should trigger");
    }

    function testEdgeCaseZeroVestedSupply() public {
        // Create DAO with no initial holders
        address[] memory noHolders = new address[](0);
        uint256[] memory noAmounts = new uint256[](0);
        string[] memory treasuryConfig = new string[](0);

        MarketDAO emptyDao = new MarketDAO(
            "Empty DAO",
            2000,
            5100,
            100,
            50,
            0, // flags (allowMinting=False)
            1 ether,
            100,
            treasuryConfig,
            noHolders,
            noAmounts
        );

        assertEq(emptyDao.getTotalVestedSupply(), 0, "Should start with 0 vested");
        assertEq(emptyDao.totalUnvestedGovernanceTokens(), 0, "Should start with 0 unvested");

        // Purchase tokens
        vm.deal(user1, 10 ether);
        vm.prank(user1);
        emptyDao.purchaseTokens{value: 5 ether}();

        assertEq(emptyDao.getTotalVestedSupply(), 0, "Still 0 vested");
        assertEq(emptyDao.totalUnvestedGovernanceTokens(), 5, "5 unvested");
    }
}
