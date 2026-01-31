# MarketDAO Development Guide

## Project Overview

MarketDAO is a governance framework where voting rights can be bought and sold during elections. Built on ERC1155, it creates tradeable voting tokens for each proposal election.

**Status**: Audited by Hashlock (January 2026). All findings addressed. Currently on `main` branch.

## Architecture

```
src/
├── MarketDAO.sol           # Core DAO - ERC1155, treasury, token management
├── Proposal.sol            # Abstract base class for all proposals
├── ProposalTypes.sol       # Concrete implementations (Resolution, Treasury, Mint, Parameter, Distribution)
├── ProposalFactory.sol     # Creates proposal clones, access control
└── DistributionRedemption.sol  # Handles pro-rata distribution claims
```

### Key Concepts

- **Token ID 0**: Governance tokens (permanent membership)
- **Token ID 1+**: Voting tokens (created per-election, transferable)
- **Lazy minting**: Voting tokens claimed on-demand, not minted upfront
- **Vesting**: Purchased tokens lock for configurable period
- **Fund locking**: Treasury proposals lock funds at election trigger, release on completion

### Proposal Lifecycle

1. Creation → 2. Support phase (accumulate backing) → 3. Election trigger (threshold met) → 4. Voting period → 5. Execution or failure

## Build & Test Commands

```bash
forge build              # Compile
forge test               # Run all tests
forge test -vvv          # Verbose output
forge test --match-test testFunctionName    # Single test
forge test --match-path test/FileName.t.sol # Single file
forge fmt                # Format code
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast  # Deploy
```

## Code Style

- **Solidity**: `pragma solidity ^0.8.20`
- **Imports**: OpenZeppelin first, then internal
- **Naming**: Contracts=PascalCase, functions/variables=camelCase, constants=UPPER_CASE
- **Errors**: Custom error types preferred over revert strings (newer code)
- **Function order**: external → public → internal → private
- **Comments**: NatSpec for public interfaces
- **Security**: CEI pattern (Checks-Effects-Interactions), ReentrancyGuard on transfers

## Security Notes

The codebase has several audit fixes marked with comments:
- `H-02 FIX`: Distribution lock prevents double-claim via token transfer
- `H-03/H-04 FIX`: Governance locks prevent support/voting power inflation  
- `H-05 FIX`: Operator voting blocked after election ends
- `M-01 FIX`: Pro-rata distribution prevents pool exhaustion

When modifying locked token logic, preserve these invariants.

## Frontend

Located in `frontend/`. React application. The refactor will require significant frontend changes to build calldata for proposal types.

---

# CURRENT TASK: Simplify Branch Refactor

## Goal

Collapse specialized proposal types into a unified arbitrary execution model. Backend becomes generic; frontend builds calldata.

## Approach

### Phase 1: Backend (this branch)

**New execution model:**
```solidity
// In MarketDAO.sol - add:
function executeCall(address target, uint256 value, bytes calldata data) external returns (bytes memory);

// Single Proposal type handles:
// - targets[] array
// - values[] array  
// - calldatas[] array
// Executes each call in sequence
```

**Keep separate:**
- `DistributionProposal` - has unique lifecycle (redemption contract deployment, registration)

**Remove/collapse:**
- `ResolutionProposal` → empty calldata array
- `TreasuryProposal` → calldata for `transferETH()`, `transferERC20()`, etc.
- `MintProposal` → calldata for `mintGovernanceTokens()`
- `ParameterProposal` → calldata for `setTokenPrice()`, `setSupportThreshold()`, etc.

### Phase 2: Frontend (separate effort)

- Proposal creation wizard builds appropriate calldata
- Templates for common operations
- "Advanced" mode for raw calldata
- Decode calldata for display (like Tally does)

## Files to Modify

1. **MarketDAO.sol**: Add `executeCall()` function
2. **Proposal.sol**: Add `targets[]`, `values[]`, `calldatas[]` storage and execution logic
3. **ProposalTypes.sol**: Gut specialized types or remove entirely
4. **ProposalFactory.sol**: Simplify to single `createProposal()` function (keep distribution separate)
5. **Tests**: Rewrite for new structure

## Testing Strategy

After refactoring:
```bash
forge test  # Everything should still pass conceptually
```

Key behaviors to preserve:
- Support threshold triggers election
- Voting token lazy minting
- Early termination on majority
- Fund locking for treasury operations
- Governance/distribution token locking
- Vesting enforcement

## Questions for Implementation

1. Should `executeCall` be single-target or batch? (Recommend: single, loop in Proposal)
2. Keep fund locking logic? (Yes - move validation to `executeCall` or keep in Proposal)
3. ERC1155 receiver hooks still needed? (Yes - for receiving tokens/NFTs to treasury)
