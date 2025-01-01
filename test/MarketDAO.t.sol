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
        dao._mint(user1, 0, 100, ""); // 100 governance tokens to user1
        dao._mint(user2, 0, 50, "");  // 50 governance tokens to user2
        dao._mint(user3, 0, 50, "");  // 50 governance tokens to user3
    }

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
    }

    function testCreateTextProposal() public {
        vm.startPrank(user1);
        
        uint256 proposalId = dao.createProposal(
            "Test Proposal",
            address(0),
            0
        );
        
        // Check proposal was created correctly
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
        
        vm.stopPrank();
    }

    function testCreateTokenProposal() public {
        vm.startPrank(user1);
        
        uint256 proposalId = dao.createProposal(
            "Token Award",
            user2,
            100
        );
        
        // Check proposal was created correctly
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
        assertEq(description, "Token Award");
        assertEq(tokenRecipient, user2);
        assertEq(tokenAmount, 100);
        assertEq(supportCount, 0);
        assertEq(executed, false);
        
        vm.stopPrank();
    }

    function testProposalSupport() public {
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        // Support proposal with user2
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Check support count increased by user2's token amount
        (,,,,, uint256 supportCount,) = dao.proposals(proposalId);
        assertEq(supportCount, 50); // user2 has 50 tokens
    }

    function testProposalToElection() public {
        // Create proposal
        vm.prank(user1);
        uint256 proposalId = dao.createProposal("Test Proposal", address(0), 0);
        
        // Support proposal with user1 (100 tokens) and user2 (50 tokens)
        vm.prank(user1);
        dao.supportProposal(proposalId);
        vm.prank(user2);
        dao.supportProposal(proposalId);
        
        // Total support: 150 tokens out of 200 total = 75% > SUPPORT_THRESHOLD
        // This should have triggered election creation
        
        // TODO: Add checks for election creation once we implement election query functions
    }

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

    // Additional tests to be added:
    // - Election creation and token distribution
    // - Voting mechanism
    // - Election execution
    // - Token transfers during voting period
    // - Quorum requirements
    // - Edge cases and failure modes
}
