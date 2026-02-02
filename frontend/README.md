# MarketDAO VanJS Frontend

A lightweight frontend for MarketDAO built with VanJS - no build step required!

## Tech Stack

- **VanJS** (~1KB reactive UI library)
- **Ethers.js v6** (Web3 interactions)
- **Bootstrap 5** (Styling)
- **No bundler/build tools** - runs directly in browser via CDN imports

## Quick Start

### 1. Start a local web server

```bash
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js
npx serve . -p 8080

# Option 3: Live reload (optional)
npx live-server --port=8080
```

### 2. Open in browser

Navigate to http://localhost:8080

### 3. Connect MetaMask

Make sure MetaMask is:
- Installed
- Connected to the correct network (default: Localhost 8545, Chain ID 31337)
- Has an account with test ETH

## Configuration

Edit `js/config.js` to change network and contract addresses:

```javascript
const CONFIG = {
  network: {
    chainId: 31337,  // Change for different networks
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545'
  },
  contracts: {
    dao: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
    factory: '0x0165878a594ca255338adfa4d48449f69242eb8f'
  }
}
```

Quick network switch using predefined configs:

```javascript
// Uncomment in config.js to switch networks
const NETWORKS = {
  anvil: { ... },
  sepolia: { ... },
  mainnet: { ... }
}
```

## Project Structure

```
frontend-vanjs/
├── index.html          # Entry point
├── css/
│   └── styles.css      # Custom styles
├── js/
│   ├── app.js          # Main app & routing
│   ├── config.js       # Configuration
│   ├── components/     # UI components (coming soon)
│   ├── services/
│   │   └── wallet.js   # Wallet connection
│   ├── utils/
│   │   ├── formatting.js
│   │   ├── contractHelpers.js
│   │   └── notifications.js
│   └── abis/
│       ├── MarketDAO.js
│       ├── Proposal.js
│       └── ProposalFactory.js
└── README.md
```

## Development Status

### ✅ Complete
- Basic app shell and routing
- Wallet connection (MetaMask)
- Configuration system
- Utility functions
- ABIs for unified proposal architecture

### 🚧 In Progress
- Dashboard (DAO info, balances, token purchase)
- Proposal list and cards
- Create proposal forms
- Voting interface

### 📋 TODO
- Elections view
- History view
- Members list
- Distribution proposals

## Key Differences from React Version

1. **No Build Tools**: Everything runs directly via CDN imports
2. **VanJS State**: Uses `van.state()` instead of React hooks
3. **Unified Proposals**: New backend uses single Proposal contract with arbitrary calldata
4. **Ethers v6**: Updated from v5 (BrowserProvider, await getSigner(), etc.)

## Testing with Local Blockchain

1. Start Anvil:
   ```bash
   anvil
   ```

2. Deploy contracts:
   ```bash
   forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
   ```

3. Update contract addresses in `js/config.js` if different

4. Open frontend and connect wallet

## Debugging

Open browser console (F12) to see:
- Wallet connection logs
- Contract initialization
- Network validation
- Error messages

## Contributing

This is an incremental build. Components will be added one at a time:
1. Dashboard
2. Proposal list
3. Create proposal
4. Elections/voting
5. History
6. Members

See `CLAUDE.md` in project root for full architecture details.
