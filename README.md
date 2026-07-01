# Referral Opportunity Engine

> When a trades pro closes a job, the engine detects an adjacent cross-trade referral opportunity, retrieves the best in-network partner from a federated brand-and-geography graph, puts the routing to a **jury of diverse LLM judges** and measures their concordance, drafts the customer handoff — and auto-routes confident referrals while escalating ambiguous ones to a human.

A working prototype of a marketplace **activation** loop for the home-services trades: turning every completed job into the *right* cross-trade referral, automatically and safely.

## The problem it targets

In a trades referral network (e.g. a Mr. Rooter plumber who spots water damage and should hand the customer to a restoration partner), the value leaks whenever a completed job *doesn't* become a referral. The growth metric that matters is **activation** — referrals generated per completed job, and locations that fire at least one referral a month. This engine attacks that gap by making the referral happen on its own, with an agreement gate so automation doesn't degrade quality.

## How it works

```
Completed job event
   │
   ▼
1. Opportunity Detector ─ is there a cross-trade referral? to which trade?
   │
   ▼
2. Partner Retriever  ◄─ Hybrid retrieval (BM25 + pgvector)
   │                     ├─ Brand-capability subgraph (19 Neighborly brands → trades → adjacencies)
   │                     └─ Local partner graph (capability sheets + reviews)
   ▼
3. Jury (Panel of LLM judges)  ─ diverse judges rank candidates → Kendall's W concordance gate   ★ showpiece
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

## The showpiece: a jury with a concordance gate

The routing decision is fuzzy and has no ground-truth answer, so a single model's pick is untrustworthy. Instead we convene a **jury** — a **Panel of LLM judges (PoLL)** — in which each judge independently *ranks* the candidate partners. Two questions decide what happens next:

1. **Do the judges agree?** We measure jury concordance with **Kendall's *W*** (the coefficient of concordance), a standard rank-agreement statistic in `[0, 1]`: `W = 1` is a unanimous ranking, `W = 0` is no agreement at all.
2. **Who wins?** We aggregate the individual rankings into a consensus order by **Borda count**, and check that the top-ranked partner clears the runner-up by a margin.

**The decision.** Auto-route when concordance clears a required-agreement threshold **and** the Borda winner clears the runner-up by the top-1 margin guard; otherwise escalate to a human. The threshold is a **live UI slider** (default `0.6`) that reads as *"how unanimous must the jury be before we let it route on its own."*

The PoLL design follows Verga et al. 2024, *"Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models"* ([arXiv:2404.18796](https://arxiv.org/abs/2404.18796)): five personality-diverse judges run across **different model families**, because the diversity is the load-bearing part — disjoint model families don't share blind spots, so their *agreement* actually carries information. Kendall's *W* is from Kendall & Babington Smith (1939). (See `docs/research/`.)

Judge diversity is *real*, not cosmetic: each judge is an explicit **criteria-weight vector** (over fit / capacity / proximity / conversion) initialized deterministically from an **OCEAN / Big Five** personality prior. The models are never told to "act neurotic" — persona-prompting degrades reasoning and only fakes diversity. The personality sets the weights in code; the model families supply the independence.

**Agreement is not correctness.** Kendall's *W* measures whether the judges *concur*, not whether they are *right* — correlated bias across judges can inflate concordance. That is exactly why the judges span different model families (to keep their errors from lining up) and why the **human gate** stays as the correctness backstop. *W* decides whether to *defer*, not whether the answer is true.

## Status

Prototype. Runs locally for a live walkthrough. Real retrieval (PGlite + pgvector), a real jury, scripted job-close scenarios; referral delivery and outcomes are simulated. An optional ingestion worker streams synthesized job-closes on a cron to drive the live activation feed. Live Google Places, auth, and deployment are roadmap, not in this build.

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

Pick a scenario and watch the pipeline run. On the **abstains** scenario, drag the required-agreement slider to flip the jury between auto-route and escalate — the interactive heart of the demo.

- **OpenRouter key** → the five judges run across different model families (the evidence-backed diversity).
- **OpenAI-only key** → judges run on one model (no family diversity); embeddings are semantic.
- **No key** → fully deterministic: detector by graph + keywords, judges by their criteria-weights. The three-scenario arc still holds, so the demo never depends on the network.

### Live feed (optional)

The board opens on a seeded set of opportunities and grows on its own when you run the ingestion worker in a second shell:

```bash
./run.sh worker    # a cron pulls a completed-job signal every ~6s → POST /api/incoming
```

Each tick synthesizes a plausible job-close, routes it through the same detect → retrieve → jury pipeline, and prepends the opportunity to the live feed (newest first). Stop / restart / clear it from the board's control row; `WORKER_CRON` overrides the schedule. In production this worker is an Inngest/cron consumer of real "job closed" events from the brands' field-service systems.

### Verify (no key required)

```bash
bun test                   # Kendall's W concordance + Borda math + the three-scenario behavior
bun run scripts/smoke.ts   # the full pipeline end-to-end on each scenario
```

## Docs

- `docs/specs/2026-06-29-referral-opportunity-engine-design.md` — the full design spec (source of truth).
- `docs/research/2026-06-29-judge-panel-design-research.md` — evidence base for the jury design.

## Method & prior art

The committee is a **Panel of LLM judges (PoLL)** in the sense of Verga et al. 2024 ([arXiv:2404.18796](https://arxiv.org/abs/2404.18796)) — diverse models, disjoint families, aggregated. Agreement is quantified with **Kendall's coefficient of concordance *W*** (Kendall & Babington Smith, 1939). Judge personalities are **OCEAN / Big Five (Five-Factor Model)** weight vectors — a standard, generic psychology model used only to initialize deterministic criteria weights, never as a role-play prompt. The consensus winner is chosen by **Borda count**; **Kemeny–Young** (the Condorcet-consistent exact aggregator) is available as a gold-standard cross-check. Each extension of these methods is named explicitly in the spec.
