// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";
import "../src/DistributionRedemption.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 ether);
    }
}

/**
 * @title M01ProRataDistributionTest
 * @notice Tests for M-01 vulnerability fix: pro-rata distribution
 * 
 * M-01 Issue: Distribution pool is calculated at init using getTotalVestedSupply(),
 * but users register using their current vestedBalance() which may be higher due to
 * vesting unlocks. This could cause total registered claims to exceed the pool.
 * 
 * Fix: Use pro-rata distribution where each user receives:
 *      (userShares / totalRegisteredShares) * actualPoolBalance
 * This ensures the pool can never be over-claimed.
 */
contract M01ProRataDistributionTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    MockERC20 mockToken;

    address proposer = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    address voter3 = address(0x4);

    // Helper to deploy the factory with all proposal implementations
    function deployFactory(MarketDAO _dao) internal returns (ProposalFactory) {
        ResolutionProposal resImpl = new ResolutionProposal();
        TreasuryProposal treasuryImpl = new TreasuryProposal();
        MintProposal mintImpl = new MintProposal();
        ParameterProposal paramImpl = new ParameterProposal();
        DistributionProposal distImpl = new DistributionProposal();

        return new ProposalFactory(
            _dao,
            address(resImpl),
            address(treasuryImpl),
            address(mintImpl),
            address(paramImpl),
            address(distImpl)
        );
    }

    function setUp() public {
        address[] memory initialHolders = new address[](4);
        initialHolders[0] = proposer;
        initialHolders[1] = voter1;
        initialHolders[2] = voter2;
        initialHolders[3] = voter3;

        uint256[] memory initialAmounts = new uint256[](4);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;
        initialAmounts[2] = 30;
        initialAmounts[3] = 20;

        string[] memory treasuryConfig = new string[](2);
        treasuryConfig[0] = "ETH";
        treasuryConfig[1] = "ERC20";

        dao = new MarketDAO(
            "Test DAO",
            2000, // 20% support threshold
            5100, // 51% quorum
            100,  // max proposal age
            50,   // election duration
            0,    // flags
            0,    // token price
            0,    // No vesting (instant vest for simplicity)
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Fund DAO
        vm.deal(address(dao), 100 ether);
        mockToken = new MockERC20();
        mockToken.transfer(address(dao), 10000 ether);
    }

    /**
     * @notice Helper to execute a distribution proposal through voting
     */
    function executeProposal(DistributionProposal proposal) internal {
        // Vote yes with enough to pass
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(voter1);
        dao.safeTransferFrom(voter1, yesVote, votingToken, 50, "");

        // Wait for election to end
        vm.roll(block.number + 51);

        // Execute
        vm.prank(proposer);
        proposal.execute();
    }

    /**
     * @notice Test basic pro-rata distribution with all users registering
     * @dev When all eligible users register, pro-rata should equal target amount
     */
    function testProRataWithAllUsersRegistered() public {
        // Create proposal: 0.5 ETH per token, total = 200 * 0.5 = 100 ETH
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // All users register
        vm.prank(proposer);
        proposal.registerForDistribution();
        vm.prank(voter1);
        proposal.registerForDistribution();
        vm.prank(voter2);
        proposal.registerForDistribution();
        vm.prank(voter3);
        proposal.registerForDistribution();

        // Execute proposal
        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();

        // Verify pool is funded
        assertTrue(redemption.poolFunded());
        assertEq(redemption.totalPoolBalance(), 100 ether);
        assertEq(redemption.totalRegisteredGovernanceTokens(), 200);

        // All users claim - should get exact pro-rata amounts
        uint256 proposerBalanceBefore = proposer.balance;
        vm.prank(proposer);
        redemption.claim();
        assertEq(proposer.balance, proposerBalanceBefore + 50 ether); // 100/200 * 100 = 50

        uint256 voter1BalanceBefore = voter1.balance;
        vm.prank(voter1);
        redemption.claim();
        assertEq(voter1.balance, voter1BalanceBefore + 25 ether); // 50/200 * 100 = 25

        uint256 voter2BalanceBefore = voter2.balance;
        vm.prank(voter2);
        redemption.claim();
        assertEq(voter2.balance, voter2BalanceBefore + 15 ether); // 30/200 * 100 = 15

        uint256 voter3BalanceBefore = voter3.balance;
        vm.prank(voter3);
        redemption.claim();
        assertEq(voter3.balance, voter3BalanceBefore + 10 ether); // 20/200 * 100 = 10
    }

    /**
     * @notice Test pro-rata when only some users register
     * @dev When not all users register, each registrant gets MORE than target
     */
    function testProRataWithPartialRegistration() public {
        // Create proposal: 0.5 ETH per token
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Only proposer and voter1 register (150 tokens out of 200)
        vm.prank(proposer);
        proposal.registerForDistribution();
        vm.prank(voter1);
        proposal.registerForDistribution();

        // Execute proposal - pool still has 100 ETH
        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();

        // Only 150 tokens registered, but pool has 100 ETH
        assertEq(redemption.totalRegisteredGovernanceTokens(), 150);
        assertEq(redemption.totalPoolBalance(), 100 ether);

        // Pro-rata: each user gets more than 0.5 ETH per token
        // proposer: 100/150 * 100 = 66.666... ETH
        // voter1: 50/150 * 100 = 33.333... ETH

        uint256 proposerBalanceBefore = proposer.balance;
        vm.prank(proposer);
        redemption.claim();
        // 100 * 100 ether / 150 = 66.666... ether
        uint256 expectedProposer = (uint256(100) * 100 ether) / 150;
        assertEq(proposer.balance, proposerBalanceBefore + expectedProposer);

        uint256 voter1BalanceBefore = voter1.balance;
        vm.prank(voter1);
        redemption.claim();
        // 50 * 100 ether / 150 = 33.333... ether
        uint256 expectedVoter1 = (uint256(50) * 100 ether) / 150;
        assertEq(voter1.balance, voter1BalanceBefore + expectedVoter1);

        // Verify no funds left stuck (allow for minor rounding dust)
        // With integer division, there may be a few wei left
        assertTrue(address(redemption).balance <= 2 wei);
    }

    /**
     * @notice Test that getClaimableAmount returns correct pro-rata amounts
     */
    function testGetClaimableAmountProRata() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.4 ETH per token",
            address(0),
            0,
            0.4 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Register
        vm.prank(proposer);
        proposal.registerForDistribution();
        vm.prank(voter1);
        proposal.registerForDistribution();

        DistributionRedemption redemption = proposal.redemptionContract();

        // Before execution: shows TARGET amount (not funded yet)
        assertEq(redemption.getClaimableAmount(proposer), 100 * 0.4 ether); // 40 ETH target
        assertFalse(redemption.poolFunded());

        // Execute
        executeProposal(proposal);

        // After execution: shows PRO-RATA amount
        // Pool has 80 ETH (200 * 0.4), only 150 tokens registered
        // proposer: 100/150 * 80 = 53.333... ETH
        assertTrue(redemption.poolFunded());
        uint256 expectedProposerClaim = (uint256(100) * 80 ether) / 150;
        uint256 expectedVoter1Claim = (uint256(50) * 80 ether) / 150;
        assertEq(redemption.getClaimableAmount(proposer), expectedProposerClaim);
        assertEq(redemption.getClaimableAmount(voter1), expectedVoter1Claim);
    }

    /**
     * @notice Test ERC20 pro-rata distribution
     */
    function testProRataERC20Distribution() public {
        // Create proposal: 25 tokens per governance token
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 25 ERC20 per token",
            address(mockToken),
            0,
            25 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Only proposer registers
        vm.prank(proposer);
        proposal.registerForDistribution();

        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();

        // Pool has 5000 tokens (200 * 25), only 100 governance tokens registered
        // proposer gets entire pool: 100/100 * 5000 = 5000
        assertTrue(redemption.poolFunded());
        assertEq(redemption.totalPoolBalance(), 5000 ether);

        uint256 proposerBalanceBefore = mockToken.balanceOf(proposer);
        vm.prank(proposer);
        redemption.claim();
        assertEq(mockToken.balanceOf(proposer), proposerBalanceBefore + 5000 ether);
    }

    /**
     * @notice Test that pool cannot be over-claimed with pro-rata
     * @dev This is the key fix for M-01: even if total registered > initial calculation,
     *      pro-rata ensures everyone gets a fair share and pool is never exhausted early
     */
    function testPoolCannotBeOverClaimed() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // All users register
        vm.prank(proposer);
        proposal.registerForDistribution();
        vm.prank(voter1);
        proposal.registerForDistribution();
        vm.prank(voter2);
        proposal.registerForDistribution();
        vm.prank(voter3);
        proposal.registerForDistribution();

        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();
        uint256 initialPoolBalance = address(redemption).balance;

        // All users claim
        vm.prank(proposer);
        redemption.claim();
        vm.prank(voter1);
        redemption.claim();
        vm.prank(voter2);
        redemption.claim();
        vm.prank(voter3);
        redemption.claim();

        // Pool should be essentially empty (maybe tiny dust from rounding)
        assertTrue(address(redemption).balance <= 3 wei); // Allow for minor rounding

        // Total claimed should equal initial pool (minus dust)
        uint256 totalClaimed = initialPoolBalance - address(redemption).balance;
        assertTrue(totalClaimed >= initialPoolBalance - 3 wei);
    }

    /**
     * @notice Test that unregistered users cannot claim
     */
    function testUnregisteredCannotClaim() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Only proposer registers
        vm.prank(proposer);
        proposal.registerForDistribution();

        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();

        // voter1 tries to claim without registering
        vm.prank(voter1);
        vm.expectRevert(DistributionRedemption.NotRegistered.selector);
        redemption.claim();
    }

    /**
     * @notice Test cannot claim before pool is funded
     */
    function testCannotClaimBeforePoolFunded() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(proposer);
        proposal.registerForDistribution();

        DistributionRedemption redemption = proposal.redemptionContract();

        // Try to claim before execution (pool not funded)
        vm.prank(proposer);
        vm.expectRevert(DistributionRedemption.PoolNotFunded.selector);
        redemption.claim();
    }

    /**
     * @notice Test that recordTokenFunding is called correctly for ERC20
     */
    function testRecordTokenFundingCalledOnERC20Execute() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 10 ERC20 per token",
            address(mockToken),
            0,
            10 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        vm.prank(proposer);
        proposal.registerForDistribution();

        DistributionRedemption redemption = proposal.redemptionContract();

        // Before execution: not funded
        assertFalse(redemption.poolFunded());

        executeProposal(proposal);

        // After execution: funded
        assertTrue(redemption.poolFunded());
        assertEq(redemption.totalPoolBalance(), 2000 ether); // 200 * 10
    }

    /**
     * @notice Test edge case: single registrant gets entire pool
     */
    function testSingleRegistrantGetsEntirePool() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per token",
            address(0),
            0,
            0.5 ether
        );

        vm.prank(proposer);
        proposal.addSupport(60);

        // Only voter3 (20 tokens) registers
        vm.prank(voter3);
        proposal.registerForDistribution();

        executeProposal(proposal);

        DistributionRedemption redemption = proposal.redemptionContract();

        // Pool has 100 ETH, only 20 tokens registered
        // voter3 gets: 20/20 * 100 = 100 ETH (entire pool!)
        uint256 voter3BalanceBefore = voter3.balance;
        vm.prank(voter3);
        redemption.claim();
        assertEq(voter3.balance, voter3BalanceBefore + 100 ether);
    }
}
