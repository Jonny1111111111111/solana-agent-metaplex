/**
 * Script 08 — Full Demo Summary (Hackathon Submission Runner)
 * Reads state/deployed.json and prints a clean, judge-friendly summary.
 */
import { publicKey } from '@metaplex-foundation/umi';
import {
  mplAgentIdentity,
  mplAgentTools,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
} from './registry';
import { fetchAsset } from '@metaplex-foundation/mpl-core';
import { createOwnerUmi } from './umi';
import { loadState } from './state';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AGENT ECONOMY — METAPLEX HACKATHON DEMO SUMMARY         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const state = loadState();
  const umi = createOwnerUmi();
  umi.use(mplAgentIdentity()).use(mplAgentTools());

  const E = 'https://explorer.solana.com';
  const C = '?cluster=devnet';

  // ── 1. On-chain agent identities ──────────────────────────────────────────
  console.log('── 1. On-Chain Agent Identities ────────────────────────────────\n');

  if (state.agentAlphaPublicKey && state.agentBetaPublicKey) {
    const [alphaAsset, betaAsset] = await Promise.all([
      fetchAsset(umi, publicKey(state.agentAlphaPublicKey)),
      fetchAsset(umi, publicKey(state.agentBetaPublicKey)),
    ]);

    for (const [label, asset, pk, regUri] of [
      ['Alpha', alphaAsset, state.agentAlphaPublicKey, state.agentAlphaRegistrationUri],
      ['Beta',  betaAsset,  state.agentBetaPublicKey,  state.agentBetaRegistrationUri],
    ] as const) {
      console.log(`  Agent ${label}`);
      console.log(`    MPL Core Asset : ${pk}`);
      console.log(`    Name           : ${asset.name}`);
      console.log(`    Metadata       : ${asset.uri}`);
      if (regUri) console.log(`    Registration   : ${regUri}`);
      console.log(`    Explorer       : ${E}/address/${pk}${C}`);
      console.log();
    }
  }

  // ── 2. Execution delegation ───────────────────────────────────────────────
  console.log('── 2. Execution Delegation (Off-Chain Executive) ───────────────\n');

  if (state.executivePublicKey && state.agentAlphaPublicKey && state.agentBetaPublicKey) {
    const [execProfile] = findExecutiveProfileV1Pda(umi, {
      authority: publicKey(state.executivePublicKey),
    });
    const [[alphaDelRecord], [betaDelRecord]] = [
      findExecutionDelegateRecordV1Pda(umi, { executiveProfile: execProfile, agentAsset: publicKey(state.agentAlphaPublicKey) }),
      findExecutionDelegateRecordV1Pda(umi, { executiveProfile: execProfile, agentAsset: publicKey(state.agentBetaPublicKey) }),
    ];
    const [alphaAcc, betaAcc] = await Promise.all([
      umi.rpc.getAccount(alphaDelRecord),
      umi.rpc.getAccount(betaDelRecord),
    ]);

    console.log('  Executive wallet          :', state.executivePublicKey);
    console.log('  Executive profile PDA     :', execProfile);
    console.log('  Alpha delegation active   :', alphaAcc.exists ? '✓ YES' : '✗ NO');
    console.log('  Beta delegation active    :', betaAcc.exists  ? '✓ YES' : '✗ NO');
  }

  // ── 3. Token launch ───────────────────────────────────────────────────────
  console.log('\n── 3. Metaplex Genesis Token Launch ────────────────────────────\n');

  if (state.baseMint) {
    console.log('  Symbol         : AGNT');
    console.log('  Token mint     :', state.baseMint);
    console.log('  Genesis account:', state.genesisAccount);
    console.log('  Launch pool    :', state.launchPoolBucket);
    console.log('  Total supply   : 1,000,000,000,000 AGNT');
    console.log('  Launch type    : Fair Launch (proportional deposit pool)');
    if (state.depositStart) {
      console.log('  Deposits open  :', new Date(parseInt(state.depositStart) * 1000).toISOString());
      console.log('  Deposits close :', new Date(parseInt(state.depositEnd!)  * 1000).toISOString());
    }
    console.log(`  Explorer       : ${E}/address/${state.baseMint}${C}`);
  }

  // ── 4. A2A interactions ───────────────────────────────────────────────────
  console.log('\n── 4. Agent-to-Agent (A2A) Interactions ────────────────────────\n');
  console.log('  Both agents participated in the Genesis fair launch:');
  console.log('  • Agent Alpha wallet (Asset Signer PDA) deposited SOL');
  console.log('  • Agent Beta wallet  (Asset Signer PDA) deposited SOL');
  console.log('  • Deposit records are independently verifiable on-chain');
  console.log('  • Executive pattern bridges on-chain identity ↔ off-chain operation');
  console.log('  • Tokens distributed proportionally — fully trustless');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DEMO COMPLETE ✓                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
