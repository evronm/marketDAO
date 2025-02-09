// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/Proposal.sol";
import "../src/ProposalTypes.sol";

contract ProposalTest is Test {
    MarketDAO dao;
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
        
        string[] memory treasuryConfig = new string[](4);
        treasuryConfig[0] = "ETH";
        treasuryConfig[1] = "ERC20";
        treasuryConfig[2] = "ERC721";
        treasuryConfig[3] = "ERC1155";
        
        dao = new MarketDAO(
            "Test DAO",
            20,  // 20% support threshold
            51,  // 51% quorum
            100, // max proposal age
            50,  // election duration
            true, // allow minting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }

    function testResolutionProposal() public {
        vm.startPrank(proposer);
        ResolutionProposal proposal = new ResolutionProposal(dao, "Test Resolution");
        dao.setApprovalForAll(address(proposal), true);
        
        proposal.addSupport(40); // 20% of 200 total tokens needed
        assertTrue(proposal.electionTriggered());
        
        assertEq(dao.balanceOf(proposer, 1), 100);
        assertEq(dao.balanceOf(voter1, 1), 50);
        assertEq(dao.balanceOf(voter2, 1), 50);
        
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), 1, 100, "");
        
        vm.stopPrank();
        
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), 1, 50, "");
        vm.stopPrank();
        
        vm.roll(block.number + 50);
        proposal.execute();
        assertTrue(proposal.executed());
    }

    function testTreasuryProposal() public {
        vm.deal(address(dao), 100 ether);
        
        vm.startPrank(proposer);
        TreasuryProposal proposal = new TreasuryProposal(
            dao,
            "Send ETH",
            voter1,
            1 ether,
            address(0),
            0
        );
        dao.setApprovalForAll(address(proposal), true);
        
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());
        
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), 1, 100, "");
        vm.stopPrank();
        
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), 1, 50, "");
        vm.stopPrank();
        
        vm.roll(block.number + 50);
        
        uint256 balanceBefore = voter1.balance;
        proposal.execute();
        assertEq(voter1.balance - balanceBefore, 1 ether);
    }

    function testMintProposal() public {
        vm.startPrank(proposer);
        MintProposal proposal = new MintProposal(
            dao,
            "Mint tokens",
            voter1,
            100
        );
        dao.setApprovalForAll(address(proposal), true);
        
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());
        
        dao.safeTransferFrom(proposer, proposal.yesVoteAddress(), 1, 100, "");
        vm.stopPrank();
        
        vm.startPrank(voter1);
        dao.setApprovalForAll(address(proposal), true);
        dao.safeTransferFrom(voter1, proposal.yesVoteAddress(), 1, 50, "");
        vm.stopPrank();
        
        vm.roll(block.number + 50);
        
        uint256 balanceBefore = dao.balanceOf(voter1, 0);
        proposal.execute();
        assertEq(dao.balanceOf(voter1, 0) - balanceBefore, 100);
    }

    function testFailInsufficientSupport() public {
        vm.prank(voter1);  // Only has 50 tokens
        ResolutionProposal proposal = new ResolutionProposal(dao, "Test Resolution");
        proposal.addSupport(39);  // Not enough for 20% threshold
        assertTrue(!proposal.electionTriggered());
    }

    function testRemoveSupport() public {
        vm.startPrank(proposer);
        ResolutionProposal proposal = new ResolutionProposal(dao, "Test Resolution");
        
        proposal.addSupport(40);
        assertTrue(proposal.electionTriggered());
        
        vm.expectRevert("Election already triggered");
        proposal.removeSupport(10);
        vm.stopPrank();
    }
}
