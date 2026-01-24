// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

/**
 * @title H03H04GovernanceLockTest
 * @notice Tests for H-03 (support double-counting) and H-04 (voting power inflation) fixes
 */
contract H03H04GovernanceLockTest is Test {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer = address(0x1);
    address attacker = address(0x2);
    address attackerAlt = address(0x3);
    address voter1 = address(0x4);

    function setUp() public {
        address[] memory initialHolders = new address[](3);
        initialHolders[0] = proposer;
        initialHolders[1] = attacker;
        initialHolders[2] = voter1;

        uint256[] memory initialAmounts = new uint256[](3);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        initialAmounts[2] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold
            5100, // 51% quorum
            100,
            50,
            0,
            0,
            0, // No vesting
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
    }

    // ==================== H-03 TESTS: Support Double-Counting ====================

    /**
     * @notice Test that H-03 attack is prevented - tokens locked after adding support
     */
    function testH03SupportLocksPreventsDoubleCount() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Attacker adds support with 30 tokens (15% - below 20% threshold)
        vm.prank(attacker);
        proposal.addSupport(30);

        // Verify support recorded
        assertEq(proposal.support(attacker), 30);
        assertEq(proposal.supportTotal(), 30);

        // Verify tokens are locked
        assertEq(dao.governanceLock(attacker), 30);
        assertEq(dao.transferableBalance(attacker), 20); // 50 - 30 = 20 transferable

        // Try to transfer ALL tokens - should fail (only 20 transferable)
        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeTransferFrom(attacker, attackerAlt, 0, 50, "");

        // Can transfer unlocked portion
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, attackerAlt, 0, 20, "");

        // attackerAlt now has 20 tokens, can only add 20 support
        vm.prank(attackerAlt);
        proposal.addSupport(20);

        // supportTotal should be 30 + 20 = 50, not 30 + 50 = 80 (attack prevented)
        assertEq(proposal.supportTotal(), 50);
    }

    /**
     * @notice Test partial support and partial transfer attempt
     */
    function testH03PartialSupportLock() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Attacker adds support with only 30 of their 50 tokens
        vm.prank(attacker);
        proposal.addSupport(30);

        // 30 locked, 20 transferable
        assertEq(dao.governanceLock(attacker), 30);
        assertEq(dao.transferableBalance(attacker), 20);

        // Can transfer the unlocked 20
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, attackerAlt, 0, 20, "");

        // Cannot transfer more
        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeTransferFrom(attacker, attackerAlt, 0, 1, "");
    }

    /**
     * @notice Test removing support unlocks tokens
     */
    function testRemoveSupportUnlocks() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Add support (below threshold to not trigger election)
        vm.prank(attacker);
        proposal.addSupport(30);
        assertEq(dao.governanceLock(attacker), 30);

        // Remove support
        vm.prank(attacker);
        proposal.removeSupport(20);
        assertEq(dao.governanceLock(attacker), 10);
        assertEq(dao.transferableBalance(attacker), 40);

        // Can now transfer 40
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, attackerAlt, 0, 40, "");
    }

    // ==================== H-04 TESTS: Voting Power Inflation ====================

    /**
     * @notice Test that H-04 attack is prevented - tokens locked after claiming voting tokens
     */
    function testH04VotingLockPreventsDoubleVote() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        // Attacker claims voting tokens
        vm.prank(attacker);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();
        assertEq(dao.balanceOf(attacker, votingTokenId), 50);

        // Verify governance tokens are locked (support lock + voting lock)
        // Initially attacker didn't add support, so only voting lock
        assertEq(dao.governanceLock(attacker), 50);
        assertEq(dao.transferableBalance(attacker), 0);

        // Try to transfer governance tokens to alt - should fail
        vm.prank(attacker);
        vm.expectRevert("Cannot transfer locked/unvested tokens");
        dao.safeTransferFrom(attacker, attackerAlt, 0, 50, "");

        // Alt cannot claim voting tokens (has no governance tokens)
        vm.prank(attackerAlt);
        vm.expectRevert("No vested governance tokens to claim");
        proposal.claimVotingTokens();
    }

    /**
     * @notice Test that support lock + voting lock accumulate correctly
     */
    function testCumulativeLocks() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Attacker adds support with 30 tokens (below threshold)
        vm.prank(attacker);
        proposal.addSupport(30);
        assertEq(dao.governanceLock(attacker), 30);

        // Proposer triggers election with their support
        vm.prank(proposer);
        proposal.addSupport(40); // Total now 70, which is 35% > 20% threshold
        assertTrue(proposal.electionTriggered());

        // Attacker claims voting tokens - lock increases
        vm.prank(attacker);
        proposal.claimVotingTokens();
        
        // Lock should be 30 (support) + 50 (voting) = 80
        // Attacker has 50 tokens, so transferable is 0
        assertEq(dao.governanceLock(attacker), 80);
        assertEq(dao.transferableBalance(attacker), 0);
    }

    // ==================== LOCK RELEASE TESTS ====================

    /**
     * @notice Test releasing locks after proposal executes
     */
    function testReleaseLockAfterExecution() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Attacker supports (below threshold)
        vm.prank(attacker);
        proposal.addSupport(30);

        // Proposer triggers election
        vm.prank(proposer);
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        // Attacker claims voting tokens
        vm.prank(attacker);
        proposal.claimVotingTokens();
        
        // Verify locks
        assertEq(proposal.supportLocked(attacker), 30);
        assertEq(proposal.votingLocked(attacker), 50);
        assertEq(dao.governanceLock(attacker), 80);

        // Vote and execute
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

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

        // Proposal is resolved
        assertTrue(proposal.isResolved());

        // Release locks
        vm.prank(attacker);
        proposal.releaseProposalLocks();

        // Verify locks released
        assertEq(proposal.supportLocked(attacker), 0);
        assertEq(proposal.votingLocked(attacker), 0);
        assertEq(dao.governanceLock(attacker), 0);
        assertEq(dao.transferableBalance(attacker), 50);

        // Can now transfer
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, attackerAlt, 0, 50, "");
    }

    /**
     * @notice Test releasing locks after proposal expires
     */
    function testReleaseLockAfterExpiration() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Attacker supports with some tokens
        vm.prank(attacker);
        proposal.addSupport(30);

        assertEq(dao.governanceLock(attacker), 30);

        // Let proposal expire (maxProposalAge = 100 blocks)
        vm.roll(block.number + 101);

        // Proposal is resolved (expired)
        assertTrue(proposal.isResolved());

        // Release locks
        vm.prank(attacker);
        proposal.releaseProposalLocks();

        assertEq(dao.governanceLock(attacker), 0);
    }

    /**
     * @notice Test cannot release locks while proposal is active
     */
    function testCannotReleaseLockWhileActive() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(attacker);
        proposal.addSupport(50);

        // Try to release while proposal is active
        vm.prank(attacker);
        vm.expectRevert("Proposal not yet resolved");
        proposal.releaseProposalLocks();
    }

    /**
     * @notice Test multiple proposals can lock same user's tokens
     */
    function testMultipleProposalLocks() public {
        vm.prank(proposer);
        ResolutionProposal proposal1 = factory.createResolutionProposal("Proposal 1");
        
        vm.prank(proposer);
        ResolutionProposal proposal2 = factory.createResolutionProposal("Proposal 2");

        // Attacker supports both proposals with 25 tokens each
        vm.prank(attacker);
        proposal1.addSupport(25);
        
        vm.prank(attacker);
        proposal2.addSupport(25);

        // Total lock is 50
        assertEq(dao.governanceLock(attacker), 50);
        assertEq(dao.transferableBalance(attacker), 0);

        // Let proposal1 expire
        vm.roll(block.number + 101);

        // Release proposal1 locks
        vm.prank(attacker);
        proposal1.releaseProposalLocks();

        // Still have 25 locked from proposal2
        assertEq(dao.governanceLock(attacker), 25);
        assertEq(dao.transferableBalance(attacker), 25);

        // Release proposal2 locks
        vm.prank(attacker);
        proposal2.releaseProposalLocks();

        // All unlocked
        assertEq(dao.governanceLock(attacker), 0);
    }

    /**
     * @notice Test normal voting flow still works
     */
    function testNormalVotingFlowWorks() public {
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(40);

        // All users claim voting tokens
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

        // Vote
        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");
        
        vm.prank(attacker);
        dao.safeTransferFrom(attacker, yesVote, votingToken, 50, "");

        // Wait for election to end and execute normally
        vm.roll(block.number + 51);
        proposal.execute();

        assertTrue(proposal.executed());
    }
}
