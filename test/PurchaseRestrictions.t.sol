// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TestHelper.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract PurchaseRestrictionsTest is TestHelper {
    MarketDAO public daoOpen;           // No purchase restrictions
    MarketDAO public daoRestricted;     // Purchase restrictions enabled
    ProposalFactory public factory;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3); // Non-holder

    uint256 constant TOKEN_PRICE = 0.1 ether;
    uint256 constant FLAG_ALLOW_MINTING = 1 << 0;
    uint256 constant FLAG_RESTRICT_PURCHASES = 1 << 1;

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

        // Create DAO without restrictions (flags = 1, only minting enabled)
        daoOpen = new MarketDAO(
            "Open DAO",
            2000,  // 20% support threshold
            5100,  // 51% quorum
            100,   // max proposal age
            50,    // election duration
            FLAG_ALLOW_MINTING,  // flags: allow minting, no restrictions
            TOKEN_PRICE,
            0,     // No vesting for simpler tests
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        // Create DAO with restrictions (flags = 3, both flags enabled)
        daoRestricted = new MarketDAO(
            "Restricted DAO",
            2000,
            5100,
            100,
            50,
            FLAG_ALLOW_MINTING | FLAG_RESTRICT_PURCHASES,  // flags: both enabled
            TOKEN_PRICE,
            0,     // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = deployFactory(daoRestricted);
        daoRestricted.setFactory(address(factory));

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }

    function testOpenDAOAllowsAnyoneToPurchase() public {
        // Charlie has no tokens initially
        assertEq(daoOpen.balanceOf(charlie, 0), 0);

        // Charlie can purchase tokens
        vm.prank(charlie);
        daoOpen.purchaseTokens{value: 1 ether}();

        // Charlie now has 10 tokens (1 ETH / 0.1 ETH per token)
        assertEq(daoOpen.balanceOf(charlie, 0), 10);
    }

    function testRestrictedDAOBlocksNonHolders() public {
        // Charlie has no tokens
        assertEq(daoRestricted.balanceOf(charlie, 0), 0);

        // Charlie cannot purchase tokens
        vm.prank(charlie);
        vm.expectRevert("Only existing holders can purchase");
        daoRestricted.purchaseTokens{value: 1 ether}();

        // Charlie still has no tokens
        assertEq(daoRestricted.balanceOf(charlie, 0), 0);
    }

    function testRestrictedDAOAllowsExistingHoldersToPurchase() public {
        // Alice is an initial holder with 100 tokens
        assertEq(daoRestricted.balanceOf(alice, 0), 100);

        // Alice can purchase more tokens
        vm.prank(alice);
        daoRestricted.purchaseTokens{value: 1 ether}();

        // Alice now has 110 tokens
        assertEq(daoRestricted.balanceOf(alice, 0), 110);
    }

    function testRestrictedDAOAllowsPurchaseAfterMinting() public {
        // Charlie has no tokens initially
        assertEq(daoRestricted.balanceOf(charlie, 0), 0);

        // Create and pass a mint proposal to give Charlie tokens
        vm.prank(alice);
        MintProposal mintProposal = factory.createMintProposal(
            "Mint tokens for Charlie",
            charlie,
            10  // Mint 10 tokens
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
        daoRestricted.safeTransferFrom(alice, yesVoteAddr, votingTokenId, 100, "");

        // Advance past election
        vm.roll(block.number + 51);

        // Execute the proposal
        mintProposal.execute();

        // Charlie should now have 10 tokens
        assertEq(daoRestricted.balanceOf(charlie, 0), 10);

        // Now Charlie can purchase more tokens
        vm.prank(charlie);
        daoRestricted.purchaseTokens{value: 1 ether}();

        // Charlie now has 20 tokens
        assertEq(daoRestricted.balanceOf(charlie, 0), 20);
    }

    function testRestrictedDAOBlocksHolderWhoTransfersAllTokens() public {
        // Bob has 50 tokens
        assertEq(daoRestricted.balanceOf(bob, 0), 50);

        // Bob can purchase
        vm.prank(bob);
        daoRestricted.purchaseTokens{value: 1 ether}();
        assertEq(daoRestricted.balanceOf(bob, 0), 60);

        // Bob transfers all tokens to Alice
        vm.prank(bob);
        daoRestricted.safeTransferFrom(bob, alice, 0, 60, "");

        assertEq(daoRestricted.balanceOf(bob, 0), 0);

        // Bob can no longer purchase
        vm.prank(bob);
        vm.expectRevert("Only existing holders can purchase");
        daoRestricted.purchaseTokens{value: 1 ether}();
    }

    function testRestrictedFlagCheck() public {
        // Check that restriction flag is correctly set
        assertFalse(daoOpen.restrictPurchasesToHolders());
        assertTrue(daoRestricted.restrictPurchasesToHolders());

        // Check that minting flag is set on both
        assertTrue(daoOpen.allowMinting());
        assertTrue(daoRestricted.allowMinting());
    }

    function testMultiplePurchasesWithRestrictions() public {
        // Alice makes multiple purchases
        vm.startPrank(alice);

        uint256 initialBalance = daoRestricted.balanceOf(alice, 0);

        daoRestricted.purchaseTokens{value: 0.5 ether}();
        assertEq(daoRestricted.balanceOf(alice, 0), initialBalance + 5);

        daoRestricted.purchaseTokens{value: 0.3 ether}();
        assertEq(daoRestricted.balanceOf(alice, 0), initialBalance + 8);

        daoRestricted.purchaseTokens{value: 1 ether}();
        assertEq(daoRestricted.balanceOf(alice, 0), initialBalance + 18);

        vm.stopPrank();
    }

    function testCannotBypassRestrictionWithZeroBalanceHolder() public {
        // Create a DAO where someone had tokens but transferred them all away
        // They should not be able to purchase again

        // Bob transfers all his tokens to Alice
        vm.prank(bob);
        daoRestricted.safeTransferFrom(bob, alice, 0, 50, "");

        // Verify Bob has zero balance
        assertEq(daoRestricted.balanceOf(bob, 0), 0);

        // Bob cannot purchase even though he's in the holder list historically
        vm.prank(bob);
        vm.expectRevert("Only existing holders can purchase");
        daoRestricted.purchaseTokens{value: 1 ether}();
    }
}
