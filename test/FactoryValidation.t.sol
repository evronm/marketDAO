// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";

contract FactoryValidationTest is Test {
    MarketDAO dao;
    address deployer = address(this);
    address user1 = address(0x1);

    function setUp() public {
        address[] memory initialHolders = new address[](1);
        initialHolders[0] = user1;

        uint256[] memory initialAmounts = new uint256[](1);
        initialAmounts[0] = 100;

        string[] memory treasuryConfig = new string[](0);

        dao = new MarketDAO(
            "Test DAO",
            2000,
            5100,
            100,
            50,
            0, // flags (allowMinting=False)
            0,
            0,
            treasuryConfig,
            initialHolders,
            initialAmounts
        );
    }

    function testCannotSetEOAAsFactory() public {
        address eoaAddress = address(0x1234);

        vm.expectRevert("Factory must be a contract");
        dao.setFactory(eoaAddress);
    }

    function testCannotSetZeroAddressAsFactory() public {
        vm.expectRevert("Invalid factory address");
        dao.setFactory(address(0));
    }

    function testCanSetValidContractAsFactory() public {
        // Deploy a real factory
        ProposalFactory factory = new ProposalFactory(dao);

        // Should succeed - it's a contract
        dao.setFactory(address(factory));

        // Verify it was set
        assertEq(dao.factory(), address(factory), "Factory should be set");
    }

    function testCannotSetFactoryTwice() public {
        // Deploy and set factory
        ProposalFactory factory = new ProposalFactory(dao);
        dao.setFactory(address(factory));

        // Try to set again
        ProposalFactory factory2 = new ProposalFactory(dao);
        vm.expectRevert("Factory already set");
        dao.setFactory(address(factory2));
    }

    function testOnlyDeployerCanSetFactory() public {
        ProposalFactory factory = new ProposalFactory(dao);

        // Try to set factory as non-deployer
        vm.prank(user1);
        vm.expectRevert("Only deployer can set factory");
        dao.setFactory(address(factory));

        // Deployer should be able to set it
        dao.setFactory(address(factory));
        assertEq(dao.factory(), address(factory), "Factory should be set by deployer");
    }

    function testFactoryMustBeContractNotDeployedContract() public {
        // This tests that even a contract address that hasn't been deployed yet fails
        // Note: In Solidity, we can't really test this perfectly because CREATE2
        // addresses might have code at them. But we can test that a random address fails.

        address randomAddress = address(uint160(uint256(keccak256("random"))));

        vm.expectRevert("Factory must be a contract");
        dao.setFactory(randomAddress);
    }
}
