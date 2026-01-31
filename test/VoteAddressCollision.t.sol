// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/GenericProposal.sol";

contract VoteAddressCollisionTest is TestHelper {
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
    }

    function testVoteAddressesAreUnique() public {
        // Create two proposals with same description
        vm.prank(proposer1);
        GenericProposal proposal1 = factory.createProposal("Same description", address(dao), 0, "");

        vm.prank(proposer2);
        GenericProposal proposal2 = factory.createProposal("Same description", address(dao), 0, "");

        // Trigger elections
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal1), true);
        proposal1.addSupport(60);
        vm.stopPrank();

        vm.startPrank(proposer2);
        dao.setApprovalForAll(address(proposal2), true);
        proposal2.addSupport(60);
        vm.stopPrank();

        // Verify vote addresses are different
        address yes1 = proposal1.yesVoteAddress();
        address no1 = proposal1.noVoteAddress();
        address yes2 = proposal2.yesVoteAddress();
        address no2 = proposal2.noVoteAddress();

        // All addresses should be unique
        assertTrue(yes1 != yes2, "Yes addresses should be different");
        assertTrue(no1 != no2, "No addresses should be different");
        assertTrue(yes1 != no1, "Yes and No should be different");
        assertTrue(yes2 != no2, "Yes and No should be different");
        assertTrue(yes1 != no2, "Cross-proposal addresses should be different");
        assertTrue(no1 != yes2, "Cross-proposal addresses should be different");
    }

    function testVoteAddressesChangeWithTime() public {
        // Create proposal but don't trigger
        vm.prank(proposer1);
        GenericProposal proposal1 = factory.createProposal("Test", address(dao), 0, "");

        // Trigger election at block 1
        vm.roll(1);
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal1), true);
        proposal1.addSupport(60);
        vm.stopPrank();

        address yes1 = proposal1.yesVoteAddress();

        // Create another proposal with same description
        vm.prank(proposer1);
        GenericProposal proposal2 = factory.createProposal("Test", address(dao), 0, "");

        // Trigger election at block 100
        vm.roll(100);
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal2), true);
        proposal2.addSupport(60);
        vm.stopPrank();

        address yes2 = proposal2.yesVoteAddress();

        // Addresses should be different due to different block numbers
        assertTrue(yes1 != yes2, "Addresses should differ based on block number");
    }

    function testVoteAddressesChangedWithTimestamp() public {
        // Create proposal
        vm.prank(proposer1);
        GenericProposal proposal1 = factory.createProposal("Test", address(dao), 0, "");

        // Trigger at timestamp 1000
        vm.warp(1000);
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal1), true);
        proposal1.addSupport(60);
        vm.stopPrank();

        address yes1 = proposal1.yesVoteAddress();

        // Create another proposal
        vm.prank(proposer1);
        GenericProposal proposal2 = factory.createProposal("Test", address(dao), 0, "");

        // Trigger at timestamp 2000
        vm.warp(2000);
        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal2), true);
        proposal2.addSupport(60);
        vm.stopPrank();

        address yes2 = proposal2.yesVoteAddress();

        // Addresses should be different due to different timestamps
        assertTrue(yes1 != yes2, "Addresses should differ based on timestamp");
    }

    function testVoteAddressNotZero() public {
        vm.prank(proposer1);
        GenericProposal proposal = factory.createProposal("Test", address(dao), 0, "");

        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60);
        vm.stopPrank();

        // Verify addresses are not zero
        assertTrue(proposal.yesVoteAddress() != address(0), "Yes address should not be zero");
        assertTrue(proposal.noVoteAddress() != address(0), "No address should not be zero");
    }

    function testVoteAddressNotContract() public {
        vm.prank(proposer1);
        GenericProposal proposal = factory.createProposal("Test", address(dao), 0, "");

        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60);
        vm.stopPrank();

        // Verify addresses are not contracts (they should be EOAs)
        address yes = proposal.yesVoteAddress();
        address no = proposal.noVoteAddress();

        assertEq(yes.code.length, 0, "Yes address should not be a contract");
        assertEq(no.code.length, 0, "No address should not be a contract");
    }

    function testVoteAddressRegisteredInDAO() public {
        vm.prank(proposer1);
        GenericProposal proposal = factory.createProposal("Test", address(dao), 0, "");

        vm.startPrank(proposer1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.addSupport(60);
        vm.stopPrank();

        // Verify addresses are registered
        address yes = proposal.yesVoteAddress();
        address no = proposal.noVoteAddress();

        assertTrue(dao.isVoteAddress(yes), "Yes address should be registered");
        assertTrue(dao.isVoteAddress(no), "No address should be registered");

        // Verify mapping
        assertEq(dao.voteAddressToProposal(yes), address(proposal), "Yes address should map to proposal");
        assertEq(dao.voteAddressToProposal(no), address(proposal), "No address should map to proposal");
    }

    function testMultipleProposalsHaveUniqueAddresses() public {
        address[] memory yesAddresses = new address[](10);
        address[] memory noAddresses = new address[](10);

        // Create 10 proposals and trigger elections
        for (uint i = 0; i < 10; i++) {
            vm.prank(proposer1);
            GenericProposal proposal = factory.createProposal(
                string(abi.encodePacked("Proposal ", vm.toString(i))),
                address(dao),
                0,
                ""
            );

            vm.startPrank(proposer1);
            dao.setApprovalForAll(address(proposal), true);
            proposal.addSupport(60);
            vm.stopPrank();

            yesAddresses[i] = proposal.yesVoteAddress();
            noAddresses[i] = proposal.noVoteAddress();

            // Move forward in time
            vm.roll(block.number + 1);
            vm.warp(block.timestamp + 1);
        }

        // Verify all addresses are unique
        for (uint i = 0; i < 10; i++) {
            for (uint j = i + 1; j < 10; j++) {
                assertTrue(yesAddresses[i] != yesAddresses[j], "All yes addresses should be unique");
                assertTrue(noAddresses[i] != noAddresses[j], "All no addresses should be unique");
                assertTrue(yesAddresses[i] != noAddresses[j], "Yes and no addresses should be unique");
                assertTrue(noAddresses[i] != yesAddresses[j], "Yes and no addresses should be unique");
            }
        }
    }
}
