// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

// Helper contract to make test addresses ERC1155 compatible
contract TestUser is ERC1155Holder {
    constructor() {}
}

contract MarketDAOTest is Test {
    MarketDAO public dao;
    TestUser alice;
    TestUser bob;
    TestUser charlie;

    event HolderAdded(address holder);
    event HolderRemoved(address holder);

    // Initial DAO parameters
    string constant NAME = "TestDAO";
    uint256 constant SUPPORT_THRESHOLD = 30; // 30%
    uint256 constant QUORUM = 50; // 50%
    uint256 constant PROPOSAL_MAX_AGE = 1 weeks;
    uint256 constant ELECTION_DURATION = 3 days;
    string constant URI = "ipfs://test";

    function setUp() public {
        // Deploy users
        alice = new TestUser();
        bob = new TestUser();
        charlie = new TestUser();

        // Deploy DAO
        dao = new MarketDAO(
            NAME,
            SUPPORT_THRESHOLD,
            QUORUM,
            PROPOSAL_MAX_AGE,
            ELECTION_DURATION,
            URI
        );

        // Mint initial tokens to test accounts
        vm.startPrank(address(dao.owner()));
        vm.expectEmit(true, true, true, true);
        emit HolderAdded(address(alice));
        dao.mint(address(alice), 300);
        
        vm.expectEmit(true, true, true, true);
        emit HolderAdded(address(bob));
        dao.mint(address(bob), 200);
        vm.stopPrank();
    }

    function test_Deployment() public {
        assertEq(dao.daoName(), NAME);
        assertEq(dao.supportThreshold(), SUPPORT_THRESHOLD);
        assertEq(dao.quorumPercentage(), QUORUM);
        assertEq(dao.proposalMaxAge(), PROPOSAL_MAX_AGE);
        assertEq(dao.electionDuration(), ELECTION_DURATION);
    }

    function test_InitialTokenDistribution() public {
        assertEq(dao.balanceOf(address(alice), 0), 300);
        assertEq(dao.balanceOf(address(bob), 0), 200);
        assertEq(dao.balanceOf(address(dao.owner()), 0), 0);
    }

    function test_CreateProposal() public {
        vm.prank(address(alice));
        
        uint256 proposalId = dao.createProposal(
            "Test Proposal",
            address(0),
            0
        );
        
        // Get proposal details and verify
        (
            uint256 id,
            address proposer,
            string memory description,
            address mintTo,
            uint256 mintAmount,
            uint256 createdAt,
            uint256 supportCount,
            bool triggered
        ) = dao.proposals(proposalId);

        assertEq(id, 0);
        assertEq(proposer, address(alice));
        assertEq(description, "Test Proposal");
        assertEq(mintTo, address(0));
        assertEq(mintAmount, 0);
        assertEq(createdAt, block.timestamp);
        assertEq(supportCount, 0);
        assertFalse(triggered);
    }

    function test_RevertCreateProposalWithoutTokens() public {
        vm.prank(address(charlie));
        vm.expectRevert("Must hold governance tokens");
        dao.createProposal("Test Proposal", address(0), 0);
    }

    function test_GovernanceHolderTracking() public {
        address[] memory holders = dao._getGovernanceTokenHolders();
        assertEq(holders.length, 2, "Should start with 2 holders");

        // Transfer some tokens to charlie
        vm.startPrank(address(alice));
        
        vm.expectEmit(true, true, true, true);
        emit HolderAdded(address(charlie));
        dao.safeTransferFrom(address(alice), address(charlie), 0, 100, "");
        vm.stopPrank();

        holders = dao._getGovernanceTokenHolders();
        assertEq(holders.length, 3, "Should have 3 holders after adding charlie");

        // Transfer all tokens away from alice
        vm.startPrank(address(alice));
        vm.expectEmit(true, true, true, true);
        emit HolderRemoved(address(alice));
        dao.safeTransferFrom(address(alice), address(bob), 0, 200, "");
        vm.stopPrank();

        holders = dao._getGovernanceTokenHolders();
        assertEq(holders.length, 2, "Should have 2 holders after removing alice");
    }

    function test_VotingTokenTrading() public {
        // Create and trigger proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        uint256 electionId = 0;
        (,,,,,,,,uint256 votingTokenId) = dao.elections(electionId);
        
        // Alice sells half her voting tokens to Charlie
        vm.prank(address(alice));
        dao.safeTransferFrom(address(alice), address(charlie), votingTokenId, 150, "");
        
        // Verify balances
        assertEq(dao.balanceOf(address(alice), votingTokenId), 150, "Alice should have 150 voting tokens left");
        assertEq(dao.balanceOf(address(charlie), votingTokenId), 150, "Charlie should have 150 voting tokens");
    }

    function test_MultipleConcurrentElections() public {
        // Create and trigger first proposal
        vm.prank(address(alice));
        uint256 proposalId1 = dao.createProposal("Proposal 1", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId1);
        
        // Create and trigger second proposal
        vm.prank(address(alice));
        uint256 proposalId2 = dao.createProposal("Proposal 2", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId2);
        
        // Verify both elections have unique voting tokens
        uint256 electionId1 = 0;
        uint256 electionId2 = 1;
        
        (,,,,,,,,uint256 votingTokenId1) = dao.elections(electionId1);
        (,,,,,,,,uint256 votingTokenId2) = dao.elections(electionId2);
        
        assertTrue(votingTokenId1 != votingTokenId2, "Voting tokens should be unique");
        
        // Verify both alice and bob got voting tokens for both elections
        assertEq(dao.balanceOf(address(alice), votingTokenId1), 300);
        assertEq(dao.balanceOf(address(alice), votingTokenId2), 300);
        assertEq(dao.balanceOf(address(bob), votingTokenId1), 200);
        assertEq(dao.balanceOf(address(bob), votingTokenId2), 200);
    }

    function test_FailedElectionExecution() public {
        // Create and trigger proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        uint256 electionId = 0;
        (,,,uint256 endTime,,,,,) = dao.elections(electionId);
        
        // Fast forward past end time without any votes
        vm.warp(endTime + 1);
        
        // Try to execute failed election
        vm.expectRevert("Election has not passed");
        dao.executeElection(electionId);
    }

    function test_DoubleExecution() public {
        // Create and trigger proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        uint256 electionId = 0;
        (,,,uint256 endTime,address yesAddress,,,, uint256 votingTokenId) = dao.elections(electionId);
        
        // Vote yes with majority
        vm.prank(address(alice));
        dao.safeTransferFrom(address(alice), yesAddress, votingTokenId, 300, "");
        
        // Fast forward past end time
        vm.warp(endTime + 1);
        
        // Execute successfully
        dao.executeElection(electionId);
        
        // Try to execute again
        vm.expectRevert("Election already executed");
        dao.executeElection(electionId);
    }

    function test_InvalidMintProposal() public {
        // Try to create proposal with mint amount but no address
        vm.prank(address(alice));
        vm.expectRevert("Invalid mint address");
        dao.createProposal("Invalid Mint", address(0), 100);
    }

    function test_DoubleSupportPrevention() public {
        // Create proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        // Support once
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        // Try to support again
        vm.prank(address(bob));
        vm.expectRevert("Already supported");
        dao.supportProposal(proposalId);
    }

    function test_VotingTokenBurning() public {
        // Create and trigger proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        uint256 electionId = 0;
        (,,,uint256 endTime,,,,,uint256 votingTokenId) = dao.elections(electionId);
        
        // Try to burn voting tokens
        vm.prank(address(alice));
        vm.expectRevert(); // ERC1155: burn amount exceeds balance
        dao.safeTransferFrom(address(alice), address(0), votingTokenId, 100, "");
    }

    function test_MintingProposal() public {
        address mintRecipient = makeAddr("recipient");
        uint256 mintAmount = 100;

        // Create and trigger a minting proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal(
            "Mint tokens",
            mintRecipient,
            mintAmount
        );
        
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        uint256 electionId = 0;
        (
            ,
            ,
            ,
            uint256 endTime,
            address yesAddress,
            ,
            ,
            ,
            uint256 votingTokenId
        ) = dao.elections(electionId);
        
        // Vote yes with enough tokens
        vm.prank(address(alice));
        dao.safeTransferFrom(
            address(alice),
            yesAddress,
            votingTokenId,
            300,
            ""
        );
        
        // Fast forward past end time
        vm.warp(endTime + 1);
        
        // Execute the proposal
        dao.executeElection(electionId);
        
        // Verify tokens were minted
        assertEq(dao.balanceOf(mintRecipient, 0), mintAmount, "Tokens should be minted to recipient");
    }
}
