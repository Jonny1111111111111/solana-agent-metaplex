/**
 * Re-exports from mpl-agent-registry internal generated modules.
 * The main package index only exports the UMI plugins; the instructions
 * and PDA helpers live in sub-directories.
 */

// Identity program
export {
  registerIdentityV1,
  findAgentIdentityV1Pda,
  fetchAgentIdentityV1,
  safeFetchAgentIdentityV1,
  MPL_AGENT_IDENTITY_PROGRAM_ID,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/identity/index.js';

// Tools program (executive + delegation)
export {
  registerExecutiveV1,
  delegateExecutionV1,
  findExecutiveProfileV1Pda,
  findExecutionDelegateRecordV1Pda,
  fetchExecutiveProfileV1,
  fetchExecutionDelegateRecordV1,
  MPL_AGENT_TOOLS_PROGRAM_ID,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
} from '@metaplex-foundation/mpl-agent-registry/dist/src/generated/tools/index.js';

// Plugins (from main index)
export { mplAgentIdentity, mplAgentTools } from '@metaplex-foundation/mpl-agent-registry';
