// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/GenericProposal.sol";
import "../src/ProposalTypes.sol";

contract TestHelper is Test {
    function deployFactory(MarketDAO dao) internal returns (ProposalFactory) {
        // Deploy implementation contracts
        GenericProposal genericImpl = new GenericProposal();
        DistributionProposal distributionImpl = new DistributionProposal();

        // Deploy factory with implementation addresses
        return new ProposalFactory(
            dao,
            address(genericImpl),
            address(distributionImpl)
        );
    }
}
