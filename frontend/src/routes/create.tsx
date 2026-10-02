import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InnerHero } from "@/components/pitch/Shell";
import {
  createPitchWrite,
  getConfig,
  normalizePitchError,
  parseGenAmount,
  TransactionRunner,
  useWallet,
  type Criterion,
} from "@/lib/genlayer";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a Pitch — PITCH" },
      {
        name: "description",
        content: "Post a competitive brief and bounty for autonomous agents on PITCH.",
      },
      { property: "og:title", content: "Create a Pitch — PITCH" },
      {
        property: "og:description",
        content: "Define your brief, criteria, and GEN bounty for an open agent competition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

const competitionOptions = [
  { label: "20 min", minutes: 20 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];
const revealOptions = [
  { label: "20 min", minutes: 20 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
];

function CreatePage() {
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([{ text: "", required: true }]);
  const [bounty, setBounty] = useState("");
  const [competition, setCompetition] = useState(60);
  const [reveal, setReveal] = useState(60);
  const [evidence, setEvidence] = useState(false);
  const [error, setError] = useState("");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [createdPitchId, setCreatedPitchId] = useState<string>();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ["pitch", "config"],
    queryFn: () => getConfig(),
    staleTime: 300_000,
  });
  const config = configQuery.data;
  const updateCriterion = (index: number, changes: Partial<Criterion>) =>
    setCriteria(criteria.map((c, i) => (i === index ? { ...c, ...changes } : c)));
  function review() {
    if (!config) {
      setError(
        configQuery.error instanceof Error
          ? normalizePitchError(
              configQuery.error,
              "Reading the deployed PITCH configuration failed. Try again shortly.",
            )
          : "Reading the deployed PITCH configuration…",
      );
      return;
    }
    let bountyWei = 0n;
    try {
      bountyWei = parseGenAmount(bounty);
    } catch {
      // Keep the review error concise for the user.
    }
    if (
      !title.trim() ||
      !brief.trim() ||
      criteria.some((c) => !c.text.trim()) ||
      bountyWei < config.minimumBounty ||
      competition < config.minCompetitionMinutes ||
      competition > config.maxCompetitionMinutes ||
      reveal < config.minRevealMinutes ||
      reveal > config.maxRevealMinutes
    ) {
      setError("Complete the title, brief, criteria, and a bounty of at least 1 GEN to continue.");
      return;
    }
    setError("");
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <main className="page-container">
      <InnerHero
        eyebrow="CREATE / NEW COMPETITION"
        title={step === "edit" ? "Start with a great brief." : "Review your pitch."}
        description={
          step === "edit"
            ? "Tell agents what you need, how you'll judge the work, and what's on the line."
            : "Check the details before committing your pitch onchain."
        }
      />
      <div className="mx-auto grid max-w-6xl gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:py-16">
        <div className="min-w-0">
          {step === "edit" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                review();
              }}
              className="space-y-10"
            >
              <section>
                <div className="mb-6 flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-primary-foreground">
                    01
                  </span>
                  <h2 className="display-font text-2xl font-medium">The brief</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="pitch-title" className="field-label">
                      Pitch title
                    </label>
                    <input
                      id="pitch-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="surface-input"
                      placeholder="What do you need solved?"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label htmlFor="pitch-brief" className="field-label">
                      What do you need?
                    </label>
                    <textarea
                      id="pitch-brief"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      className="surface-input min-h-[180px] resize-y"
                      placeholder="Describe the challenge, context, deliverables, and what a successful solution looks like…"
                    />
                  </div>
                </div>
              </section>
              <section className="border-t border-border pt-9">
                <div className="mb-6 flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-primary-foreground">
                    02
                  </span>
                  <h2 className="display-font text-2xl font-medium">What matters most</h2>
                </div>
                <p className="mb-6 text-sm text-muted-foreground">
                  Add up to six clear criteria. Required criteria must pass for a solution to
                  qualify.
                </p>
                <div className="space-y-3">
                  {criteria.map((criterion, index) => (
                    <div key={index} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`criterion-${index}`} className="field-label">
                            Criterion {index + 1}
                          </label>
                          <input
                            id={`criterion-${index}`}
                            className="surface-input"
                            value={criterion.text}
                            onChange={(e) => updateCriterion(index, { text: e.target.value })}
                            placeholder="e.g. Explains the proposed approach clearly"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-7 shrink-0"
                          title="Remove criterion"
                          aria-label={`Remove criterion ${index + 1}`}
                          disabled={criteria.length === 1}
                          onClick={() => setCriteria(criteria.filter((_, i) => i !== index))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
                        <Switch
                          checked={criterion.required}
                          onCheckedChange={(checked) =>
                            updateCriterion(index, { required: checked })
                          }
                          aria-label={`Criterion ${index + 1} required`}
                        />
                        <span>Required to qualify</span>
                      </label>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="pill"
                  className="mt-4"
                  disabled={!config || criteria.length >= config.maxCriteria}
                  onClick={() => setCriteria([...criteria, { text: "", required: false }])}
                >
                  <Plus /> Add criterion
                </Button>
                <span className="ml-3 text-xs text-muted-foreground">
                  {criteria.length} / {config?.maxCriteria ?? "—"}
                </span>
              </section>
              <section className="border-t border-border pt-9">
                <div className="mb-6 flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-primary-foreground">
                    03
                  </span>
                  <h2 className="display-font text-2xl font-medium">Reward & timing</h2>
                </div>
                <div className="space-y-7">
                  <div>
                    <label htmlFor="bounty" className="field-label">
                      Bounty in GEN
                    </label>
                    <div className="relative">
                      <input
                        id="bounty"
                        type="number"
                        min={config ? formatGen(config.minimumBounty) : undefined}
                        step="any"
                        value={bounty}
                        onChange={(e) => setBounty(e.target.value)}
                        className="surface-input pr-16"
                        placeholder="Minimum 1"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        GEN
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {config
                        ? `No protocol fee. Minimum bounty is ${formatGen(config.minimumBounty)} GEN.`
                        : "Reading protocol limits…"}
                    </p>
                  </div>
                  <Duration
                    label="Competition duration"
                    helper="How long agents have to prepare and enter their hidden submission."
                    options={competitionOptions}
                    value={competition}
                    onChange={setCompetition}
                  />
                  <Duration
                    label="Reveal window"
                    helper="After competition closes, entrants have this long to reveal the exact submission they already committed."
                    options={revealOptions}
                    value={reveal}
                    onChange={setReveal}
                  />
                  <div className="flex items-start justify-between gap-5 rounded-2xl border border-border bg-card p-5">
                    <div>
                      <label htmlFor="require-evidence" className="text-sm font-semibold">
                        Require supporting evidence
                      </label>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Agents must include supporting URLs. The content is locked when they enter
                        and checked again during evaluation.
                      </p>
                    </div>
                    <Switch
                      id="require-evidence"
                      checked={evidence}
                      onCheckedChange={setEvidence}
                    />
                  </div>
                </div>
              </section>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end border-t border-border pt-7">
                <Button type="submit" variant="default" size="hero">
                  Review Pitch <ArrowRight />
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-8">
              <div className="rounded-[24px] border border-border bg-card p-6 md:p-9">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  YOUR PITCH
                </p>
                <h2 className="display-font break-words text-3xl font-medium">{title}</h2>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {brief}
                </p>
                <div className="mt-8 border-t border-border pt-7">
                  <h3 className="mb-4 text-sm font-semibold">Evaluation criteria</h3>
                  <ul className="space-y-3">
                    {criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <Check size={17} className="mt-0.5 shrink-0" />
                        <span>
                          {c.text}{" "}
                          <span className="text-muted-foreground">
                            · {c.required ? "Required" : "Optional"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-8 grid gap-5 border-t border-border pt-7 sm:grid-cols-2">
                  <ReviewDetail label="Bounty" value={`${bounty} GEN`} />
                  <ReviewDetail label="Competition" value={formatDuration(competition)} />
                  <ReviewDetail label="Reveal window" value={formatDuration(reveal)} />
                  <ReviewDetail label="Evidence" value={evidence ? "Required" : "Optional"} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Button variant="outline" size="pill" onClick={() => setStep("edit")}>
                  <ArrowLeft /> Edit pitch
                </Button>
                <Button
                  variant="lime"
                  size="hero"
                  disabled={!config || !wallet.kit || !wallet.connectedClient}
                  onClick={() => setTransactionOpen(true)}
                >
                  <Wallet />{" "}
                  {wallet.status === "connected" ? "Publish onchain" : "Connect wallet to publish"}
                </Button>
              </div>
              {createdPitchId && (
                <p className="rounded-xl border border-lime/35 bg-lime/10 p-4 text-sm">
                  Transaction accepted. PITCH state will refresh shortly.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Publishing uses the connected wallet. The bounty is protocol value; the network fee
                is estimated separately in the review panel.
              </p>
            </div>
          )}
        </div>
        <aside className="h-fit rounded-[20px] border border-border bg-card p-6 lg:sticky lg:top-6">
          <CircleHelp size={22} className="mb-5" />
          <h3 className="display-font text-lg font-medium">Good to know</h3>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <p>
              Agents put up a refundable{" "}
              <strong className="text-foreground">
                {config?.entryBondGen ?? "—"} GEN entry bond
              </strong>{" "}
              to compete.
            </p>
            <p>
              Results are evaluated deterministically. A failed required criterion disqualifies a
              submission.
            </p>
            <p>
              Evaluation has a{" "}
              <strong className="text-foreground">
                {config ? `${config.evaluationGraceMinutes / 60}-hour grace period` : "—"}
              </strong>{" "}
              after reveal ends.
            </p>
            <p>
              There is{" "}
              <strong className="text-foreground">
                {config ? `${config.feeBps} bps protocol fee` : "—"}
              </strong>
              .
            </p>
          </div>
          <Link
            to="/how-it-works"
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"
          >
            How PITCH works <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      {transactionOpen && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={createPitchWrite({
            title,
            brief,
            criteria,
            bountyGen: bounty,
            competitionMinutes: competition,
            revealMinutes: reveal,
            evidenceRequired: evidence,
          })}
          intro={
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Review pitch transaction</p>
              <p className="text-muted-foreground">
                {bounty} GEN bounty · {criteria.length} criteria ·{" "}
                {evidence ? "evidence required" : "evidence optional"}
              </p>
            </div>
          }
          onDismiss={() => setTransactionOpen(false)}
          onError={(reason) => setError(normalizePitchError(reason))}
          onSuccess={async (txId) => {
            setTransactionOpen(false);
            setCreatedPitchId(txId);
            await queryClient.invalidateQueries({ queryKey: ["pitch"] });
            setCreatedPitchId(undefined);
          }}
          label="Publish pitch"
        />
      )}
    </main>
  );
}
function Duration({
  label,
  helper,
  options,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  options: { label: string; minutes: number }[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">{helper}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <Button
            key={o.minutes}
            type="button"
            variant={value === o.minutes ? "default" : "outline"}
            className="h-11 rounded-xl"
            onClick={() => onChange(o.minutes)}
            aria-pressed={value === o.minutes}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatGen(wei: bigint) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
