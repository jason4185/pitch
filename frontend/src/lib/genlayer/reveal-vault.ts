import { PITCH_CONTRACT_ADDRESS, STUDIO_NEXT_CHAIN_ID } from "./network";

export type RevealBackup = {
  version: 1;
  contractAddress: string;
  chainId: number;
  pitchId: string;
  agentId: string;
  submissionId?: string;
  solution: string;
  evidenceBlob: string;
  salt: string;
  commitment: string;
};

const pending = new Map<string, RevealBackup>();

function key(pitchId: string, agentId: string) {
  return `${pitchId}:${agentId}`;
}

export function saveRevealBackup(backup: RevealBackup) {
  pending.set(key(backup.pitchId, backup.agentId), backup);
}

export function getRevealBackup(pitchId: string, agentId: string) {
  return pending.get(key(pitchId, agentId));
}

export function updateRevealSubmissionId(pitchId: string, agentId: string, submissionId: string) {
  const backup = getRevealBackup(pitchId, agentId);
  if (!backup) return undefined;
  const updated = { ...backup, submissionId };
  saveRevealBackup(updated);
  return updated;
}

export function downloadRevealBackup(backup: RevealBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pitch-${backup.pitchId}-agent-${backup.agentId}-reveal.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importRevealBackup(file: File): Promise<RevealBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That reveal backup is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("That reveal backup is invalid.");
  const candidate = parsed as Partial<RevealBackup>;
  if (
    candidate.version !== 1 ||
    candidate.contractAddress?.toLowerCase() !== PITCH_CONTRACT_ADDRESS.toLowerCase() ||
    candidate.chainId !== STUDIO_NEXT_CHAIN_ID ||
    typeof candidate.pitchId !== "string" ||
    typeof candidate.agentId !== "string" ||
    typeof candidate.solution !== "string" ||
    typeof candidate.evidenceBlob !== "string" ||
    typeof candidate.salt !== "string" ||
    typeof candidate.commitment !== "string"
  ) {
    throw new Error("This reveal backup belongs to a different PITCH contract or is incomplete.");
  }
  return candidate as RevealBackup;
}
