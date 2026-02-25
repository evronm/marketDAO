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
- **Lock-based voting power** for unlimited scalability (no holder count limits)
- **Automatic vesting schedule management** with cleanup and consolidation
- **Proposal lifecycle** with support thresholds and voting periods
- **Two proposal types** for maximum flexibility:
  - **GenericProposal**: Execute arbitrary calls to any contract
    - Resolution proposals (empty calldata = symbolic vote)
    - Treasury transfers (ETH, ERC20, ERC721, ERC1155)
    - Governance token minting (including join requests)
    - Parameter changes (modify any DAO configuration)
    - External protocol interactions (DeFi, other DAOs, smart contracts)
  - **DistributionProposal**: Proportional asset distribution to token holders
- **Majority-based execution** when strict majority (>50%) is reached and quorum is met
- **Configurable parameters** for tailoring governance to specific needs
- **Security-hardened** with factory-based proposal registration and bounded gas costs

## Implementation Details

- The DAO inherits from OpenZeppelin's ERC1155 implementation
- Token ID 0 is reserved for governance tokens
- Each election creates unique voting tokens that can be claimed by governance token holders
- Voting is done by transferring voting tokens to YES/NO addresses
- Treasury accepts all asset types (ETH, ERC20, ERC721, ERC1155)

### Architecture

MarketDAO uses a flexible proposal execution model:

- **GenericProposal** handles standard operations via arbitrary call execution
- **No target restrictions** - proposals can interact with any blockchain contract
- **Automatic fund detection** - treasury operations automatically trigger fund locking
- **Frontend builds calldata** - UI constructs the appropriate encoded function calls
- **Security through voting** - community approval is the safeguard for all operations

### Lazy Token Distribution

To minimize gas costs when elections are triggered, voting tokens use a "lazy minting" approach:

- **On-demand claiming**: Voting tokens are not automatically distributed when an election starts
- **Gas efficiency**: The proposer who triggers the election doesn't pay gas fees to mint tokens for all holders
- **User-initiated**: Each governance token holder claims their voting tokens when they're ready to participate
- **One-time claim**: Each address can claim once per election, receiving voting tokens equal to their vested governance token balance
- **Flexible participation**: Holders can claim and vote at any point during the election period

### Majority-Based Execution

To allow proposals with overwhelming support to execute immediately:

- **Dual requirements**: Requires BOTH strict majority (>50% of total possible votes) AND quorum to be met
- **Strict majority threshold**: When YES or NO votes reach >50% of total possible votes, proposal can execute if quorum is also met
- **Works during or after election**: Can be called anytime after the election starts, even after the voting period ends
- **Automatic attempts**: MarketDAO automatically attempts majority-based execution after each vote transfer
- **Manual fallback**: Anyone can manually call `checkEarlyTermination()` at any time
- **Graceful failure**: Automatic attempts are wrapped in try/catch, so they never block vote transfers
- **Gas efficiency**: Winning proposals can execute immediately when both majority and quorum are reached, without waiting for the full voting period

### Join Request System

Non-token holders can request to join the DAO through a special mint proposal:

1. Non-holder submits a join request (creates a GenericProposal to mint 1 token to themselves)
2. The proposal enters the standard support phase
3. Existing members add support if they approve
4. If support threshold is reached, an election is triggered
5. Members vote on the join request
6. If approved, the new member receives 1 governance token and full DAO access
7. If rejected, they remain a non-holder

**Example**: `factory.createProposal("Join request", address(dao), 0, abi.encodeWithSelector(dao.mintGovernanceTokens.selector, requester, 1))`

### Lock-Based Voting Power

To enable unlimited scalability without gas limit concerns, MarketDAO uses a lock-based system instead of traditional snapshots:

- **O(1) election triggering**: Records only total vested supply (not individual balances), enabling constant-time election starts
- **Truly unlimited holders**: Tested with 10,000+ holders with constant gas costs (~280K regardless of holder count)
- **Governance token locking**: Tokens are locked when used for support or voting, preventing double-counting
- **On-demand voting power calculation**: Each user's voting power is calculated when they claim voting tokens (not stored for all holders)
- **Accurate quorum**: Quorum calculated from vested supply only (unvested tokens cannot vote)
- **Fair voting**: Voting power determined at election start, preventing mid-election manipulation through new purchases

