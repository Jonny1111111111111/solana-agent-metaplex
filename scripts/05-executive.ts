/**
 * Script 05 — Register Executive & Delegate Execution
 * Idempotent: skips registerExecutiveV1 if profile already exists.
 * Also skips delegateExecutionV1 per-agent if delegate record already exists.
 */
import { publicKey } from '@metaplex-foundation/umi';
import {
  mplAgentIdentity,
  mplAgentTools,
  registerExecutiveV1,
  delegateExecutionV1,
  findAgentIdentityV1Pda,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
} from './registry';
import { createOwnerUmi, createExecutiveUmi } from './umi';
import { loadState, saveState } from './state';

async function main() {
  console.log('=== Step 05: Register Executive & Delegate Execution ===\n');

  const state = loadState();

  if (!state.agentAlphaPublicKey || !state.agentBetaPublicKey) {
    throw new Error('Run scripts 02-03 first.');
  }

  const execUmi  = createExecutiveUmi();
  execUmi.use(mplAgentTools());

  const ownerUmi = createOwnerUmi();
  ownerUmi.use(mplAgentIdentity()).use(mplAgentTools());

  // ── Step 1: Register executive profile (skip if already exists) ───────────
  const executiveProfilePda = findExecutiveProfileV1Pda(execUmi, {
    authority: execUmi.identity.publicKey,
  });
  const executiveProfile = executiveProfilePda[0];

  const profileAccount = await execUmi.rpc.getAccount(executiveProfile);

  if (profileAccount.exists) {
    console.log('Executive profile already exists — skipping registration.');
    console.log('  Executive profile PDA:', executiveProfile);
  } else {
    console.log('Registering executive profile...');
    console.log('  Executive wallet:', execUmi.identity.publicKey);
    await registerExecutiveV1(execUmi, {
      payer: execUmi.payer,
    }).sendAndConfirm(execUmi);
    console.log('  Executive profile PDA:', executiveProfile);
  }

  // ── Step 2: Delegate execution per agent (skip each if already delegated) ─
  const agentAlphaPk = publicKey(state.agentAlphaPublicKey);
  const agentBetaPk  = publicKey(state.agentBetaPublicKey);

  const [alphaIdentity] = findAgentIdentityV1Pda(ownerUmi, { asset: agentAlphaPk });
  const [betaIdentity]  = findAgentIdentityV1Pda(ownerUmi, { asset: agentBetaPk });

  const alphaDelegateRecordPda = findExecutionDelegateRecordV1Pda(ownerUmi, {
    executiveProfile,
    agentAsset: agentAlphaPk,
  });
  const betaDelegateRecordPda = findExecutionDelegateRecordV1Pda(ownerUmi, {
    executiveProfile,
    agentAsset: agentBetaPk,
  });

  const [alphaRecordAcct, betaRecordAcct] = await Promise.all([
    ownerUmi.rpc.getAccount(alphaDelegateRecordPda[0]),
    ownerUmi.rpc.getAccount(betaDelegateRecordPda[0]),
  ]);

  if (alphaRecordAcct.exists) {
    console.log('\nAgent Alpha delegation already exists — skipping.');
  } else {
    console.log('\nDelegating execution for Agent Alpha...');
    await delegateExecutionV1(ownerUmi, {
      agentAsset: agentAlphaPk,
      agentIdentity: alphaIdentity,
      executiveProfile,
    }).sendAndConfirm(ownerUmi);
    console.log('  Alpha delegate record:', alphaDelegateRecordPda[0]);
  }

  if (betaRecordAcct.exists) {
    console.log('Agent Beta delegation already exists — skipping.');
  } else {
    console.log('\nDelegating execution for Agent Beta...');
    await delegateExecutionV1(ownerUmi, {
      agentAsset: agentBetaPk,
      agentIdentity: betaIdentity,
      executiveProfile,
    }).sendAndConfirm(ownerUmi);
    console.log('  Beta delegate record:', betaDelegateRecordPda[0]);
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  console.log('\nVerifying delegations on-chain...');
  const [alphaFinal, betaFinal] = await Promise.all([
    ownerUmi.rpc.getAccount(alphaDelegateRecordPda[0]),
    ownerUmi.rpc.getAccount(betaDelegateRecordPda[0]),
  ]);
  console.log('  Alpha delegation active:', alphaFinal.exists);
  console.log('  Beta delegation active: ', betaFinal.exists);

  saveState({
    executiveProfilePda: executiveProfile,
    alphaDelegateRecord: alphaDelegateRecordPda[0],
    betaDelegateRecord:  betaDelegateRecordPda[0],
  });

  console.log('\n✓ Executive ready and delegation active for both agents!');
}

main().catch((e) => { console.error(e); process.exit(1); });
