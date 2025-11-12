// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract JoinRequestTest is TestHelper {
    MarketDAO public dao;
    ProposalFactory public factory;

    address public alice = address(0x1); // Token holder
    address public bob = address(0x2);   // Token holder
    address public charlie = address(0x3); // Non-holder wanting to join

    uint256 constant FLAG_ALLOW_MINTING = 1 << 0;

    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = alice;
        initialHolders[1] = bob;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000,  // 20% support threshold
            5100,  // 51% quorum
            100,   // max proposal age
            50,    // election duration
            FLAG_ALLOW_MINTING,
            0,     // No token sales
            0,     // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));
    }

    function testNonHolderCanCreateJoinRequest() public {
        // Charlie has no tokens
        assertEq(dao.balanceOf(charlie, 0), 0);

        // Charlie creates a join request
        vm.prank(charlie);
        MintProposal proposal = factory.createMintProposal(
            "Hi, I'm Charlie and I'd like to join the DAO",
            charlie,
            1
        );

        // Verify proposal was created
        assertEq(address(proposal), address(factory.proposals(0)));
        assertEq(proposal.recipient(), charlie);
        assertEq(proposal.amount(), 1);
    }

    function testNonHolderCannotRequestMoreThanOneToken() public {
        // Charlie tries to request 10 tokens
        vm.prank(charlie);
        vm.expectRevert("Non-holders can only request 1 token");
        factory.createMintProposal(
            "I want 10 tokens",
            charlie,
            10
        );
    }

    function testNonHolderCannotRequestTokensForOthers() public {
        // Charlie tries to create a mint proposal for Alice
        vm.prank(charlie);
        vm.expectRevert("Non-holders can only request tokens for themselves");
        factory.createMintProposal(
            "I want to mint tokens for Alice",
            alice,
            1
        );
    }

    function testTokenHolderCanStillCreateAnyMintProposal() public {
        // Alice can create a mint proposal for any amount to any address
        vm.prank(alice);
        MintProposal proposal = factory.createMintProposal(
            "Mint 100 tokens for Bob",
            bob,
            100
        );

        assertEq(proposal.recipient(), bob);
        assertEq(proposal.amount(), 100);
    }

    function testCompleteJoinRequestWorkflow() public {
        // Charlie has no tokens initially
        assertEq(dao.balanceOf(charlie, 0), 0);

        // Charlie creates a join request
        vm.prank(charlie);
        MintProposal proposal = factory.createMintProposal(
            "Hi, I'm Charlie. I'm a blockchain developer and would like to join the DAO.",
            charlie,
            1
        );

        // Alice supports the proposal (need 20% of 150 = 30)
        vm.prank(alice);
        proposal.addSupport(30);

        // Election should trigger
        assertTrue(proposal.electionTriggered());

        // Alice claims voting tokens and votes YES
        vm.prank(alice);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();
        address yesVoteAddr = proposal.yesVoteAddress();

        vm.prank(alice);
        dao.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        // Advance past election
        vm.roll(block.number + 51);

        // Execute the proposal
        proposal.execute();

        // Charlie should now have 1 token
        assertEq(dao.balanceOf(charlie, 0), 1);

        // Verify Charlie can now create other types of proposals
        vm.prank(charlie);
        ResolutionProposal resProposal = factory.createResolutionProposal(
            "Now that I'm a member, here's my first resolution"
        );

        // Verify the resolution proposal was created
        assertTrue(address(resProposal) != address(0));
    }

    function testJoinRequestRejected() public {
        // Charlie creates a join request
        vm.prank(charlie);
        MintProposal proposal = factory.createMintProposal(
            "I'd like to join",
            charlie,
            1
        );

        // Alice supports to trigger election
        vm.prank(alice);
        proposal.addSupport(30);

        assertTrue(proposal.electionTriggered());

        // Alice votes NO
        vm.prank(alice);
        proposal.claimVotingTokens();

        uint256 votingTokenId = proposal.votingTokenId();
        address noVoteAddr = proposal.noVoteAddress();

        vm.prank(alice);
        dao.safeTransferFrom(alice, noVoteAddr, votingTokenId, 100, "");

        // Advance past election
        vm.roll(block.number + 51);

        // Proposal failed, cannot execute
        vm.expectRevert("Proposal not passed");
        proposal.execute();

        // Charlie should still have no tokens
        assertEq(dao.balanceOf(charlie, 0), 0);
    }

    function testMultipleJoinRequests() public {
        address dave = address(0x4);
        address eve = address(0x5);

        // Charlie and Dave both create join requests
        vm.prank(charlie);
        MintProposal charlieProposal = factory.createMintProposal(
            "Charlie wants to join",
            charlie,
            1
        );

        vm.prank(dave);
        MintProposal daveProposal = factory.createMintProposal(
            "Dave wants to join",
            dave,
            1
        );

        // Both proposals exist
        assertEq(address(charlieProposal), factory.proposals(0));
        assertEq(address(daveProposal), factory.proposals(1));
        assertEq(factory.proposalCount(), 2);
    }

    function testNonHolderCannotCreateOtherProposalTypes() public {
        // Charlie cannot create a resolution proposal
        vm.prank(charlie);
        vm.expectRevert("Must hold vested governance tokens");
        factory.createResolutionProposal("This should fail");

        // Charlie cannot create a treasury proposal
        vm.prank(charlie);
        vm.expectRevert("Must hold vested governance tokens");
        factory.createTreasuryProposal(
            "Send me money",
            charlie,
            1 ether,
            address(0),
            0
        );

        // Charlie cannot create a parameter proposal
        vm.prank(charlie);
        vm.expectRevert("Must hold vested governance tokens");
        factory.createParameterProposal("Change price", ParameterProposal.ParameterType.TokenPrice, 0.5 ether);
    }
}
