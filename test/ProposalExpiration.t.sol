// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract ProposalExpirationTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    address alice = address(0x1);
    address bob = address(0x2);

    uint256 constant MAX_PROPOSAL_AGE = 100; // blocks

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
            MAX_PROPOSAL_AGE, // max proposal age
            50,   // election duration
            1, // flags (allowMinting=True)
            0,    // no token sales
            0,    // no vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));
    }

    function testProposalCanBeSupportedBeforeExpiration() public {
        vm.startPrank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support before expiration
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);

        assertEq(proposal.supportTotal(), 10);
        vm.stopPrank();
    }

    function testFailProposalCannotBeSupportedAfterExpiration() public {
        vm.startPrank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Move past expiration
        vm.roll(block.number + MAX_PROPOSAL_AGE);

        // This should fail with "Proposal expired"
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);
        vm.stopPrank();
    }

    function testFailSupportCannotBeRemovedAfterExpiration() public {
        vm.startPrank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add support before expiration
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);

        // Move past expiration
        vm.roll(block.number + MAX_PROPOSAL_AGE);

        // This should fail with "Proposal expired"
        proposal.removeSupport(5);
        vm.stopPrank();
    }

    function testProposalCanStillBeTriggeredBeforeExpiration() public {
        vm.startPrank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");

        // Add enough support to trigger election (need 20% of 150 = 30)
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(40);

        // Verify election was triggered
        assertTrue(proposal.electionTriggered());
        vm.stopPrank();
    }

    function testProposalAtExactExpirationBlock() public {
        vm.startPrank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Proposal");
        uint256 creationBlock = block.number;

        // Move to exact expiration block
        vm.roll(creationBlock + MAX_PROPOSAL_AGE - 1);

        // Should still work (< createdAt + maxAge)
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(10);

        assertEq(proposal.supportTotal(), 10);
        vm.stopPrank();
    }
}