This lock-based approach is more scalable than traditional snapshot mechanisms because it doesn't require iterating through or storing individual holder balances.

### GenericProposal

GenericProposal is the core execution primitive that enables flexible contract interactions:

- **Single call execution**: Each proposal executes one call with `target`, `value`, and `data`
- **No target restrictions**: Can call any contract on the blockchain (DAO functions, DeFi protocols, other DAOs)
- **Automatic fund locking**: Detects DAO treasury operations and reserves funds at election trigger
- **Security model**: Community voting is the safeguard - malicious proposals must convince majority

**Common use cases**:
- **Resolution**: `createProposal("Description", address(dao), 0, "")` - Symbolic vote with empty calldata
- **ETH Transfer**: `createProposal("Send ETH", address(dao), 0, abi.encodeWithSelector(dao.transferETH.selector, recipient, amount))`
- **Mint Tokens**: `createProposal("Mint tokens", address(dao), 0, abi.encodeWithSelector(dao.mintGovernanceTokens.selector, recipient, amount))`
- **Change Parameters**: `createProposal("Change quorum", address(dao), 0, abi.encodeWithSelector(dao.setQuorumPercentage.selector, 6000))`
- **External Protocol**: `createProposal("Vote in Uniswap", uniswapGovernor, 0, abi.encodeWithSelector(governor.castVote.selector, proposalId, true))`

**Parameter changes** through GenericProposal support:
- **Support Threshold**: `dao.setSupportThreshold(newValue)` - basis points, must be > 0 and <= 10000
- **Quorum Percentage**: `dao.setQuorumPercentage(newValue)` - basis points, must be >= 100 and <= 10000
- **Max Proposal Age**: `dao.setMaxProposalAge(newValue)` - blocks, must be > 0
- **Election Duration**: `dao.setElectionDuration(newValue)` - blocks, must be > 0
- **Vesting Period**: `dao.setVestingPeriod(newValue)` - blocks, no restrictions
- **Token Price**: `dao.setTokenPrice(newValue)` - wei, must be > 0
- **Flags**: `dao.setFlags(newValue)` - bitfield, must be 0-7

All parameter changes validate at execution time and require the standard proposal lifecycle.

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

- ✅ **Unlimited governance token holders**: Lock-based system tested with 10,000+ participants
- ✅ **O(1) election triggering**: Constant 280K gas cost regardless of holder count
- ✅ **Automatic vesting cleanup**: Prevents unbounded array growth in vesting schedules
- ✅ **O(1) proposal execution**: Constant-time execution regardless of holder count
- ✅ **No snapshot storage**: Doesn't need to store individual holder balances

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

### Block-Based Durations

`maxProposalAge`, `electionDuration`, and `vestingPeriod` are all measured in **block numbers**, not wall-clock time. Block times vary significantly across EVM chains (Ethereum ~12s, some L2s sub-second or variable). Deployers must choose values appropriate for their target chain. For example, an `electionDuration` of 50 blocks is ~10 minutes on Ethereum mainnet but could be under a second on a fast L2.

## Usage Flow

All operations can be performed through the **web interface** (see Frontend section above) or via direct contract interaction.

### For New Members (Join Request):
1. **Connect wallet** to the DAO interface (web UI or MetaMask)
2. **Submit join request** with a description (web UI handles calldata generation)
3. Wait for existing members to add support
4. If threshold met, members vote on admission
5. If approved, receive 1 governance token

### For Token Holders (Standard Proposals):
1. **Create a proposal** via web UI or `factory.createProposal(description, target, value, data)`:
   - **Resolution**: Empty calldata for symbolic votes
   - **Treasury transfers**: Send ETH, ERC20, ERC721, or ERC1155 assets
   - **Mint tokens**: Add new members or increase holdings
   - **Change parameters**: Modify quorum, thresholds, durations, etc.
   - **External calls**: Interact with DeFi protocols, other DAOs, etc.
