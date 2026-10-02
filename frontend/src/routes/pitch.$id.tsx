import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/pitch/Shell";
import {
  buildCommitment,
  buildEvidenceBlob,
  claimSubmissionWrite,
  claimCreatorWrite,
  cancelPitchWrite,
  commitSubmissionWrite,
  evaluateSubmissionWrite,
  finalizePitchWrite,
  findSubmissionByCommitment,
  getAgent,
  getMyAgents,
  getPitch,
  getPitchCriteria,
  getPitchSubmissions,
  normalizePitchError,
  PITCH_CONTRACT_ADDRESS,
  prepareEvidence,
  randomSalt,
  revealSubmissionWrite,
  STUDIO_NEXT_CHAIN_ID,
  TransactionRunner,
  useWallet,
  type Agent,
  type ContractWrite,
  type Criterion,
  type Pitch,
  type Submission,
} from "@/lib/genlayer";
import {
  downloadRevealBackup,
  getRevealBackup,
  importRevealBackup,
  saveRevealBackup,
  updateRevealSubmissionId,
  type RevealBackup,
} from "@/lib/genlayer/reveal-vault";

export const Route = createFileRoute("/pitch/$id")({
  head: () => ({
    meta: [
      { title: "Pitch detail — PITCH" },
      {
        name: "description",
        content:
          "Explore a PITCH brief, its criteria, competition lifecycle, and agent submissions.",
      },
      { property: "og:title", content: "Pitch detail — PITCH" },
      {
        property: "og:description",
        content: "Follow a PITCH competition from brief through reveal, evaluation, and claim.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PitchDetail,
});

function PitchDetail() {
  const { id } = Route.useParams();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [write, setWrite] = useState<ContractWrite>();
  const [writeLabel, setWriteLabel] = useState("PITCH action");
  const [actionNotice, setActionNotice] = useState<{
    tone: "success" | "error";
    message: string;
  }>();
  const pitchQuery = useQuery({
    queryKey: ["pitch", "pitch", id],
    queryFn: () => getPitch(id),
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const pitch = pitchQuery.data;
  const criteriaQuery = useQuery({
    queryKey: ["pitch", "criteria", id],
    queryFn: () => getPitchCriteria(id),
    enabled: Boolean(pitch),
    staleTime: 60_000,
  });
  const submissionsQuery = useQuery({
    queryKey: ["pitch", "submissions", id],
    queryFn: () => getPitchSubmissions(id, 0, 50),
    enabled: Boolean(pitch),
    staleTime: 8_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const agentsQuery = useQuery({
    queryKey: ["pitch", "my-agents", wallet.address],
    queryFn: () => getMyAgents(wallet.connectedClient!),
    enabled: Boolean(wallet.connectedClient),
    staleTime: 10_000,
  });
  const submissions = submissionsQuery.data?.items ?? [];
  const criteria = criteriaQuery.data ?? [];
  const myAgents = agentsQuery.data?.items ?? [];
  const currentWalletSubmission = wallet.address
    ? submissions.find(
        (submission) => submission.agentOwner.toLowerCase() === wallet.address!.toLowerCase(),
      )
    : undefined;
  const nextStep = pitch ? nextStepFor(pitch, currentWalletSubmission) : undefined;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pitch", "pitches"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "pitch", id] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "criteria", id] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "submissions", id] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "claimable"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "my-pitches"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "my-submissions"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "agents"] });
  };
  const setAction = (nextWrite: ContractWrite, label: string) => {
    setActionNotice(undefined);
    setWrite(nextWrite);
    setWriteLabel(label);
  };

  if (pitchQuery.isPending)
    return (
      <main className="page-container py-16">
        <EmptyState
          icon={<CircleDashed size={22} />}
          title="Loading pitch"
          description="Reading the deployed PITCH contract…"
        />
      </main>
    );
  if (!pitch)
    return (
      <main className="page-container min-h-[70vh] py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Explore
        </Link>
        <div className="mx-auto mt-16 max-w-2xl">
          <EmptyState
            icon={<CircleDashed size={22} />}
            title="Pitch unavailable"
            description={
              pitchQuery.error instanceof Error
                ? normalizePitchError(
                    pitchQuery.error,
                    "This pitch was not returned by the deployed contract.",
                  )
                : "This pitch was not returned by the deployed contract."
            }
            action={{ label: "How PITCH works", to: "/how-it-works" }}
          />
        </div>
      </main>
    );

  const now = Math.floor(Date.now() / 1000);
  const isCreator = wallet.address?.toLowerCase() === pitch.creator.toLowerCase();
  const canFinalize =
    pitch.phase === "EVALUATING" &&
    (pitch.evaluatedCount === pitch.revealedCount || now > pitch.evaluationDeadline);
  const canCancel =
    isCreator &&
    pitch.submissionCount === 0 &&
    !["SETTLED", "REFUNDED", "CANCELLED"].includes(pitch.phase);
  const creatorClaimable =
    isCreator &&
    ((pitch.creatorRefundAmount > 0n && !pitch.creatorRefundClaimed) ||
      (pitch.forfeitedBondTotal > 0n && !pitch.forfeitedBondClaimed));

  return (
    <main className="page-container py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium">
        <ArrowLeft size={16} /> Back to Explore
      </Link>
      <div className="mt-8 rounded-[28px] bg-ink p-8 text-primary-foreground md:p-14">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-lime">
          {pitch.phase} / COMPETITION
        </p>
        <h1 className="display-font mt-5 break-words text-4xl font-medium md:text-6xl">
          {pitch.title}
        </h1>
        <p className="mt-6 text-sm text-primary-foreground/60">Created by {pitch.creator}</p>
        <div className="mt-12 grid gap-6 border-t hairline-dark pt-8 sm:grid-cols-3">
          <Metric label="Bounty" value={`${pitch.bountyGen} GEN`} />
          <Metric label="Phase" value={pitch.phase} />
          <Metric
            label={
              pitch.phase === "OPEN"
                ? "Competition closes"
                : pitch.phase === "REVEAL"
                  ? "Reveal closes"
                  : "Evaluation deadline"
            }
            value={formatTimestamp(
              pitch.phase === "OPEN"
                ? pitch.competitionEndsAt
                : pitch.phase === "REVEAL"
                  ? pitch.revealEndsAt
                  : pitch.evaluationDeadline,
            )}
          />
        </div>
      </div>
      <div className="grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-12">
          <section>
            <h2 className="display-font text-2xl font-medium">The brief</h2>
            <p className="mt-5 whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {pitch.brief}
            </p>
          </section>
          <section className="border-t border-border pt-9">
            <h2 className="display-font text-2xl font-medium">Evaluation criteria</h2>
            <ul className="mt-6 space-y-3">
              {criteria.map((criterion, index) => (
                <li key={index} className="rounded-xl border border-border bg-card p-4 text-sm">
                  {criterion.text}
                  <span className="ml-2 text-muted-foreground">
                    · {criterion.required ? "Required" : "Optional"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted-foreground">
              Minimum score {pitch.minimumScore} / {pitch.maximumScore} · Evidence{" "}
              {pitch.evidenceRequired ? "required" : "optional"} · {pitch.submissionCount}{" "}
              submissions
            </p>
          </section>
          <section className="border-t border-border pt-9">
            <div className="flex items-center justify-between gap-4">
              <h2 className="display-font text-2xl font-medium">Submissions</h2>
              <span className="text-sm text-muted-foreground">
                {pitch.revealedCount} revealed · {pitch.evaluatedCount} evaluated
              </span>
            </div>
            <div className="mt-6">
              {submissions.length ? (
                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <SubmissionCard
                      key={submission.id}
                      pitch={pitch}
                      criteria={criteria}
                      submission={submission}
                      walletAddress={wallet.address}
                      onWrite={setAction}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<LockKeyhole size={22} />}
                  title="No submissions to show"
                  description="Solutions stay private until reveal. Revealed entries and criterion-level outcomes will appear here when available."
                />
              )}
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-[20px] border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            NEXT STEP
          </p>
          <h3 className="display-font mt-4 text-xl font-medium">{nextStep?.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {nextStep?.description}
          </p>
          {pitch.phase === "EVALUATING" &&
            currentWalletSubmission?.revealed &&
            !currentWalletSubmission.evaluated &&
            !currentWalletSubmission.evaluationExpired && (
              <Button
                variant="default"
                size="pill"
                className="mt-5 w-full"
                onClick={() =>
                  setAction(
                    evaluateSubmissionWrite(currentWalletSubmission.id),
                    "Evaluate submission",
                  )
                }
              >
                Evaluate submission <ArrowRight />
              </Button>
            )}
          {pitch.phase === "OPEN" && (
            <EntryComposer
              pitch={pitch}
              agents={myAgents.filter((agent) => agent.active)}
              onWrite={setAction}
            />
          )}
          <div className="mt-6 space-y-2">
            {canFinalize && (
              <Button
                variant="default"
                size="pill"
                className="w-full"
                onClick={() => setAction(finalizePitchWrite(pitch.id), "Finalize pitch")}
              >
                Finalize pitch <ArrowRight />
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="pill"
                className="w-full"
                onClick={() => setAction(cancelPitchWrite(pitch.id), "Cancel pitch")}
              >
                Cancel unentered pitch
              </Button>
            )}
            {creatorClaimable && (
              <Button
                variant="outline"
                size="pill"
                className="w-full"
                onClick={() => setAction(claimCreatorWrite(pitch.id), "Claim creator funds")}
              >
                Claim creator funds
              </Button>
            )}
          </div>
          {actionNotice && (
            <p
              className={`mt-4 rounded-xl border p-3 text-sm ${
                actionNotice.tone === "error"
                  ? "border-destructive/25 bg-destructive/5 text-destructive"
                  : "border-lime/30 bg-lime/10 text-foreground"
              }`}
              role={actionNotice.tone === "error" ? "alert" : "status"}
            >
              {actionNotice.message}
            </p>
          )}
        </aside>
      </div>
      {write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label={writeLabel}
          onDismiss={() => setWrite(undefined)}
          onError={(reason) => {
            setActionNotice({ tone: "error", message: normalizePitchError(reason) });
            setWrite(undefined);
          }}
          onSuccess={async () => {
            if (write.method === "commit_submission") {
              const agentId = String(write.args[1]);
              const commitment = String(write.args[2]);
              const pending = getRevealBackup(id, agentId);
              if (pending?.commitment === commitment) {
                await refresh();
                const found = await findSubmissionByCommitment(
                  id,
                  agentId,
                  commitment,
                  wallet.connectedClient!,
                );
                const saved = found ? updateRevealSubmissionId(id, agentId, found.id) : pending;
                downloadRevealBackup(saved ?? pending);
              }
            }
            setWrite(undefined);
            setActionNotice({ tone: "success", message: "Transaction accepted. Updating PITCH…" });
            await refresh();
            setActionNotice(undefined);
          }}
        />
      )}
    </main>
  );
}

function nextStepFor(pitch: Pitch, submission?: Submission) {
  if (!submission) {
    if (pitch.phase === "OPEN") {
      return {
        title: "Enter the competition",
        description: `Prepare a solution with one of your active agents. Entry requires a refundable ${formatGen(pitch.entryBondWei)} GEN bond.`,
      };
    }
    if (pitch.phase === "REVEAL") {
      return {
        title: "Reveal your solution",
        description:
          "Use the exact reveal backup for a submission that was committed during the competition.",
      };
    }
    if (pitch.phase === "EVALUATING") {
      return {
        title: "Evaluate submissions",
        description: "Evaluation is permissionless while the evaluation window remains active.",
      };
    }
    return {
      title: "Competition complete",
      description: "This pitch has reached a terminal state.",
    };
  }

  if (!submission.revealed) {
    return pitch.phase === "OPEN"
      ? {
          title: "Submission committed",
          description:
            "Your commitment is recorded. Reveal the exact saved submission during the reveal window.",
        }
      : {
          title: "Reveal your solution",
          description:
            "Your commitment is recorded. Reveal the exact saved submission before the reveal window closes.",
        };
  }
  if (!submission.evaluated && submission.evaluationExpired) {
    return {
      title: "Evaluation expired",
      description: "This revealed submission was not evaluated before the evaluation deadline.",
    };
  }
  if (!submission.evaluated && pitch.phase === "REVEAL") {
    return {
      title: "Reveal complete",
      description:
        "Your submission is revealed. Evaluation becomes available after the reveal window closes.",
    };
  }
  if (!submission.evaluated) {
    return {
      title: "Ready for evaluation",
      description: "Evaluation is now available for this revealed submission.",
    };
  }
  return {
    title: "Evaluation complete",
    description:
      "Your submission has been evaluated. Any reward or bond claim comes from the contract state.",
  };
}

function SubmissionCard({
  pitch,
  criteria,
  submission,
  walletAddress,
  onWrite,
}: {
  pitch: Pitch;
  criteria: Criterion[];
  submission: Submission;
  walletAddress: string | undefined;
  onWrite: (write: ContractWrite, label: string) => void;
}) {
  const [revealBackup, setRevealBackup] = useState<RevealBackup>();
  const agentQuery = useQuery({
    queryKey: ["pitch", "agent", submission.agentId],
    queryFn: () => getAgent(submission.agentId),
    enabled: Boolean(walletAddress),
    staleTime: 60_000,
  });
  const ownSubmission = Boolean(
    walletAddress && submission.agentOwner.toLowerCase() === walletAddress.toLowerCase(),
  );
  const authorizedAgent = Boolean(
    walletAddress &&
    (ownSubmission || agentQuery.data?.operator.toLowerCase() === walletAddress.toLowerCase()),
  );
  const pendingBackup = revealBackup ?? getRevealBackup(pitch.id, submission.agentId);
  const bondClaimable = submission.revealed && !submission.bondClaimed;
  const rewardClaimable = submission.rewardWei > 0n && !submission.rewardClaimed;
  const totalClaimable =
    (bondClaimable ? submission.bondAmountWei : 0n) + (rewardClaimable ? submission.rewardWei : 0n);
  const claimLabel =
    bondClaimable && rewardClaimable
      ? `Claim ${formatGen(totalClaimable)} GEN`
      : bondClaimable
        ? `Claim ${formatGen(submission.bondAmountWei)} GEN entry bond`
        : `Claim ${formatGen(submission.rewardWei)} GEN reward`;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {submission.agentName} · Agent {submission.agentId}
        </p>
        <span className="text-xs text-muted-foreground">Submission {submission.id}</span>
      </div>
      {!submission.revealed ? (
        <>
          {authorizedAgent && pitch.phase === "REVEAL" ? (
            <RevealComposer
              pitch={pitch}
              submission={submission}
              backup={pendingBackup}
              setBackup={setRevealBackup}
              onWrite={onWrite}
            />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Committed · Solution hidden until reveal
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{submission.solution}</p>
          {submission.evidence?.length ? (
            <ul className="mt-3 space-y-1">
              {submission.evidence.map((item, index) => (
                <li key={index} className="truncate text-sm">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    Evidence {index + 1}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {submission.evaluationExpired ? (
            <p className="mt-4 text-sm font-semibold">Evaluation expired</p>
          ) : submission.evaluated ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-semibold">
                {submission.qualified ? "Qualified" : "Not qualified"} · Score {submission.score}
              </p>
              <ul className="mt-2 space-y-1">
                {submission.results?.map((result, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {criteria[index]?.text ?? `Criterion ${index + 1}`} · {result}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Awaiting evaluation</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Entry bond: {formatGen(submission.bondAmountWei)} GEN{" "}
            {bondClaimable ? "refundable" : "claimed"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {walletAddress &&
              pitch.phase === "EVALUATING" &&
              !submission.evaluated &&
              !submission.evaluationExpired && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onWrite(evaluateSubmissionWrite(submission.id), "Evaluate submission")
                  }
                >
                  Evaluate
                </Button>
              )}
          </div>
          {authorizedAgent && (bondClaimable || rewardClaimable) && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/35 p-4">
              <div className="space-y-1 text-xs">
                {bondClaimable && (
                  <p>
                    <span className="font-bold uppercase tracking-[0.12em]">Entry bond claim</span>
                    <span className="ml-2 text-muted-foreground">
                      {formatGen(submission.bondAmountWei)} GEN
                    </span>
                  </p>
                )}
                {rewardClaimable && (
                  <p>
                    <span className="font-bold uppercase tracking-[0.12em]">Reward claim</span>
                    <span className="ml-2 text-muted-foreground">
                      {formatGen(submission.rewardWei)} GEN
                    </span>
                  </p>
                )}
              </div>
              {bondClaimable && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Your submission was revealed successfully. Your entry bond is refundable now.
                  Claiming it does not affect evaluation or your potential reward.
                </p>
              )}
              <Button
                size="sm"
                className="mt-3"
                variant={rewardClaimable && !bondClaimable ? "default" : "outline"}
                onClick={() =>
                  onWrite(
                    claimSubmissionWrite(submission.id),
                    bondClaimable && rewardClaimable
                      ? "Claim bond and reward"
                      : bondClaimable
                        ? "Claim entry bond"
                        : "Claim reward",
                  )
                }
              >
                {claimLabel}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EntryComposer({
  pitch,
  agents,
  onWrite,
}: {
  pitch: Pitch;
  agents: Agent[];
  onWrite: (write: ContractWrite, label: string) => void;
}) {
  const wallet = useWallet();
  const [agentId, setAgentId] = useState("");
  const [operatorAgentId, setOperatorAgentId] = useState("");
  const [solution, setSolution] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [backup, setBackup] = useState<RevealBackup>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const review = async () => {
    setBusy(true);
    setError("");
    try {
      const selectedAgentId = agentId || operatorAgentId.trim();
      if (!selectedAgentId || !solution.trim())
        throw new Error(
          "Choose an active agent or enter its ID as the registered operator, then enter a solution.",
        );
      const evidence = await prepareEvidence(urls.filter(Boolean));
      if (pitch.evidenceRequired && evidence.length === 0)
        throw new Error("This pitch requires at least one browser-content-locked evidence URL.");
      const evidenceBlob = buildEvidenceBlob(evidence);
      const salt = randomSalt();
      const commitment = await buildCommitment(
        pitch.id,
        selectedAgentId,
        solution,
        evidenceBlob,
        salt,
      );
      const next: RevealBackup = {
        version: 1,
        contractAddress: PITCH_CONTRACT_ADDRESS,
        chainId: STUDIO_NEXT_CHAIN_ID,
        pitchId: pitch.id,
        agentId: selectedAgentId,
        solution,
        evidenceBlob,
        salt,
        commitment,
      };
      saveRevealBackup(next);
      setBackup(next);
    } catch (reason) {
      setError(
        normalizePitchError(reason, "We couldn't prepare the evidence for this submission."),
      );
    } finally {
      setBusy(false);
    }
  };
  if (!wallet.address)
    return (
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to enter this pitch with one of your active agents.
        </p>
      </div>
    );
  return (
    <div className="mt-6 space-y-5 border-t border-border pt-5">
      {backup ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Review entry
          </p>
          <p className="text-sm font-semibold">
            {agents.find((agent) => agent.id === backup.agentId)?.name ?? `Agent ${backup.agentId}`}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {backup.solution}
          </p>
          <p className="text-xs text-muted-foreground">
            {backup.evidenceBlob
              ? `${backup.evidenceBlob.split("\n").length} evidence item(s)`
              : "No evidence"}{" "}
            · {formatGen(pitch.entryBondWei)} GEN refundable entry bond
          </p>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs leading-relaxed">
            Download the reveal backup after the commit succeeds. Losing it can prevent reveal and
            forfeit the {formatGen(pitch.entryBondWei)} GEN bond.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="pill" onClick={() => setBackup(undefined)}>
              Edit entry
            </Button>
            <Button
              variant="default"
              size="pill"
              disabled={!wallet.kit || !wallet.connectedClient}
              onClick={() =>
                onWrite(
                  commitSubmissionWrite(pitch.id, backup.agentId, backup.commitment),
                  "Commit solution",
                )
              }
            >
              Commit solution <ArrowRight />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="field-label" htmlFor="entry-agent">
              Choose an active agent
            </label>
            <select
              id="entry-agent"
              className="surface-input"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              <option value="">Select your agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            {!agents.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                No active agents are registered to this wallet.
              </p>
            )}
            <label
              className="mt-4 block text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
              htmlFor="operator-agent-id"
            >
              Registered operator? Enter agent ID
            </label>
            <input
              id="operator-agent-id"
              className="surface-input mt-2"
              inputMode="numeric"
              value={operatorAgentId}
              onChange={(event) => setOperatorAgentId(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Agent ID"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              The contract checks that this wallet is the registered operator.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="entry-solution">
              Your solution
            </label>
            <textarea
              id="entry-solution"
              className="surface-input min-h-[150px] resize-y"
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              placeholder="Describe your approach and deliverables…"
            />
          </div>
          <div>
            <p className="field-label">
              Supporting evidence {pitch.evidenceRequired ? "(required)" : "(optional)"}
            </p>
            {urls.map((url, index) => (
              <div className="mt-2 flex gap-2" key={index}>
                <input
                  type="url"
                  className="surface-input min-w-0"
                  value={url}
                  onChange={(event) =>
                    setUrls(
                      urls.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                  placeholder="https://"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setUrls(urls.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="pill"
              className="mt-3"
              type="button"
              disabled={urls.length >= 5}
              onClick={() => setUrls([...urls, ""])}
            >
              <Plus /> Add evidence URL
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The browser fetches the exact raw bytes and commits their SHA-256. CORS or network
              policy can prevent content-locking; there is no fake hash fallback.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            variant="default"
            size="pill"
            disabled={
              busy ||
              (!agentId && !operatorAgentId.trim()) ||
              !solution.trim() ||
              !wallet.kit ||
              !wallet.connectedClient
            }
            onClick={() => void review()}
          >
            {busy ? "Preparing evidence…" : "Review entry"} <ArrowRight />
          </Button>
        </>
      )}
    </div>
  );
}

function RevealComposer({
  pitch,
  submission,
  backup,
  setBackup,
  onWrite,
}: {
  pitch: Pitch;
  submission: Submission;
  backup: RevealBackup | undefined;
  setBackup: (backup: RevealBackup | undefined) => void;
  onWrite: (write: ContractWrite, label: string) => void;
}) {
  const [error, setError] = useState("");
  const current = backup ?? getRevealBackup(pitch.id, submission.agentId);
  const importBackup = async (file: File) => {
    try {
      const imported = await importRevealBackup(file);
      if (
        imported.pitchId !== pitch.id ||
        imported.agentId !== submission.agentId ||
        imported.commitment !== submission.commitment
      )
        throw new Error("This backup does not match this submission.");
      saveRevealBackup(imported);
      setBackup(imported);
    } catch (reason) {
      setError(normalizePitchError(reason, "We couldn't import this reveal backup."));
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
      <p className="text-sm font-semibold">Reveal this committed solution</p>
      {current ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Backup matches this pitch, agent, and commitment. Reveal uses the exact saved solution,
            evidence blob, and salt.
          </p>
          <Button
            variant="default"
            size="pill"
            className="mt-4"
            onClick={() =>
              onWrite(
                revealSubmissionWrite(
                  submission.id,
                  current.solution,
                  current.evidenceBlob,
                  current.salt,
                ),
                "Reveal solution",
              )
            }
          >
            Reveal solution <ArrowRight />
          </Button>
        </>
      ) : (
        <>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold underline underline-offset-4">
            <Upload size={15} /> Import reveal backup
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBackup(file);
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            The contract intentionally does not store unrevealed solution data. Import the JSON
            backup created after commit.
          </p>
        </>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-primary-foreground/50">
        <Clock3 size={14} /> {label}
      </p>
      <p className="display-font mt-2 text-xl">{value}</p>
    </div>
  );
}
function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function formatGen(wei: bigint) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
