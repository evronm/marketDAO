# SwapEscrow

A minimal, gas-optimized escrow system for trustless atomic swaps on Ethereum. Built with Solidity ^0.8.20 and Foundry.

## Features

- ✅ **Multi-Token Support** - Native ETH, ERC20, ERC721, and ERC1155 tokens
- ✅ **Automatic Detection** - Just transfer tokens/ETH to the contract
- ✅ **Time-Locked Swaps** - First deposit starts timer, expiry returns assets
- ✅ **Multiple Assets** - Lock multiple NFTs/tokens in a single escrow
- ✅ **DAO Compatible** - Works with simple send/receive operations
- ✅ **Gas Optimized** - EIP-1167 minimal proxy pattern (~90% gas savings)
- ✅ **Reentrancy Protected** - OpenZeppelin ReentrancyGuard + CEI pattern
- ✅ **Fully Tested** - Comprehensive test coverage

## How It Works

1. **Deploy** - Use `EscrowFactory` to create a new escrow with payment parameters
2. **Deposit** - Seller transfers assets to the escrow (NFTs/tokens)
3. **Pay** - Buyer transfers payment to the escrow
4. **Swap** - Assets automatically exchanged when payment matches parameters
5. **Expiry** - If no payment, assets return to seller after time lock

## Quick Start

### Installation

```bash
forge install
```

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Deploy

```solidity
// Deploy the factory
EscrowFactory factory = new EscrowFactory();

// AssetType enum: NATIVE = 0, ERC20 = 1, ERC721 = 2, ERC1155 = 3

// Create an escrow: 1 day duration, expecting 100 USDC
address escrowAddr = factory.createEscrow(
    1 days,                     // Duration (must be > 0)
    Escrow.AssetType.ERC20,     // Payment type (1)
    address(usdcToken),         // Payment token (non-zero for ERC20)
    0,                          // Token ID (for ERC721/1155)
    100 * 10**6                 // Payment amount (must be > 0)
);
```

## Usage Examples

### Example 1: NFT for ERC20

```solidity
// Seller deposits NFT
nft.safeTransferFrom(seller, escrowAddr, tokenId);

// Buyer pays with ERC20 (requires approval first)
usdc.approve(escrowAddr, 100 * 10**6);
escrow.depositERC20(address(usdc), 100 * 10**6);

// Swap complete! Buyer receives NFT, seller receives USDC
```

### Example 2: Multiple NFTs for ERC20

```solidity
// Seller deposits multiple NFTs (same seller only)
nft.safeTransferFrom(seller, escrowAddr, tokenId1);
nft.safeTransferFrom(seller, escrowAddr, tokenId2);
nft.safeTransferFrom(seller, escrowAddr, tokenId3);

// Buyer pays once
usdc.approve(escrowAddr, 500 * 10**6);
escrow.depositERC20(address(usdc), 500 * 10**6);

// Buyer receives all 3 NFTs!
```

### Example 3: NFT for Native ETH

```solidity
// Create escrow expecting 1 ETH as payment
address escrowAddr = factory.createEscrow(
    1 days,
    Escrow.AssetType.NATIVE,        // Native ETH (0)
    address(0),                      // Use address(0) for ETH
    0,
    1 ether                          // Payment amount
);

// Seller deposits NFT
nft.safeTransferFrom(seller, escrowAddr, tokenId);

// Buyer sends ETH (automatically processed via receive hook)
payable(escrowAddr).call{value: 1 ether}("");

// Swap complete! Buyer receives NFT, seller receives ETH
```

### Example 4: NFT for NFT

```solidity
// Create escrow expecting NFT #42 as payment
address escrowAddr = factory.createEscrow(
    1 days,
    Escrow.AssetType.ERC721,
    address(bayc),
    42,  // Token ID
    0
);

// Seller deposits their NFT
coolCats.safeTransferFrom(seller, escrowAddr, 123);

// Buyer sends their NFT as payment
bayc.safeTransferFrom(buyer, escrowAddr, 42);

// Swap complete!
```

### Example 5: DAO Purchase

This escrow is specifically designed for DAOs that can send and receive tokens but cannot call arbitrary external functions.

```solidity
// DAO creates escrow for an NFT purchase
address escrowAddr = factory.createEscrow(
    7 days,
    Escrow.AssetType.ERC20,
    address(daoToken),
    0,
    1000 ether
);

// Seller deposits NFT
nft.safeTransferFrom(seller, escrowAddr, tokenId);

// DAO votes and executes treasury proposal that:
// 1. Approves tokens: daoToken.approve(escrowAddr, 1000 ether)
// 2. Calls: escrow.depositERC20(address(daoToken), 1000 ether)

// DAO receives the NFT automatically!
```

### Example 6: Expired Escrow

```solidity
// Seller deposits NFT
nft.safeTransferFrom(seller, escrowAddr, tokenId);

// Time passes... buyer never pays
// After expiry, anyone can trigger withdrawal

escrow.withdrawExpired();

// NFT returned to seller
```