2. Proposals need to reach **support threshold** to trigger an election
3. When threshold is reached, an **election period** begins
4. **Claim voting tokens** (1:1 with vested governance tokens)
5. **Cast votes** by transferring voting tokens to YES/NO addresses
6. Successful proposals **execute automatically** when majority reached

### For Distribution Proposals:
1. Create distribution proposal specifying asset type and target amount per token
2. Members **register** during support/election phases to be included
3. If approved, funds transfer to a **DistributionRedemption** contract
4. Registered members **claim their proportional share** at any time after execution

### Web Interface Workflow:
- **Dashboard**: View stats, buy/claim tokens
- **Proposals**: Create proposals using intuitive forms (no calldata knowledge required)
- **Support**: Click "Add Support" on proposals you want to see go to election
- **Elections**: Claim voting tokens and vote with one click
- **History**: Review all past proposal outcomes
- **Members**: See all token holders and their balances

## Frontend

A complete web interface for MarketDAO is included, built with **VanJS** - a lightweight 1KB reactive UI framework requiring no build tools.

### Frontend Features

- **Wallet Integration**: Connect via MetaMask with automatic network detection
- **Dashboard**: View DAO info, token balances, purchase/claim tokens
- **Proposals**: Create, view, and support proposals (all types)
- **Elections**: View active elections, claim voting tokens, cast votes
- **History**: Browse all completed proposals and their outcomes
- **Members**: View all DAO members and their token holdings
- **Real-time Updates**: Reactive UI updates when blockchain state changes
- **Error Handling**: User-friendly error messages with transaction failure details

### Frontend Tech Stack

- **VanJS** (1KB reactive UI library, no build step)
- **Ethers.js v6** (Web3 interactions)
- **Bootstrap 5** (Styling)
- **No bundler required** - runs directly via CDN imports

### Quick Start (Frontend)

1. **Start a local web server** in the `frontend/` directory:
   ```bash
   cd frontend
   python -m http.server 8080
   # OR: npx serve . -p 8080
   ```

2. **Deploy contracts** to a local blockchain:
   ```bash
   # In project root
   anvil  # Start local blockchain in one terminal

   # In another terminal
   forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
   ```

3. **Configure frontend** - Edit `frontend/js/config.js`:
   ```javascript
   const CONFIG = {
     network: {
       chainId: 31337,  // Anvil default
       name: 'Localhost',
       rpcUrl: 'http://localhost:8545'
     },
     contracts: {
       dao: '0x5fbdb2315678afecb367f032d93f642f64180aa3',  // Update from deploy
       factory: '0x0165878a594ca255338adfa4d48449f69242eb8f'  // Update from deploy
     }
   }
   ```

4. **Open browser** to http://localhost:8080 and connect MetaMask

See `frontend/README.md` for detailed frontend documentation.

## Development

### Build & Test Commands

```bash
# Build the contracts
forge build

# Run all tests
forge test

# Run a single test
forge test --match-test testFunctionName

# Run tests in a specific file
forge test --match-path test/FileName.t.sol

# Format code
forge fmt

# Deploy to local blockchain
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy with controlled supply (flag bit 2)
forge script script/Deploy.controlled.s.sol --rpc-url http://localhost:8545 --broadcast

# Deploy with restricted purchases (flag bit 1)
forge script script/Deploy.private.s.sol --rpc-url http://localhost:8545 --broadcast
```

## Future Possibilities

The GenericProposal architecture enables unlimited extensibility through external contracts:

- **DeFi Integration**: Participate in Uniswap governance, manage Aave positions, stake in protocols
- **Cross-DAO Collaboration**: Vote in other DAOs, delegate voting power externally
- **Advanced Execution**: Multi-call proposals via custom executor contracts
- **NFT Management**: Bulk NFT operations, marketplace interactions, collection management
- **Custom Governance**: Quadratic voting, delegation, time-weighted power via external modules
- **Proposal Templates**: Frontend-provided templates for common operations
- **Batch Operations**: Execute multiple related actions through external batch executor

The architecture is designed to support any future governance innovation without protocol changes.

## License

MIT
