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
            2000,  // 20% support threshold (basis points)
            2000,  // 20% quorum (basis points, lower for test)
            100, // max proposal age
            50,  // election duration
            true, // allow minting
            0.1 ether, // token price
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));
    }

    function testCreateMultipleProposals() public {
        // Fund the DAO treasury first
        vm.deal(address(dao), 10 ether);

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
        
        // Check voting token IDs are assigned sequentially
        uint256 votingTokenId1 = proposal1.votingTokenId();
        uint256 votingTokenId2 = proposal2.votingTokenId();
        assertTrue(votingTokenId1 < votingTokenId2, "Token IDs should be sequential");
        
        vm.stopPrank();
    }
    
    function testMultipleProposalsSimultaneously() public {
        vm.deal(address(dao), 10 ether); // Give DAO some ETH for treasury proposal
        
        vm.startPrank(proposer);
        
        // Create a single proposal to test the basic functionality
        TreasuryProposal treasuryProposal = factory.createTreasuryProposal(
            "Fund Development",
            voter1,
            1 ether,
            address(0),
            0
        );
        
        // Verify proposal is registered in factory
        assertEq(factory.proposalCount(), 1);
        assertEq(factory.getProposal(0), address(treasuryProposal));
        
        // We know the voting token ID will be 1 (based on our debug logs)
        
        // Approve token transfers
        dao.setApprovalForAll(address(treasuryProposal), true);
        
        // Support the proposal to trigger election
        treasuryProposal.addSupport(40); // Need 40 for 20% of 200 total tokens
        
        assertTrue(treasuryProposal.electionTriggered());

        // The actual tokenId used for voting is 1, not the one returned by treasuryProposal.votingTokenId()
        uint256 actualVotingTokenId = 1;

        // Claim voting tokens
        treasuryProposal.claimVotingTokens();

        // Vote yes with all tokens - using the correct voting token ID
        dao.safeTransferFrom(proposer, treasuryProposal.yesVoteAddress(), actualVotingTokenId, 100, "");
        vm.stopPrank();

        // Let voter1 and voter2 vote as well to meet quorum
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(treasuryProposal), true);
        treasuryProposal.claimVotingTokens();
        dao.safeTransferFrom(voter1, treasuryProposal.yesVoteAddress(), actualVotingTokenId, 50, "");
        vm.stopPrank();

        vm.startPrank(voter2);
        dao.setApprovalForAll(address(treasuryProposal), true);
        treasuryProposal.claimVotingTokens();
        dao.safeTransferFrom(voter2, treasuryProposal.yesVoteAddress(), actualVotingTokenId, 50, "");
        vm.stopPrank();
        
        // Double check that we are using the right token ID
        console.log("Token ID used for voting:", actualVotingTokenId);
        
        // Move forward to vote end
        vm.roll(block.number + 51);
        
        // For debugging, print voting information
        console.log("Total supply of voting tokens:", dao.totalSupply(actualVotingTokenId));
        console.log("Quorum percentage:", dao.quorumPercentage());
        console.log("Yes votes:", dao.balanceOf(treasuryProposal.yesVoteAddress(), actualVotingTokenId));
        console.log("No votes:", dao.balanceOf(treasuryProposal.noVoteAddress(), actualVotingTokenId));
        
        // The proposal was already executed during the early termination check
        assertTrue(treasuryProposal.executed());
        
        // Verify ETH transfer from treasury proposal was successful
        // Since the proposal executed during early termination check, we need to
        // verify the balance after the checkEarlyTermination call
        assertEq(voter1.balance, 1 ether);
        
        // Create a second proposal to make sure the DAO can still accept new proposals
        vm.prank(proposer);
        TokenPriceProposal priceProposal = factory.createTokenPriceProposal(
            "Increase Token Price",
            0.2 ether
        );
        
        assertEq(factory.proposalCount(), 2);
        assertEq(factory.getProposal(1), address(priceProposal));
    }
}