/**
 * Script 04 — Launch Token
 * Uses Metaplex Genesis to launch AGNT via a fair-launch pool.
 *
 * The combined addLaunchPoolBucketV2 exceeds the 1232-byte tx limit, so we split it:
 *   2a. addLaunchPoolBucketV2Base  — bucket + 4 time conditions
 *   2b. setLaunchPoolBucketV2Behaviors — end behaviors (separate tx)
 */
import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import {
  genesis,
  initializeV2,
  findGenesisAccountV2Pda,
  findLaunchPoolBucketV2Pda,
  findUnlockedBucketV2Pda,
  addLaunchPoolBucketV2Base,
  setLaunchPoolBucketV2Behaviors,
  addUnlockedBucketV2,
  finalizeV2,
  createTimeAbsoluteCondition,
} from '@metaplex-foundation/genesis';
import { fetchGenesisAccountV2 } from '@metaplex-foundation/genesis';
import { createOwnerUmi } from './umi';
import { saveState } from './state';

async function waitForAccount(
  umi: ReturnType<typeof createOwnerUmi>,
  address: ReturnType<typeof publicKey>,
  label: string,
  maxWaitMs = 30_000,
) {
  const intervalMs = 3_000;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const acct = await umi.rpc.getAccount(address);
    if (acct.exists) return;
    const remaining = Math.round((deadline - Date.now()) / 1000);
    console.log(`  ${label} not visible yet — retrying in 3s (${remaining}s left)...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} not found after ${maxWaitMs / 1000}s`);
}

const TOTAL_SUPPLY = 1_000_000_000_000n;      // 1 trillion (9 decimals)
const DEPOSIT_DURATION_SECS = 60 * 60;        // 60 min deposit window
const CLAIM_DURATION_SECS   = 60 * 60;        // 1 hour

