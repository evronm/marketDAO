// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract CanTriggerElectionExpirationTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address proposer1 = address(0x1);
    address proposer2 = address(0x2);

    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = proposer1;
        initialHolders[1] = proposer2;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 100;

        string[] memory treasuryConfig = new string[](0);

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support (need 40 tokens)
            5100, // 51% quorum
            100,  // Max proposal age: 100 blocks
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
    }

    function testCannotTriggerElectionAfterExpiration() public {
        // Create proposal at block 1
        vm.roll(1);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support just below threshold (need 40, add 39)
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(39);
        vm.stopPrank();

        // Verify election not triggered yet
        assertFalse(proposal.electionTriggered(), "Election should not be triggered yet");
        assertTrue(proposal.canTriggerElection() == false, "Should not be able to trigger yet");

        // Roll forward to block 101 (past expiration)
        vm.roll(102);

        // Verify canTriggerElection returns false due to expiration
        assertFalse(proposal.canTriggerElection(), "Should not trigger after expiration");

        // Try to add more support - should fail because proposal expired
        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal), true);
        vm.expectRevert("Proposal expired");
        proposal.addSupport(10);
        vm.stopPrank();

        // Verify election was never triggered
        assertFalse(proposal.electionTriggered(), "Election should not have been triggered");
    }

    function testCanTriggerElectionBeforeExpiration() public {
        // Create proposal at block 1
        vm.roll(1);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support just below threshold at block 50 (still within expiration)
        vm.roll(50);
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(39);
        vm.stopPrank();

        // Verify can still trigger
        assertFalse(proposal.canTriggerElection(), "Should not be able to trigger yet with 39");

        // Add more support to reach threshold (still before expiration)
        vm.roll(99); // Still within 100 blocks from creation
        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);
        vm.stopPrank();

        // Should have triggered
        assertTrue(proposal.electionTriggered(), "Election should be triggered");
    }

    function testCanTriggerElectionReturnsFalseAtExactExpiration() public {
        // Create proposal at block 1
        vm.roll(1);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add enough support to trigger
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(39);
        vm.stopPrank();

        // At block 100, still within range (createdAt=1, maxAge=100, expires at 101)
        vm.roll(100);
        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);
        vm.stopPrank();

        // Should have triggered since we're at block 100 (createdAt + maxAge = 1 + 100 = 101)
        assertTrue(proposal.electionTriggered(), "Should trigger at block 100");
    }

    function testCannotTriggerAtExactExpirationBlock() public {
        // Create proposal at block 0
        vm.roll(0);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support just below threshold
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(39);
        vm.stopPrank();

        // At exact expiration block (createdAt + maxAge = 0 + 100 = 100)
        vm.roll(100);

        // canTriggerElection should return false
        assertFalse(proposal.canTriggerElection(), "Should not trigger at exact expiration block");

        // Trying to add support should fail
        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal), true);
        vm.expectRevert("Proposal expired");
        proposal.addSupport(10);
        vm.stopPrank();
    }

    function testCanTriggerElectionJustBeforeExpiration() public {
        // Create proposal at block 0
        vm.roll(0);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support just below threshold
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(39);
        vm.stopPrank();

        // At one block before expiration (createdAt=0, maxAge=100, expires at 100, so block 99 is ok)
        vm.roll(99);

        // Should be able to trigger
        assertTrue(proposal.canTriggerElection() == false, "Not enough support yet");

        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);
        vm.stopPrank();

        // Should have triggered
        assertTrue(proposal.electionTriggered(), "Should trigger just before expiration");
    }

    function testSupportTotalReachesThresholdButExpired() public {
        // Create proposal at block 1
        vm.roll(1);
        vm.prank(proposer1);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support to exactly reach threshold
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40); // Exactly at threshold
        vm.stopPrank();

        // Should have triggered immediately
        assertTrue(proposal.electionTriggered(), "Should trigger at threshold");

        // Now create another proposal
        vm.roll(1);
        vm.prank(proposer1);
        ResolutionProposal proposal2 = factory.createResolutionProposal("Test Proposal 2");

        // Add 40 tokens but over multiple transactions
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal2), true);
        proposal2.addSupport(20);
        vm.stopPrank();

        // Roll past expiration
        vm.roll(102);

        // Even though we have 20 and threshold is 40, expired proposals can't add more
        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal2), true);
        vm.expectRevert("Proposal expired");
        proposal2.addSupport(20);
        vm.stopPrank();

        // Verify election never triggered
        assertFalse(proposal2.electionTriggered(), "Expired proposal should not trigger");
    }
}
