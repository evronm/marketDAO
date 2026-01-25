// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

/**
 * @title H05OperatorLateVoteTest
 * @notice Tests for H-05 fix: Operators cannot vote after election deadline
 */
contract H05OperatorLateVoteTest is Test {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer = address(0x1);
    address voter = address(0x2);
    address operator = address(0x3);
    address voter2 = address(0x4);

    function setUp() public {
        address[] memory initialHolders = new address[](3);
        initialHolders[0] = proposer;
        initialHolders[1] = voter;
        initialHolders[2] = voter2;

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
            50,   // election duration
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

    /**
     * @notice Test that operator cannot vote after election ends (H-05 attack prevented)
     */
    function testH05OperatorCannotVoteAfterElectionEnds() public {
        // Create and trigger election
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(proposer);
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        // Voter claims voting tokens and approves operator
        vm.prank(voter);
        proposal.claimVotingTokens();

        vm.prank(voter);
        dao.setApprovalForAll(operator, true);

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVote = proposal.yesVoteAddress();

        // Fast forward past election end
        vm.roll(block.number + 51);

        // Operator tries to vote on behalf of voter - should fail
        vm.prank(operator);
        vm.expectRevert("Election has ended");
        dao.safeTransferFrom(voter, yesVote, votingTokenId, 50, "");
    }

    /**
     * @notice Test that operator CAN vote during active election (normal behavior)
     */
    function testOperatorCanVoteDuringActiveElection() public {
        // Create and trigger election
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(proposer);
        proposal.addSupport(40);

        // Voter claims voting tokens and approves operator
        vm.prank(voter);
        proposal.claimVotingTokens();

        vm.prank(voter);
        dao.setApprovalForAll(operator, true);

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVote = proposal.yesVoteAddress();

        // Operator votes on behalf of voter during active election - should succeed
        vm.prank(operator);
        dao.safeTransferFrom(voter, yesVote, votingTokenId, 50, "");

        // Verify vote was cast
        assertEq(dao.balanceOf(yesVote, votingTokenId), 50);
    }

    /**
     * @notice Test that direct vote after election also fails (existing behavior)
     */
    function testDirectVoteAfterElectionFails() public {
        // Create and trigger election
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(proposer);
        proposal.addSupport(40);

        // Voter claims voting tokens
        vm.prank(voter);
        proposal.claimVotingTokens();

        vm.prank(voter);
        dao.setApprovalForAll(address(proposal), true);

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVote = proposal.yesVoteAddress();

        // Fast forward past election end
        vm.roll(block.number + 51);

        // Direct vote after election - should fail
        vm.prank(voter);
        vm.expectRevert("Election has ended");
        dao.safeTransferFrom(voter, yesVote, votingTokenId, 50, "");
    }

    /**
     * @notice Test batch transfer by operator after election also fails
     */
    function testH05OperatorBatchTransferAfterElectionFails() public {
        // Create and trigger election
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(proposer);
        proposal.addSupport(40);

        // Voter claims voting tokens and approves operator
        vm.prank(voter);
        proposal.claimVotingTokens();

        vm.prank(voter);
        dao.setApprovalForAll(operator, true);

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVote = proposal.yesVoteAddress();

        // Fast forward past election end
        vm.roll(block.number + 51);

        // Prepare batch transfer
        uint256[] memory ids = new uint256[](1);
        ids[0] = votingTokenId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50;

        // Operator tries batch transfer after election - should fail
        vm.prank(operator);
        vm.expectRevert("Election has ended");
        dao.safeBatchTransferFrom(voter, yesVote, ids, amounts, "");
    }

    /**
     * @notice Test that the attack scenario from the audit is prevented
     * Attack: Operator waits until election ends, then casts decisive votes
     */
    function testH05FullAttackScenarioPrevented() public {
        // Create and trigger election
        vm.prank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test proposal");

        vm.prank(proposer);
        proposal.addSupport(40);

        // Setup: proposer and voter2 claim and vote during election
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(voter2);
        proposal.claimVotingTokens();
        vm.prank(voter2);
        dao.setApprovalForAll(address(proposal), true);

        // voter (the victim) claims but gives operator approval
        vm.prank(voter);
        proposal.claimVotingTokens();
        vm.prank(voter);
        dao.setApprovalForAll(operator, true);

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVote = proposal.yesVoteAddress();
        address noVote = proposal.noVoteAddress();

        // During election: proposer votes yes (100), voter2 votes no (50)
        // This makes it 100 yes vs 50 no - proposal would pass
        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingTokenId, 100, "");

        vm.prank(voter2);
        dao.safeTransferFrom(voter2, noVote, votingTokenId, 50, "");

        // Election ends
        vm.roll(block.number + 51);

        // ATTACK: Operator tries to flip the vote by adding voter's 50 tokens to NO
        // This would make it 100 yes vs 100 no - proposal would fail
        // With H-05 fix, this should be blocked
        vm.prank(operator);
        vm.expectRevert("Election has ended");
        dao.safeTransferFrom(voter, noVote, votingTokenId, 50, "");

        // Verify vote counts are unchanged
        assertEq(dao.balanceOf(yesVote, votingTokenId), 100);
        assertEq(dao.balanceOf(noVote, votingTokenId), 50);

        // Proposal can still execute with original results
        proposal.execute();
        assertTrue(proposal.executed());
    }
}