async function main() {
  console.log('=== Step 04: Launch Agent Token (Genesis) ===\n');

  const umi = createOwnerUmi();
  umi.use(genesis());

  // Upload token metadata — uploadJson takes a single object, not an array
  console.log('Uploading token metadata...');
  const tokenMetaUri = await umi.uploader.uploadJson({
    name: 'Agent Economy Token',
    symbol: 'AGNT',
    description: 'Governance and utility token of the Agent Economy.',
    image: 'https://placehold.co/400x400/6e56cf/fff?text=AGNT',
  });
  console.log('  Token metadata URI:', tokenMetaUri);

  // Timing
  const now          = BigInt(Math.floor(Date.now() / 1000));
  const depositStart = now + 30n;
  const depositEnd   = depositStart + BigInt(DEPOSIT_DURATION_SECS);
  const claimStart   = depositEnd + 60n;
  const claimEnd     = claimStart + BigInt(CLAIM_DURATION_SECS);

  // ── Step 1: Initialize genesis account + mint ─────────────────────────────
  console.log('\nStep 1: Initializing genesis account...');
  const baseMint = generateSigner(umi);

  const [genesisAccount] = findGenesisAccountV2Pda(umi, {
    baseMint: baseMint.publicKey,
    genesisIndex: 0,
  });

  await initializeV2(umi, {
    baseMint,
    fundingMode: 0,
    totalSupplyBaseToken: TOTAL_SUPPLY,
    name: 'Agent Economy Token',
    uri: tokenMetaUri,
    symbol: 'AGNT',
  }).sendAndConfirm(umi);

  console.log('  Token mint:     ', baseMint.publicKey);
  console.log('  Genesis account:', genesisAccount);

  await waitForAccount(umi, publicKey(genesisAccount), 'Genesis account');
  console.log('  Genesis account confirmed on-chain ✓');

  const [launchPoolBucket] = findLaunchPoolBucketV2Pda(umi, { genesisAccount, bucketIndex: 0 });
  const [unlockedBucket]   = findUnlockedBucketV2Pda(umi,   { genesisAccount, bucketIndex: 0 });

  // ── Step 2a: Add Launch Pool bucket (conditions only) ─────────────────────
  // Separated from end behaviors to stay under the 1232-byte tx size limit.
  console.log('\nStep 2a: Adding Launch Pool bucket (conditions)...');
  await addLaunchPoolBucketV2Base(umi, {
    genesisAccount,
    baseMint: baseMint.publicKey,
    baseTokenAllocation: TOTAL_SUPPLY,
    depositStartCondition: createTimeAbsoluteCondition(depositStart),
    depositEndCondition:   createTimeAbsoluteCondition(depositEnd),
    claimStartCondition:   createTimeAbsoluteCondition(claimStart),
    claimEndCondition:     createTimeAbsoluteCondition(claimEnd),
  }).sendAndConfirm(umi);
  console.log('  Launch Pool bucket:', launchPoolBucket);

  await waitForAccount(umi, launchPoolBucket, 'Launch Pool bucket');
  console.log('  Launch Pool bucket confirmed on-chain ✓');

  // ── Step 2b: Set end behaviors (separate tx) ──────────────────────────────
  console.log('\nStep 2b: Setting end behaviors...');
  await setLaunchPoolBucketV2Behaviors(umi, {
    genesisAccount,
    bucket: launchPoolBucket,
    padding: Array(3).fill(0),
    endBehaviors: [
      {
        __kind: 'SendQuoteTokenPercentage',
        processed: false,
        percentageBps: 10000,           // 100% of collected SOL → unlocked bucket
        padding: Array(4).fill(0),
        destinationBucket: publicKey(unlockedBucket),
      },
    ],
  }).sendAndConfirm(umi);
  console.log('  End behaviors set ✓');

  // ── Step 3: Add Unlocked bucket ───────────────────────────────────────────
  console.log('\nStep 3: Adding Unlocked bucket...');
  await addUnlockedBucketV2(umi, {
    genesisAccount,
    baseMint: baseMint.publicKey,
    baseTokenAllocation: 0n,
    recipient: umi.identity.publicKey,
    padding: Array(6).fill(0),
    claimStartCondition: createTimeAbsoluteCondition(claimStart),
    claimEndCondition:   createTimeAbsoluteCondition(claimEnd),
    backendSigner: null,
  }).sendAndConfirm(umi);
  console.log('  Unlocked bucket:', unlockedBucket);

  await waitForAccount(umi, unlockedBucket, 'Unlocked bucket');
  console.log('  Unlocked bucket confirmed on-chain ✓');

  // ── Step 4: Finalize ──────────────────────────────────────────────────────
  // finalizeV2 requires all bucket accounts passed as remaining accounts.
  console.log('\nStep 4: Finalizing launch...');
  await finalizeV2(umi, {
    baseMint: baseMint.publicKey,
    genesisAccount,
  })
    .addRemainingAccounts([
      { pubkey: launchPoolBucket, isSigner: false, isWritable: true },
      { pubkey: unlockedBucket,   isSigner: false, isWritable: true },
    ])
    .sendAndConfirm(umi);

  saveState({
    baseMint:         baseMint.publicKey,
    genesisAccount:   genesisAccount,
    launchPoolBucket: launchPoolBucket,
    unlockedBucket:   unlockedBucket,
    depositStart:     depositStart.toString(),
    depositEnd:       depositEnd.toString(),
    claimStart:       claimStart.toString(),
    claimEnd:         claimEnd.toString(),
  });

  console.log('\n✓ Token launch ACTIVE!');
  console.log('  Token mint:     ', baseMint.publicKey);
  console.log('  Genesis:        ', genesisAccount);
  console.log('  Launch pool:    ', launchPoolBucket);
  console.log('  Unlocked bucket:', unlockedBucket);
  console.log('\n  TIMING:');
  console.log('  Deposits open: ', new Date(Number(depositStart) * 1000).toISOString());
  console.log('  Deposits close:', new Date(Number(depositEnd)   * 1000).toISOString());
  console.log('  Claims open:   ', new Date(Number(claimStart)   * 1000).toISOString());
  console.log('  Claims close:  ', new Date(Number(claimEnd)     * 1000).toISOString());
}

main().catch((e) => { console.error(e); process.exit(1); });