## Contract Architecture

### Escrow.sol

Single-use escrow contract for atomic swaps. Supports:
- Native ETH, ERC20, ERC721, and ERC1155 tokens
- Multiple asset deposits (from the same seller)
- Automatic payment detection via receiver hooks
- Time-locked expiry

**Key Functions:**
- `receive()` - Auto-process native ETH deposits/payments
- `depositERC20(token, amount)` - Deposit or pay with ERC20 tokens (pull-based)
- `withdrawExpired()` - Return assets after expiry
- `onERC721Received()` / `onERC1155Received()` - Auto-handle NFTs

**Events:**
- `Deposited(depositor, assetType, token, tokenId, amount)` - Asset deposited
- `SwapExecuted(payer, seller, paymentAssetType, paymentToken, paymentTokenId, paymentAmount, depositCount)` - Swap completed
- `ExpiredWithdrawal(caller, depositCount)` - Expired assets returned

### EscrowFactory.sol

Factory for deploying minimal proxy clones of escrow contracts.

**Key Functions:**
- `createEscrow(duration, paymentAssetType, paymentToken, paymentTokenId, paymentAmount)` - Deploy new escrow
- `getEscrow(escrowId)` - Look up escrow by ID

## Important Design Decisions

### Single Depositor Only

Only the first depositor (seller) can add assets to an escrow. This prevents funds from being lost if multiple parties deposit before reading each other's transactions. The same seller can deposit multiple assets (e.g., bundle sales).

### Push-Based Settlement (By Design)

The escrow uses push-based settlement (automatically sends funds on completion) rather than pull-based (requiring claim transactions). This is intentional:

- **DAO Compatibility**: DAOs can typically send/receive tokens but cannot call arbitrary external functions without custom proposal types
- **Simplicity**: No additional claim transaction required
- **Trade-off**: Sellers should use EOA addresses or contracts that can receive ETH

### ERC20 Deposits are Pull-Based

For ERC20 tokens, depositors must:
1. First call `token.approve(escrowAddress, amount)`
2. Then call `escrow.depositERC20(token, amount)`

This prevents front-running attacks where an attacker could claim credit for someone else's deposit.

## Security

### Audit Status

Audited by **Hashlock Pty Ltd** (January 2026). Remediation complete, pending final review.

### Security Features

- ✅ **ReentrancyGuard** - OpenZeppelin ReentrancyGuard on state-changing functions
- ✅ **SafeERC20** - OpenZeppelin SafeERC20 for non-standard token compatibility
- ✅ **CEI Pattern** - Checks-Effects-Interactions throughout
- ✅ **Input Validation** - Duration, payment token, and amount validation
- ✅ **Single Depositor** - Prevents fund loss from multi-depositor confusion
- ✅ **Pull-Based ERC20** - Prevents front-running on ERC20 deposits
- ✅ **No Admin Keys** - Fully trustless, no owner privileges
- ✅ **Comprehensive Events** - Full off-chain observability

### Known Limitations (By Design)

- **Push-based ETH/token settlement**: If the seller's address cannot receive ETH (e.g., contract without receive function), the swap will fail. Sellers should use EOA addresses or properly configured contracts.
- **Single depositor**: Only the first depositor can add assets. Other addresses attempting to deposit will have their transaction reverted (funds protected).

## Gas Costs

- Factory deployment: ~500k gas
- Escrow creation: ~150k gas (90% cheaper than direct deployment)
- Swap execution: ~200k-300k gas depending on token types

## Development

### Project Structure

```
swapEscrow/
├── src/
│   ├── Escrow.sol          # Main escrow contract
│   └── EscrowFactory.sol   # Factory for deploying escrows
├── script/
│   └── Deploy.s.sol        # Deployment script
├── test/
│   ├── Escrow.t.sol        # Core escrow tests
│   ├── EscrowFactory.t.sol # Factory tests
│   └── M03SingleDepositorTest.t.sol  # Single depositor tests
├── deployments/            # Deployment addresses by chain ID
├── index.html              # Web frontend
├── lib/                    # Dependencies (forge-std, OpenZeppelin)
└── foundry.toml            # Foundry config
```

### Running Tests

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testERC721ForERC20Swap

# Run with gas reporting
forge test --gas-report

# Run with verbosity
forge test -vvv
```

### Code Coverage

```bash
forge coverage
```

## Use Cases

- 🏛️ **DAO Purchases** - Safe asset purchases through governance (primary use case)
- 🎨 **NFT Marketplaces** - P2P NFT sales with escrow protection
- 💱 **Token Swaps** - OTC trades with time-locked security
- 🎮 **Gaming Assets** - In-game item trading
- 🖼️ **Art Deals** - Multi-asset bundle trades

## Local Development

1. Start a local Ethereum node: `anvil`
2. Deploy the factory: `forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast`
3. Open `index.html` in a browser
4. Connect MetaMask to your local network
5. Create escrows and copy addresses to share with trading partners

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Contact

Built for the MarketDAO ecosystem and beyond.
