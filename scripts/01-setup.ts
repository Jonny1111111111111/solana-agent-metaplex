/**
 * Script 01 — Setup
 * First run:  generates owner + executive keypairs, saves to wallets.json.
 * Subsequent: loads wallets.json, never regenerates — idempotent.
 * Always:     checks executive SOL balance and tops it up to 1 SOL from owner if needed.
 */
import { generateSigner, publicKey, sol, lamports } from '@metaplex-foundation/umi';
import { transferSol } from '@metaplex-foundation/mpl-toolbox';
import { createBaseUmi, createOwnerUmi } from './umi';
import { saveState } from './state';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WALLETS_FILE = join(process.cwd(), 'wallets.json');

interface WalletsFile {
  owner:     { publicKey: string; secretKey: number[] };
  executive: { publicKey: string; secretKey: number[] };
}

function loadOrCreateWallets(umi: ReturnType<typeof createBaseUmi>): WalletsFile {
  if (existsSync(WALLETS_FILE)) {
    console.log('wallets.json found — loading existing wallets (no new keys generated).\n');
    return JSON.parse(readFileSync(WALLETS_FILE, 'utf-8')) as WalletsFile;
  }

  console.log('wallets.json not found — generating new wallets.\n');

  const ownerSigner = generateSigner(umi);
  const execSigner  = generateSigner(umi);

  const wallets: WalletsFile = {
    owner: {
      publicKey: ownerSigner.publicKey,
      secretKey: Array.from(ownerSigner.secretKey),
    },
    executive: {
      publicKey: execSigner.publicKey,
      secretKey: Array.from(execSigner.secretKey),
    },
  };

  writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
  console.log('Saved to wallets.json (DO NOT commit this file).\n');

  return wallets;
}

async function main() {
  console.log('=== Step 01: Setup ===\n');

  const umi = createBaseUmi();
  const wallets = loadOrCreateWallets(umi);

  const ownerPk = wallets.owner.publicKey;
  const execPk  = wallets.executive.publicKey;

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   WALLET ADDRESSES                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Owner:      ${ownerPk}`);
  console.log(`║  Executive:  ${execPk}`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  // Also write individual keypair files for scripts that load from .env paths
  const { mkdirSync } = await import('fs');
  const keypairsDir = join(process.cwd(), 'keypairs');
  if (!existsSync(keypairsDir)) mkdirSync(keypairsDir);

  writeFileSync(join(keypairsDir, 'owner.json'),     JSON.stringify(wallets.owner.secretKey));
  writeFileSync(join(keypairsDir, 'executive.json'), JSON.stringify(wallets.executive.secretKey));

  saveState({
    ownerPublicKey:     ownerPk,
    executivePublicKey: execPk,
  });

  // Fund executive from owner if it has less than 1 SOL
  const ownerUmi = createOwnerUmi();
  ownerUmi.use(require('@metaplex-foundation/mpl-toolbox').mplToolbox());

  const execBalance = await ownerUmi.rpc.getBalance(publicKey(execPk));
  const ONE_SOL = sol(1).basisPoints;

  if (execBalance.basisPoints < ONE_SOL) {
    const topUp = lamports(ONE_SOL - execBalance.basisPoints);
    console.log(`\nExecutive balance: ${Number(execBalance.basisPoints) / 1e9} SOL — topping up to 1 SOL...`);
    await transferSol(ownerUmi, {
      destination: publicKey(execPk),
      amount: topUp,
    }).sendAndConfirm(ownerUmi);
    console.log('✓ Executive funded.');
  } else {
    console.log(`\nExecutive balance: ${Number(execBalance.basisPoints) / 1e9} SOL — no top-up needed.`);
  }

  console.log('\n✓ Setup complete. Run: npm run create-agents');
}

main().catch((e) => { console.error(e); process.exit(1); });
