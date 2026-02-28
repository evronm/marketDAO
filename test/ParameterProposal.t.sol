// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/GenericProposal.sol";

contract ParameterProposalTest is TestHelper {
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

        dao = new MarketDAO(
            "Test DAO",
            2000,  // 20% support threshold (basis points)
            5100,  // 51% quorum (basis points)
            100, // max proposal age
            50,  // election duration
            1, // flags (allowMinting=True)
            0.1 ether, // token price
            0, // No vesting
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));
    }

    function _getParameterSelector(uint8 paramType) internal view returns (bytes4) {
        // 0: SupportThreshold, 1: QuorumPercentage, 2: MaxProposalAge
        // 3: ElectionDuration, 4: VestingPeriod, 5: TokenPrice, 6: Flags
        if (paramType == 0) return dao.setSupportThreshold.selector;
        if (paramType == 1) return dao.setQuorumPercentage.selector;
        if (paramType == 2) return dao.setMaxProposalAge.selector;
        if (paramType == 3) return dao.setElectionDuration.selector;
        if (paramType == 4) return dao.setVestingPeriod.selector;
        if (paramType == 5) return dao.setTokenPrice.selector;
        if (paramType == 6) return dao.setFlags.selector;
        revert("Invalid parameter type");
    }

    // Helper to create proposal with invalid params, pass it, and verify graceful failure.
    // With the execution-failure fix, the call doesn't revert — it emits ExecutionFailed,
    // marks the proposal as executed, and unlocks any funds, preventing permanent lock.
    function _expectExecutionFailure(bytes4 selector, uint256 value) internal {
        vm.startPrank(proposer);
        GenericProposal proposal = factory.createProposal(
            "Invalid parameter",
            address(dao),
            0,
            abi.encodeWithSelector(selector, value)
        );

        // Support and trigger election
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());

        // Claim and vote from all three voters to ensure quorum
        proposal.claimVotingTokens();
        uint256 votingTokenId = proposal.votingTokenId();
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        // Have voter1 and voter2 also vote yes to reach quorum
        vm.startPrank(voter1);
        proposal.claimVotingTokens();
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
        vm.stopPrank();

        vm.startPrank(voter2);
        proposal.claimVotingTokens();
        dao.safeTransferFrom(voter2, proposal.yesVoteAddress(), votingTokenId, 50, "");
        vm.stopPrank();

        // The proposal may have already been executed via early termination
        // during voting (proposer has >50% majority). If not, roll forward and execute.
        if (!proposal.executed()) {
            vm.roll(block.number + 50);
            proposal.execute();
        }

        // Proposal is resolved — execution call failed gracefully,
        // emitting ExecutionFailed and unlocking any funds
        assertTrue(proposal.executed());
    }

    function _createAndExecuteProposal(
        uint8 paramType,
        uint256 newValue
    ) internal returns (GenericProposal) {
        vm.startPrank(proposer);
        GenericProposal proposal = factory.createProposal(
            "Change parameter",
            address(dao),
            0,
            abi.encodeWithSelector(_getParameterSelector(paramType), newValue)
        );
        dao.setApprovalForAll(address(proposal), true);

        // Add support to trigger election
        proposal.addSupport(40); // 20% of 200 total tokens needed
        assertTrue(proposal.electionTriggered());

        // Claim voting tokens
        uint256 votingTokenId = proposal.votingTokenId();
        proposal.claimVotingTokens();

        // Vote yes
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();

        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        proposal.claimVotingTokens();
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
        vm.stopPrank();

        // Execute the proposal after election period
        vm.roll(block.number + 50);
        proposal.execute();

        return proposal;
    }

    function testTokenPriceChange() public {
        uint256 initialPrice = dao.tokenPrice();
        uint256 newPrice = 0.2 ether;

        _createAndExecuteProposal(5, newPrice); // TokenPrice = 5

        assertEq(dao.tokenPrice(), newPrice);
        assertTrue(dao.tokenPrice() != initialPrice);
    }

    function testSupportThresholdChange() public {
        uint256 initialThreshold = dao.supportThreshold();
        uint256 newThreshold = 3000; // 30%

        _createAndExecuteProposal(0, newThreshold); // SupportThreshold = 0

        assertEq(dao.supportThreshold(), newThreshold);
        assertTrue(dao.supportThreshold() != initialThreshold);
    }

    function testQuorumPercentageChange() public {
        uint256 initialQuorum = dao.quorumPercentage();
        uint256 newQuorum = 6000; // 60%

        _createAndExecuteProposal(1, newQuorum); // QuorumPercentage = 1

        assertEq(dao.quorumPercentage(), newQuorum);
        assertTrue(dao.quorumPercentage() != initialQuorum);
    }

    function testMaxProposalAgeChange() public {
        uint256 initialAge = dao.maxProposalAge();
        uint256 newAge = 200;

        _createAndExecuteProposal(2, newAge); // MaxProposalAge = 2

        assertEq(dao.maxProposalAge(), newAge);
        assertTrue(dao.maxProposalAge() != initialAge);
    }

    function testElectionDurationChange() public {
        uint256 initialDuration = dao.electionDuration();
        uint256 newDuration = 100;

        _createAndExecuteProposal(3, newDuration); // ElectionDuration = 3

        assertEq(dao.electionDuration(), newDuration);
        assertTrue(dao.electionDuration() != initialDuration);
    }

    function testVestingPeriodChange() public {
        uint256 initialPeriod = dao.vestingPeriod();
        uint256 newPeriod = 50;

        _createAndExecuteProposal(4, newPeriod); // VestingPeriod = 4

        assertEq(dao.vestingPeriod(), newPeriod);
        assertTrue(dao.vestingPeriod() != initialPeriod);
    }

    function testFlagsChange() public {
        uint256 initialFlags = dao.flags();
        uint256 newFlags = 7; // All flags enabled (bits 0, 1, 2)

        _createAndExecuteProposal(6, newFlags); // Flags = 6

        assertEq(dao.flags(), newFlags);
        assertTrue(dao.flags() != initialFlags);
        assertTrue(dao.allowMinting());
        assertTrue(dao.restrictPurchasesToHolders());
        assertTrue(dao.mintToPurchase());
    }

    function testInvalidSupportThreshold() public {
        uint256 before = dao.supportThreshold();
        // Test threshold = 0
        _expectExecutionFailure(dao.setSupportThreshold.selector, 0);
        assertEq(dao.supportThreshold(), before);

        // Test threshold > 10000
        _expectExecutionFailure(dao.setSupportThreshold.selector, 10001);
        assertEq(dao.supportThreshold(), before);
    }

    function testInvalidQuorum() public {
        uint256 before = dao.quorumPercentage();
        // Test quorum < 100 (less than 1%)
        _expectExecutionFailure(dao.setQuorumPercentage.selector, 99);
        assertEq(dao.quorumPercentage(), before);

        // Test quorum > 10000
        _expectExecutionFailure(dao.setQuorumPercentage.selector, 10001);
        assertEq(dao.quorumPercentage(), before);
    }

    function testInvalidMaxProposalAge() public {
        uint256 before = dao.maxProposalAge();
        _expectExecutionFailure(dao.setMaxProposalAge.selector, 0);
        assertEq(dao.maxProposalAge(), before);
    }

    function testInvalidElectionDuration() public {
        uint256 before = dao.electionDuration();
        _expectExecutionFailure(dao.setElectionDuration.selector, 0);
        assertEq(dao.electionDuration(), before);
    }

    function testInvalidTokenPrice() public {
        uint256 before = dao.tokenPrice();
        _expectExecutionFailure(dao.setTokenPrice.selector, 0);
        assertEq(dao.tokenPrice(), before);
    }

    function testInvalidFlags() public {
        uint256 before = dao.flags();
        // Test flags > 7 (only bits 0-2 are valid)
        _expectExecutionFailure(dao.setFlags.selector, 8);
        assertEq(dao.flags(), before);
    }

    function testDirectSettersFail() public {
        // All setters should fail when called directly (not from active proposal)
        vm.expectRevert("Only active proposal can set price");
        dao.setTokenPrice(0.2 ether);

        vm.expectRevert("Only active proposal can set threshold");
        dao.setSupportThreshold(3000);

        vm.expectRevert("Only active proposal can set quorum");
        dao.setQuorumPercentage(6000);

        vm.expectRevert("Only active proposal can set proposal age");
        dao.setMaxProposalAge(200);

        vm.expectRevert("Only active proposal can set election duration");
        dao.setElectionDuration(100);

        vm.expectRevert("Only active proposal can set vesting period");
        dao.setVestingPeriod(50);

        vm.expectRevert("Only active proposal can set flags");
        dao.setFlags(7);
    }

    function testVestingPeriodZeroAllowed() public {
        // Vesting period of 0 should be valid
        _createAndExecuteProposal(4, 0); // VestingPeriod = 4
        assertEq(dao.vestingPeriod(), 0);
    }
}
