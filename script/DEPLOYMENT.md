# MarketDAO Deployment Guide

This directory contains deployment scripts for different DAO configurations. Each script deploys a MarketDAO with specific governance and token sale settings.

## Available Deployment Scripts

### 1. Deploy.s.sol - Open Market DAO (Default)

**Use case:** Public DAO with unrestricted token sales and on-demand minting.

**Configuration:**
- `ALLOW_MINTING`: ✅ true - Governance can mint new tokens
- `RESTRICT_PURCHASES`: ❌ false - Anyone can purchase tokens
- `MINT_ON_PURCHASE`: ❌ false - Purchases mint new tokens on-demand

**Token Purchase Behavior:**
- Anyone can purchase tokens at any time
- Each purchase mints new tokens, increasing total supply
- No need to pre-mint tokens for sale
- Treasury receives ETH payments

**Deployment:**
```bash
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast
```

---

### 2. Deploy.private.s.sol - Private/Restricted DAO

**Use case:** Invitation-only DAO where only existing members can purchase more tokens.

**Configuration:**
- `ALLOW_MINTING`: ✅ true - Governance can mint new tokens
- `RESTRICT_PURCHASES`: ✅ true - Only token holders can purchase
- `MINT_ON_PURCHASE`: ❌ false - Purchases mint new tokens on-demand

**Token Purchase Behavior:**
- Only existing token holders can purchase additional tokens
- Each purchase mints new tokens, increasing total supply
- New members join through mint proposals (join requests)
- Once someone has 1+ tokens, they can purchase more

**Deployment:**
```bash
forge script script/Deploy.private.s.sol --rpc-url <RPC_URL> --broadcast
```

---

### 3. Deploy.controlled.s.sol - Controlled Token Sale DAO (NEW)

**Use case:** DAO with controlled token supply where purchases transfer from pre-minted treasury.

**Configuration:**
- `ALLOW_MINTING`: ✅ true - Governance can mint new tokens
- `RESTRICT_PURCHASES`: ❌ false - Anyone can purchase tokens
- `MINT_ON_PURCHASE`: ✅ true - Purchases transfer from DAO treasury

**Token Purchase Behavior:**
- Purchases transfer existing tokens from DAO treasury
- **DAO must pre-mint tokens to itself via governance proposals**
- Total supply only increases through governance-approved minting
- Token sales stop when DAO treasury runs out
- Anyone can purchase (not restricted to holders)

**Deployment:**
```bash
forge script script/Deploy.controlled.s.sol --rpc-url <RPC_URL> --broadcast
```

**Post-Deployment Setup for Controlled Sale:**
1. Create a mint proposal to mint tokens to the DAO address:
   ```solidity
   factory.createMintProposal(
       "Mint 1000 tokens to DAO treasury for public sale",
       address(dao),  // Mint to DAO itself
       1000
   );
   ```
2. Vote on and execute the proposal
3. Tokens are now available for public purchase
4. Check available tokens: `dao.getAvailableTokensForPurchase()`

---

## Configuration Comparison

| Feature | Deploy.s.sol | Deploy.private.s.sol | Deploy.controlled.s.sol |
|---------|--------------|----------------------|-------------------------|
| Purchase Access | Anyone | Token holders only | Anyone |
| Purchase Mechanism | Mint new tokens | Mint new tokens | Transfer from DAO |
| Supply Growth | Unlimited via purchases | Unlimited via purchases | Controlled via governance |
| Pre-minting Required | No | No | **Yes** |
| Best For | Open public DAOs | Private membership DAOs | Token sale fundraising |

---

## Common Configuration Parameters

All deployment scripts share these base parameters:

- **Token Price**: `1e14` wei (0.0001 ETH per token)
- **Support Threshold**: 20% of vested tokens needed to trigger election
- **Quorum**: 51% of vested tokens needed for valid vote
- **Max Proposal Age**: 100 blocks before proposal expires
- **Election Duration**: 50 blocks for voting period
- **Vesting Period**: 100 blocks for purchased tokens to vest
- **Treasury**: Accepts ETH, ERC20, and ERC1155 tokens

You can modify these parameters in the `DeployConfig` contract of each script.

---

## Flag Reference

The DAO uses bitflags to configure behavior:

```solidity
FLAG_ALLOW_MINTING       = 1 << 0  // Bit 0: Can governance mint tokens?
FLAG_RESTRICT_PURCHASES  = 1 << 1  // Bit 1: Restrict purchases to holders only?
FLAG_MINT_ON_PURCHASE    = 1 << 2  // Bit 2: Transfer from DAO (true) or mint (false)?
```

### Flag Combinations

- `0b001` (1): Allow minting only
- `0b011` (3): Allow minting + restrict purchases (Deploy.private.s.sol)
- `0b101` (5): Allow minting + controlled sale (Deploy.controlled.s.sol)
- `0b111` (7): All flags enabled (restricted + controlled sale)

---

## Testing Deployments

### Local Testing (Anvil)

1. Start local node:
```bash
anvil
```

2. Deploy in another terminal:
```bash
forge script script/Deploy.controlled.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Testnet Deployment

```bash
forge script script/Deploy.controlled.s.sol \
    --rpc-url <TESTNET_RPC> \
    --broadcast \
    --verify \
    --etherscan-api-key <API_KEY>
```

---

## Modifying Configurations

To create a custom configuration:

1. Copy one of the existing deployment scripts
2. Modify the `DeployConfig` constants:
   - Change `DAO_NAME`
   - Adjust governance parameters (thresholds, durations)
   - Set flags (ALLOW_MINTING, RESTRICT_PURCHASES, MINT_ON_PURCHASE)
   - Update initial token holders and amounts
3. Test your configuration
4. Deploy

Example custom configuration (invite-only + controlled sale):

```solidity
bool constant RESTRICT_PURCHASES = true;  // Only holders can buy
bool constant MINT_ON_PURCHASE = true;    // Transfer from DAO treasury
```

This creates an exclusive DAO where:
- New members must be voted in via mint proposals
- Token holders can purchase additional tokens
- All sales come from pre-approved treasury allocation
