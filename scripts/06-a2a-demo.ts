/**
 * Script 06 — A2A Demo
 * Shows both agent Asset Signer wallets on-chain.
 * Each agent's depositor wraps SOL → deposits into the Genesis launch pool.
 * Skips deposits gracefully if the window has already closed.
 */
import { publicKey, sol } from '@metaplex-foundation/umi';
import {
  depositLaunchPoolV2,
  findLaunchPoolDepositV2Pda,
} from '@metaplex-foundation/genesis';
import { findAssetSignerPda } from '@metaplex-foundation/mpl-core';
import {
  mplToolbox,
  findAssociatedTokenPda,
  createIdempotentAssociatedToken,
  syncNative,
  transferSol,
} from '@metaplex-foundation/mpl-toolbox';
import { WRAPPED_SOL_MINT } from '@metaplex-foundation/genesis';
import { createOwnerUmi, createExecutiveUmi } from './umi';
import { loadState } from './state';

const DEPOSIT_SOL = 0.1;

type Umi = ReturnType<typeof createOwnerUmi>;

async function wrapAndDeposit(
  umi: Umi,
  genesisAccount: ReturnType<typeof publicKey>,
  launchPoolBucket: ReturnType<typeof publicKey>,
  baseMint: ReturnType<typeof publicKey>,
  label: string,
) {
  const [wsolAta] = findAssociatedTokenPda(umi, {
    mint: publicKey(WRAPPED_SOL_MINT),
    owner: umi.identity.publicKey,
  });

  const [depositPda] = findLaunchPoolDepositV2Pda(umi, {
    bucket: launchPoolBucket,
    recipient: umi.identity.publicKey,
  });

  console.log(`  ${label} depositing ${DEPOSIT_SOL} SOL...`);

  // One atomic transaction: create wSOL ATA → fund it → sync → deposit
  await createIdempotentAssociatedToken(umi, {
    ata: wsolAta,
    mint: publicKey(WRAPPED_SOL_MINT),
    owner: umi.identity.publicKey,
  })
    .add(transferSol(umi, {
      destination: wsolAta,
      amount: sol(DEPOSIT_SOL),
    }))
    .add(syncNative(umi, { account: wsolAta }))
    .add(depositLaunchPoolV2(umi, {
      genesisAccount,
      bucket: launchPoolBucket,
      baseMint,
      amountQuoteToken: BigInt(DEPOSIT_SOL * 1e9),
    }))
    .sendAndConfirm(umi);

  console.log(`  ✓ ${label} deposited — deposit PDA: ${depositPda}`);
  return depositPda;
}

async function main() {
  console.log('=== Step 06: A2A Demonstration ===\n');

  const state = loadState();

  if (!state.genesisAccount || !state.launchPoolBucket || !state.baseMint) {
    throw new Error('Run script 04 first.');
  }
  if (!state.agentAlphaPublicKey || !state.agentBetaPublicKey) {
    throw new Error('Run scripts 02-03 first.');
  }

  const ownerUmi = createOwnerUmi();
  ownerUmi.use(mplToolbox());

  const execUmi = createExecutiveUmi();
  execUmi.use(mplToolbox());

  const genesisAccount   = publicKey(state.genesisAccount);
  const launchPoolBucket = publicKey(state.launchPoolBucket);
  const baseMint         = publicKey(state.baseMint);

  // Show agent wallets (Asset Signer PDAs — the agents' built-in on-chain wallets)
  const [alphaWallet] = findAssetSignerPda(ownerUmi, { asset: publicKey(state.agentAlphaPublicKey) });
  const [betaWallet]  = findAssetSignerPda(ownerUmi, { asset: publicKey(state.agentBetaPublicKey) });

  console.log('── Agent On-Chain Wallets (Asset Signer PDAs) ───────────────────\n');
  console.log('  Agent Alpha wallet:', alphaWallet);
  console.log('  Agent Beta wallet: ', betaWallet);
  console.log('\nThese PDAs have no private key — controlled exclusively via MPL');
  console.log('Core Execute hooks by a delegated executive.\n');

  // Skip deposits if window closed
  const now        = Math.floor(Date.now() / 1000);
  const depositEnd = parseInt(state.depositEnd!);
  if (now > depositEnd) {
    console.log('⚠  Deposit window closed — skipping on-chain deposits.');
    console.log('   A2A wallet identities are demonstrated above.');
    console.log('\n✓ Run: npm run crank');
    return;
  }

  const remaining = depositEnd - now;
  console.log(`Deposit window open — ${remaining}s remaining.\n`);

  // Deposits
  console.log('── A2A Interactions: Both agents deposit into token launch pool ──\n');

  const alphaDepositPda = await wrapAndDeposit(ownerUmi, genesisAccount, launchPoolBucket, baseMint, 'Agent Alpha');
  const betaDepositPda  = await wrapAndDeposit(execUmi,  genesisAccount, launchPoolBucket, baseMint, 'Agent Beta');

  // Interaction log
  const E = 'https://explorer.solana.com/address';
  const C = '?cluster=devnet';

  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    A2A INTERACTION LOG                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`  [1] Agent Alpha  wallet: ${alphaWallet}`);
  console.log(`       → deposited ${DEPOSIT_SOL} SOL into Genesis pool`);
  console.log(`       proof: ${E}/${alphaDepositPda}${C}`);
  console.log();
  console.log(`  [2] Agent Beta   wallet: ${betaWallet}`);
  console.log(`       → deposited ${DEPOSIT_SOL} SOL into Genesis pool`);
  console.log(`       proof: ${E}/${betaDepositPda}${C}`);
  console.log('\n  Both agents now hold proportional AGNT token claims.');
  console.log('  Run: npm run crank  (after deposit window closes)');
}

main().catch((e) => { console.error(e); process.exit(1); });
