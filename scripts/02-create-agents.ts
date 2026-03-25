/**
 * Script 02 — Create Agents
 * Creates an MPL Core collection and two agent assets (Alpha and Beta).
 * Uploads NFT metadata to Irys devnet before minting.
 */
import { generateSigner } from '@metaplex-foundation/umi';
import { create, createCollection, fetchCollection } from '@metaplex-foundation/mpl-core';
import { createOwnerUmi } from './umi';
import { loadState, saveState } from './state';

const COLLECTION_METADATA = {
  name: 'Agent Economy Collection',
  description: 'A collection of autonomous on-chain agents built for the Solana Agent Economy.',
  image: 'https://placehold.co/400x400/6e56cf/fff?text=AE',
  external_url: 'https://github.com/your-handle/agent-economy',
  attributes: [{ trait_type: 'type', value: 'agent-collection' }],
};

const AGENT_ALPHA_METADATA = {
  name: 'Agent Alpha',
  description: 'The primary autonomous agent. Launches tokens, interacts on-chain, and delegates execution to a trusted executive.',
  image: 'https://placehold.co/400x400/6e56cf/fff?text=Alpha',
  external_url: 'https://github.com/your-handle/agent-economy',
  attributes: [
    { trait_type: 'role', value: 'token-launcher' },
    { trait_type: 'version', value: '1.0.0' },
  ],
};

const AGENT_BETA_METADATA = {
  name: 'Agent Beta',
  description: 'A peer agent that receives and responds to Agent Alpha via on-chain token transfers, demonstrating A2A interaction.',
  image: 'https://placehold.co/400x400/4e9af1/fff?text=Beta',
  external_url: 'https://github.com/your-handle/agent-economy',
  attributes: [
    { trait_type: 'role', value: 'a2a-responder' },
    { trait_type: 'version', value: '1.0.0' },
  ],
};

/** Poll fetchCollection until it resolves, retrying every 3s for up to 30s. */
async function fetchCollectionWithRetry(
  umi: ReturnType<typeof createOwnerUmi>,
  address: string,
  maxWaitMs = 30_000,
) {
  const { publicKey } = await import('@metaplex-foundation/umi');
  const intervalMs = 3_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      return await fetchCollection(umi, publicKey(address));
    } catch {
      const remaining = Math.round((deadline - Date.now()) / 1000);
      console.log(`  Account not visible yet — retrying in 3s (${remaining}s left)...`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  throw new Error(`Collection ${address} not found after ${maxWaitMs / 1000}s`);
}

async function main() {
  console.log('=== Step 02: Create Agents ===\n');

  const umi = createOwnerUmi();

  // uploadJson takes a single object and returns a single URI — call separately
  console.log('Uploading metadata to Irys devnet...');
  const collectionUri = await umi.uploader.uploadJson(COLLECTION_METADATA);
  const alphaUri      = await umi.uploader.uploadJson(AGENT_ALPHA_METADATA);
  const betaUri       = await umi.uploader.uploadJson(AGENT_BETA_METADATA);

  console.log('  Collection URI:', collectionUri);
  console.log('  Alpha URI:     ', alphaUri);
  console.log('  Beta URI:      ', betaUri);

  // Create collection
  console.log('\nCreating collection...');
  const collectionSigner = generateSigner(umi);
  await createCollection(umi, {
    collection: collectionSigner,
    name: 'Agent Economy Collection',
    uri: collectionUri,
  }).sendAndConfirm(umi);
  console.log('  Collection:', collectionSigner.publicKey);

  // Fetch full collection object, retrying until RPC confirms it
  const collectionData = await fetchCollectionWithRetry(umi, collectionSigner.publicKey);
  console.log('  Collection confirmed on-chain ✓');

  // Create Agent Alpha
  console.log('\nCreating Agent Alpha...');
  const agentAlpha = generateSigner(umi);
  await create(umi, {
    asset: agentAlpha,
    collection: collectionData,
    name: 'Agent Alpha',
    uri: alphaUri,
  }).sendAndConfirm(umi);
  console.log('  Agent Alpha:', agentAlpha.publicKey);

  // Create Agent Beta
  console.log('\nCreating Agent Beta...');
  const agentBeta = generateSigner(umi);
  await create(umi, {
    asset: agentBeta,
    collection: collectionData,
    name: 'Agent Beta',
    uri: betaUri,
  }).sendAndConfirm(umi);
  console.log('  Agent Beta:', agentBeta.publicKey);

  saveState({
    collectionPublicKey: collectionSigner.publicKey,
    agentAlphaPublicKey: agentAlpha.publicKey,
    agentBetaPublicKey:  agentBeta.publicKey,
  });

  console.log('\n✓ Agents created!');
}

main().catch((e) => { console.error(e); process.exit(1); });
