// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract FundLockingTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer1 = address(0x1);
    address proposer2 = address(0x2);
    address voter1 = address(0x3);
    address voter2 = address(0x4);

    function setUp() public {
        address[] memory initialHolders = new address[](4);
        initialHolders[0] = proposer1;
        initialHolders[1] = proposer2;
        initialHolders[2] = voter1;
        initialHolders[3] = voter2;

        uint256[] memory initialAmounts = new uint256[](4);
        initialAmounts[0] = 100;
        initialAmounts[1] = 100;
        initialAmounts[2] = 50;
        initialAmounts[3] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support
            5100, // 51% quorum
            100,
            50,
            0, // flags (allowMinting=False)
            0,
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Fund the DAO with exactly 10 ETH
        vm.deal(address(dao), 10 ether);
    }

    function testFundLockingPreventsDoubleSpend() public {
        // Create first proposal for 10 ETH
        vm.prank(proposer1);
        TreasuryProposal proposal1 = factory.createTreasuryProposal(
            "Send 10 ETH - Proposal 1",
            address(0x999),
            10 ether,
            address(0),
            0
        );

        // Can still create second proposal at creation time (funds not locked yet)
        vm.prank(proposer2);
        TreasuryProposal proposal2 = factory.createTreasuryProposal(
            "Send 10 ETH - Proposal 2",
            address(0x998),
            10 ether,
            address(0),
            0
        );

        // Trigger first election - this locks the funds
        vm.prank(proposer1);
        proposal1.addSupport(60);

        // Verify funds are now locked
        assertEq(dao.getTotalLockedETH(), 10 ether);
        assertEq(dao.getAvailableETH(), 0);

        // Now trying to trigger second election should fail (can't lock already-locked funds)
        vm.prank(proposer2);
        vm.expectRevert("Insufficient available ETH");
        proposal2.addSupport(60);
    }

    function testFundsLockedAtElectionTrigger() public {
        // Create proposal for 5 ETH
        vm.prank(proposer1);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send 5 ETH",
            address(0x999),
            5 ether,
            address(0),
            0
        );

        // Initially, funds are NOT locked yet (election not triggered)
        assertEq(dao.getTotalLockedETH(), 0);
        assertEq(dao.getAvailableETH(), 10 ether);

        // Add support to trigger election
        vm.prank(proposer1);
        proposal.addSupport(60);

        // NOW funds should be locked
        assertTrue(proposal.electionTriggered());
        assertEq(dao.getTotalLockedETH(), 5 ether);
        assertEq(dao.getAvailableETH(), 5 ether);

        // Can create another proposal for remaining 5 ETH
        vm.prank(proposer2);
        TreasuryProposal proposal2 = factory.createTreasuryProposal(
            "Send remaining 5 ETH",
            address(0x998),
            5 ether,
            address(0),
            0
        );

        // Can also trigger this one
        vm.prank(proposer2);
        proposal2.addSupport(60);

        // Now all funds are locked
        assertEq(dao.getTotalLockedETH(), 10 ether);
        assertEq(dao.getAvailableETH(), 0);

        // Cannot create a third proposal - no funds available
        vm.prank(proposer1);
        vm.expectRevert("Insufficient available ETH balance");
        factory.createTreasuryProposal(
            "Send 1 more ETH - should fail",
            address(0x997),
            1 ether,
            address(0),
            0
        );
    }

    function testFundsUnlockedWhenProposalFails() public {
        // Create proposal
        vm.prank(proposer1);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send 5 ETH",
            address(0x999),
            5 ether,
            address(0),
            0
        );

        // Trigger election
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60);
        vm.stopPrank();

        // Funds are locked
        assertEq(dao.getTotalLockedETH(), 5 ether);

        // Claim voting tokens
        vm.prank(proposer1);
        proposal.claimVotingTokens();
        vm.prank(proposer2);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter2);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();

        // Cast 200 NO votes (majority)
        vm.startPrank(proposer1);
        dao.safeTransferFrom(proposer1, proposal.noVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        vm.startPrank(proposer2);
        dao.safeTransferFrom(proposer2, proposal.noVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        // Check early termination
        proposal.checkEarlyTermination();

        // Funds should be unlocked now
        assertEq(dao.getTotalLockedETH(), 0);
        assertEq(dao.getAvailableETH(), 10 ether);
        assertTrue(proposal.executed()); // Marked as executed (failed)
    }

    function testFundsUnlockedWhenQuorumNotMet() public {
        // Create proposal
        vm.prank(proposer1);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send 5 ETH",
            address(0x999),
            5 ether,
            address(0),
            0
        );

        // Trigger election
        vm.prank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        vm.prank(proposer1);
        proposal.addSupport(60);

        // Funds are locked
        assertEq(dao.getTotalLockedETH(), 5 ether);

        // Don't vote - let election end without quorum
        vm.roll(block.number + 51); // Past election duration

        // execute() will revert, so call failProposal() to explicitly fail and unlock
        proposal.failProposal();

        // Funds should be unlocked now
        assertEq(dao.getTotalLockedETH(), 0);
        assertEq(dao.getAvailableETH(), 10 ether);
        assertTrue(proposal.executed()); // Marked as executed (failed)
    }

    function testFundsConsumedWhenProposalPasses() public {
        address recipient = address(0x999);

        // Create proposal
        vm.prank(proposer1);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send 5 ETH",
            recipient,
            5 ether,
            address(0),
            0
        );

        // Trigger election
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60);
        vm.stopPrank();

        // Funds are locked
        assertEq(dao.getTotalLockedETH(), 5 ether);

        // Claim voting tokens
        vm.prank(proposer1);
        proposal.claimVotingTokens();
        vm.prank(proposer2);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();

        // Cast 200 YES votes (majority)
        vm.startPrank(proposer1);
        dao.safeTransferFrom(proposer1, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        vm.startPrank(proposer2);
        dao.safeTransferFrom(proposer2, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        // Check early termination - should execute
        proposal.checkEarlyTermination();

        // Funds should be unlocked (consumed)
        assertEq(dao.getTotalLockedETH(), 0);
        // Available should be 5 ETH (10 - 5 transferred)
        assertEq(dao.getAvailableETH(), 5 ether);
        assertEq(address(dao).balance, 5 ether);
        assertEq(recipient.balance, 5 ether);
        assertTrue(proposal.executed());
    }

    function testMultipleProposalsLockTracking() public {
        // Create 3 proposals for 3 ETH each
        vm.prank(proposer1);
        TreasuryProposal proposal1 = factory.createTreasuryProposal(
            "Proposal 1",
            address(0x991),
            3 ether,
            address(0),
            0
        );

        vm.prank(proposer1);
        TreasuryProposal proposal2 = factory.createTreasuryProposal(
            "Proposal 2",
            address(0x992),
            3 ether,
            address(0),
            0
        );

        vm.prank(proposer1);
        TreasuryProposal proposal3 = factory.createTreasuryProposal(
            "Proposal 3",
            address(0x993),
            3 ether,
            address(0),
            0
        );

        // Trigger all elections
        vm.startPrank(proposer1);
        proposal1.addSupport(60);
        proposal2.addSupport(60);
        proposal3.addSupport(60);
        vm.stopPrank();

        // All funds locked
        assertEq(dao.getTotalLockedETH(), 9 ether);
        assertEq(dao.getAvailableETH(), 1 ether);

        // Verify tracking array
        address[] memory locked = dao.getProposalsWithLockedFunds();
        assertEq(locked.length, 3);
    }

    function testReceiveETHTriggersReleaseCheck() public {
        // Create proposal for 15 ETH (more than available)
        vm.prank(proposer1);
        vm.expectRevert("Insufficient available ETH balance");
        factory.createTreasuryProposal(
            "Send 15 ETH",
            address(0x999),
            15 ether,
            address(0),
            0
        );

        // Send 5 more ETH to DAO
        vm.deal(address(this), 5 ether);
        (bool success,) = address(dao).call{value: 5 ether}("");
        assertTrue(success);

        // Now we should be able to create the proposal
        vm.prank(proposer1);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Send 15 ETH",
            address(0x999),
            15 ether,
            address(0),
            0
        );

        // Verify it was created successfully
        assertEq(proposal.amount(), 15 ether);
    }
}
