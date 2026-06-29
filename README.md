# Referral Opportunity Engine

> When a trades pro closes a job, the engine detects an adjacent cross-trade referral opportunity, retrieves the best in-network partner from a federated brand-and-geography graph, validates the routing with a committee of diverse judge-agents under a `δ < ε` convergence gate, drafts the customer handoff — and auto-routes confident referrals while escalating ambiguous ones to a human.

A working prototype of a marketplace **activation** loop for the home-services trades: turning every completed job into the *right* cross-trade referral, automatically and safely.

## The problem it targets

In a trades referral network (e.g. a Mr. Rooter plumber who spots water damage and should hand the customer to a restoration partner), the value leaks whenever a completed job *doesn't* become a referral. The growth metric that matters is **activation** — referrals generated per completed job, and locations that fire at least one referral a month. This engine attacks that gap by making the referral happen on its own, with a trust gate so automation doesn't degrade quality.

## How it works

```
Completed job event
   │
   ▼
1. Opportunity Detector ─ is there a cross-trade referral? to which trade?
   │
   ▼
2. Partner Retriever  ◄─ Federated retrieval
   │                     ├─ Brand-capability subgraph (19 Neighborly brands → trades → adjacencies)
   │                     └─ Local partner graph (capability sheets + reviews; pgvector)
   ▼
3. Routing Validator (committee)  ─ diverse judges score pairwise → δ<ε convergence gate   ★ showpiece
   │
   ▼
4. Handoff Composer  ─ drafts the customer message + internal referral record
   │
   ▼
   HUMAN GATE: [ Send ] [ Edit ] [ Skip ]
   │
   ▼
   Referral fired (simulated) + audit log + outcome → eval calibration
```

## The showpiece: a convergence-gated committee

The routing decision is fuzzy and has no ground-truth answer, so a single model's pick is untrustworthy. Instead a **committee of deliberately diverse judge-agents** each scores the candidate partners; we compute pairwise distance `δ` between their preference vectors and **only auto-route when the committee converges (`δ < ε`)** — otherwise we escalate to a human. The gate, the pairwise comparison, and the commit-reveal independence are adapted from Tim Cotten's **Commit-Reveal Pairwise Comparison Protocol (CRPC)**, lifted from trustless verification into routing-decision confidence.

Judge diversity is *real*, not cosmetic: each judge is an explicit **criteria-weight vector** (over fit / capacity / proximity / conversion), initialized from an `OCEAN` personality prior and ideally run across **different model families** — the evidence-backed sources of useful disagreement. (See `docs/research/`.)

## Status

Prototype. Runs locally for a live walkthrough. Real retrieval (PGlite + pgvector), real committee, scripted job-close scenarios; referral delivery and outcomes are simulated. Live Google Places, auth, and deployment are roadmap, not in this build.

## Stack

TypeScript · Bun · Next.js (App Router) · PGlite (embedded Postgres + pgvector, no Docker) · provider-agnostic LLM/embeddings adapter (OpenRouter for a cross-family judge panel; OpenAI or local MiniLM for embeddings).

## Run it

> **Node ≥ 20 required** (Next 15). If your default `node` is older, use `./run.sh`
> (auto-selects an nvm Node ≥ 20) or run `nvm use` first — there's an `.nvmrc`.

```bash
bun install
cp .env.example .env    # add OPENROUTER_API_KEY (judges) and/or OPENAI_API_KEY (embeddings)
                        # — both optional; the engine runs deterministically with neither
./run.sh seed          # warms the embedded pgvector store (optional; the app self-seeds)
./run.sh dev           # → http://localhost:3000    (or: nvm use && bun run dev)
```

Pick a scenario and watch the pipeline run. On the **abstains** scenario, drag the `ε` knob to flip the committee between auto-route and escalate — the interactive heart of the demo.

- **OpenRouter key** → the five judges run across different model families (the evidence-backed diversity).
- **OpenAI-only key** → judges run on one model (no family diversity); embeddings are semantic.
- **No key** → fully deterministic: detector by graph + keywords, judges by their criteria-weights. The three-scenario arc still holds, so the demo never depends on the network.

### Verify (no key required)

```bash
bun test                   # committee δ<ε math + the three-scenario behavior
bun run scripts/smoke.ts   # the full pipeline end-to-end on each scenario
```

## Docs

- `docs/specs/2026-06-29-referral-opportunity-engine-design.md` — the full design spec (source of truth).
- `docs/research/2026-06-29-judge-panel-design-research.md` — evidence base for the judge-committee design.

## Credits / prior art

This build engages directly with Tim Cotten's published work — the **CRPC** protocol (the convergence gate), the **Autonomous Virtual Beings (AVB)** framing (agents with agency, not chatbots), and the **Five Factor Model** (`scryptedinc/ffm`, used as inspiration for the personality prior, not as a dependency). Where this engine *extends* his ideas, those leaps are named explicitly in the spec.
