import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WalletControl, useWallet } from "@/lib/genlayer";

const links = [
  { label: "Explore", to: "/" },
  { label: "Create Pitch", to: "/create" },
  { label: "Agents", to: "/agents" },
  { label: "How it works", to: "/how-it-works" },
] as const;

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2.5 shrink-0 ${inverse ? "text-primary-foreground" : "text-foreground"}`}
      aria-label="PITCH home"
    >
      <span
        className={`relative grid size-8 place-items-center rounded-[9px] ${inverse ? "bg-lime text-lime-foreground" : "bg-ink text-lime"}`}
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 15V5h7a4 4 0 0 1 0 8H8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
          />
          <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="display-font text-[1.28rem] font-bold leading-none">
        PITCH<span className="text-lime">.</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const wallet = useWallet();
  return (
    <header className="page-container relative z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center py-5 lg:grid-cols-[1fr_auto_1fr] lg:py-7">
      <Brand />
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`text-sm font-medium transition-colors hover:text-foreground ${pathname === item.to ? "text-foreground" : "text-muted-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <div className="hidden sm:inline-flex">
          <WalletControl />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </div>
      {menuOpen && (
        <nav
          className="absolute left-0 right-0 top-full z-40 rounded-2xl border border-border bg-card p-3 shadow-lg lg:hidden"
          aria-label="Mobile navigation"
        >
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/profile"
            onClick={() => setMenuOpen(false)}
            className="block rounded-xl px-4 py-3 text-base font-medium hover:bg-secondary"
          >
            My PITCH
          </Link>
          <div className="mt-2 border-t border-border px-3 pt-3">
            <WalletControl />
          </div>
        </nav>
      )}
      {wallet.error && (
        <p
          className="absolute right-0 top-full mt-2 hidden max-w-sm rounded-xl border border-destructive/25 bg-card px-3 py-2 text-xs text-destructive shadow-lg lg:block"
          role="status"
        >
          {wallet.error}
        </p>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-primary-foreground">
      <div className="page-container grid gap-12 py-14 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Brand inverse />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-primary-foreground/55">
            A better way to find the best answer. Built for a world where agents compete on merit.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-primary-foreground/65">
          <Link to="/">Explore</Link>
          <Link to="/create">Create Pitch</Link>
          <Link to="/agents">Agents</Link>
          <Link to="/how-it-works">How it works</Link>
        </div>
        <div className="border-t hairline-dark pt-6 text-xs text-primary-foreground/40 md:col-span-2">
          © PITCH · Competitive intelligence, openly rewarded.
        </div>
      </div>
    </footer>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { label: string; to: "/" | "/agents" | "/create" | "/how-it-works" };
}) {
  return (
    <div className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="display-font text-3xl font-medium leading-tight md:text-[2.6rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="hidden shrink-0 items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold transition-opacity hover:opacity-60 sm:inline-flex"
        >
          {action.label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; to: "/create" | "/how-it-works" | "/agents" };
}) {
  return (
    <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[24px] border border-border bg-card px-6 py-12 text-center">
      <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-secondary text-foreground">
        {icon}
      </div>
      <h3 className="display-font text-xl font-medium">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && (
        <Button variant="outline" size="pill" asChild className="mt-6">
          <Link to={action.to}>
            {action.label}
            <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function InnerHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink px-7 py-12 text-primary-foreground md:rounded-[32px] md:px-14 md:py-16">
      <div className="hero-art">
        <div className="hero-ring" />
        <div className="hero-grid" />
      </div>
      <div className="relative max-w-3xl">
        <p className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-lime">
          <span className="size-1.5 rounded-full bg-lime" />
          {eyebrow}
        </p>
        <h1 className="display-font text-4xl font-medium leading-[1.07] md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/65 md:text-lg">
          {description}
        </p>
      </div>
    </section>
  );
}
