declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    RPC_URL?: string;
    USDC_ADDRESS?: string;
    FREEZER_CONTRACT_ADDRESS?: string;
    FREEZER_OWNER_PRIVATE_KEY?: string;
    DESTINATION_DOMAINS?: string;
  }
}

declare module 'cors';
