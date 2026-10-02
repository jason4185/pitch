import type { Address } from "viem";
import { getReadClient, type GenLayerClient } from "./client";
import { PITCH_CONTRACT_ADDRESS, STUDIO_NEXT_CHAIN_ID } from "./network";

// The deployed contract has no generated ABI in this app; these records are validated field-by-field below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractRecord = any;

export type PitchPhase = "OPEN" | "REVEAL" | "EVALUATING" | "SETTLED" | "REFUNDED" | "CANCELLED";
export type CriterionResult = "PASS" | "PARTIAL" | "FAIL";
export type Criterion = { text: string; required: boolean };
export type Evidence = { sha256: string; url: string };

export type Pitch = {
  id: string;
  title: string;
  brief: string;
  creator: string;
  bountyWei: bigint;
  bountyGen: string;
  phase: PitchPhase;
  createdAt: number;
  competitionEndsAt: number;
  revealEndsAt: number;
  evaluationDeadline: number;
  competitionMinutes: number;
  revealMinutes: number;
  criteriaCount: number;
  minimumScore: number;
  maximumScore: number;
  entryBondWei: bigint;
  evidenceRequired: boolean;
  submissionCount: number;
  revealedCount: number;
  evaluatedCount: number;
  winnerCount: number;
  winningScore: number;
  creatorRefundAmount: bigint;
  creatorRefundClaimed: boolean;
  forfeitedBondTotal: bigint;
  forfeitedBondClaimed: boolean;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  wins: number;
  competitionsEntered: number;
  validReveals: number;
  evaluatedSubmissions: number;
  totalScore: number;
  totalEarningsWei: bigint;
  totalEarningsGen: string;
  owner: string;
  operator: string;
  payoutAddress: string;
};

export type Submission = {
  id: string;
  pitchId: string;
  agentId: string;
  agentName: string;
  agentOwner: string;
  commitment: string;
  revealed: boolean;
  solution?: string;
  evidence?: Evidence[];
  evaluationExpired: boolean;
  evaluated: boolean;
  results?: CriterionResult[];
  score?: number;
  qualified?: boolean;
  rewardWei: bigint;
  rewardGen: string;
  rewardClaimed: boolean;
  bondAmountWei: bigint;
  bondClaimed: boolean;
};

export type Claim = {
  id: string;
  kind: "submission" | "creator";
  pitchId: string;
  submissionId?: string;
  bondClaimable: bigint;
  rewardClaimable: bigint;
  creatorRefundClaimable: bigint;
  forfeitedBondsClaimable: bigint;
  totalClaimable: bigint;
};

export type PitchConfig = {
  protocol: string;
  nativeToken: string;
  nativePrecision: number;
  minimumBounty: bigint;
  feeBps: number;
  entryBond: bigint;
  entryBondGen: string;
  evaluationGraceMinutes: number;
  minCompetitionMinutes: number;
  maxCompetitionMinutes: number;
  minRevealMinutes: number;
  maxRevealMinutes: number;
  maxCriteria: number;
  maxSubmissionsPerPitch: number;
  maxPageSize: number;
  qualificationRule: string;
  evidenceInput: string;
  commitment: string;
  criteriaInput: string;
  timezone: string;
  tieBehavior: string;
  payoutRounding: string;
  scores: Record<string, number>;
  limits: Record<string, number>;
};

export type DraftPitch = {
  title: string;
  brief: string;
  criteria: Criterion[];
  bountyGen: string;
  competitionMinutes: number;
  revealMinutes: number;
  evidenceRequired: boolean;
};

export type EntryPayload = { agentId: string; solution: string; evidenceUrls: string[] };
export type RevealPayload = {
  solution: string;
  evidenceBlob: string;
  salt: string;
  commitment: string;
};

export type ContractWrite = {
  kind: "write";
  address: Address;
  method: string;
  args: unknown[];
  value?: bigint;
};

function integer(value: unknown, field: string) {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    // Fall through to the stable error below.
  }
  throw new Error(`Contract returned an invalid ${field}.`);
}

