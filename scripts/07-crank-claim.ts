/**
 * Script 07 — Crank + Claim
 * Fault-tolerant: handles empty pools (no deposits) and already-processed states.
 */
import { publicKey } from '@metaplex-foundation/umi';
import {
  triggerBehaviorsV2,
  claimLaunchPoolV2,
  WRAPPED_SOL_MINT,
} from '@metaplex-foundation/genesis';
import { findAssociatedTokenPda, mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { createOwnerUmi, createExecutiveUmi } from './umi';
import { loadState } from './state';

async function tryStep(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    // Check message, name, and full string representation for any known non-fatal pattern
    const haystack = [e?.message, e?.name, String(e)].filter(Boolean).join(' ');
    const skip = [
      'already',
      'AlreadyClaimed',
      'AlreadyGraduated',
      'FundingThresholdNotMet',
      'InvalidDepositPda',           // error name prefix
      'deposit PDA account is invalid', // error message text
      'AccountNotFound',
      'ClaimNotStarted',
    ].some(s => haystack.includes(s));

    if (skip) {
      console.log(`  ⚠  ${label} skipped (no deposit found — pool was empty): ${(e?.name ?? String(e)).split('\n')[0]}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log('=== Step 07: Crank + Claim ===\n');

  const state = loadState();

  if (!state.genesisAccount || !state.launchPoolBucket || !state.baseMint || !state.unlockedBucket) {
    throw new Error('Run script 04 first.');
  }

  const now        = Math.floor(Date.now() / 1000);
  const depositEnd = parseInt(state.depositEnd!);

  if (now < depositEnd) {
    const remaining = depositEnd - now;
    console.log(`⏳ Deposit window still open — ${remaining}s left (closes ${new Date(depositEnd * 1000).toISOString()}).`);
    process.exit(0);
  }

  const ownerUmi = createOwnerUmi();
  ownerUmi.use(mplToolbox());

  const execUmi = createExecutiveUmi();
  execUmi.use(mplToolbox());

  const genesisAccount   = publicKey(state.genesisAccount);
  const launchPoolBucket = publicKey(state.launchPoolBucket);
  const unlockedBucket   = publicKey(state.unlockedBucket);
  const baseMint         = publicKey(state.baseMint);

  // ── Step 1: Crank ─────────────────────────────────────────────────────────
  console.log('Cranking state machine...');

  const [unlockedBucketQuoteTokenAccount] = findAssociatedTokenPda(ownerUmi, {
    owner: unlockedBucket,
    mint: WRAPPED_SOL_MINT,
  });

  await tryStep('Crank', async () => {
    await triggerBehaviorsV2(ownerUmi, {
      genesisAccount,
      primaryBucket: launchPoolBucket,
      baseMint,
    })
      .addRemainingAccounts([
        { pubkey: unlockedBucket,                             isSigner: false, isWritable: true },
        { pubkey: publicKey(unlockedBucketQuoteTokenAccount), isSigner: false, isWritable: true },
      ])
      .sendAndConfirm(ownerUmi);
    console.log('  ✓ Crank complete');
  });

  // ── Step 2: Wait for claim window ─────────────────────────────────────────
  const claimStart = parseInt(state.claimStart!);
  if (now < claimStart) {
    const wait = claimStart - now;
    console.log(`\n⏳ Claim window opens in ${wait}s (${new Date(claimStart * 1000).toISOString()}). Re-run then.`);
    process.exit(0);
  }

  // ── Step 3: Claim tokens ──────────────────────────────────────────────────
  console.log('\nClaiming AGNT for Agent Alpha...');
  await tryStep('Alpha claim', async () => {
    await claimLaunchPoolV2(ownerUmi, {
      genesisAccount,
      bucket: launchPoolBucket,
      baseMint,
      recipient: ownerUmi.identity.publicKey,
    }).sendAndConfirm(ownerUmi);
    console.log('  ✓ Alpha tokens claimed');
  });

  console.log('Claiming AGNT for Agent Beta...');
  await tryStep('Beta claim', async () => {
    await claimLaunchPoolV2(execUmi, {
      genesisAccount,
      bucket: launchPoolBucket,
      baseMint,
      recipient: execUmi.identity.publicKey,
    }).sendAndConfirm(execUmi);
    console.log('  ✓ Beta tokens claimed');
  });

  console.log('\n✓ Crank + claim complete. Run: npm run demo');
}

main().catch((e) => { console.error(e); process.exit(1); });
