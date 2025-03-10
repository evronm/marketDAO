// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract TokenPriceProposalTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    address proposer = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    uint256 constant INITIAL_TOKEN_PRICE = 0.1 ether;
    uint256 constant NEW_TOKEN_PRICE = 0.2 ether;
    
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
            20,  // 20% support threshold
            51,  // 51% quorum
            100, // max proposal age
            50,  // election duration
            true, // allow minting
            INITIAL_TOKEN_PRICE, // token price
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
    }

    function testTokenPriceProposal() public {
        // Verify initial token price
        assertEq(dao.tokenPrice(), INITIAL_TOKEN_PRICE);
        
        // Create proposal to change token price
        vm.startPrank(proposer);
        TokenPriceProposal proposal = factory.createTokenPriceProposal(
            "Change token price", 
            NEW_TOKEN_PRICE
        );
        dao.setApprovalForAll(address(proposal), true);
        
        // Add support to trigger election
        proposal.addSupport(40); // 20% of 200 total tokens needed
        assertTrue(proposal.electionTriggered());
        
        // Vote yes
        uint256 votingTokenId = proposal.votingTokenId();
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), votingTokenId, 100, "");
        vm.stopPrank();
        
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), votingTokenId, 50, "");
        vm.stopPrank();
        
        // Execute the proposal after election period
        vm.roll(block.number + 50);
        proposal.execute();
        
        // Verify that token price was updated
        assertEq(dao.tokenPrice(), NEW_TOKEN_PRICE);
        
        // Test purchase at new price
        address buyer = address(0x4);
        vm.deal(buyer, 1 ether);
        
        vm.prank(buyer);
        dao.purchaseTokens{value: 0.4 ether}();
        
        // Should get 2 tokens at the new price
        assertEq(dao.balanceOf(buyer, 0), 2);
    }
    
    function testSetTokenPriceDirect() public {
        // This should fail as only a proposal can change the price
        vm.expectRevert("Only active proposal can set price");
        dao.setTokenPrice(NEW_TOKEN_PRICE);
    }
}