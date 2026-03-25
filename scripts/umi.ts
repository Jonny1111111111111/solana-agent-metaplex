import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity } from '@metaplex-foundation/umi';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { genesis } from '@metaplex-foundation/genesis';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_URL = process.env.RPC_URL ?? 'https://api.devnet.solana.com';

export function loadKeypairFile(filePath: string) {
  const resolved = filePath.startsWith('.') ? join(process.cwd(), filePath) : filePath;
  if (!existsSync(resolved)) {
    throw new Error(`Keypair file not found: ${resolved}\nRun: npm run setup`);
  }
  return JSON.parse(readFileSync(resolved, 'utf-8')) as number[];
}

export function createBaseUmi() {
  return createUmi(RPC_URL)
    .use(mplCore())
    .use(mplToolbox())
    .use(genesis())
    .use(irysUploader({ address: 'https://devnet.irys.xyz' }));
}

export function createOwnerUmi() {
  const umi = createBaseUmi();
  const walletPath = process.env.WALLET_PATH ?? './keypairs/owner.json';
  const secretKey = loadKeypairFile(walletPath);
  const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey));
  return umi.use(keypairIdentity(keypair));
}

export function createExecutiveUmi() {
  const umi = createBaseUmi();
  const walletPath = process.env.EXECUTIVE_WALLET_PATH ?? './keypairs/executive.json';
  const secretKey = loadKeypairFile(walletPath);
  const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey));
  return umi.use(keypairIdentity(keypair));
}
