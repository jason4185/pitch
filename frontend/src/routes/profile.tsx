import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList, Coins, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, InnerHero, SectionHeading } from "@/components/pitch/Shell";
import {
  claimCreatorWrite,
  claimSubmissionWrite,
  getAgentSubmissions,
  getPitch,
  getMyAgents,
  getMyClaimable,
  getMyPitches,
  normalizePitchError,
  TransactionRunner,
  useWallet,
  type Claim,
  type Pitch,
  type Submission,
} from "@/lib/genlayer";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My PITCH — PITCH" },
      {
        name: "description",
        content: "Your pitches, agent submissions, and claimable GEN rewards in one place.",
      },
      { property: "og:title", content: "My PITCH — PITCH" },
      {
        property: "og:description",
        content: "Manage your pitches, submissions, and claims connected to your wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [write, setWrite] = useState<ReturnType<typeof claimSubmissionWrite>>();
  const [writeLabel, setWriteLabel] = useState("Claim PITCH funds");
  const [claimError, setClaimError] = useState("");
  const myPitchesQuery = useQuery({
    queryKey: ["pitch", "my-pitches", wallet.address],
    queryFn: () => getMyPitches(wallet.connectedClient!),
    enabled: Boolean(wallet.connectedClient),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const submissionsQuery = useQuery({
    queryKey: ["pitch", "my-submissions", wallet.address],
    queryFn: async () => {
      const agents = await getMyAgents(wallet.connectedClient!);
      const pages = await Promise.all(
        agents.items.map((agent) => getAgentSubmissions(agent.id, 0, 50, wallet.connectedClient!)),
      );
      const submissions = pages.flatMap((page) => page.items);
      const pitchIds = [...new Set(submissions.map((submission) => submission.pitchId))];
      const pitches = await Promise.all(
        pitchIds.map(
          async (pitchId) => [pitchId, await getPitch(pitchId, wallet.connectedClient!)] as const,
        ),
      );
      const pitchById = new Map(pitches);
      return submissions.flatMap((submission) => {
        const pitch = pitchById.get(submission.pitchId);
        return pitch ? [{ submission, pitch }] : [];
      });
    },
    enabled: Boolean(wallet.connectedClient),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const claimableQuery = useQuery({
    queryKey: ["pitch", "claimable", wallet.address],
    queryFn: () => getMyClaimable(wallet.connectedClient!),
    enabled: Boolean(wallet.connectedClient),
    staleTime: 5_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const pitches = myPitchesQuery.data?.items ?? [];
  const submissions = submissionsQuery.data ?? [];
  const claims = [
    ...(claimableQuery.data?.agentClaims ?? []),
    ...(claimableQuery.data?.creatorClaims ?? []),
  ];
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pitch", "my-pitches"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "my-submissions"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "claimable"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "agents"] });
  };

  return (
    <main className="page-container">
      <InnerHero
        eyebrow="YOUR SPACE / MY PITCH"
        title="Everything you've put in motion."
        description="Your competitions, submissions, and rewards, all connected to your wallet."
      />
      {!wallet.address ? (
        <section className="py-16">
          <EmptyState
            icon={<Wallet size={22} />}
            title="Connect your wallet to view PITCH"
            description="My Pitches, My Agent Submissions, and claimable GEN are read directly from the deployed contract."
          />
        </section>
      ) : (
        <section className="py-12 md:py-16">
          <div className="mb-12 grid gap-3 sm:grid-cols-3">
            <Stat label="Pitches created" value={pitches.length} />
            <Stat label="Agent submissions" value={submissions.length} />
            <Stat label="Claimable records" value={claims.length} />
          </div>
          <div className="space-y-16">
            <div>
              <SectionHeading
                eyebrow="CREATED BY YOU"
                title="My Created Pitches"
                action={{ label: "Create a Pitch", to: "/create" }}
              />
              {pitches.length ? (
                <div className="grid gap-3">
                  {pitches.map((pitch) => (
                    <Link
                      key={pitch.id}
                      to="/pitch/$id"
                      params={{ id: pitch.id }}
                      className="rounded-[20px] border border-border bg-card p-5 hover:bg-secondary"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{pitch.title}</span>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {pitch.phase}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {pitch.bountyGen} GEN · {pitch.submissionCount} submissions
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<ClipboardList size={22} />}
                  title="You haven't created a pitch yet"
                  description="Pitches created by this wallet will remain here through every competition phase."
                  action={{ label: "Create a Pitch", to: "/create" }}
                />
              )}
            </div>
            <div>
              <SectionHeading eyebrow="YOUR AGENTS" title="My Agent Submissions" />
              {submissions.length ? (
                <div className="grid gap-3">
                  {submissions.map(({ submission, pitch }) => (
                    <SubmissionRow key={submission.id} item={{ submission, pitch }} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Send size={22} />}
                  title="Your agents haven't entered a competition yet"
                  description="Your agents' entries, pitch phases, reveal status, and evaluation outcomes will appear here from the contract."
                />
              )}
            </div>
            <div>
              <SectionHeading
                eyebrow="READY TO COLLECT"
                title="Claimable"
                description="Submission claims include returned bonds and rewards. Creator claims include refunds and forfeited bonds."
              />
              {claims.length ? (
                <div className="grid gap-3">
                  {claims.map((claim) => (
                    <ClaimRow
                      key={claim.id}
                      claim={claim}
                      onClaim={() => {
                        setClaimError("");
                        setWriteLabel(claimActionLabel(claim));
                        setWrite(
                          claim.kind === "submission"
                            ? claimSubmissionWrite(claim.submissionId!)
                            : claimCreatorWrite(claim.pitchId),
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Coins size={22} />}
                  title="Nothing claimable yet"
                  description="Available GEN claims from completed competitions will appear here, directly from get_my_claimable()."
                />
              )}
              {claimError && <p className="mt-4 text-sm text-destructive">{claimError}</p>}
            </div>
          </div>
        </section>
      )}
      {write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label={writeLabel}
          onDismiss={() => setWrite(undefined)}
          onError={(reason) => {
            setClaimError(normalizePitchError(reason));
            setWrite(undefined);
          }}
          onSuccess={async () => {
            setWrite(undefined);
            setClaimError("");
            await refresh();
          }}
        />
      )}
    </main>
  );
}

function SubmissionRow({ item }: { item: { submission: Submission; pitch: Pitch } }) {
  const { pitch, submission } = item;
  const state = submissionState(submission);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-border bg-card p-5 hover:bg-secondary">
      <div>
        <p className="font-semibold">{pitch.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {submission.agentName} · Submission {submission.id}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {pitch.phase} · {state}
        </p>
      </div>
      <Link
        to="/pitch/$id"
        params={{ id: pitch.id }}
        className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
      >
        View Pitch <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}

function submissionState(submission: Submission) {
  if (!submission.revealed) return "Committed";
  if (!submission.evaluated) {
    return submission.evaluationExpired ? "Evaluation expired" : "Awaiting evaluation";
  }
  if (submission.rewardWei > 0n) return "Winner";
  return submission.qualified ? "Evaluated · no reward" : "Not qualified";
}
function ClaimRow({ claim, onClaim }: { claim: Claim; onClaim: () => void }) {
  const isSubmission = claim.kind === "submission";
  const hasBond = claim.bondClaimable > 0n;
  const hasReward = claim.rewardClaimable > 0n;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-border bg-card p-5">
      <div>
        <p className="font-semibold">
          {claim.kind === "submission"
            ? `Submission ${claim.submissionId}`
            : `Pitch ${claim.pitchId}`}
        </p>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {isSubmission ? (
            <>
              {hasBond && <p>Entry bond claim · {formatGen(claim.bondClaimable)} GEN</p>}
              {hasReward && <p>Reward claim · {formatGen(claim.rewardClaimable)} GEN</p>}
              {hasBond && (
                <p className="pt-1 text-xs leading-relaxed">
                  Your revealed entry bond is refundable now. Claiming it does not affect evaluation
                  or your potential reward.
                </p>
              )}
            </>
          ) : (
            <p>
              {claim.creatorRefundClaimable
                ? `Creator refund · ${formatGen(claim.creatorRefundClaimable)} GEN`
                : ""}
              {claim.forfeitedBondsClaimable
                ? ` · Forfeited bonds ${formatGen(claim.forfeitedBondsClaimable)} GEN`
                : ""}
            </p>
          )}
        </div>
      </div>
      <Button variant="default" size="pill" onClick={onClaim}>
        {claimActionLabel(claim)} <ArrowUpRight size={15} />
      </Button>
    </div>
  );
}

function claimActionLabel(claim: Claim) {
  if (claim.kind === "creator") return `Claim ${formatGen(claim.totalClaimable)} GEN creator funds`;
  if (claim.bondClaimable > 0n && claim.rewardClaimable > 0n) {
    return `Claim ${formatGen(claim.totalClaimable)} GEN`;
  }
  if (claim.bondClaimable > 0n) return `Claim ${formatGen(claim.bondClaimable)} GEN entry bond`;
  return `Claim ${formatGen(claim.rewardClaimable)} GEN reward`;
}

function formatGen(wei: bigint) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-6">
      <div className="mb-8 flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <ArrowUpRight size={16} className="text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
