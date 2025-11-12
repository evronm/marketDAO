// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

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

    function _createAndExecuteProposal(
        ParameterProposal.ParameterType paramType,
        uint256 newValue
    ) internal returns (ParameterProposal) {
        vm.startPrank(proposer);
        ParameterProposal proposal = factory.createParameterProposal(
            "Change parameter",
            paramType,
            newValue
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

        _createAndExecuteProposal(ParameterProposal.ParameterType.TokenPrice, newPrice);

        assertEq(dao.tokenPrice(), newPrice);
        assertTrue(dao.tokenPrice() != initialPrice);
    }

    function testSupportThresholdChange() public {
        uint256 initialThreshold = dao.supportThreshold();
        uint256 newThreshold = 3000; // 30%

        _createAndExecuteProposal(ParameterProposal.ParameterType.SupportThreshold, newThreshold);

        assertEq(dao.supportThreshold(), newThreshold);
        assertTrue(dao.supportThreshold() != initialThreshold);
    }

    function testQuorumPercentageChange() public {
        uint256 initialQuorum = dao.quorumPercentage();
        uint256 newQuorum = 6000; // 60%

        _createAndExecuteProposal(ParameterProposal.ParameterType.QuorumPercentage, newQuorum);

        assertEq(dao.quorumPercentage(), newQuorum);
        assertTrue(dao.quorumPercentage() != initialQuorum);
    }

    function testMaxProposalAgeChange() public {
        uint256 initialAge = dao.maxProposalAge();
        uint256 newAge = 200;

        _createAndExecuteProposal(ParameterProposal.ParameterType.MaxProposalAge, newAge);

        assertEq(dao.maxProposalAge(), newAge);
        assertTrue(dao.maxProposalAge() != initialAge);
    }

    function testElectionDurationChange() public {
        uint256 initialDuration = dao.electionDuration();
        uint256 newDuration = 100;

        _createAndExecuteProposal(ParameterProposal.ParameterType.ElectionDuration, newDuration);

        assertEq(dao.electionDuration(), newDuration);
        assertTrue(dao.electionDuration() != initialDuration);
    }

    function testVestingPeriodChange() public {
        uint256 initialPeriod = dao.vestingPeriod();
        uint256 newPeriod = 50;

        _createAndExecuteProposal(ParameterProposal.ParameterType.VestingPeriod, newPeriod);

        assertEq(dao.vestingPeriod(), newPeriod);
        assertTrue(dao.vestingPeriod() != initialPeriod);
    }

    function testFlagsChange() public {
        uint256 initialFlags = dao.flags();
        uint256 newFlags = 7; // All flags enabled (bits 0, 1, 2)

        _createAndExecuteProposal(ParameterProposal.ParameterType.Flags, newFlags);

        assertEq(dao.flags(), newFlags);
        assertTrue(dao.flags() != initialFlags);
        assertTrue(dao.allowMinting());
        assertTrue(dao.restrictPurchasesToHolders());
        assertTrue(dao.mintToPurchase());
    }

    function testInvalidSupportThreshold() public {
        vm.startPrank(proposer);

        // Test threshold = 0
        vm.expectRevert("Threshold must be > 0 and <= 10000");
        factory.createParameterProposal(
            "Invalid threshold",
            ParameterProposal.ParameterType.SupportThreshold,
            0
        );

        // Test threshold > 10000
        vm.expectRevert("Threshold must be > 0 and <= 10000");
        factory.createParameterProposal(
            "Invalid threshold",
            ParameterProposal.ParameterType.SupportThreshold,
            10001
        );

        vm.stopPrank();
    }

    function testInvalidQuorum() public {
        vm.startPrank(proposer);

        // Test quorum < 100 (less than 1%)
        vm.expectRevert("Quorum must be >= 1% and <= 100%");
        factory.createParameterProposal(
            "Invalid quorum",
            ParameterProposal.ParameterType.QuorumPercentage,
            99
        );

        // Test quorum > 10000
        vm.expectRevert("Quorum must be >= 1% and <= 100%");
        factory.createParameterProposal(
            "Invalid quorum",
            ParameterProposal.ParameterType.QuorumPercentage,
            10001
        );

        vm.stopPrank();
    }

    function testInvalidMaxProposalAge() public {
        vm.startPrank(proposer);

        vm.expectRevert("Proposal age must be greater than 0");
        factory.createParameterProposal(
            "Invalid proposal age",
            ParameterProposal.ParameterType.MaxProposalAge,
            0
        );

        vm.stopPrank();
    }

    function testInvalidElectionDuration() public {
        vm.startPrank(proposer);

        vm.expectRevert("Election duration must be greater than 0");
        factory.createParameterProposal(
            "Invalid election duration",
            ParameterProposal.ParameterType.ElectionDuration,
            0
        );

        vm.stopPrank();
    }

    function testInvalidTokenPrice() public {
        vm.startPrank(proposer);

        vm.expectRevert("Price must be greater than 0");
        factory.createParameterProposal(
            "Invalid price",
            ParameterProposal.ParameterType.TokenPrice,
            0
        );

        vm.stopPrank();
    }

    function testInvalidFlags() public {
        vm.startPrank(proposer);

        // Test flags > 7 (only bits 0-2 are valid)
        vm.expectRevert("Invalid flags - only bits 0-2 are valid");
        factory.createParameterProposal(
            "Invalid flags",
            ParameterProposal.ParameterType.Flags,
            8
        );

        vm.stopPrank();
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
        _createAndExecuteProposal(ParameterProposal.ParameterType.VestingPeriod, 0);
        assertEq(dao.vestingPeriod(), 0);
    }
}
