// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";
import "../src/DistributionRedemption.sol";

contract ConcurrentDistributionProposalTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    address voter3 = address(0x4);

    function setUp() public {
        address[] memory initialHolders = new address[](4);
        initialHolders[0] = proposer;
        initialHolders[1] = voter1;
        initialHolders[2] = voter2;
        initialHolders[3] = voter3;

        uint256[] memory initialAmounts = new uint256[](4);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        initialAmounts[2] = 30;
        initialAmounts[3] = 20;

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support
            5100, // 51% quorum
            100,
            50,
            0, // flags
            0,
            0, // No vesting
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Fund the DAO with ETH
        vm.deal(address(dao), 100 ether);
    }

    function testSecondDistributionElectionRevertsWhileFirstActive() public {
        // Create first distribution proposal (0.1 ETH/token = 20 ETH total)
        vm.prank(proposer);
        DistributionProposal proposal1 = factory.createDistributionProposal(
            "First distribution",
            address(0),
            0,
            0.1 ether
        );

        // Create second distribution proposal (0.1 ETH/token = 20 ETH total)
        vm.prank(voter1);
        DistributionProposal proposal2 = factory.createDistributionProposal(
            "Second distribution",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election on first proposal
        vm.prank(proposer);
        proposal1.addSupport(60);
        assertTrue(proposal1.electionTriggered());

        // First redemption contract is now active
        assertTrue(dao.activeRedemptionContract() != address(0));

        // Triggering election on second proposal should revert
        // because activeRedemptionContract is already set.
        // The revert happens inside _lockFunds when addSupport triggers the election.
        vm.prank(voter1);
        proposal2.addSupport(10);
        vm.prank(voter2);
        vm.expectRevert("Another redemption contract is already active");
        proposal2.addSupport(30);
    }

    function testSecondDistributionCanProceedAfterFirstCompletes() public {
        // Create first distribution proposal
        vm.prank(proposer);
        DistributionProposal proposal1 = factory.createDistributionProposal(
            "First distribution",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election on first proposal
        vm.prank(proposer);
        proposal1.addSupport(60);

        // Vote YES and execute first proposal
        vm.prank(proposer);
        proposal1.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal1), true);

        address yesVote = proposal1.yesVoteAddress();
        uint256 votingToken = proposal1.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(voter1);
        proposal1.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal1), true);
        vm.prank(voter1);
        dao.safeTransferFrom(voter1, yesVote, votingToken, 50, "");

        vm.roll(block.number + 51);
        proposal1.execute();

        // activeRedemptionContract should now be cleared
        assertEq(dao.activeRedemptionContract(), address(0));

        // Now second distribution proposal can trigger its election
        vm.prank(voter1);
        DistributionProposal proposal2 = factory.createDistributionProposal(
            "Second distribution",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal2.addSupport(60);
        assertTrue(proposal2.electionTriggered());
        assertTrue(dao.activeRedemptionContract() != address(0));
    }

    function testSecondDistributionCanProceedAfterFirstFails() public {
        // Create first distribution proposal
        vm.prank(proposer);
        DistributionProposal proposal1 = factory.createDistributionProposal(
            "First distribution",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election on first proposal
        vm.prank(proposer);
        proposal1.addSupport(60);

        // Vote NO and fail first proposal
        vm.prank(proposer);
        proposal1.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal1), true);

        address noVote = proposal1.noVoteAddress();
        uint256 votingToken = proposal1.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, noVote, votingToken, 100, "");

        vm.roll(block.number + 51);
        proposal1.failProposal();

        // activeRedemptionContract should now be cleared
        assertEq(dao.activeRedemptionContract(), address(0));

        // Now second distribution proposal can trigger its election
        vm.prank(voter1);
        DistributionProposal proposal2 = factory.createDistributionProposal(
            "Second distribution",
            address(0),
            0,
            0.1 ether
        );

        vm.prank(proposer);
        proposal2.addSupport(60);
        assertTrue(proposal2.electionTriggered());
    }
}
