// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/Proposal.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

// Test contract for early termination functionality
contract EarlyTerminationTest is Test {
    MarketDAO public dao;
    ProposalFactory public factory;
    address public alice;
    address public bob;
    address public charlie;
    
    function setUp() public {
        // Create test accounts
        alice = address(0x1);
        bob = address(0x2);
        charlie = address(0x3);
        
        vm.startPrank(alice);
        
        // Initialize governance token holders and amounts
        address[] memory initialHolders = new address[](3);
        initialHolders[0] = alice;
        initialHolders[1] = bob;
        initialHolders[2] = charlie;
        
        uint256[] memory initialAmounts = new uint256[](3);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        initialAmounts[2] = 50;
        
        // Setup treasury config
        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";
        
        // Create DAO with a 30% support threshold and 60% quorum
        dao = new MarketDAO(
            "Test DAO",
            3000, // Support threshold 30% (basis points)
            6000, // Quorum 60% (basis points)
            100, // Max proposal age
            100, // Election duration
            true, // Allow minting
            0, // Token price
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
        
        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));

        vm.stopPrank();
    }
    
    function testEarlyTerminationWithMajorityYes() public {
        vm.startPrank(alice);
        
        // Create a resolution proposal
        ResolutionProposal proposal = factory.createResolutionProposal("Test Early Termination");
        
        // Add support to trigger election
        proposal.addSupport(60); // Alice supports with 60 tokens (30% of total)
        
        // Proposal now has an active election
        assert(proposal.electionTriggered());
        
        // Get the voting token ID and the Yes vote address
        uint256 votingTokenId = proposal.votingTokenId();
        address yesVoteAddress = proposal.yesVoteAddress();
        
        // Log debug info
        console.log("Voting Token ID:", votingTokenId);
        console.log("Yes Vote Address:", yesVoteAddress);
        
        // Total tokens in circulation
        uint256 totalVotes = dao.totalSupply(votingTokenId);
        console.log("Total votes:", totalVotes);
        console.log("Half votes needed:", totalVotes / 2);
        
        // Claim voting tokens
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(bob);
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(alice);

        // Check initial balances
        uint256 aliceBalance = dao.balanceOf(alice, votingTokenId);
        uint256 bobBalance = dao.balanceOf(bob, votingTokenId);
        console.log("Alice's voting balance:", aliceBalance);
        console.log("Bob's voting balance:", bobBalance);
        assertEq(aliceBalance, 100);
        assertEq(bobBalance, 50);
        assertEq(dao.balanceOf(yesVoteAddress, votingTokenId), 0);

        // We need more than half of total votes (200) to trigger early termination
        // First, Bob will transfer all 50 tokens to Yes
        vm.stopPrank();
        vm.startPrank(bob);
        dao.safeTransferFrom(bob, yesVoteAddress, votingTokenId, 50, "");
        vm.stopPrank();
        vm.startPrank(alice);
        
        // Then, Alice transfers 51 tokens to Yes to exceed half
        uint256 voteAmount = 51;
        console.log("Alice voting with:", voteAmount);
        
        dao.safeTransferFrom(alice, yesVoteAddress, votingTokenId, voteAmount, "");
        
        // Check post-vote balances
        console.log("Alice's post-vote balance:", dao.balanceOf(alice, votingTokenId));
        console.log("Yes vote balance:", dao.balanceOf(yesVoteAddress, votingTokenId));
        
        // Manually check for early termination
        console.log("Explicitly calling checkEarlyTermination");
        proposal.checkEarlyTermination();
        
        // The proposal should now be executed
        console.log("Executed:", proposal.executed());
        assert(proposal.executed());
        
        vm.stopPrank();
    }
    
    function testEarlyTerminationWithMajorityNo() public {
        vm.startPrank(alice);
        
        // Create a resolution proposal
        ResolutionProposal proposal = factory.createResolutionProposal("Test Early Termination - No Vote");
        
        // Add support to trigger election
        proposal.addSupport(60); // Alice supports with 60 tokens (30% of total)
        
        // Proposal now has an active election
        assert(proposal.electionTriggered());
        
        // Get the voting token ID and the No vote address
        uint256 votingTokenId = proposal.votingTokenId();
        address noVoteAddress = proposal.noVoteAddress();

        // Claim voting tokens
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(bob);
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(alice);

        // Check initial balances
        uint256 aliceBalance = dao.balanceOf(alice, votingTokenId);
        uint256 bobBalance = dao.balanceOf(bob, votingTokenId);
        assertEq(aliceBalance, 100);
        assertEq(bobBalance, 50);
        assertEq(dao.balanceOf(noVoteAddress, votingTokenId), 0);

        // We need more than half of total votes (200) to trigger early termination
        // First, Bob will transfer all 50 tokens to No
        vm.stopPrank();
        vm.startPrank(bob);
        dao.safeTransferFrom(bob, noVoteAddress, votingTokenId, 50, "");
        vm.stopPrank();
        vm.startPrank(alice);
        
        // Then, Alice transfers 51 tokens to No to exceed half
        dao.safeTransferFrom(alice, noVoteAddress, votingTokenId, 51, "");
        
        // Manually check for early termination
        proposal.checkEarlyTermination();
        
        // The election is ended by setting electionStart = 0
        // We can test this by requesting the election start block
        // and confirming it's been set to 0
        uint256 electionStart = proposal.electionStart();
        assert(electionStart == 0);
        
        vm.stopPrank();
    }
    
    function testBatchTransferEarlyTermination() public {
        vm.startPrank(alice);
        
        // Create a resolution proposal
        ResolutionProposal proposal = factory.createResolutionProposal("Test Batch Transfer Early Termination");
        
        // Add support to trigger election
        proposal.addSupport(60); // Alice supports with 60 tokens (30% of total)
        
        // Proposal now has an active election
        assert(proposal.electionTriggered());
        
        // Get the voting token ID and the Yes vote address
        uint256 votingTokenId = proposal.votingTokenId();
        address yesVoteAddress = proposal.yesVoteAddress();

        // Claim voting tokens
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(bob);
        proposal.claimVotingTokens();
        vm.stopPrank();
        vm.startPrank(alice);

        // Check initial balances
        uint256 aliceBalance = dao.balanceOf(alice, votingTokenId);
        uint256 bobBalance = dao.balanceOf(bob, votingTokenId);
        assertEq(aliceBalance, 100);
        assertEq(bobBalance, 50);
        assertEq(dao.balanceOf(yesVoteAddress, votingTokenId), 0);

        // We need more than half of total votes (200) to trigger early termination
        // First, Bob will transfer all 50 tokens to Yes
        vm.stopPrank();
        vm.startPrank(bob);
        dao.safeTransferFrom(bob, yesVoteAddress, votingTokenId, 50, "");
        vm.stopPrank();
        vm.startPrank(alice);
        
        // Prepare batch transfer arrays for Alice
        uint256[] memory ids = new uint256[](1);
        ids[0] = votingTokenId;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 51;
        
        // Alice batch transfers enough tokens to Yes to exceed half
        dao.safeBatchTransferFrom(alice, yesVoteAddress, ids, amounts, "");
        
        // Manually check for early termination
        proposal.checkEarlyTermination();
        
        // The proposal should now be executed
        assert(proposal.executed());
        
        vm.stopPrank();
    }
}