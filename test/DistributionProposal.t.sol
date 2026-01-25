// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
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

contract DistributionProposalTest is TestHelper {
    MarketDAO dao;
    ProposalFactory factory;
    MockERC20 mockToken;

    address proposer = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    address voter3 = address(0x4);

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
            2000, // 20% support
            5100, // 51% quorum
            100,
            50,
            0, // flags
            0,
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(dao);
        dao.setFactory(address(factory));

        // Create mock ERC20 token and fund the DAO
        mockToken = new MockERC20();
        mockToken.transfer(address(dao), 10000 ether);

        // Fund the DAO with ETH
        vm.deal(address(dao), 100 ether);
    }

    function testCreateETHDistributionProposal() public {
        // Total vested supply is 200 (100 + 50 + 30 + 20)
        // At 0.5 ETH per token, we need 100 ETH total
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.5 ETH per governance token",
            address(0), // ETH
            0,
            0.5 ether
        );

        assertEq(proposal.token(), address(0));
        assertEq(proposal.tokenId(), 0);
        assertEq(proposal.amountPerGovernanceToken(), 0.5 ether);
        assertEq(proposal.totalAmount(), 100 ether); // 200 tokens * 0.5 ETH
    }

    function testCreateERC20DistributionProposal() public {
        // Total vested supply is 200
        // At 10 tokens per governance token, we need 2000 tokens total
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 10 ERC20 per governance token",
            address(mockToken),
            0,
            10 ether
        );

        assertEq(proposal.token(), address(mockToken));
        assertEq(proposal.tokenId(), 0);
        assertEq(proposal.amountPerGovernanceToken(), 10 ether);
        assertEq(proposal.totalAmount(), 2000 ether); // 200 tokens * 10
    }

    function testRejectsInsufficientETH() public {
        // Try to distribute more ETH than available
        vm.prank(proposer);
        vm.expectRevert("Insufficient available ETH balance");
        factory.createDistributionProposal(
            "Distribute too much ETH",
            address(0),
            0,
            1 ether // 200 tokens * 1 ETH = 200 ETH, but we only have 100 ETH
        );
    }

    function testRejectsInsufficientERC20() public {
        // Try to distribute more ERC20 than available
        vm.prank(proposer);
        vm.expectRevert("Insufficient available ERC20 balance");
        factory.createDistributionProposal(
            "Distribute too much ERC20",
            address(mockToken),
            0,
            100000 ether // 200 tokens * 100000 = 20M tokens, but we only have 10k
        );
    }

    function testRejectsZeroAmountPerToken() public {
        vm.prank(proposer);
        vm.expectRevert("Amount per token must be positive");
        factory.createDistributionProposal(
            "Distribute zero",
            address(0),
            0,
            0
        );
    }

    function testFundsLockedOnElectionTrigger() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.4 ETH per token",
            address(0),
            0,
            0.4 ether // 200 * 0.4 = 80 ETH
        );

        // Before election: no funds locked
        assertEq(dao.getTotalLockedETH(), 0);
        assertEq(dao.getAvailableETH(), 100 ether);

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // After election: funds are locked
        assertTrue(proposal.electionTriggered());
        assertEq(dao.getTotalLockedETH(), 80 ether);
        assertEq(dao.getAvailableETH(), 20 ether);
    }

    function testRedemptionContractDeployedOnElectionTrigger() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.3 ETH per token",
            address(0),
            0,
            0.3 ether
        );

        // Before election: no redemption contract
        assertEq(address(proposal.redemptionContract()), address(0));

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // After election: redemption contract is deployed
        assertTrue(address(proposal.redemptionContract()) != address(0));

        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(redemption.proposal(), address(proposal));
        assertEq(redemption.token(), address(0));
        assertEq(redemption.tokenId(), 0);
        assertEq(redemption.amountPerGovernanceToken(), 0.3 ether);
    }

    function testCannotRegisterBeforeElection() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.2 ETH per token",
            address(0),
            0,
            0.2 ether
        );

        // Try to register before election
        vm.prank(voter1);
        vm.expectRevert(DistributionProposal.ElectionNotTriggered.selector);
        proposal.registerForDistribution();
    }

    function testRegisterForDistribution() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.25 ETH per token",
            address(0),
            0,
            0.25 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register voters
        vm.prank(voter1);
        proposal.registerForDistribution();

        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(redemption.registeredBalance(voter1), 50); // voter1 has 50 tokens
        assertTrue(redemption.isRegistered(voter1));
    }

    function testCannotRegisterTwice() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.2 ETH per token",
            address(0),
            0,
            0.2 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register once
        vm.prank(voter1);
        proposal.registerForDistribution();

        // Try to register again
        vm.prank(voter1);
        vm.expectRevert(DistributionRedemption.AlreadyRegistered.selector);
        proposal.registerForDistribution();
    }

    // ============ M-01 FIX: Updated for Pro-Rata Distribution ============
    // With pro-rata, when not all users register, each registrant gets MORE
    // than the target amountPerGovernanceToken because the pool is fixed but
    // divided among fewer shares.

    function testFullETHDistributionFlow() public {
        // Create proposal for 0.4 ETH per token
        // Pool = 200 * 0.4 = 80 ETH
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.4 ETH per token",
            address(0),
            0,
            0.4 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register users for distribution (only 3 of 4 register)
        // proposer: 100, voter1: 50, voter2: 30 = 180 total registered
        vm.prank(proposer);
        proposal.registerForDistribution();

        vm.prank(voter1);
        proposal.registerForDistribution();

        vm.prank(voter2);
        proposal.registerForDistribution();

        // Vote and pass proposal
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        vm.prank(voter1);
        dao.safeTransferFrom(voter1, yesVote, votingToken, 50, "");

        // Move past election period
        vm.roll(block.number + 51);

        // Execute proposal
        vm.prank(proposer);
        proposal.execute();

        assertTrue(proposal.executed());

        // Verify funds transferred to redemption contract
        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(address(redemption).balance, 80 ether);

        // M-01 FIX: Pro-rata calculation
        // Pool = 80 ETH, registered = 180 tokens
        // proposer: 100/180 * 80 = 44.444... ETH
        // voter1: 50/180 * 80 = 22.222... ETH  
        // voter2: 30/180 * 80 = 13.333... ETH
        uint256 expectedProposer = (uint256(100) * 80 ether) / 180;
        uint256 expectedVoter1 = (uint256(50) * 80 ether) / 180;
        uint256 expectedVoter2 = (uint256(30) * 80 ether) / 180;

        uint256 proposerBalanceBefore = proposer.balance;
        vm.prank(proposer);
        redemption.claim();
        assertEq(proposer.balance, proposerBalanceBefore + expectedProposer);
        assertTrue(redemption.hasClaimed(proposer));

        uint256 voter1BalanceBefore = voter1.balance;
        vm.prank(voter1);
        redemption.claim();
        assertEq(voter1.balance, voter1BalanceBefore + expectedVoter1);
        assertTrue(redemption.hasClaimed(voter1));

        uint256 voter2BalanceBefore = voter2.balance;
        vm.prank(voter2);
        redemption.claim();
        assertEq(voter2.balance, voter2BalanceBefore + expectedVoter2);
        assertTrue(redemption.hasClaimed(voter2));
    }

    function testFullERC20DistributionFlow() public {
        // Create proposal for 25 ERC20 per token
        // Pool = 200 * 25 = 5000 ERC20
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 25 ERC20 per token",
            address(mockToken),
            0,
            25 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register users (only 2 of 4 register)
        // proposer: 100, voter1: 50 = 150 total registered
        vm.prank(proposer);
        proposal.registerForDistribution();

        vm.prank(voter1);
        proposal.registerForDistribution();

        // Vote and pass
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        address yesVote = proposal.yesVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, yesVote, votingToken, 100, "");

        vm.prank(voter1);
        proposal.claimVotingTokens();
        vm.prank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        vm.prank(voter1);
        dao.safeTransferFrom(voter1, yesVote, votingToken, 50, "");

        vm.roll(block.number + 51);

        // Execute
        vm.prank(proposer);
        proposal.execute();

        DistributionRedemption redemption = proposal.redemptionContract();
        assertEq(mockToken.balanceOf(address(redemption)), 5000 ether);

        // M-01 FIX: Pro-rata calculation
        // Pool = 5000 ERC20, registered = 150 tokens
        // proposer: 100/150 * 5000 = 3333.333... ERC20
        // voter1: 50/150 * 5000 = 1666.666... ERC20
        uint256 expectedProposer = (uint256(100) * 5000 ether) / 150;
        uint256 expectedVoter1 = (uint256(50) * 5000 ether) / 150;

        uint256 proposerBalanceBefore = mockToken.balanceOf(proposer);
        vm.prank(proposer);
        redemption.claim();
        assertEq(mockToken.balanceOf(proposer), proposerBalanceBefore + expectedProposer);

        uint256 voter1BalanceBefore = mockToken.balanceOf(voter1);
        vm.prank(voter1);
        redemption.claim();
        assertEq(mockToken.balanceOf(voter1), voter1BalanceBefore + expectedVoter1);
    }

    // M-01 FIX: Updated error expectation
    function testCannotClaimBeforeExecution() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register
        vm.prank(voter1);
        proposal.registerForDistribution();

        // Try to claim before execution - now returns PoolNotFunded (M-01 fix)
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(voter1);
        vm.expectRevert(DistributionRedemption.PoolNotFunded.selector);
        redemption.claim();
    }

    function testCannotClaimTwice() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Register
        vm.prank(voter1);
        proposal.registerForDistribution();

        // Vote and execute
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

        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // Claim once
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(voter1);
        redemption.claim();

        // Try to claim again
        vm.prank(voter1);
        vm.expectRevert(DistributionRedemption.AlreadyClaimed.selector);
        redemption.claim();
    }

    function testUnregisteredUserCannotClaim() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.1 ETH per token",
            address(0),
            0,
            0.1 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // voter1 registers, voter2 does not
        vm.prank(voter1);
        proposal.registerForDistribution();

        // Vote and execute
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

        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // voter2 tries to claim without registering
        DistributionRedemption redemption = proposal.redemptionContract();
        vm.prank(voter2);
        vm.expectRevert(DistributionRedemption.NotRegistered.selector);
        redemption.claim();
    }

    // M-01 FIX: Updated for pro-rata
    function testGetClaimableAmount() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.3 ETH per token",
            address(0),
            0,
            0.3 ether
        );

        // Trigger election and register
        vm.prank(proposer);
        proposal.addSupport(60);

        // Only voter1 registers (50 tokens)
        vm.prank(voter1);
        proposal.registerForDistribution();

        DistributionRedemption redemption = proposal.redemptionContract();

        // Before execution: shows TARGET amount (not funded yet)
        assertEq(redemption.getClaimableAmount(voter1), 15 ether); // 50 * 0.3

        // Execute proposal
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

        vm.roll(block.number + 51);
        vm.prank(proposer);
        proposal.execute();

        // M-01 FIX: After execution, shows PRO-RATA amount
        // Pool = 60 ETH (200 * 0.3), only 50 tokens registered
        // voter1: 50/50 * 60 = 60 ETH (entire pool!)
        uint256 expectedClaimable = (uint256(50) * 60 ether) / 50;
        assertEq(redemption.getClaimableAmount(voter1), expectedClaimable);

        // After claim: shows zero
        vm.prank(voter1);
        redemption.claim();
        assertEq(redemption.getClaimableAmount(voter1), 0);
    }

    function testFundsUnlockedOnFailure() public {
        vm.prank(proposer);
        DistributionProposal proposal = factory.createDistributionProposal(
            "Distribute 0.3 ETH per token",
            address(0),
            0,
            0.3 ether
        );

        // Trigger election
        vm.prank(proposer);
        proposal.addSupport(60);

        // Funds locked
        assertEq(dao.getTotalLockedETH(), 60 ether);

        // Vote NO to fail the proposal
        vm.prank(proposer);
        proposal.claimVotingTokens();
        vm.prank(proposer);
        dao.setApprovalForAll(address(proposal), true);

        address noVote = proposal.noVoteAddress();
        uint256 votingToken = proposal.votingTokenId();

        vm.prank(proposer);
        dao.safeTransferFrom(proposer, noVote, votingToken, 100, "");

        vm.roll(block.number + 51);

        // Fail the proposal
        vm.prank(proposer);
        proposal.failProposal();

        // Funds unlocked
        assertEq(dao.getTotalLockedETH(), 0);
        assertEq(dao.getAvailableETH(), 100 ether);
    }
}
