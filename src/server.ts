import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { JsonRpcProvider, Contract, Log, isAddress, Wallet, formatUnits } from 'ethers';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const RPC_URL = process.env.RPC_URL ?? '';
const USDC_ADDRESS = process.env.USDC_ADDRESS ?? '';
const FREEZER_CONTRACT_ADDRESS = process.env.FREEZER_CONTRACT_ADDRESS ?? '';
const FREEZER_OWNER_PRIVATE_KEY = process.env.FREEZER_OWNER_PRIVATE_KEY ?? '';
const DESTINATION_DOMAINS =
  process.env.DESTINATION_DOMAINS?.split(',').map((d) => Number(d.trim())) ?? [];

const USDC_ABI = [
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'function balanceOf(address account) view returns (uint256)',
];

const FREEZER_ABI = [
  'function freezeTokenAndRemoteMultiple(uint32[] calldata destDomains) external returns (bytes32[])',
];

if (!RPC_URL || !USDC_ADDRESS) {
  // eslint-disable-next-line no-console
  console.warn(
    'RPC_URL or USDC_ADDRESS not set. Indexer will not connect to blockchain until configured.'
  );
}

// In-memory registry of wallet addresses to monitor
const registeredWallets = new Set<string>();

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Register wallet address for monitoring
app.post('/register-wallet', (req: Request, res: Response) => {
  const { address } = req.body as { address?: string };

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address is required' });
  }

  const normalized = address.toLowerCase();
  registeredWallets.add(normalized);

  return res.json({ success: true, address: normalized });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

type WSClient = {
  send: (data: string) => void;
  readyState: number;
};

const wsClients = new Set<WSClient>();

wss.on('connection', (socket: WebSocket) => {
  wsClients.add(socket);

  socket.on('close', () => {
    wsClients.delete(socket);
  });
});

function broadcast(data: unknown) {
  const payload = JSON.stringify(data);
  for (const client of wsClients) {
    if ((client as any).readyState === 1) {
      client.send(payload);
    }
  }
}

// Set up indexer for USDC Approval events
if (RPC_URL && USDC_ADDRESS) {
  console.log('RPC_URL', RPC_URL);
  console.log('USDC_ADDRESS', USDC_ADDRESS);
  if (!isAddress(USDC_ADDRESS)) {
    // eslint-disable-next-line no-console
    console.error('USDC_ADDRESS is not a valid hex address. Indexer will not start.');
  } else {
    const provider = new JsonRpcProvider(RPC_URL);
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider);

    usdc.on(
      'Approval',
      async (owner: string, spender: string, value: bigint, event: Log & { args?: any }) => {
        const ownerNormalized = owner.toLowerCase();
        if (!registeredWallets.has(ownerNormalized)) return;

        const payload = {
          type: 'approval_detected',
          owner,
          spender,
          value: value.toString(),
          txHash: event.transactionHash,
          logIndex: event.index,
          blockNumber: event.blockNumber,
        };

        // eslint-disable-next-line no-console
        console.log('USDC approval detected:', payload);

        broadcast(payload);

        console.log('FREEZER_CONTRACT_ADDRESS', FREEZER_CONTRACT_ADDRESS);
        console.log('FREEZER_OWNER_PRIVATE_KEY', FREEZER_OWNER_PRIVATE_KEY);
        console.log('DESTINATION_DOMAINS', DESTINATION_DOMAINS);

        // Check if approval amount is >= 90% of user balance and trigger freeze
        if (FREEZER_CONTRACT_ADDRESS && FREEZER_OWNER_PRIVATE_KEY) {
          console.log('====== In here trying =====');
          try {
            const userBalance = await usdc.balanceOf(owner);
            const threshold = (userBalance * 90n) / 100n;

            // value >= threshold && value > 0n;

            if (true) {
              // eslint-disable-next-line no-console
              console.log(
                `Approval amount (${formatUnits(value, 6)}) >= 90% of balance (${formatUnits(userBalance, 6)}). Triggering freeze...`
              );

              const freezerSigner = new Wallet(FREEZER_OWNER_PRIVATE_KEY, provider);
              const freezer = new Contract(FREEZER_CONTRACT_ADDRESS, FREEZER_ABI, freezerSigner);

              const tx = await freezer.freezeTokenAndRemoteMultiple(DESTINATION_DOMAINS);

              // eslint-disable-next-line no-console
              console.log(`Freeze transaction sent: ${tx.hash}`);

              const receipt = await tx.wait();

              // eslint-disable-next-line no-console
              console.log(`Freeze transaction confirmed: ${tx.hash}`);

              const freezePayload = {
                type: 'freeze_triggered',
                owner,
                approvalAmount: value.toString(),
                userBalance: userBalance.toString(),
                threshold: threshold.toString(),
                txHash: tx.hash,
                destDomains: DESTINATION_DOMAINS,
              };

              broadcast(freezePayload);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error checking balance or triggering freeze:', error);
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(
            'Freezer contract address or owner private key or destination domains not set. Freeze will not be triggered.'
          );
        }
      }
    );
  }
}

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});
