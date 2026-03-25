/**
 * Script 03 — Register Agents
 * Uploads ERC-8004 registration documents and calls registerIdentityV1 for both agents.
 */
import { publicKey } from '@metaplex-foundation/umi';
import { mplAgentIdentity, registerIdentityV1 } from './registry';
import { createOwnerUmi } from './umi';
import { loadState, saveState } from './state';

function buildRegistrationDoc(agentId: string, name: string, description: string): object {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name,
    description,
    image: `https://placehold.co/400x400/6e56cf/fff?text=${encodeURIComponent(name)}`,
    services: [
      {
        name: 'A2A',
        endpoint: `https://agent-economy.example.com/agents/${agentId}/agent-card.json`,
        version: '0.3.0',
        skills: [
          { name: 'token-transfer', description: 'Send SPL tokens to peer agents' },
          { name: 'a2a-ping', description: 'Respond to A2A pings from other agents' },
        ],
        domains: ['defi', 'agent-economy'],
      },
      {
        name: 'MCP',
        endpoint: `https://agent-economy.example.com/agents/${agentId}/mcp`,
        version: '2025-06-18',
      },
    ],
    active: true,
    registrations: [
      {
        agentId,
        agentRegistry: 'solana:101:metaplex',
      },
    ],
    supportedTrust: ['reputation', 'crypto-economic'],
  };
}

async function main() {
  console.log('=== Step 03: Register Agent Identities ===\n');

  const umi = createOwnerUmi();
  umi.use(mplAgentIdentity());

  const state = loadState();

  if (!state.agentAlphaPublicKey || !state.agentBetaPublicKey) {
    throw new Error('Run script 02 first — agents not found in state.');
  }

  const alphaId = state.agentAlphaPublicKey;
  const betaId  = state.agentBetaPublicKey;

  // Build and upload ERC-8004 registration documents
  console.log('Uploading registration documents to Irys devnet...');

  const alphaDoc = buildRegistrationDoc(alphaId, 'Agent Alpha', 'Token-launching autonomous agent on Solana.');
  const betaDoc  = buildRegistrationDoc(betaId,  'Agent Beta',  'A2A-capable peer agent that exchanges tokens with Agent Alpha.');

  const alphaRegUri = await umi.uploader.uploadJson(alphaDoc);
  const betaRegUri  = await umi.uploader.uploadJson(betaDoc);

  console.log('  Alpha registration URI:', alphaRegUri);
  console.log('  Beta registration URI: ', betaRegUri);

  // Register Agent Alpha
  console.log('\nRegistering Agent Alpha identity...');
  await registerIdentityV1(umi, {
    asset: publicKey(alphaId),
    collection: state.collectionPublicKey ? publicKey(state.collectionPublicKey) : undefined,
    agentRegistrationUri: alphaRegUri,
  }).sendAndConfirm(umi);
  console.log('  ✓ Alpha registered on-chain');

  // Register Agent Beta
  console.log('\nRegistering Agent Beta identity...');
  await registerIdentityV1(umi, {
    asset: publicKey(betaId),
    collection: state.collectionPublicKey ? publicKey(state.collectionPublicKey) : undefined,
    agentRegistrationUri: betaRegUri,
  }).sendAndConfirm(umi);
  console.log('  ✓ Beta registered on-chain');

  saveState({
    agentAlphaRegistrationUri: alphaRegUri,
    agentBetaRegistrationUri:  betaRegUri,
  });

  console.log('\n✓ Both agents have on-chain identities!');
  console.log('  Alpha AgentIdentity PDA derived from:', alphaId);
  console.log('  Beta AgentIdentity PDA derived from: ', betaId);
}

main().catch((e) => { console.error(e); process.exit(1); });
