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

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        dao = new MarketDAO(
            "Test DAO",
            2000,  // 20% support threshold (basis points)
            5100,  // 51% quorum (basis points)
            100, // max proposal age
            50,  // election duration
            1, // flags (allowMinting=True)
            0.1 ether, // token price
            0, // No vesting
            treasuryConfig,
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

    // Helper to create proposal and expect execution failure
    function _expectExecutionRevert(bytes4 selector, uint256 value, string memory expectedError) internal {
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

        // Roll forward to end of election
        vm.roll(block.number + 50);

        // Execution should fail with validation error (now we have quorum, so validation error will be hit)
        vm.expectRevert(bytes(expectedError));
        proposal.execute();
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
        // Test threshold = 0
        _expectExecutionRevert(dao.setSupportThreshold.selector, 0, "Threshold must be > 0 and <= 10000");

        // Test threshold > 10000
        _expectExecutionRevert(dao.setSupportThreshold.selector, 10001, "Threshold must be > 0 and <= 10000");
    }

    function testInvalidQuorum() public {
        // Test quorum < 100 (less than 1%)
        _expectExecutionRevert(dao.setQuorumPercentage.selector, 99, "Quorum must be >= 1% and <= 100%");

        // Test quorum > 10000
        _expectExecutionRevert(dao.setQuorumPercentage.selector, 10001, "Quorum must be >= 1% and <= 100%");
    }

    function testInvalidMaxProposalAge() public {
        _expectExecutionRevert(dao.setMaxProposalAge.selector, 0, "Proposal age must be greater than 0");
    }

    function testInvalidElectionDuration() public {
        _expectExecutionRevert(dao.setElectionDuration.selector, 0, "Election duration must be greater than 0");
    }

    function testInvalidTokenPrice() public {
        _expectExecutionRevert(dao.setTokenPrice.selector, 0, "Price must be greater than 0");
    }

    function testInvalidFlags() public {
        // Test flags > 7 (only bits 0-2 are valid)
        _expectExecutionRevert(dao.setFlags.selector, 8, "Invalid flags - only bits 0-2 are valid");
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
