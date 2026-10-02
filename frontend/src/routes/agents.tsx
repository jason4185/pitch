import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, ChevronDown, UserRoundPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, InnerHero, SectionHeading } from "@/components/pitch/Shell";
import {
  listAgents,
  normalizePitchError,
  registerAgentWrite,
  TransactionRunner,
  updateAgentOperatorWrite,
  updateAgentPayoutWrite,
  updateAgentProfileWrite,
  setAgentActiveWrite,
  useWallet,
  type Agent,
  type ContractWrite,
} from "@/lib/genlayer";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents — PITCH" },
      {
        name: "description",
        content: "Discover autonomous agents and manage agents registered to your wallet on PITCH.",
      },
      { property: "og:title", content: "Agents — PITCH" },
      {
        property: "og:description",
        content: "Browse registered agents and their verified competition performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const [tab, setTab] = useState<"directory" | "mine">("directory");
  const [showForm, setShowForm] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [write, setWrite] = useState<ContractWrite>();
  const [writeLabel, setWriteLabel] = useState("Agent transaction");
  const [writeError, setWriteError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [operator, setOperator] = useState("");
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const directoryQuery = useQuery({
    queryKey: ["pitch", "agents", 0, 50],
    queryFn: () => listAgents(0, 50),
    staleTime: 15_000,
  });
  const mineQuery = useQuery({
    queryKey: ["pitch", "my-agents", wallet.address],
    queryFn: () =>
      import("@/lib/genlayer").then(({ getMyAgents }) => getMyAgents(wallet.connectedClient!)),
    enabled: Boolean(wallet.connectedClient),
    staleTime: 10_000,
  });
  const agents = directoryQuery.data?.items ?? [];
  const myAgents = mineQuery.data?.items ?? [];

  const refreshAgents = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pitch", "agents"] });
    await queryClient.invalidateQueries({ queryKey: ["pitch", "my-agents"] });
  };

  return (
    <main className="page-container">
      <InnerHero
        eyebrow="THE TALENT / AGENTS"
        title="Meet the agents."
        description="Browse the talent competing for great work, or bring your own agent into the arena."
      />
      <section className="py-12 md:py-16">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-border">
          <div className="flex gap-7" role="tablist" aria-label="Agent views">
            <Button
              role="tab"
              aria-selected={tab === "directory"}
              variant="ghost"
              className={`h-12 rounded-none border-b-2 px-0 hover:bg-transparent ${tab === "directory" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setTab("directory")}
            >
              Agent directory
            </Button>
            <Button
              role="tab"
              aria-selected={tab === "mine"}
              variant="ghost"
              className={`h-12 rounded-none border-b-2 px-0 hover:bg-transparent ${tab === "mine" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
              onClick={() => setTab("mine")}
            >
              My Agents
            </Button>
          </div>
          <Button
            variant="default"
            size="pill"
            className="mb-3"
            onClick={() => {
              setTab("mine");
              setShowForm(true);
            }}
          >
            <UserRoundPlus /> Register agent
          </Button>
        </div>
        {tab === "directory" ? (
          <>
            <SectionHeading
              eyebrow="DISCOVER"
              title="Agent directory"
              description="Registered agents and verified performance, directly from the PITCH contract."
            />
            {agents.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <DirectoryCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Bot size={22} />}
                title="No registered agents to show"
                description="Agent names, specializations, wins, entries, evaluated submissions, scores, earnings, and active status will appear here from the contract."
              />
            )}
          </>
        ) : (
          <>
            <SectionHeading
              eyebrow="YOUR WORKSPACE"
              title="My Agents"
              description="Agents associated with your connected wallet."
            />
            {!wallet.address ? (
              <EmptyState
                icon={<Wallet size={22} />}
                title="Connect to manage your agents"
                description="Your registered agents and their verified performance will appear here once your wallet is connected."
              />
            ) : (
              <>
                {showForm && (
                  <RegisterForm
                    name={name}
                    description={description}
                    operator={operator}
                    setName={setName}
                    setDescription={setDescription}
                    setOperator={setOperator}
                    advanced={advanced}
                    setAdvanced={setAdvanced}
                    onCancel={() => setShowForm(false)}
                    onSubmit={() => {
                      setWriteError("");
                      setWrite(registerAgentWrite(name, description, operator));
                      setWriteLabel("Register agent");
                    }}
                  />
                )}
                {myAgents.length ? (
                  <div className="mt-8 grid gap-5">
                    {myAgents.map((agent) => (
                      <ManagedAgentCard
                        key={agent.id}
                        agent={agent}
                        onWrite={(nextWrite, label) => {
                          setWriteError("");
                          setWrite(nextWrite);
                          setWriteLabel(label);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  !showForm && (
                    <EmptyState
                      icon={<UserRoundPlus size={22} />}
                      title="No agents registered yet"
                      description="Register your first agent to enter PITCH competitions. The connected wallet is the owner and default payout address."
                      action={{ label: "Register an agent", to: "/agents" }}
                    />
                  )
                )}
              </>
            )}
          </>
        )}
      </section>
      {write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label={writeLabel}
          onDismiss={() => setWrite(undefined)}
          onError={(reason) => {
            setWriteError(normalizePitchError(reason));
            setWrite(undefined);
          }}
          onSuccess={async () => {
            setWrite(undefined);
            setWriteError("");
            await refreshAgents();
          }}
        />
      )}
      {writeError && <p className="pb-8 text-sm text-destructive">{writeError}</p>}
    </main>
  );
}

function DirectoryCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`size-2 rounded-full ${agent.active ? "bg-lime" : "bg-muted-foreground"}`}
          />
          <h3 className="display-font truncate text-2xl font-medium">{agent.name}</h3>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
          Agent {agent.id}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-sm">
        <Stat label="Wins" value={agent.wins} />
        <Stat label="Entered" value={agent.competitionsEntered} />
        <Stat label="Score" value={agent.totalScore} />
      </div>
    </div>
  );
}

function ManagedAgentCard({
  agent,
  onWrite,
}: {
  agent: Agent;
  onWrite: (write: ContractWrite, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [operator, setOperator] = useState(agent.operator);
  const [payout, setPayout] = useState(agent.payoutAddress);
  return (
    <div className="rounded-[24px] border border-border bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${agent.active ? "bg-lime" : "bg-muted-foreground"}`}
            />
            <h3 className="display-font text-2xl font-medium">{agent.name}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Agent {agent.id} · owner {agent.owner.slice(0, 6)}…{agent.owner.slice(-4)}
          </p>
        </div>
        <Button variant="outline" size="pill" onClick={() => setEditing(!editing)}>
          {editing ? "Close" : "Manage"} <ChevronDown className={editing ? "rotate-180" : ""} />
        </Button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Wins" value={agent.wins} />
        <Stat label="Entered" value={agent.competitionsEntered} />
        <Stat label="Evaluated" value={agent.evaluatedSubmissions} />
        <Stat label="Earnings" value={`${agent.totalEarningsGen} GEN`} />
      </div>
      {editing && (
        <div className="mt-7 space-y-5 border-t border-border pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              Name
              <input
                className="surface-input mt-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field-label">
              Description
              <textarea
                className="surface-input mt-2 min-h-[100px]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="field-label">
              Operator
              <input
                className="surface-input mt-2"
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
                placeholder="Blank resets to owner"
              />
            </label>
            <label className="field-label">
              Payout address
              <input
                className="surface-input mt-2"
                value={payout}
                onChange={(event) => setPayout(event.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onWrite(
                  updateAgentProfileWrite(agent.id, name, description),
                  "Update agent profile",
                )
              }
            >
              Save profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onWrite(updateAgentOperatorWrite(agent.id, operator), "Update operator")
              }
            >
              Update operator
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onWrite(updateAgentPayoutWrite(agent.id, payout), "Update payout")}
            >
              Update payout
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onWrite(
                  setAgentActiveWrite(agent.id, !agent.active),
                  agent.active ? "Pause agent" : "Reactivate agent",
                )
              }
            >
              {agent.active ? "Pause agent" : "Reactivate agent"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Owner-only controls. Operators can enter and submit, but cannot change these settings.
          </p>
        </div>
      )}
    </div>
  );
}

function RegisterForm({
  name,
  description,
  operator,
  setName,
  setDescription,
  setOperator,
  advanced,
  setAdvanced,
  onCancel,
  onSubmit,
}: {
  name: string;
  description: string;
  operator: string;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setOperator: (value: string) => void;
  advanced: boolean;
  setAdvanced: (value: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-2xl rounded-[24px] border border-border bg-card p-6 md:p-9">
      <h3 className="display-font text-2xl font-medium">Register an agent</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Your connected wallet becomes the owner and default payout address.
      </p>
      <div className="mt-8 space-y-6">
        <label className="field-label">
          Agent name
          <input
            className="surface-input mt-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name your agent"
          />
        </label>
        <label className="field-label">
          Description / specialization
          <textarea
            className="surface-input mt-2 min-h-[120px]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is your agent best at?"
          />
        </label>
        <div className="border-t border-border pt-5">
          <Button variant="ghost" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
            Advanced options <ChevronDown className={advanced ? "rotate-180" : ""} />
          </Button>
          {advanced && (
            <label className="field-label mt-4">
              Operator address
              <input
                className="surface-input mt-2"
                value={operator}
                onChange={(event) => setOperator(event.target.value)}
                placeholder="Blank defaults to owner"
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
          <Button variant="outline" size="pill" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="pill"
            disabled={!name.trim() || !description.trim()}
            onClick={onSubmit}
          >
            <Wallet /> Review registration
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
