# MarketDAO Frontend

A clean, modular, maintainable frontend for the MarketDAO project, refactored from a 2,559-line monolithic HTML file.

## Architecture

### Structure
```
frontend/
├── src/
│   ├── types/          # TypeScript interfaces and ABIs
│   ├── utils/          # Pure utility functions
│   ├── hooks/          # Custom React hooks
│   ├── components/     # Reusable UI components
│   ├── App.tsx         # Main application
│   └── main.tsx        # Entry point
├── index.html          # Clean HTML shell
└── package.json        # Minimal dependencies
```

### Key Improvements
- **Modular Code**: Separated concerns into hooks, components, and utilities
- **Type Safety**: Full TypeScript coverage with proper interfaces
- **Testable**: Pure functions and isolated hooks can be unit tested
- **Maintainable**: Each file has a single responsibility
- **Minimal Dependencies**: Only React, ReactDOM, Ethers.js, and Vite

### Dependencies
- `react` + `react-dom` - UI framework
- `ethers` - Blockchain interaction
- `vite` - Build tool and dev server (dev dependency only)
- `typescript` - Type safety (dev dependency only)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Key Files

### Hooks
- `useWallet.ts` - Wallet connection and MetaMask integration
- `useDAO.ts` - DAO information loading and token operations
- `useProposals.ts` - Proposal loading, voting, and management

### Components
- `Dashboard.tsx` - DAO info and token purchase interface
- `ProposalList.tsx` - Reusable proposal list component
- `ProposalCard.tsx` - Individual proposal card display
- `LoadingSpinner.tsx` - Loading overlay
- `Notification.tsx` - Toast notifications

### Utilities
- `formatting.ts` - Safe value formatting (ETH, BigNumber, addresses)
- `contractHelpers.ts` - Contract interaction utilities
- `notification.ts` - Notification state management

## Configuration

Contract addresses are configured in `src/types/constants.ts`:
```typescript
export const DAO_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
export const FACTORY_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
```

Update these for different networks or deployments.

## Build Output

The production build outputs to `dist/`:
- Optimized, minified JavaScript bundle
- Production React build (smaller, faster)
- Static HTML with asset references

Deploy the `dist/` folder to any static hosting service.
