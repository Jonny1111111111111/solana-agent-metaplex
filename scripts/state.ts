/**
 * Persists deployed addresses between scripts so each step picks up where the last left off.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const STATE_FILE = join(process.cwd(), 'state', 'deployed.json');

export interface DeployedState {
  // Wallets
  ownerPublicKey?: string;
  executivePublicKey?: string;

  // Collection
  collectionPublicKey?: string;

  // Agent Alpha
  agentAlphaPublicKey?: string;
  agentAlphaRegistrationUri?: string;

  // Agent Beta
  agentBetaPublicKey?: string;
  agentBetaRegistrationUri?: string;

  // Token launch
  baseMint?: string;
  genesisAccount?: string;
  launchPoolBucket?: string;
  unlockedBucket?: string;
  depositStart?: string;
  depositEnd?: string;
  claimStart?: string;
  claimEnd?: string;

  // Executive delegation
  executiveProfilePda?: string;
  alphaDelegateRecord?: string;
  betaDelegateRecord?: string;
}

export function loadState(): DeployedState {
  if (!existsSync(STATE_FILE)) return {};
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

export function saveState(partial: Partial<DeployedState>) {
  const current = loadState();
  const next = { ...current, ...partial };
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}
