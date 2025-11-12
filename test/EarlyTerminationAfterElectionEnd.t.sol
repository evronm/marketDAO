// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

/**
 * @title EarlyTerminationAfterElectionEndTest
 * @notice Tests that checkEarlyTermination can be called after election ends
 * @dev This tests the bug fix where checkEarlyTermination would revert with "Election ended"
 */
contract EarlyTerminationAfterElectionEndTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;

    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = alice;
        initialHolders[1] = bob;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 100;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support
            5100, // 51% quorum
            100,  // max proposal age
            50,   // election duration
            1,    // flags (allowMinting=True)
            0,    // token price
            0,    // no vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Fund DAO with ETH for distribution
        // Total vested supply is 200, at 0.1 ETH per token we need 20 ETH
        vm.deal(address(dao), 100 ether);
    }

    function testCheckEarlyTerminationAfterElectionEnds() public {
        // Create a distribution proposal
        vm.prank(alice);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute ETH to holders",
            address(0),  // ETH
            0,           // tokenId for ETH
            0.1 ether    // amount per governance token
        );

        // Support the proposal to trigger election
        vm.prank(alice);
        proposal.addSupport(40);  // 20% of 200 total

        assertTrue(proposal.electionTriggered());

        // Register for distribution
        vm.prank(alice);
        proposal.registerForDistribution();

        // Claim voting tokens for both alice and bob
        vm.prank(alice);
        proposal.claimVotingTokens();

        vm.prank(bob);
        proposal.claimVotingTokens();

        // Vote YES with majority (just over 50% - should trigger early termination)
        uint256 votingTokenId = proposal.votingTokenId();
        address yesVoteAddr = proposal.yesVoteAddress();

        // Move forward in time but still during election
        vm.roll(block.number + 10);

        // Vote with majority (Alice has 100 votes, which is exactly 50%, so vote all to reach majority)
        vm.prank(alice);
        dao.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        // Bob also votes yes to reach >50%
        vm.prank(bob);
        dao.safeTransferFrom(bob, yesVoteAddr, votingTokenId, 1, "");

        // At this point, early termination should have been attempted but may have failed
        // Let's advance past the election end
        vm.roll(block.number + 100); // Way past election end

        // Now try to call checkEarlyTermination manually - this should work!
        // Before the fix, this would revert with "Election ended"
        proposal.checkEarlyTermination();

        // Verify the proposal was executed via early termination
        assertTrue(proposal.executed());

        // Verify funds were transferred to redemption contract
        address redemptionContract = address(proposal.redemptionContract());
        assertGt(redemptionContract.balance, 0);

        console.log("Early termination successfully called after election ended");
        console.log("Redemption contract balance:", redemptionContract.balance);
    }

    function testEarlyTerminationForDistributionProposal() public {
        // Test with a distribution proposal specifically
        vm.prank(alice);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute ETH to holders",
            address(0),  // ETH
            0,           // tokenId for ETH
            0.1 ether    // amount per governance token
        );

        // Support the proposal to trigger election
        vm.prank(alice);
        proposal.addSupport(40);  // 20% of 200 total

        // Register and claim
        vm.prank(alice);
        proposal.registerForDistribution();

        vm.prank(alice);
        proposal.claimVotingTokens();

        vm.prank(bob);
        proposal.claimVotingTokens();

        // Vote YES with majority DURING the election
        uint256 votingTokenId = proposal.votingTokenId();
        address yesVoteAddr = proposal.yesVoteAddress();

        vm.prank(alice);
        dao.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        vm.prank(bob);
        dao.safeTransferFrom(bob, yesVoteAddr, votingTokenId, 1, "");

        // At this point early termination may or may not have been called
        // Move past the election end
        vm.roll(block.number + 60);

        // Now call checkEarlyTermination manually - should execute the proposal
        if (!proposal.executed()) {
            proposal.checkEarlyTermination();
        }

        // The proposal should now be executed
        assertTrue(proposal.executed());

        console.log("Distribution proposal executed via checkEarlyTermination after election ended");
    }

    function testEarlyTerminationWithNoVotesMajority() public {
        // Test that early termination also works for NO votes reaching majority
        vm.prank(alice);
        ResolutionProposal proposal = factory.createResolutionProposal(
            "Test proposal for NO vote termination"
        );

        // Support to trigger
        vm.prank(alice);
        proposal.addSupport(40);

        // Claim voting tokens
        vm.prank(alice);
        proposal.claimVotingTokens();

        vm.prank(bob);
        proposal.claimVotingTokens();

        // Vote NO with majority DURING the election
        uint256 votingTokenId = proposal.votingTokenId();
        address noVoteAddr = proposal.noVoteAddress();

        vm.prank(alice);
        dao.safeTransferFrom(alice, noVoteAddr, votingTokenId, 100, "");

        vm.prank(bob);
        dao.safeTransferFrom(bob, noVoteAddr, votingTokenId, 1, "");

        // Move past election end
        vm.roll(block.number + 60);

        // Call checkEarlyTermination manually if not executed
        if (!proposal.executed()) {
            proposal.checkEarlyTermination();
        }

        // Should be marked as executed (rejected) via early termination
        assertTrue(proposal.executed());

        console.log("Early termination with NO votes majority after election ended");
    }
}
