# MarketDAO

MarketDAO is a governance framework that brings market forces to bear on group decisions. The key innovation is a system where voting rights can be freely bought and sold during elections, allowing market forces to influence governance outcomes.

## Core Concept

Unlike traditional DAOs where voting power is static, MarketDAO introduces tradable voting tokens for each election. This creates a dynamic where voters can:
- Buy more voting power if they feel strongly about an issue
- Sell their voting power if others value it more
- Speculate on election outcomes through voting token markets

## Features

- **ERC1155-based governance tokens** for proposal creation and voting rights
- **Saleable voting rights** through transferable voting tokens
- **Lazy token distribution** for gas-efficient voting token claiming
- **Token vesting mechanism** to prevent governance attacks from new token purchases
- **Purchase restrictions** to limit token purchases to existing holders (optional)
- **Join request system** allowing non-holders to request membership via proposals
- **Snapshot-based voting power** for unlimited scalability (no holder count limits)
- **Automatic vesting schedule management** with cleanup and consolidation
- **Proposal lifecycle** with support thresholds and voting periods
- **Multiple proposal types**:
  - Resolution proposals (text-only governance decisions)
  - Treasury transfers (ETH, ERC20, ERC721, ERC1155)
  - Governance token minting (including join requests)
  - Parameter changes (modify any DAO configuration through governance)
  - Distribution proposals (proportional distributions to all token holders)
- **Early election termination** when clear majority is reached (works even after election ends)
- **Configurable parameters** for tailoring governance to specific needs
- **Security-hardened** with factory-based proposal registration and bounded gas costs

## Implementation Details

- The DAO inherits from OpenZeppelin's ERC1155 implementation
- Token ID 0 is reserved for governance tokens
- Each election creates unique voting tokens that can be claimed by governance token holders
- Voting is done by transferring voting tokens to YES/NO addresses
- Treasury functions support multiple asset types (ETH, ERC20, ERC721, ERC1155)

### Lazy Token Distribution

To minimize gas costs when elections are triggered, voting tokens use a "lazy minting" approach:

- **On-demand claiming**: Voting tokens are not automatically distributed when an election starts
- **Gas efficiency**: The proposer who triggers the election doesn't pay gas fees to mint tokens for all holders
- **User-initiated**: Each governance token holder claims their voting tokens when they're ready to participate
- **One-time claim**: Each address can claim once per election, receiving voting tokens equal to their vested governance token balance
- **Flexible participation**: Holders can claim and vote at any point during the election period

### Early Election Termination

To allow proposals with overwhelming support to execute quickly without waiting for the full election period:

- **Automatic termination**: When YES or NO votes reach a strict majority (>50% of total possible votes), the proposal can terminate early
- **Post-election calling**: `checkEarlyTermination()` can be called even after the election period formally ends
- **Multiple attempts**: MarketDAO automatically attempts early termination on each vote transfer
- **Manual fallback**: Anyone can manually call `checkEarlyTermination()` at any time during or after the election
- **Graceful failure**: If automatic early termination fails (e.g., called after election ends), it's silently caught and execution can be triggered later
- **Gas efficiency**: Allows winning proposals to execute immediately without waiting for the full voting period

### Join Request System

Non-token holders can request to join the DAO through a special mint proposal:

1. Non-holder submits a join request (creates a MintProposal for 1 token to themselves)
2. The proposal enters the standard support phase
3. Existing members add support if they approve
4. If support threshold is reached, an election is triggered
5. Members vote on the join request
6. If approved, the new member receives 1 governance token and full DAO access
7. If rejected, they remain a non-holder

### Snapshot-Based Voting Power

To enable unlimited scalability without gas limit concerns:

- **O(1) snapshot creation**: Uses total vested supply instead of looping through all holders
- **Truly unlimited holders**: Tested with 10,000+ holders with constant gas costs
- **Accurate quorum**: Quorum calculated from vested supply only (unvested tokens cannot vote)
- **Fair voting**: Voting power frozen at election start, preventing mid-election manipulation
- **No gas limit concerns**: Election triggering cannot fail due to too many holders

### Parameter Proposals (Governance Configuration)

All DAO configuration parameters can be modified through democratic governance via Parameter Proposals:

- **7 parameter types**:
  - **Support Threshold**: Percentage of vested tokens needed to trigger elections (basis points)
  - **Quorum Percentage**: Participation required for valid elections (basis points, minimum 1%)
  - **Max Proposal Age**: Block limit before proposals expire (must be > 0)
  - **Election Duration**: Voting period length in blocks (must be > 0)
  - **Vesting Period**: Token unlock time in blocks (0 = no vesting)
  - **Token Price**: Cost per governance token in wei (must be > 0)
  - **Flags**: Boolean configuration bitfield (0-7, controls minting/purchasing options)
- **Built-in validation**: Each parameter type has appropriate constraints to prevent invalid configurations
- **Democratic changes**: All parameter changes require the standard proposal lifecycle

### Distribution Proposals (Proportional Distributions)

Distribution Proposals enable fair, proportional distributions of assets (ETH, ERC20, ERC1155) to all token holders:

