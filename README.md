# SentinelX Backend

Node.js/Express backend service that monitors blockchain events for suspicious token approvals and automatically triggers cross-chain token freezes.

Listens for USDC approval events on registered wallets. When an approval exceeds 90% of the user's balance, it automatically calls the freezer contract to pause tokens across all configured chains via Hyperlane messaging. Provides WebSocket API for real-time event notifications.

## Setup

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```env
PORT=4000
RPC_URL=https://your-rpc-endpoint.com
USDC_ADDRESS=0xYourUSDCContractAddress
FREEZER_CONTRACT_ADDRESS=0xYourFreezerContractAddress
FREEZER_OWNER_PRIVATE_KEY=your_private_key_here
DESTINATION_DOMAINS=11142220,1918988905,4661
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## API Endpoints

- `GET /health` - Health check
- `POST /register-wallet` - Register wallet for monitoring
- `WS /ws` - WebSocket for real-time events

## Tech Stack

- Node.js
- Express
- WebSocket (ws)
- Ethers.js v6
- TypeScript
