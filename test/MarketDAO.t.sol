// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract MarketDAOTest is Test {
    MarketDAO public dao;
    TestUser alice;
    TestUser bob;
    TestUser charlie;

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

        // Mint initial tokens to test accounts instead of transferring
        // Note: owner can mint because DAO contract constructor gave them ownership
        vm.startPrank(address(dao.owner()));
        dao.mint(address(alice), 300);
        dao.mint(address(bob), 200);
        vm.stopPrank();
    }

    function test_Deployment() public view {
        assertEq(dao.daoName(), NAME);
        assertEq(dao.supportThreshold(), SUPPORT_THRESHOLD);
        assertEq(dao.quorumPercentage(), QUORUM);
        assertEq(dao.proposalMaxAge(), PROPOSAL_MAX_AGE);
        assertEq(dao.electionDuration(), ELECTION_DURATION);
    }

    function test_InitialTokenDistribution() public view {
        assertEq(dao.balanceOf(address(alice), 0), 300);
        assertEq(dao.balanceOf(address(bob), 0), 200);
        assertEq(dao.balanceOf(address(dao.owner()), 0), 0); // Owner has no tokens
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

    function test_Support_And_Trigger_Election() public {
        // Create proposal
        vm.prank(address(alice));
        uint256 proposalId = dao.createProposal(
            "Test Proposal",
            address(0),
            0
        );

        // First check it's not triggered
        (, , , , , , uint256 supportCount, bool triggered) = dao.proposals(proposalId);
        assertEq(supportCount, 0);
        assertFalse(triggered);

        // Support from Bob (200/500 = 40%) should trigger since > 30% threshold
        vm.prank(address(bob));
        dao.supportProposal(proposalId);
        
        (, , , , , , supportCount, triggered) = dao.proposals(proposalId);
        assertEq(supportCount, 200);
        assertTrue(triggered, "Election should be triggered with 40% support");
    }
}

// Helper contract to make test addresses ERC1155 compatible
contract TestUser is ERC1155Holder {
    constructor() {}
}
