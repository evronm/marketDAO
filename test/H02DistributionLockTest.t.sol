// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";
import "../src/DistributionRedemption.sol";

/**
 * @title H02DistributionLockTest
 * @notice Tests for the H-02 vulnerability fix: preventing double-claim distribution
 *         by locking governance tokens after registration
 */
contract H02DistributionLockTest is Test {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer = address(0x1);
    address attacker = address(0x2);
    address attackerAlt = address(0x3);  // Attacker's second wallet
    address voter1 = address(0x4);

    function setUp() public {
        address[] memory initialHolders = new address[](3);
        initialHolders[0] = proposer;
        initialHolders[1] = attacker;
        initialHolders[2] = voter1;

        uint256[] memory initialAmounts = new uint256[](3);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;   // Attacker has 50 tokens
        initialAmounts[2] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold
            5100, // 51% quorum
            100,  // max proposal age
            50,   // election duration
            0,    // flags
            0,    // token price
            0,    // no vesting (simplify test)
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        // Deploy implementation contracts
        ResolutionProposal resolutionImpl = new ResolutionProposal();
        TreasuryProposal treasuryImpl = new TreasuryProposal();
        MintProposal mintImpl = new MintProposal();
        ParameterProposal parameterImpl = new ParameterProposal();
        DistributionProposal distributionImpl = new DistributionProposal();

        factory = new ProposalFactory(
            dao,
            address(resolutionImpl),
            address(treasuryImpl),
            address(mintImpl),
            address(parameterImpl),
            address(distributionImpl)
        );

        dao.setFactory(address(factory));

        // Fund the DAO with 20 ETH for distribution
        vm.deal(address(dao), 20 ether);
    }

    /**
     * @notice Test that the H-02 attack is now prevented
     * @dev Attack flow that should now fail:
     *      1. Attacker registers with 50 tokens
     *      2. Attacker tries to transfer tokens to attackerAlt
     *      3. Transfer should fail because tokens are locked
     */
    function testH02AttackPrevented() public {
        // Create distribution proposal: 0.1 ETH per governance token
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),  // ETH
            0,
            0.1 ether
        );

        // Trigger election (proposer has 100 tokens, needs 40 for 20% threshold)
        vm.prank(proposer);
        proposal.addSupport(60);

        assertTrue(proposal.electionTriggered());
        assertTrue(address(proposal.redemptionContract()) != address(0));

        // Step 1: Attacker registers with their 50 tokens
        vm.prank(attacker);
        proposal.registerForDistribution();

        // Verify attacker is registered
        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(redemption.registeredBalance(attacker), 50);

        // Step 2: Attacker tries to transfer tokens to their alt account
        // This should FAIL because the tokens are now locked
        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeTransferFrom(attacker, attackerAlt, 0, 50, "");

        // Verify attacker still has tokens (transfer failed)
        assertEq(dao.balanceOf(attacker, 0), 50);
        assertEq(dao.balanceOf(attackerAlt, 0), 0);

        // Step 3: Verify attackerAlt cannot register (has no tokens)
        vm.prank(attackerAlt);
        vm.expectRevert(DistributionRedemption.NothingToClaim.selector);
        proposal.registerForDistribution();
    }

    /**
     * @notice Test that partial transfers are also blocked
     * @dev Attacker shouldn't be able to transfer even part of locked tokens
     */
    function testPartialTransferBlocked() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Register with 50 tokens
        vm.prank(attacker);
        proposal.registerForDistribution();

        // Try to transfer just 1 token - should still fail
        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeTransferFrom(attacker, attackerAlt, 0, 1, "");
    }

    /**
     * @notice Test normal flow: registration, voting, execution, and claim
     */
    function testNormalDistributionFlow() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register for distribution
        vm.prank(attacker);
        proposal.registerForDistribution();

        vm.prank(voter1);
        proposal.registerForDistribution();

        // Claim voting tokens and vote
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(attacker);
        proposal.claimVotingTokens();
        vm.prank(attacker);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        // Vote yes
        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(attacker);
        dao.safeTransferFrom(attacker, yesVote, votingToken, 50, "");

        // Wait for election to end and execute
        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // Verify funds transferred to redemption contract
        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(address(redemption).balance, 20 ether);

        // Claim distributions
        uint256 attackerBalanceBefore = attacker.balance;
        vm.prank(attacker);
        redemption.claim();
        assertEq(attacker.balance, attackerBalanceBefore + 5 ether); // 50 * 0.1 ETH

        uint256 voter1BalanceBefore = voter1.balance;
        vm.prank(voter1);
        redemption.claim();
        assertEq(voter1.balance, voter1BalanceBefore + 5 ether); // 50 * 0.1 ETH
    }

    /**
     * @notice Test that tokens are unlocked after claim
     */
    function testTokensUnlockedAfterClaim() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(attacker);
        proposal.registerForDistribution();

        // Verify tokens are locked
        assertEq(dao.distributionLock(attacker), 50);
        assertEq(dao.transferableBalance(attacker), 0);

        // Complete the proposal
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(attacker);
        proposal.claimVotingTokens();
        vm.prank(attacker);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(attacker);
        dao.safeTransferFrom(attacker, yesVote, votingToken, 50, "");

        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // Claim - this should unlock tokens
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(attacker);
        redemption.claim();

        // Verify tokens are now unlocked
        assertEq(dao.distributionLock(attacker), 0);
        assertEq(dao.transferableBalance(attacker), 50);

        // Now transfer should succeed
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, attackerAlt, 0, 50, "");
        assertEq(dao.balanceOf(attackerAlt, 0), 50);
    }

    /**
     * @notice Test that non-claimers can release lock after distribution ends
     */
    function testReleaseLockAfterDistributionEnds() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Attacker registers but decides not to claim
        vm.prank(attacker);
        proposal.registerForDistribution();

        // Complete the proposal - need enough votes for quorum (51% of 200 = 102)
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        // Proposer votes 100, voter1 votes 50 = 150 total (75% > 51% quorum)
        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(voter1);
        dao.safeTransferFrom(voter1, yesVote, votingToken, 50, "");

        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // Verify tokens are still locked
        assertEq(dao.distributionLock(attacker), 50);

        // Release lock without claiming
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(attacker);
        redemption.releaseLock();

        // Verify tokens are now unlocked
        assertEq(dao.distributionLock(attacker), 0);
        assertEq(dao.transferableBalance(attacker), 50);
    }

    /**
     * @notice Test cannot release lock while distribution is still active
     */
    function testCannotReleaseLockDuringActiveDistribution() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(attacker);
        proposal.registerForDistribution();

        // Try to release lock while election is still active
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(attacker);
        vm.expectRevert(DistributionRedemption.DistributionStillActive.selector);
        redemption.releaseLock();
    }

    /**
     * @notice Test that transferableBalance correctly accounts for locks
     */
    function testTransferableBalanceCalculation() public {
        // Initially, all tokens are transferable
        assertEq(dao.transferableBalance(attacker), 50);
        assertEq(dao.distributionLock(attacker), 0);

        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(attacker);
        proposal.registerForDistribution();

        // After registration, no tokens are transferable
        assertEq(dao.transferableBalance(attacker), 0);
        assertEq(dao.distributionLock(attacker), 50);

        // vestedBalance is still 50 (locked != unvested)
        assertEq(dao.vestedBalance(attacker), 50);
    }

    /**
     * @notice Test batch transfer is also blocked
     */
    function testBatchTransferBlocked() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(attacker);
        proposal.registerForDistribution();

        // Try batch transfer
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50;

        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeBatchTransferFrom(attacker, attackerAlt, ids, amounts, "");
    }
}
