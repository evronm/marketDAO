// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDAO.sol";
import "../src/ProposalFactory.sol";
import "../src/ProposalTypes.sol";

contract TestHelper is Test {
    function deployFactory(MarketDAO dao) internal returns (ProposalFactory) {
        // Deploy implementation contracts
        ResolutionProposal resolutionImpl = new ResolutionProposal();
        TreasuryProposal treasuryImpl = new TreasuryProposal();
        MintProposal mintImpl = new MintProposal();
        ParameterProposal parameterImpl = new ParameterProposal();
        DistributionProposal distributionImpl = new DistributionProposal();

        // Deploy factory with implementation addresses
        return new ProposalFactory(
            dao,
            address(resolutionImpl),
            address(treasuryImpl),
            address(mintImpl),
            address(parameterImpl),
            address(distributionImpl)
        );
    }
}
