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

### Parameter Proposals (Governance Configuration)

All DAO configuration parameters can be modified through democratic governance via Parameter Proposals:

- **Flexible governance**: Any configuration parameter set at deployment can be changed through voting
- **7 parameter types**:
  - **Support Threshold**: Percentage of vested tokens needed to trigger elections (basis points)
  - **Quorum Percentage**: Participation required for valid elections (basis points, minimum 1%)
  - **Max Proposal Age**: Block limit before proposals expire (must be > 0)
  - **Election Duration**: Voting period length in blocks (must be > 0)
  - **Vesting Period**: Token unlock time in blocks (0 = no vesting)
  - **Token Price**: Cost per governance token in wei (must be > 0)
  - **Flags**: Boolean configuration bitfield (0-7, controls minting/purchasing options)
- **Built-in validation**: Each parameter type has appropriate constraints to prevent invalid configurations
- **Democratic changes**: All parameter changes require the standard proposal lifecycle (support → election → execution)
- **No special privileges**: Parameter changes use the same voting thresholds as other proposals

**Example Use Cases:**
- Lower support threshold to make it easier to trigger elections
- Increase quorum to require broader participation for important decisions
- Adjust token price based on market conditions or treasury needs
- Modify vesting period to balance security with accessibility
- Change election duration to allow more time for deliberation

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

### Purchase Restrictions (Optional)

To prevent governance attacks where outsiders buy enough tokens to control the DAO, the purchase restriction feature can be enabled at deployment:

- **Open mode (default)**: Anyone can purchase governance tokens directly
- **Restricted mode**: Only existing token holders can purchase additional tokens
- **Voting in new members**: When restricted, new members must be approved via mint proposals
- **Attack prevention**: Prevents hostile takeovers by requiring community approval for all new members
- **Configuration option**: Set `RESTRICT_PURCHASES = true` in the deployment script

**Use Cases:**
- **Investment clubs**: Members vote on admitting new partners
- **Private DAOs**: Closed membership with proposal-based expansion
- **Security-focused**: Extra protection against governance attacks

**Note**: Restriction check is based on current token balance (> 0), not historical holder status. If a holder transfers all tokens, they lose purchase privileges until they receive tokens again.

### Join Request System

To enable controlled membership growth while maintaining accessibility, non-token holders can request to join the DAO:

- **Open to all**: Anyone without governance tokens can submit a join request
- **Proposal-based**: Join requests are mint proposals for exactly 1 governance token to the requester's address
- **Community voting**: Existing token holders vote on whether to admit new members
- **Self-introduction**: Requesters provide a description explaining who they are and why they want to join
- **One request per address**: Non-holders can only submit one join request (tracked via frontend localStorage)
- **Standard proposal flow**: Join requests follow the normal proposal lifecycle (support → election → execution)
- **Automatic restrictions**: Non-holders cannot create any other proposal types (resolution, treasury, token price)

**How It Works:**
1. Non-holder connects wallet and is presented with a "Request to Join DAO" interface
2. They submit a description introducing themselves
3. The system creates a mint proposal for 1 token to their address
4. Existing members see the request in the Proposals tab and can add support
5. Once support threshold is met, an election begins
6. Members vote YES or NO on admitting the new member
7. If approved, the new member receives 1 governance token and full DAO access
8. If rejected, they remain a non-holder but cannot submit another request

**Benefits:**
- **Controlled growth**: Community decides who joins
- **Prevents spam**: One request per address limits abuse
- **Transparency**: All join decisions are on-chain and voted on
- **Flexibility**: Works with both open and restricted purchase modes

**Note**: Token holders can still create mint proposals for any amount to any address. The 1-token restriction only applies to non-holders creating proposals for themselves.

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
- ✅ **Token holder restrictions**: Only addresses with vested governance tokens can create proposals (except join requests)
- ✅ **Join request validation**: Non-holders can only create mint proposals for exactly 1 token to their own address
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
- ✅ **Join request spam prevention**: Non-holders limited to one join request per address (frontend enforced)

## Known Limitations & Design Decisions

These are intentional design choices that should be understood before deployment:

### Immutable vs. Changeable Parameters

**Immutable (Set at Deployment)**:
- **DAO Name**: Cannot be changed after deployment
- **Treasury Configuration**: Which asset types (ETH, ERC20, ERC721, ERC1155) the DAO accepts
- **Purchase Restrictions**: Whether token purchases are limited to existing holders

**Changeable via Parameter Proposals**:
- Support Threshold
- Quorum Percentage
- Max Proposal Age
- Election Duration
- Vesting Period
- Token Price
- Flags (Allow Minting, Restrict Purchases, Mint to Purchase)

