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
- **Snapshot-based voting power** for unlimited scalability (no holder count limits)
- **Automatic vesting schedule management** with cleanup and consolidation
- **Proposal lifecycle** with support thresholds and voting periods
- **Multiple proposal types**:
  - Resolution proposals (text-only governance decisions)
  - Treasury transfers (ETH, ERC20, ERC721, ERC1155)
  - Governance token minting
  - Token price updates
- **Early election termination** when clear majority is reached
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

### Token Vesting System

To prevent governance attacks where an actor purchases enough tokens to immediately control the DAO, purchased tokens are subject to a vesting period:

- **Vested tokens**: Available for governance (creating/supporting proposals, receiving voting tokens)
- **Unvested tokens**: Locked for governance and not transferable (prevents circumventing vesting)
- **Automatic cleanup**: Expired vesting schedules are automatically removed when transferring governance tokens
- **Accurate accounting**: Automatic cleanup maintains accurate `totalUnvestedGovernanceTokens` counter for quorum calculations
- **Schedule consolidation**: Multiple purchases with the same unlock time are automatically merged
- **Schedule limit**: Maximum 10 active vesting schedules per address (prevents DoS attacks)
- **Manual cleanup**: Users can call `cleanupMyVestingSchedules()` to remove expired schedules anytime
- **Frontend display**: Dashboard shows total, vested, and unvested balances separately

Initial token holders (from constructor) are not subject to vesting restrictions.

### Snapshot-Based Voting Power

To enable unlimited scalability without gas limit concerns:

- **O(1) snapshot creation**: Uses total vested supply instead of looping through all holders
- **Truly unlimited holders**: Tested with 10,000+ holders with constant gas costs
- **Accurate quorum**: Quorum calculated from vested supply only (unvested tokens cannot vote)
- **Fair voting**: Voting power frozen at election start, preventing mid-election manipulation
- **No gas limit concerns**: Election triggering cannot fail due to too many holders

## Security & Scalability

MarketDAO has been audited and hardened against common vulnerabilities:

### Security Features
- ✅ **Reentrancy protection**: Transfer functions (`safeTransferFrom`, `safeBatchTransferFrom`) use ReentrancyGuard to prevent reentrancy during vote transfers and early termination
- ✅ **Factory-only proposal registration**: Only the official ProposalFactory can register proposals
- ✅ **Safe token transfers**: Uses OpenZeppelin's SafeERC20 and safeTransferFrom for all token operations
- ✅ **Basis points precision**: Thresholds use basis points (10000 = 100%) for 0.01% precision
- ✅ **Bounded gas costs**: All operations have predictable, capped gas costs

### Scalability Guarantees
- ✅ **Unlimited governance token holders**: O(1) snapshot using total supply enables 10,000+ participants
- ✅ **O(1) election triggering**: Constant 280K gas cost regardless of holder count
- ✅ **Automatic vesting cleanup**: Prevents unbounded array growth in vesting schedules
- ✅ **O(1) proposal execution**: Constant-time execution regardless of holder count
- ✅ **No gas limit concerns**: Election triggering cannot fail due to blockchain gas limits

### DoS Protection
- ✅ **No holder count limits**: O(1) snapshot prevents DoS from too many token holders
- ✅ **Vesting schedule limits**: Max 10 active schedules per address with auto-cleanup
- ✅ **Consolidation**: Automatic merging of schedules with same unlock time
- ✅ **Gas-bounded operations**: Election triggering uses constant gas regardless of holder count

## Known Limitations & Design Decisions

These are intentional design choices that should be understood before deployment:

### Treasury Proposal Competition

**Behavior**: Multiple treasury proposals can be created requesting the same funds. Funds are only locked when a proposal reaches the support threshold and triggers an election. If proposal A locks the funds first, proposal B will fail when trying to start its election.

**Rationale**: Locking funds at proposal creation would enable trivial DoS attacks (spam proposals locking all treasury). Current design ensures only proposals with real community support (20%+ backing) can lock funds.

**Mitigation**: Community should coordinate on competing proposals. Frontend should display when multiple proposals request overlapping funds.

### Support Tracking After Token Transfers

**Behavior**: Support amounts are recorded when added but not automatically adjusted if users transfer their governance tokens afterward. Support only triggers elections - it does not affect voting outcomes.

**Why Not Critical**: Even if support is artificially inflated, winning an election still requires:
- 51% quorum participation from real token holders
- Majority YES votes based on actual token holdings at election start
- Attack cost (gas + token ownership) exceeds any benefit

**Mitigation**: Monitor for unusual support patterns. Set appropriate support thresholds to make attacks expensive.

## Installation & Development

```bash
# Clone the repository
git clone https://github.com/evronm/marketDAO
cd marketDAO

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Format code
forge fmt

# Deploy locally
./deploy.sh
```

## Configuration Parameters

When creating a new DAO, you can configure:
- **Name** of the DAO
- **Support threshold** (in basis points, e.g., 2000 = 20% of tokens needed to trigger an election)
- **Quorum percentage** (in basis points, e.g., 5100 = 51% of tokens needed for valid election)
- **Maximum proposal age** before expiration (in blocks)
- **Election duration** (in blocks)
- **Treasury configuration** (ETH, ERC20, ERC721, ERC1155)
- **Governance token minting** permissions (true/false)
- **Initial token price** (in wei, 0 = direct sales disabled)
- **Vesting period** (in blocks, 0 = no vesting)
- **Initial token distribution** (addresses and amounts)

**Note on Basis Points**: All percentage parameters use basis points for precision:
- 10000 = 100%
- 5100 = 51%
- 2000 = 20%
- 250 = 2.5%

This allows for fractional percentages with 0.01% precision.

## Current Deployment

- **Frontend**: [https://evronm.github.io/marketDAO/index.html](https://evronm.github.io/marketDAO/index.html)
- **DAO Contract**: 0xf188d689d78b58b9d3e1a841a9b9afb8f92ddf55 (Polygon Amoy testnet)
- **Factory Contract**: 0xc609fa60239116ecee53af12f733eb0214d7b1ad (Polygon Amoy testnet)

## Usage Flow

1. **Create a Proposal**: Governance token holders can submit proposals
2. **Support Phase**: Proposals need to reach support threshold to trigger an election
3. **Election Triggered**: When the threshold is reached, an election period begins
4. **Claim Voting Tokens**: Governance token holders claim their voting tokens (1:1 with vested governance tokens)
5. **Trading Period**: During elections, voting tokens can be freely bought and sold
6. **Voting**: Cast votes by sending voting tokens to YES/NO addresses
7. **Execution**: Successful proposals are executed automatically

## Future Possibilities

- Resolution enhancements: Expiring resolutions, cancellation proposals
- Multiple choice proposals beyond binary YES/NO
- Variable election lengths
- Staking mechanisms for proposals

## License

MIT