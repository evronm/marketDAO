// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";

contract MarketDAOTest is Test {
    MarketDAO public dao;
    address public user1;
    address public user2;
    address public user3;

    // Test constants
    string constant DAO_NAME = "Test DAO";
    uint256 constant SUPPORT_THRESHOLD = 51; // 51%
    uint256 constant QUORUM_PERCENTAGE = 40; // 40%
    uint256 constant ELECTION_DELAY = 1 days;
    uint256 constant ELECTION_DURATION = 3 days;
    string constant URI = "ipfs://test";

    function setUp() public {
        // Create users with initial ETH
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);

        // Deploy DAO
        dao = new MarketDAO(
            DAO_NAME,
            SUPPORT_THRESHOLD,
            QUORUM_PERCENTAGE,
            ELECTION_DELAY,
            ELECTION_DURATION,
            URI
        );

        // Mint some initial governance tokens
        dao.mint(user1, 0, 100); // 100 governance tokens to user1
        dao.mint(user2, 0, 50);  // 50 governance tokens to user2
        dao.mint(user3, 0, 50);  // 50 governance tokens to user3
    }

    // Basic Setup Tests
    function testInitialSetup() public {
        assertEq(dao.name(), DAO_NAME);
        assertEq(dao.supportThreshold(), SUPPORT_THRESHOLD);
        assertEq(dao.quorumPercentage(), QUORUM_PERCENTAGE);
        assertEq(dao.electionDelay(), ELECTION_DELAY);
        assertEq(dao.electionDuration(), ELECTION_DURATION);
        
        // Check initial token distribution
        assertEq(dao.balanceOf(user1, 0), 100);
        assertEq(dao.balanceOf(user2, 0), 50);
        assertEq(dao.balanceOf(user3, 0), 50);
        assertEq(dao.totalSupply(0), 200);
    }

    // Proposal Creation Tests
    function testCreateTextProposal() public {
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(
            "Test Proposal",
            address(0),
            0
        );
        
        (
            uint256 id,
            address proposer,
            string memory description,
            address tokenRecipient,
            uint256 tokenAmount,
            uint256 supportCount,
            bool executed
        ) = dao.proposals(proposalId);
        
        assertEq(id, proposalId);
        assertEq(proposer, user1);
        assertEq(description, "Test Proposal");
        assertEq(tokenRecipient, address(0));
        assertEq(tokenAmount, 0);
        assertEq(supportCount, 0);
        assertEq(executed, false);
    }

    function testCreateTokenProposal() public {
        vm.prank(user1);
        uint256 proposalId = dao.createProposal(
            "Token Award",
            user2,
            100
        );
        
        (
            uint256 id,
            address proposer,
            string memory description,
            address tokenRecipient,
            uint256 tokenAmount,
            ,
            
        ) = dao.proposals(proposalId);
        
        assertEq(id, proposalId);
        assertEq(proposer, user1);
        assertEq(description, "Token Award");
        assertEq(tokenRecipient, user2);
        assertEq(tokenAmount, 100);
    }

    // Support and Election Creation Tests
    function testProposalSupport() public {
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        (, , , , , uint256 supportCount, ) = dao.proposals(proposalId);
        assertEq(supportCount, 50); // user2 has 50 tokens
    }

    function testElectionCreation() public {
        // Create and support proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        // Support with enough tokens to trigger election
        vm.prank(user1); // 100 tokens
        dao.supportProposal(proposalId);
        vm.prank(user2); // 50 more tokens = 150 total > 51% of 200
        dao.supportProposal(proposalId);
        
        // Get election state
        (
            uint256 id,
            uint256 eProposalId,
            uint256 votingTokenId,
            uint256 startTime,
            uint256 endTime,
            address yesAddress,
            address noAddress,
            bool executed,
            uint256 yesVotes,
            uint256 noVotes
        ) = dao.getElectionState(0); // First election should be ID 0
        
        // Verify election was created correctly
        assertEq(eProposalId, proposalId);
        assertFalse(executed);
        assertEq(startTime, block.timestamp + ELECTION_DELAY);
        assertEq(endTime, startTime + ELECTION_DURATION);
        assertNotEq(yesAddress, address(0));
        assertNotEq(noAddress, address(0));
        assertEq(yesVotes, 0);
        assertEq(noVotes, 0);
        
        // Verify voting tokens were distributed
        assertEq(dao.getVotingTokenBalance(0, user1), 100);
        assertEq(dao.getVotingTokenBalance(0, user2), 50);
        assertEq(dao.getVotingTokenBalance(0, user3), 50);
    }

    // Election Voting Tests
    function testVotingPeriod() public {
        // Create and support proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(user1);
        dao.supportProposal(proposalId);
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Election should not be ongoing before delay
        assertFalse(dao.isOngoing(0));
        
        // Move time to after election start
        vm.warp(block.timestamp + ELECTION_DELAY + 1);
        
        // Election should now be ongoing
        assertTrue(dao.isOngoing(0));
        
        // Get election info to find yes/no addresses and voting token ID
        (,, uint256 votingTokenId,,, address yesAddress, address noAddress,,uint256 yesVotes, uint256 noVotes) = 
            dao.getElectionState(0);
        
        // Check initial voting token distribution
        assertEq(dao.getVotingTokenBalance(0, user1), 100);
        assertEq(dao.getVotingTokenBalance(0, user2), 50);
        
        // Transfer voting tokens to yes/no addresses using the correct token ID
        vm.startPrank(user1);
        dao.safeTransferFrom(user1, yesAddress, votingTokenId, 60, "");
        dao.safeTransferFrom(user1, noAddress, votingTokenId, 40, "");
        vm.stopPrank();
        
        vm.prank(user2);
        dao.safeTransferFrom(user2, yesAddress, votingTokenId, 50, "");
        
        // Verify vote counts
        (,,,,,,,,uint256 newYesVotes, uint256 newNoVotes) = dao.getElectionState(0);
        assertEq(newYesVotes, 110);
        assertEq(newNoVotes, 40);
        
        // Check quorum
        assertTrue(dao.hasQuorum(0));
    }

    // Election Execution Tests
    function testElectionExecution() public {
        // Create and support token proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Token Award", user3, 100);
        
        vm.prank(user1);
        dao.supportProposal(proposalId);
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Move time to after election start
        vm.warp(block.timestamp + ELECTION_DELAY + 1);
        
        // Get election info to find yes/no addresses and voting token ID
        (,, uint256 votingTokenId,,, address yesAddress, address noAddress,,,) = dao.getElectionState(0);
        
        // Vote with all tokens to ensure quorum (200 total tokens, need 40% = 80 tokens)
        vm.prank(user1);
        dao.safeTransferFrom(user1, yesAddress, votingTokenId, 100, "");
        vm.prank(user2);
        dao.safeTransferFrom(user2, noAddress, votingTokenId, 50, "");
        vm.prank(user3);
        dao.safeTransferFrom(user3, yesAddress, votingTokenId, 50, "");
        
        // Move time to after election
        vm.warp(block.timestamp + ELECTION_DURATION + 1);
        
        // Execute election
        dao.executeElection(0);
        
        // Verify execution
        (,,,,,,,bool executed, uint256 yesVotes, uint256 noVotes) = dao.getElectionState(0);
        assertTrue(executed);
        assertEq(yesVotes, 150);
        assertEq(noVotes, 50);
        
        // Verify token award was processed
        assertEq(dao.balanceOf(user3, 0), 150); // Original 50 + 100 awarded
        
        // Verify voting tokens were burned except at yes/no addresses
        assertEq(dao.getVotingTokenBalance(0, user1), 0);
        assertEq(dao.getVotingTokenBalance(0, user2), 0);
        assertEq(dao.getVotingTokenBalance(0, user3), 0);
    }

    // Failure Cases
    function testFailCreateProposalWithoutTokens() public {
        address noTokenUser = makeAddr("noTokenUser");
        vm.prank(noTokenUser);
        dao.createProposal("Should Fail", address(0), 0);
    }

    function testFailInvalidTextProposal() public {
        vm.prank(user1);
        dao.createProposal("", address(0), 0); // Should fail due to empty description
    }

    function testFailInvalidTokenProposal() public {
        vm.prank(user1);
        dao.createProposal("", address(0), 100); // Should fail due to missing recipient
    }

    function testFailDoubleSupportProposal() public {
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        vm.prank(user2);
        dao.supportProposal(proposalId); // Should fail
    }

    // Timing Tests
    function testElectionTiming() public {
        // Create and support proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(user1);
        dao.supportProposal(proposalId);
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Test at different times
        vm.warp(block.timestamp + ELECTION_DELAY - 1); // Just before start
        assertFalse(dao.isOngoing(0));
        
        vm.warp(block.timestamp + 2); // Just after start
        assertTrue(dao.isOngoing(0));
        
        vm.warp(block.timestamp + ELECTION_DURATION - 1); // Just before end
        assertTrue(dao.isOngoing(0));
        
        vm.warp(block.timestamp + 2); // Just after end
        assertFalse(dao.isOngoing(0));
        
        // Try to execute before end should fail
        vm.warp(block.timestamp - ELECTION_DURATION); // Back during election
        vm.expectRevert("Election still ongoing");
        dao.executeElection(0);
    }

    // Multiple Elections Tests
    function testMultipleElections() public {
        // Create first proposal and election
        vm.prank(user1);
        uint256 proposalId1 = dao.createProposal("Proposal 1", address(0), 0);
        vm.prank(user1);
        dao.supportProposal(proposalId1);
        vm.prank(user2);
        dao.supportProposal(proposalId1);
        
        // Create second proposal and election
        vm.prank(user1);
        uint256 proposalId2 = dao.createProposal("Proposal 2", address(0), 0);
        vm.prank(user1);
        dao.supportProposal(proposalId2);
        vm.prank(user2);
        dao.supportProposal(proposalId2);
        
        // Get election details
        (,, uint256 votingTokenId1,,, address yesAddress1, address noAddress1,,,) = dao.getElectionState(0);
        (,, uint256 votingTokenId2,,, address yesAddress2, address noAddress2,,,) = dao.getElectionState(1);
        
        // Verify different voting token IDs
        assertTrue(votingTokenId1 != votingTokenId2);
        
        // Verify different voting addresses
        assertTrue(yesAddress1 != yesAddress2);
        assertTrue(noAddress1 != noAddress2);
        
        // Move to election period
        vm.warp(block.timestamp + ELECTION_DELAY + 1);
        
        // Vote on both elections
        vm.startPrank(user1);
        dao.safeTransferFrom(user1, yesAddress1, votingTokenId1, 60, "");
        dao.safeTransferFrom(user1, noAddress2, votingTokenId2, 60, ""); // Vote differently on second election
        vm.stopPrank();
        
        vm.startPrank(user2);
        dao.safeTransferFrom(user2, yesAddress1, votingTokenId1, 50, "");
        dao.safeTransferFrom(user2, yesAddress2, votingTokenId2, 50, "");
        vm.stopPrank();
        
        // Verify independent vote counting
        (,,,,,,,,uint256 yesVotes1, uint256 noVotes1) = dao.getElectionState(0);
        (,,,,,,,,uint256 yesVotes2, uint256 noVotes2) = dao.getElectionState(1);
        
        assertEq(yesVotes1, 110);
        assertEq(noVotes1, 0);
        assertEq(yesVotes2, 50);
        assertEq(noVotes2, 60);
        
        // Move to end of election
        vm.warp(block.timestamp + ELECTION_DURATION + 1);
        
        // Execute both elections
        dao.executeElection(0);
        dao.executeElection(1);
        
        // Verify both executed
        (,,,,,,,bool executed1,,) = dao.getElectionState(0);
        (,,,,,,,bool executed2,,) = dao.getElectionState(1);
        assertTrue(executed1);
        assertTrue(executed2);
    }

    function testVotingTokenManagement() public {
        // Create and support proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(user1);
        dao.supportProposal(proposalId);
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Get election details
        (,, uint256 votingTokenId,,, address yesAddress, address noAddress,,,) = dao.getElectionState(0);
        
        // Verify initial voting token distribution
        assertEq(dao.balanceOf(user1, votingTokenId), 100);
        assertEq(dao.balanceOf(user2, votingTokenId), 50);
        assertEq(dao.balanceOf(user3, votingTokenId), 50);
        
        // Test token transfers between users
        vm.prank(user1);
        dao.safeTransferFrom(user1, user2, votingTokenId, 30, "");
        
        assertEq(dao.balanceOf(user1, votingTokenId), 70);
        assertEq(dao.balanceOf(user2, votingTokenId), 80);
        
        // Move to election period
        vm.warp(block.timestamp + ELECTION_DELAY + 1);
        
        // Vote with transferred tokens
        vm.startPrank(user2);
        dao.safeTransferFrom(user2, yesAddress, votingTokenId, 80, "");
        vm.stopPrank();
        
        // Move to end and execute
        vm.warp(block.timestamp + ELECTION_DURATION + 1);
        dao.executeElection(0);
        
        // Verify tokens are burned except at yes/no addresses
        assertEq(dao.balanceOf(user1, votingTokenId), 0);
        assertEq(dao.balanceOf(user2, votingTokenId), 0);
        assertEq(dao.balanceOf(user3, votingTokenId), 0);
        assertEq(dao.balanceOf(yesAddress, votingTokenId), 80);
        assertEq(dao.balanceOf(noAddress, votingTokenId), 0);
    }
}