**Rationale**: Immutable parameters ensure trust and predictability. Members joining a DAO know that fundamental characteristics (name, treasury capabilities, core access controls) cannot be changed without redeploying. All governance-related parameters can be modified democratically as the DAO evolves.

**Consideration for Purchase Restrictions**: Choose carefully based on your DAO's purpose:
- **Open**: Best for community DAOs, protocol governance, broad participation
- **Restricted**: Best for investment clubs, private organizations, security-focused DAOs

Note: While the "Restrict Purchases" flag can technically be modified via Parameter Proposal, it affects the fundamental nature of DAO membership and should only be changed with broad consensus.

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

### Fund Locking Gas Costs

**Behavior**: Functions that calculate available treasury balances (`getAvailableETH`, `getAvailableERC20`, etc.) iterate through all proposals with locked funds. Gas costs scale linearly with the number of concurrent treasury proposals in their election phase.

**Impact**: With many concurrent treasury proposals (50+), creating new treasury proposals or triggering elections could become expensive or potentially hit gas limits.

**Likelihood**: Low - Most DAOs will have fewer than 10 concurrent treasury elections at any time since elections are typically short (50 blocks).

**Mitigation**: If your DAO expects high concurrent treasury activity, consider shorter election durations or implementing a proposal limit.

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

# Start local Anvil node
anvil

# Deploy locally (in another terminal)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Frontend Development

The project includes a React/TypeScript frontend for interacting with the DAO:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Update contract addresses in src/contexts/DAOContext.tsx with deployed addresses

# Start development server
npm run dev

# Build for production
npm run build
```

The frontend provides a complete interface for:
- Connecting wallet and viewing DAO information
- Purchasing governance tokens
- Creating proposals (Resolution, Treasury, Mint, Parameter)
- Supporting proposals and triggering elections
- Claiming voting tokens and casting votes
- Viewing proposal history and results
- Seeing all DAO members and their token balances

**Parameter Proposal UI Features:**
- Dropdown selection for all 7 parameter types
- Contextual input fields with appropriate units (ETH, %, blocks, bitfield)
- Automatic value conversion (percentages → basis points, ETH → wei)
- Inline hints and validation for each parameter type
- Clear display of current vs. proposed values

## Configuration Parameters

When creating a new DAO, you can configure:
- **Name** of the DAO (permanent, cannot be changed)
- **Support threshold** (in basis points, e.g., 2000 = 20% of tokens needed to trigger an election) *[changeable via Parameter Proposal]*
- **Quorum percentage** (in basis points, e.g., 5100 = 51% of tokens needed for valid election) *[changeable via Parameter Proposal]*
- **Maximum proposal age** before expiration (in blocks) *[changeable via Parameter Proposal]*
- **Election duration** (in blocks) *[changeable via Parameter Proposal]*
- **Flags** (bitfield for boolean options) *[changeable via Parameter Proposal]*:
  - **Allow minting** (bit 0): Whether new governance tokens can be minted via proposals
  - **Restrict purchases** (bit 1): Whether token purchases are limited to existing holders
  - **Mint to purchase** (bit 2): Whether purchases transfer from DAO treasury or mint new tokens
- **Initial token price** (in wei, 0 = direct sales disabled) *[changeable via Parameter Proposal]*
- **Vesting period** (in blocks, 0 = no vesting) *[changeable via Parameter Proposal]*
- **Treasury configuration** (ETH, ERC20, ERC721, ERC1155) (permanent, cannot be changed)
- **Initial token distribution** (addresses and amounts)

**Note on Basis Points**: All percentage parameters use basis points for precision:
- 10000 = 100%
- 5100 = 51%
- 2000 = 20%
- 250 = 2.5%

This allows for fractional percentages with 0.01% precision.

**Configuring Flags**: The deployment script (`script/Deploy.s.sol`) provides boolean configuration options that are automatically converted to the flags bitfield:
```solidity
bool constant ALLOW_MINTING = true;            // Enable governance token minting
bool constant RESTRICT_PURCHASES = false;      // Allow anyone to purchase tokens
```

The `buildFlags()` function handles the conversion automatically.

## Usage Flow

### For New Members (Join Request):
1. **Connect Wallet**: Non-holder connects their wallet to the DAO interface
2. **Submit Join Request**: Provide a description introducing yourself and why you want to join
3. **Wait for Support**: Existing members review your request and add support
4. **Election**: Once support threshold is met, members vote on your admission
5. **Admission**: If approved, you receive 1 governance token and full DAO access

### For Token Holders (Standard Proposals):
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
- Delegation mechanisms for voting power
- Staking mechanisms for proposal prioritization
- Quadratic voting options
- Time-weighted voting power
- Proposal templates and batch operations

## License

MIT