function numberValue(value: unknown, field: string) {
  const result = integer(value, field);
  const number = Number(result);
  if (!Number.isSafeInteger(number)) throw new Error(`Contract returned an unsafe ${field}.`);
  return number;
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`Contract returned an invalid ${field}.`);
  return value;
}

function booleanValue(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`Contract returned an invalid ${field}.`);
  return value;
}

function formatGen(wei: bigint) {
  const negative = wei < 0n;
  const value = negative ? -wei : wei;
  const whole = value / 1000000000000000000n;
  const fraction = (value % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function parseGenAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error("Enter a GEN amount with no more than 18 decimal places.");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1000000000000000000n + BigInt(fraction.padEnd(18, "0") || "0");
}

function readArgs(args: unknown[]) {
  return args as never[];
}

async function read(
  client: GenLayerClient,
  method: string,
  args: unknown[] = [],
): Promise<unknown> {
  return await client.readContract({
    address: PITCH_CONTRACT_ADDRESS,
    functionName: method,
    args: readArgs(args),
    transactionHashVariant: "latest-nonfinal" as never,
  });
}

function page(value: unknown, field: string) {
  if (!value || typeof value !== "object")
    throw new Error(`Contract returned an invalid ${field} page.`);
  return value as ContractRecord;
}

function mapAgent(raw: unknown): Agent {
  const value = raw as ContractRecord;
  const earnings = integer(value.total_earnings, "agent earnings");
  return {
    id: String(numberValue(value.agent_id, "agent id")),
    name: stringValue(value.name, "agent name"),
    description: stringValue(value.description, "agent description"),
    active: booleanValue(value.active, "agent active status"),
    wins: numberValue(value.wins, "agent wins"),
    competitionsEntered: numberValue(value.competitions_entered, "competitions entered"),
    validReveals: numberValue(value.valid_reveals, "valid reveals"),
    evaluatedSubmissions: numberValue(value.evaluated_submissions, "evaluated submissions"),
    totalScore: numberValue(value.total_score, "agent total score"),
    totalEarningsWei: earnings,
    totalEarningsGen: formatGen(earnings),
    owner: stringValue(value.owner, "agent owner"),
    operator: stringValue(value.operator, "agent operator"),
    payoutAddress: stringValue(value.payout_address, "agent payout address"),
  };
}

function mapPitch(raw: unknown): Pitch {
  const value = raw as ContractRecord;
  const bounty = integer(value.bounty, "pitch bounty");
  const status = stringValue(value.status, "pitch status").toUpperCase() as PitchPhase;
  const terminalStatus = stringValue(value.terminal_status, "terminal pitch status");
  return {
    id: String(numberValue(value.pitch_id, "pitch id")),
    title: stringValue(value.title, "pitch title"),
    brief: stringValue(value.brief, "pitch brief"),
    creator: stringValue(value.creator, "pitch creator"),
    bountyWei: bounty,
    bountyGen: formatGen(bounty),
    phase: (terminalStatus || status) as PitchPhase,
    createdAt: numberValue(value.created_at, "pitch creation time"),
    competitionEndsAt: numberValue(value.commit_deadline, "commit deadline"),
    revealEndsAt: numberValue(value.reveal_deadline, "reveal deadline"),
    evaluationDeadline: numberValue(value.evaluation_deadline, "evaluation deadline"),
    competitionMinutes: numberValue(value.competition_minutes, "competition duration"),
    revealMinutes: numberValue(value.reveal_minutes, "reveal duration"),
    criteriaCount: numberValue(value.criteria_count, "criteria count"),
    minimumScore: numberValue(value.minimum_score, "minimum score"),
    maximumScore: numberValue(value.maximum_score, "maximum score"),
    entryBondWei: integer(value.entry_bond, "entry bond"),
    evidenceRequired: booleanValue(value.evidence_required, "evidence requirement"),
    submissionCount: numberValue(value.submission_count, "submission count"),
    revealedCount: numberValue(value.revealed_count, "revealed count"),
    evaluatedCount: numberValue(value.evaluated_count, "evaluated count"),
    winnerCount: numberValue(value.winner_count, "winner count"),
    winningScore: numberValue(value.winning_score, "winning score"),
    creatorRefundAmount: integer(value.creator_refund_amount, "creator refund"),
    creatorRefundClaimed: booleanValue(value.creator_refund_claimed, "creator refund status"),
    forfeitedBondTotal: integer(value.forfeited_bond_total, "forfeited bonds"),
    forfeitedBondClaimed: booleanValue(value.forfeited_bond_claimed, "forfeited bond status"),
  };
}

function mapSubmission(raw: unknown): Submission {
  const value = raw as ContractRecord;
  const evidenceRaw: unknown[] = Array.isArray(value.evidence) ? value.evidence : [];
  const evidence = evidenceRaw.map((item) => {
    const record = item as ContractRecord;
    return {
      sha256: stringValue(record.sha256, "evidence SHA-256"),
      url: stringValue(record.url, "evidence URL"),
    };
  });
  const resultsRaw: unknown[] = Array.isArray(value.criterion_results)
    ? value.criterion_results
    : [];
  const results = resultsRaw.map((item) => {
    const record = item as ContractRecord;
    return stringValue(record.result, "criterion result") as CriterionResult;
  });
  const reward = integer(value.reward, "submission reward");
  return {
    id: String(numberValue(value.submission_id, "submission id")),
    pitchId: String(numberValue(value.pitch_id, "submission pitch id")),
    agentId: String(numberValue(value.agent_id, "submission agent id")),
    agentName: stringValue(value.agent_name, "submission agent name"),
    agentOwner: stringValue(value.agent_owner, "submission agent owner"),
    commitment: stringValue(value.commitment, "submission commitment"),
    revealed: booleanValue(value.revealed, "submission reveal status"),
    ...(value.solution ? { solution: stringValue(value.solution, "solution") } : {}),
    ...(evidence.length ? { evidence } : {}),
    evaluationExpired: booleanValue(value.evaluation_expired, "evaluation expiry"),
    evaluated: booleanValue(value.evaluated, "evaluation status"),
    ...(results.length ? { results } : {}),
    score: numberValue(value.score, "submission score"),
    qualified: booleanValue(value.qualified, "qualification status"),
    rewardWei: reward,
    rewardGen: formatGen(reward),
    rewardClaimed: booleanValue(value.reward_claimed, "reward claim status"),
    bondAmountWei: integer(value.bond_amount, "bond amount"),
    bondClaimed: booleanValue(value.bond_claimed, "bond claim status"),
  };
}

function mapClaim(raw: unknown, kind: "submission" | "creator"): Claim {
  const value = raw as ContractRecord;
  const pitchId = String(numberValue(value.pitch_id, "claim pitch id"));
  const submissionId =
    value.submission_id === undefined
      ? undefined
      : String(numberValue(value.submission_id, "claim submission id"));
  const bond = integer(value.bond_claimable ?? 0, "claimable bond");
  const reward = integer(value.reward_claimable ?? 0, "claimable reward");
  const refund = integer(value.creator_refund_claimable ?? 0, "claimable refund");
  const forfeited = integer(value.forfeited_bonds_claimable ?? 0, "claimable forfeited bonds");
  const total = integer(value.total_claimable ?? 0, "total claimable");
  return {
    id: kind === "submission" ? `submission:${submissionId}` : `creator:${pitchId}`,
    kind,
    pitchId,
    ...(submissionId ? { submissionId } : {}),
    bondClaimable: bond,
    rewardClaimable: reward,
    creatorRefundClaimable: refund,
    forfeitedBondsClaimable: forfeited,
    totalClaimable: total,
  };
}

export async function getConfig(client = getReadClient()): Promise<PitchConfig> {
  const value = (await read(client, "get_config")) as ContractRecord;
  const scores = (value.scores ?? {}) as ContractRecord;
  const limits = (value.limits ?? {}) as ContractRecord;
  return {
    protocol: stringValue(value.protocol, "protocol"),
    nativeToken: stringValue(value.native_token, "native token"),
    nativePrecision: numberValue(value.native_precision, "native precision"),
    minimumBounty: integer(value.minimum_bounty, "minimum bounty"),
    feeBps: numberValue(value.fee_bps, "fee bps"),
    entryBond: integer(value.entry_bond, "entry bond"),
    entryBondGen: stringValue(value.entry_bond_gen, "entry bond GEN"),
    evaluationGraceMinutes: numberValue(value.evaluation_grace_minutes, "evaluation grace"),
    minCompetitionMinutes: numberValue(
      value.min_competition_minutes,
      "minimum competition duration",
    ),
    maxCompetitionMinutes: numberValue(
      value.max_competition_minutes,
      "maximum competition duration",
    ),
    minRevealMinutes: numberValue(value.min_reveal_minutes, "minimum reveal duration"),
    maxRevealMinutes: numberValue(value.max_reveal_minutes, "maximum reveal duration"),
    maxCriteria: numberValue(value.max_criteria, "maximum criteria"),
    maxSubmissionsPerPitch: numberValue(value.max_submissions_per_pitch, "maximum submissions"),
    maxPageSize: numberValue(value.max_page_size, "maximum page size"),
    qualificationRule: stringValue(value.qualification_rule, "qualification rule"),
    evidenceInput: stringValue(value.evidence_input, "evidence input"),
    commitment: stringValue(value.commitment, "commitment format"),
    criteriaInput: stringValue(value.criteria_input, "criteria input"),
    timezone: stringValue(value.timezone, "timezone"),
    tieBehavior: stringValue(value.tie_behavior, "tie behavior"),
    payoutRounding: stringValue(value.payout_rounding, "payout rounding"),
    scores: Object.fromEntries(
      Object.entries(scores).map(([key, item]) => [key, numberValue(item, `score ${key}`)]),
    ),
    limits: Object.fromEntries(
      Object.entries(limits).map(([key, item]) => [key, numberValue(item, `limit ${key}`)]),
    ),
  };
}

export async function getAgent(agentId: string, client = getReadClient()) {
  return mapAgent(await read(client, "get_agent", [BigInt(agentId)]));
}

export async function getPitch(pitchId: string, client = getReadClient()) {
  return mapPitch(await read(client, "get_pitch", [BigInt(pitchId)]));
}

export async function getPitches(offset = 0, limit = 50, client = getReadClient()) {
  const result = page(await read(client, "get_pitches", [BigInt(offset), BigInt(limit)]), "pitch");
  const items = Array.isArray(result.pitches) ? (result.pitches as unknown[]).map(mapPitch) : [];
  return {
    offset: numberValue(result.offset, "pitch offset"),
    nextOffset: numberValue(result.next_offset, "pitch next offset"),
    total: numberValue(result.total, "pitch total"),
    hasMore: booleanValue(result.has_more, "pitch pagination"),
    items,
  };
}

export async function getPitchCriteria(
  pitchId: string,
  client = getReadClient(),
): Promise<Criterion[]> {
  const values = await read(client, "get_pitch_criteria", [BigInt(pitchId)]);
  if (!Array.isArray(values)) throw new Error("Contract returned invalid pitch criteria.");
  return (values as unknown[]).map((item) => {
    const value = item as ContractRecord;
    return {
      text: stringValue(value.text, "criterion text"),
      required: booleanValue(value.required, "criterion requirement"),
    };
  });
}

export async function getSubmission(submissionId: string, client = getReadClient()) {
  return mapSubmission(await read(client, "get_submission", [BigInt(submissionId)]));
}

export async function getPitchSubmissions(
  pitchId: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  const result = page(
    await read(client, "get_pitch_submissions", [BigInt(pitchId), BigInt(offset), BigInt(limit)]),
    "submission",
  );
  const items = Array.isArray(result.submissions)
    ? (result.submissions as unknown[]).map(mapSubmission)
    : [];
  return {
    offset: numberValue(result.offset, "submission offset"),
    nextOffset: numberValue(result.next_offset, "submission next offset"),
    total: numberValue(result.total, "submission total"),
    hasMore: booleanValue(result.has_more, "submission pagination"),
    items,
  };
}

export async function getOwnerAgents(
  owner: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  const result = page(
    await read(client, "get_owner_agents", [owner, BigInt(offset), BigInt(limit)]),
    "owner agent",
  );
  const items = Array.isArray(result.agents) ? (result.agents as unknown[]).map(mapAgent) : [];
  return {
    offset: numberValue(result.offset, "agent offset"),
    nextOffset: numberValue(result.next_offset, "agent next offset"),
    total: numberValue(result.total, "agent total"),
    hasMore: booleanValue(result.has_more, "agent pagination"),
    items,
  };
}

export async function getMyAgents(client: GenLayerClient, offset = 0, limit = 50) {
  const result = page(
    await read(client, "get_my_agents", [BigInt(offset), BigInt(limit)]),
    "my agent",
  );
  const items = Array.isArray(result.agents) ? (result.agents as unknown[]).map(mapAgent) : [];
  return {
    offset: numberValue(result.offset, "agent offset"),
    nextOffset: numberValue(result.next_offset, "agent next offset"),
    total: numberValue(result.total, "agent total"),
    hasMore: booleanValue(result.has_more, "agent pagination"),
    items,
  };
}

export async function getCreatorPitches(
  creator: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  const result = page(
    await read(client, "get_creator_pitches", [creator, BigInt(offset), BigInt(limit)]),
    "creator pitch",
  );
  const items = Array.isArray(result.pitches) ? (result.pitches as unknown[]).map(mapPitch) : [];
  return {
    offset: numberValue(result.offset, "pitch offset"),
    nextOffset: numberValue(result.next_offset, "pitch next offset"),
    total: numberValue(result.total, "pitch total"),
    hasMore: booleanValue(result.has_more, "pitch pagination"),
    items,
  };
}

export async function getMyPitches(client: GenLayerClient, offset = 0, limit = 50) {
  const result = page(
    await read(client, "get_my_pitches", [BigInt(offset), BigInt(limit)]),
    "my pitch",
  );
  const items = Array.isArray(result.pitches) ? (result.pitches as unknown[]).map(mapPitch) : [];
  return {
    offset: numberValue(result.offset, "pitch offset"),
    nextOffset: numberValue(result.next_offset, "pitch next offset"),
    total: numberValue(result.total, "pitch total"),
    hasMore: booleanValue(result.has_more, "pitch pagination"),
    items,
  };
}

export async function getAgentSubmissions(
  agentId: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  const result = page(
    await read(client, "get_agent_submissions", [BigInt(agentId), BigInt(offset), BigInt(limit)]),
    "agent submission",
  );
  const items = Array.isArray(result.submissions)
    ? (result.submissions as unknown[]).map(mapSubmission)
    : [];
  return {
    offset: numberValue(result.offset, "submission offset"),
    nextOffset: numberValue(result.next_offset, "submission next offset"),
    total: numberValue(result.total, "submission total"),
    hasMore: booleanValue(result.has_more, "submission pagination"),
    items,
  };
}

export async function getMyClaimable(client: GenLayerClient, offset = 0, limit = 50) {
  const result = page(
    await read(client, "get_my_claimable", [BigInt(offset), BigInt(limit)]),
    "claim",
  );
  const agentClaims = Array.isArray(result.agent_claims)
    ? (result.agent_claims as unknown[]).map((item) => mapClaim(item, "submission"))
    : [];
  const creatorClaims = Array.isArray(result.creator_claims)
    ? (result.creator_claims as unknown[]).map((item) => mapClaim(item, "creator"))
    : [];
  return {
    agentClaims,
    creatorClaims,
    agentTotal: numberValue(result.agent_total, "agent claim total"),
    creatorTotal: numberValue(result.creator_total, "creator claim total"),
    agentHasMore: booleanValue(result.agent_has_more, "agent claim pagination"),
    creatorHasMore: booleanValue(result.creator_has_more, "creator claim pagination"),
  };
}

export async function getAgentCount(client = getReadClient()) {
  return numberValue(await read(client, "get_agent_count"), "agent count");
}

export async function getPitchCount(client = getReadClient()) {
  return numberValue(await read(client, "get_pitch_count"), "pitch count");
}

export async function getSubmissionCount(client = getReadClient()) {
  return numberValue(await read(client, "get_submission_count"), "submission count");
}

export async function listAgents(offset = 0, limit = 50, client = getReadClient()) {
  const total = await getAgentCount(client);
  const start = Math.min(offset, total);
  const end = Math.min(start + limit, total);
  const items = await Promise.all(
    Array.from({ length: end - start }, (_, index) => getAgent(String(start + index + 1), client)),
  );
  return { offset: start, nextOffset: end, total, hasMore: end < total, items };
}

export async function findSubmissionByCommitment(
  pitchId: string,
  agentId: string,
  commitment: string,
  client: GenLayerClient,
) {
  const pageResult = await getPitchSubmissions(pitchId, 0, 50, client);
  return pageResult.items.find(
    (item: Submission) => item.agentId === agentId && item.commitment === commitment,
  );
}

export function createPitchWrite(input: DraftPitch): ContractWrite {
  return {
    kind: "write",
    address: PITCH_CONTRACT_ADDRESS,
    method: "create_pitch",
    args: [
      input.title,
      input.brief,
      JSON.stringify(input.criteria.map(({ text, required }) => ({ text, required }))),
      BigInt(input.competitionMinutes),
      BigInt(input.revealMinutes),
      input.evidenceRequired,
    ],
    value: parseGenAmount(input.bountyGen),
  };
}

export const registerAgentWrite = (
  name: string,
  description: string,
  operator = "",
): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "register_agent",
  args: [name, description, operator],
});
export const updateAgentOperatorWrite = (agentId: string, operator: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "update_agent_operator",
  args: [BigInt(agentId), operator],
});
export const updateAgentPayoutWrite = (agentId: string, payout: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "update_agent_payout",
  args: [BigInt(agentId), payout],
});
export const updateAgentProfileWrite = (
  agentId: string,
  name: string,
  description: string,
): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "update_agent_profile",
  args: [BigInt(agentId), name, description],
});
export const setAgentActiveWrite = (agentId: string, active: boolean): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "set_agent_active",
  args: [BigInt(agentId), active],
});
export const cancelPitchWrite = (pitchId: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "cancel_pitch",
  args: [BigInt(pitchId)],
});
export const commitSubmissionWrite = (
  pitchId: string,
  agentId: string,
  commitment: string,
): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "commit_submission",
  args: [BigInt(pitchId), BigInt(agentId), commitment],
  value: 1000000000000000000n,
});
export const revealSubmissionWrite = (
  submissionId: string,
  solution: string,
  evidenceBlob: string,
  salt: string,
): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "reveal_submission",
  args: [BigInt(submissionId), solution, evidenceBlob, salt],
});
export const evaluateSubmissionWrite = (submissionId: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "evaluate_submission",
  args: [BigInt(submissionId)],
});
export const finalizePitchWrite = (pitchId: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "finalize_pitch",
  args: [BigInt(pitchId)],
});
export const claimSubmissionWrite = (submissionId: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "claim_submission",
  args: [BigInt(submissionId)],
});
export const claimCreatorWrite = (pitchId: string): ContractWrite => ({
  kind: "write",
  address: PITCH_CONTRACT_ADDRESS,
  method: "claim_creator",
  args: [BigInt(pitchId)],
});

export async function buildCommitment(
  pitchId: string,
  agentId: string,
  solution: string,
  evidenceBlob: string,
  salt: string,
) {
  const encoder = new TextEncoder();
  const lengthPrefix = (value: string) => {
    const bytes = encoder.encode(value);
    return new Uint8Array([...encoder.encode(String(bytes.byteLength)), 58, ...bytes]);
  };
  const parts = [
    encoder.encode("PITCH-V1\0"),
    lengthPrefix(pitchId),
    lengthPrefix(agentId),
    lengthPrefix(solution),
    lengthPrefix(evidenceBlob),
    lengthPrefix(salt),
  ];
  const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
  const preimage = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    preimage.set(part, offset);
    offset += part.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", preimage);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const PITCH_CHAIN_ID = STUDIO_NEXT_CHAIN_ID;
