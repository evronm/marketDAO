// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProposalFactory.sol";

contract ProposalFactoryTest is Test {
    MarketDAO dao;
    ProposalFactory factory;
    address proposer = address(0x1);
    
    function setUp() public {
        address[] memory initialHolders = new address[](1);
        initialHolders[0] = proposer;
        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100;
        string[] memory treasuryConfig = new string[](2);
        treasuryConfig[0] = "ETH";
        treasuryConfig[1] = "ERC20";
        
        dao = new MarketDAO(
            "Test DAO",
            2000,  // 20% (basis points)
            5100,  // 51% (basis points)
            100,
            50,
            1, // flags (allowMinting=True)
            0, //token sales off
            0, // No vesting
            treasuryConfig,
            initialHolders,
            initialAmounts
        );

        factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));
    }
    
    function testCreateResolutionProposal() public {
        vm.startPrank(proposer);
        ResolutionProposal proposal = factory.createResolutionProposal("Test Resolution");
        
        assertEq(factory.proposalCount(), 1);
        assertEq(factory.getProposal(0), address(proposal));
        assertEq(proposal.description(), "Test Resolution");
    }
    
    function testCreateTreasuryProposal() public {
        // Fund the DAO treasury first
        vm.deal(address(dao), 10 ether);

        vm.startPrank(proposer);
        TreasuryProposal proposal = factory.createTreasuryProposal(
            "Test Treasury",
            address(0x2),
            1 ether,
            address(0),
            0
        );

        assertEq(factory.proposalCount(), 1);
        assertEq(factory.getProposal(0), address(proposal));
        assertEq(proposal.description(), "Test Treasury");
        assertEq(proposal.recipient(), address(0x2));
        assertEq(proposal.amount(), 1 ether);
    }
    
    function testCreateMintProposal() public {
        vm.startPrank(proposer);
        MintProposal proposal = factory.createMintProposal(
            "Test Mint",
            address(0x2),
            100
        );
        
        assertEq(factory.proposalCount(), 1);
        assertEq(factory.getProposal(0), address(proposal));
        assertEq(proposal.description(), "Test Mint");
        assertEq(proposal.recipient(), address(0x2));
        assertEq(proposal.amount(), 100);
    }
    
    function testFailInvalidProposalIndex() public view {
        factory.getProposal(0);
    }
}