- **Pro-rata distribution**: Each registered holder receives a proportional share of the distribution pool
- **Registration system**: Token holders must register during the support/election phases
- **Redemption contract**: Approved distributions transfer funds to a separate redemption contract
- **Claimable by holders**: Each registered holder claims their share when ready
- **Asset support**: Works with ETH, ERC20, and ERC1155 tokens

**Important**: The `amountPerGovernanceToken` parameter is a TARGET, not a guarantee. Actual payouts are calculated pro-rata based on total registered shares vs actual pool balance.

## Security & Scalability

MarketDAO has been audited by **Hashlock Pty Ltd** (January 2026). **The audit has been completed and all findings have been addressed.**

### Security Features

- ✅ **Reentrancy protection**: ReentrancyGuard on transfer functions prevents reentrancy during vote transfers
- ✅ **Governance token locking**: Tokens are locked when used for proposal support or voting claims, preventing double-counting (H-03/H-04 fix)
- ✅ **Distribution token locking**: Tokens are locked when registering for distributions, preventing double-claim attacks (H-02 fix)
- ✅ **Operator voting restrictions**: Election-ended checks apply to all transfers, not just direct transfers (H-05 fix)
- ✅ **Pro-rata distributions**: Distribution claims use proportional calculations to prevent pool exhaustion (M-01 fix)
- ✅ **Factory-only proposal registration**: Only the official ProposalFactory can register proposals
- ✅ **Token holder restrictions**: Only addresses with vested governance tokens can create proposals (except join requests)
- ✅ **Safe token transfers**: Uses OpenZeppelin's SafeERC20 for all token operations
- ✅ **Basis points precision**: Thresholds use basis points (10000 = 100%) for 0.01% precision
- ✅ **Bounded gas costs**: All operations have predictable, capped gas costs

### Scalability Guarantees

- ✅ **Unlimited governance token holders**: O(1) snapshot using total supply enables 10,000+ participants
- ✅ **O(1) election triggering**: Constant 280K gas cost regardless of holder count
- ✅ **Automatic vesting cleanup**: Prevents unbounded array growth in vesting schedules
- ✅ **O(1) proposal execution**: Constant-time execution regardless of holder count

### Known Limitations (By Design)

- **M-02 (Stale Vested Supply)**: `getTotalVestedSupply()` may be slightly understated if users don't claim vested tokens. This makes governance slightly easier (not harder) and self-corrects through normal usage.

## Configuration

### Flags Bitfield

The `flags` parameter controls optional features:
- **Bit 0 (value 1)**: Allow minting of new governance tokens
- **Bit 1 (value 2)**: Restrict token purchases to existing holders only
- **Bit 2 (value 4)**: Transfer tokens from DAO treasury on purchase (controlled supply)

Common configurations:
- `0`: No minting, open purchases, tokens minted on purchase
- `1`: Allow minting, open purchases
- `3`: Allow minting, restricted purchases (holder-only)
- `5`: Allow minting, controlled supply (treasury transfers)

## Usage Flow

### For New Members (Join Request):
1. Connect wallet to the DAO interface
2. Submit join request with a description
3. Wait for existing members to add support
4. If threshold met, members vote on admission
5. If approved, receive 1 governance token

### For Token Holders (Standard Proposals):
1. Create a proposal (Resolution, Treasury, Mint, Parameter, or Distribution)
2. Proposals need to reach support threshold to trigger an election
3. When threshold is reached, an election period begins
4. Claim voting tokens (1:1 with vested governance tokens)
5. Cast votes by sending voting tokens to YES/NO addresses
6. Successful proposals are executed automatically

### For Distribution Proposals:
1. Create distribution proposal specifying asset type and amount per token
2. Register during support/election phases to be included
3. If approved, funds transfer to a DistributionRedemption contract
4. Claim your proportional share at any time after execution

## Development

### Build & Test Commands

```bash
# Build the project
forge build

# Run all tests
forge test

# Run a single test
forge test --match-test testFunctionName

# Run tests in a specific file
forge test --match-path test/FileName.t.sol

# Format code
forge fmt

# Deploy locally
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Project Structure

```
marketDAO/
├── src/
│   ├── MarketDAO.sol           # Core DAO contract (ERC1155-based)
│   ├── Proposal.sol            # Abstract proposal base class
│   ├── ProposalTypes.sol       # Concrete proposal implementations
│   ├── ProposalFactory.sol     # Factory for creating proposals
│   └── DistributionRedemption.sol  # Handles distribution claims
├── script/
│   ├── Deploy.s.sol            # Default deployment
│   ├── Deploy.controlled.s.sol # Controlled supply deployment
│   └── Deploy.private.s.sol    # Restricted purchases deployment
├── test/                       # Comprehensive test suite
├── frontend/                   # React frontend application
├── foundry.toml               # Foundry configuration
└── CLAUDE.md                  # Development guide
```

## Future Possibilities

- Resolution enhancements: Expiring resolutions, cancellation proposals
- Multiple choice proposals beyond binary YES/NO
- Delegation mechanisms for voting power
- Staking mechanisms for proposal prioritization
- Quadratic voting options
- Time-weighted voting power
- Proposal templates and batch operations

## License

MIT
