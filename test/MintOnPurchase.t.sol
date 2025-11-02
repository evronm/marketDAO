// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract MintOnPurchaseTest is Test {
    MarketDAO public daoMintOnPurchase;     // FLAG_MINT_ON_PURCHASE = true (default behavior)
    MarketDAO public daoTransferOnPurchase; // FLAG_MINT_ON_PURCHASE = false (new behavior)
    ProposalFactory public factory;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);

    uint256 constant TOKEN_PRICE = 0.1 ether;
    uint256 constant FLAG_ALLOW_MINTING = 1 << 0;
    uint256 constant FLAG_RESTRICT_PURCHASES = 1 << 1;
    uint256 constant FLAG_MINT_ON_PURCHASE = 1 << 2;

    function setUp() public {
        // Setup initial holders
        address[] memory initialHolders = new address[](2);
        initialHolders[0] = alice;
        initialHolders[1] = bob;

        uint256[] memory initialAmounts = new uint256[](2);
        initialAmounts[0] = 100;
        initialAmounts[1] = 50;

        string[] memory treasuryConfig = new string[](1);
        treasuryConfig[0] = "ETH";

        // Create DAO without FLAG_MINT_ON_PURCHASE (traditional behavior - mints on purchase)
        daoMintOnPurchase = new MarketDAO(
            "Mint On Purchase DAO",
            2000,  // 20% support threshold
            5100,  // 51% quorum
            100,   // max proposal age
            50,    // election duration
            FLAG_ALLOW_MINTING, // No FLAG_MINT_ON_PURCHASE, so it mints
            TOKEN_PRICE,
            0,     // No vesting for simpler tests
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        // Create DAO with FLAG_MINT_ON_PURCHASE enabled (new behavior - transfers from DAO)
        daoTransferOnPurchase = new MarketDAO(
            "Transfer On Purchase DAO",
            2000,
            5100,
            100,
            50,
            FLAG_ALLOW_MINTING | FLAG_MINT_ON_PURCHASE, // FLAG_MINT_ON_PURCHASE set
            TOKEN_PRICE,
            0,
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(daoTransferOnPurchase);
        daoTransferOnPurchase.setFactory(address(factory));

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    function testMintOnPurchaseFlagCheck() public {
        // Check that the flags are correctly set
        // mintOnPurchase=false means mint new tokens (default/old behavior)
        // mintOnPurchase=true means transfer from DAO (new behavior)
        assertFalse(daoMintOnPurchase.mintOnPurchase());
        assertTrue(daoTransferOnPurchase.mintOnPurchase());
    }

    function testMintOnPurchaseTraditionalBehavior() public {
        // With FLAG_MINT_ON_PURCHASE enabled, purchasing mints new tokens
        uint256 initialSupply = daoMintOnPurchase.totalSupply(0);
        uint256 initialBalance = daoMintOnPurchase.balanceOf(charlie, 0);

        // Charlie purchases tokens
        vm.prank(charlie);
        daoMintOnPurchase.purchaseTokens{value: 1 ether}();

        // Charlie receives 10 tokens
        assertEq(daoMintOnPurchase.balanceOf(charlie, 0), initialBalance + 10);

        // Total supply increases
        assertEq(daoMintOnPurchase.totalSupply(0), initialSupply + 10);
    }

    function testTransferOnPurchaseBlocksWhenNoTokensAvailable() public {
        // With FLAG_MINT_ON_PURCHASE disabled, purchase fails when DAO has no tokens
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 0);

        // Charlie tries to purchase but should fail
        vm.prank(charlie);
        vm.expectRevert("Insufficient tokens available for purchase");
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();
    }

    function testTransferOnPurchaseAfterMintingToDAO() public {
        // First, mint tokens to the DAO via proposal
        vm.prank(alice);
        MintProposal mintProposal = factory.createMintProposal(
            "Mint tokens to DAO treasury for sale",
            address(daoTransferOnPurchase),
            100
        );

        // Support the proposal (need 20% of 150 = 30)
        vm.prank(alice);
        mintProposal.addSupport(30);

        // Election should trigger automatically
        assertTrue(mintProposal.electionTriggered());

        // Claim voting tokens and vote
        vm.prank(alice);
        mintProposal.claimVotingTokens();

        uint256 votingTokenId = mintProposal.votingTokenId();
        address yesVoteAddr = mintProposal.yesVoteAddress();

        vm.prank(alice);
        daoTransferOnPurchase.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        // Advance past election
        vm.roll(block.number + 51);

        // Execute the proposal
        mintProposal.execute();

        // DAO should now have 100 tokens
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 100);

        // Check available tokens for purchase
        assertEq(daoTransferOnPurchase.getAvailableTokensForPurchase(), 100);

        // Now Charlie can purchase tokens
        uint256 initialSupply = daoTransferOnPurchase.totalSupply(0);
        uint256 initialCharlieBalance = daoTransferOnPurchase.balanceOf(charlie, 0);

        vm.prank(charlie);
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();

        // Charlie receives 10 tokens
        assertEq(daoTransferOnPurchase.balanceOf(charlie, 0), initialCharlieBalance + 10);

        // DAO has 90 tokens left
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 90);

        // Total supply stays the same (no new minting)
        assertEq(daoTransferOnPurchase.totalSupply(0), initialSupply);

        // Available tokens for purchase decreased
        assertEq(daoTransferOnPurchase.getAvailableTokensForPurchase(), 90);
    }

    function testTransferOnPurchaseBlocksWhenInsufficientTokens() public {
        // Mint 5 tokens to DAO
        vm.prank(alice);
        MintProposal mintProposal = factory.createMintProposal(
            "Mint 5 tokens to DAO",
            address(daoTransferOnPurchase),
            5
        );

        vm.prank(alice);
        mintProposal.addSupport(30);

        vm.prank(alice);
        mintProposal.claimVotingTokens();

        uint256 votingTokenId = mintProposal.votingTokenId();
        address yesVoteAddr = mintProposal.yesVoteAddress();

        vm.prank(alice);
        daoTransferOnPurchase.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        vm.roll(block.number + 51);
        mintProposal.execute();

        // DAO has 5 tokens
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 5);

        // Charlie tries to purchase 10 tokens (1 ETH / 0.1 ETH = 10 tokens)
        vm.prank(charlie);
        vm.expectRevert("Insufficient tokens available for purchase");
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();

        // Charlie can purchase 5 tokens (0.5 ETH)
        vm.prank(charlie);
        daoTransferOnPurchase.purchaseTokens{value: 0.5 ether}();

        assertEq(daoTransferOnPurchase.balanceOf(charlie, 0), 5);
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 0);
    }

    function testMultiplePurchasesDepletesDAOInventory() public {
        // Mint 20 tokens to DAO
        vm.prank(alice);
        MintProposal mintProposal = factory.createMintProposal(
            "Mint 20 tokens to DAO",
            address(daoTransferOnPurchase),
            20
        );

        vm.prank(alice);
        mintProposal.addSupport(30);

        vm.prank(alice);
        mintProposal.claimVotingTokens();

        uint256 votingTokenId = mintProposal.votingTokenId();
        address yesVoteAddr = mintProposal.yesVoteAddress();

        vm.prank(alice);
        daoTransferOnPurchase.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        vm.roll(block.number + 51);
        mintProposal.execute();

        // Charlie buys 10 tokens
        vm.prank(charlie);
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();
        assertEq(daoTransferOnPurchase.balanceOf(charlie, 0), 10);
        assertEq(daoTransferOnPurchase.getAvailableTokensForPurchase(), 10);

        // Bob buys 10 tokens
        vm.prank(bob);
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();
        // Bob already had 50 tokens from initial distribution
        assertEq(daoTransferOnPurchase.balanceOf(bob, 0), 60);
        assertEq(daoTransferOnPurchase.getAvailableTokensForPurchase(), 0);

        // Alice tries to buy but no tokens left
        vm.prank(alice);
        vm.expectRevert("Insufficient tokens available for purchase");
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();
    }

    function testSupplyConsistencyWithTransferOnPurchase() public {
        // Mint 50 tokens to DAO
        vm.prank(alice);
        MintProposal mintProposal = factory.createMintProposal(
            "Mint 50 tokens to DAO",
            address(daoTransferOnPurchase),
            50
        );

        vm.prank(alice);
        mintProposal.addSupport(30);

        vm.prank(alice);
        mintProposal.claimVotingTokens();

        uint256 votingTokenId = mintProposal.votingTokenId();
        address yesVoteAddr = mintProposal.yesVoteAddress();

        vm.prank(alice);
        daoTransferOnPurchase.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        vm.roll(block.number + 51);
        mintProposal.execute();

        uint256 supplyAfterMint = daoTransferOnPurchase.totalSupply(0);
        // Initial: alice=100, bob=50, then minted 50 to DAO = 200 total
        assertEq(supplyAfterMint, 200);

        // Multiple purchases
        vm.prank(charlie);
        daoTransferOnPurchase.purchaseTokens{value: 2 ether}();

        vm.prank(alice);
        daoTransferOnPurchase.purchaseTokens{value: 1 ether}();

        // Supply should remain constant (no new minting)
        assertEq(daoTransferOnPurchase.totalSupply(0), supplyAfterMint);

        // Verify distribution
        assertEq(daoTransferOnPurchase.balanceOf(charlie, 0), 20);
        assertEq(daoTransferOnPurchase.balanceOf(alice, 0), 110);
        assertEq(daoTransferOnPurchase.balanceOf(address(daoTransferOnPurchase), 0), 20);
    }
}
