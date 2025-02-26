// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract MultipleProposalTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    address proposer = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    
    function setUp() public {
        address[] memory initialHolders = new address[](3);
        initialHolders[0] = proposer;
        initialHolders[1] = voter1;
        initialHolders[2] = voter2;
        
        uint256[] memory initialAmounts = new uint256[](3);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        initialAmounts[2] = 50;
        
        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";
        
        dao = new MarketDAO(
            "Test DAO",
            20,  // 20% support threshold
            51,  // 51% quorum
            100, // max proposal age
            50,  // election duration
            true, // allow minting
            0.1 ether, // token price
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
    }

    function testCreateMultipleProposals() public {
        vm.startPrank(proposer);
        
        // Create first proposal
        ResolutionProposal proposal1 = factory.createResolutionProposal("First Resolution");
        
        // Verify first proposal is registered
        assertTrue(dao.activeProposals(address(proposal1)), "First proposal not registered as active");
        
        // Create second proposal - this should not revert now with our changes
        TreasuryProposal proposal2 = factory.createTreasuryProposal(
            "Second Proposal",
            address(0x2),
            1 ether,
            address(0),
            0
        );
        
        // Verify second proposal is registered
        assertTrue(dao.activeProposals(address(proposal2)), "Second proposal not registered as active");
        
        // Verify both proposals are tracked
        assertEq(factory.proposalCount(), 2);
        assertEq(factory.getProposal(0), address(proposal1));
        assertEq(factory.getProposal(1), address(proposal2));
        
        // Verify both proposals can be interacted with
        dao.setApprovalForAll(address(proposal1), true);
        dao.setApprovalForAll(address(proposal2), true);
        
        // Add support to first proposal
        proposal1.addSupport(40); // Need 40 for 20% of 200 total tokens
        assertTrue(proposal1.electionTriggered(), "First proposal election not triggered");
        
        // Add support to second proposal
        proposal2.addSupport(40);
        assertTrue(proposal2.electionTriggered(), "Second proposal election not triggered");
        
        // Check voting token IDs to ensure they're different
        assertEq(proposal1.votingTokenId(), 1, "First proposal should have voting token ID 1");
        assertEq(proposal2.votingTokenId(), 2, "Second proposal should have voting token ID 2");
        
        vm.stopPrank();
    }
    
    function testMultipleProposalsSimultaneously() public {
        vm.deal(address(dao), 10 ether); // Give DAO some ETH for treasury proposal
        
        vm.startPrank(proposer);
        
        // Create two different proposals
        ResolutionProposal resolutionProposal = factory.createResolutionProposal(
            "Community Guidelines"
        );
        
        TreasuryProposal treasuryProposal = factory.createTreasuryProposal(
            "Fund Development",
            voter1,
            1 ether,
            address(0),
            0
        );
        
        // Both proposals should be in the factory
        assertEq(factory.proposalCount(), 2);
        assertEq(factory.getProposal(0), address(resolutionProposal));
        assertEq(factory.getProposal(1), address(treasuryProposal));
        
        // Approve token transfers for both proposals
        dao.setApprovalForAll(address(resolutionProposal), true);
        dao.setApprovalForAll(address(treasuryProposal), true);
        
        // Support both proposals to trigger elections
        resolutionProposal.addSupport(40); // Need 40 for 20% of 200 total tokens
        treasuryProposal.addSupport(40);
        
        assertTrue(resolutionProposal.electionTriggered());
        assertTrue(treasuryProposal.electionTriggered());
        
        // Vote for both proposals
        // For resolution proposal
        dao.safeTransferFrom(proposer, resolutionProposal.yesVoteAddress(), 1, 100, "");
        
        // For treasury proposal - second voting token (ID 2)
        dao.safeTransferFrom(proposer, treasuryProposal.yesVoteAddress(), 2, 100, "");
        
        vm.stopPrank();
        
        // Let voter1 vote on both proposals too
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(resolutionProposal), true);
        dao.setApprovalForAll(address(treasuryProposal), true);
        
        dao.safeTransferFrom(voter1, resolutionProposal.yesVoteAddress(), 1, 50, "");
        dao.safeTransferFrom(voter1, treasuryProposal.yesVoteAddress(), 2, 50, "");
        vm.stopPrank();
        
        // Move forward to vote end
        vm.roll(block.number + 51);
        
        // Execute both proposals
        uint256 voter1BalanceBefore = voter1.balance;
        
        resolutionProposal.execute();
        treasuryProposal.execute();
        
        // Verify results
        assertTrue(resolutionProposal.executed());
        assertTrue(treasuryProposal.executed());
        
        // Verify ETH transfer from treasury proposal
        assertEq(voter1.balance - voter1BalanceBefore, 1 ether);
        
        // Create a third proposal to make sure the DAO can still accept new proposals
        vm.prank(proposer);
        TokenPriceProposal priceProposal = factory.createTokenPriceProposal(
            "Increase Token Price",
            0.2 ether
        );
        
        assertEq(factory.proposalCount(), 3);
        assertEq(factory.getProposal(2), address(priceProposal));
    }
}
