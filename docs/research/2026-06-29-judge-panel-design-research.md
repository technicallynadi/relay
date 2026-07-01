# Judge-panel design research — evidence base for the committee

Compiled 2026-06-29. Tags: CONFIRMED (primary source w/ URL) · UNCERTAIN (secondary/directional). Bottom line: **model/architecture diversity in a panel is well-supported; persona diversity within one model is weak and sometimes harmful.** Make judges differ in something *real* (model family, criteria-weighting) — not just a costume. The panel is a **Panel of LLM judges (PoLL)** in the sense of Verga et al. 2024 ([arXiv:2404.18796](https://arxiv.org/abs/2404.18796)); jury agreement is quantified with **Kendall's coefficient of concordance *W*** (Kendall & Babington Smith, 1939), and the consensus winner is chosen by **Borda count** (with **Kemeny–Young** available as the exact Condorcet-consistent cross-check).

---

## 1. Does persona/role diversity improve LLM-as-judge reliability?

- **A jury of diverse models beats a single strong judge — CONFIRMED.** Verga et al. 2024, "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models" (PoLL): a panel of smaller models from *disjoint families* aggregated; higher agreement with humans than GPT-4 alone, at ~1/7 cost, with less intra-model bias. This is the primary citation for the jury design — the diversity across model families is the load-bearing part. (exact κ decimals UNCERTAIN — from a secondary summary; direction + disjoint-family design CONFIRMED.) [arXiv:2404.18796](https://arxiv.org/abs/2404.18796)
- **Model-family diversity is the active ingredient — CONFIRMED.** ReConcile (ChatGPT + Bard + Claude2 round-table): StrategyQA **79.0%** with three different models vs **72.2%** with three ChatGPT instances — a **6.8-pt** diversity gap; cross-model answers are least similar and most accurate. Same-model panels = "echo chambers." Strongest evidence that *diversity makes agreement informative* — the premise the Kendall's *W* concordance gate rests on. [arXiv:2309.13007](https://arxiv.org/html/2309.13007)
- **Ensembling neutralizes self-preference bias — CONFIRMED.** Self-preference (a judge over-rating its own/low-perplexity outputs) is documented; fixes = don't let the same model generate and judge; Peer-Rank aggregation. [arXiv:2410.21819](https://arxiv.org/abs/2410.21819) · [survey arXiv:2412.05579](https://arxiv.org/pdf/2412.05579)
- **Multi-agent debate improves factuality/reasoning — CONFIRMED.** Du et al. (ICML 2024). But debate can also drive *false* consensus. [openreview](https://openreview.net/pdf?id=zj7YuTE4t8)
- **Role/persona assignment is promising but under-evidenced — UNCERTAIN/mixed.** The win usually comes from **decomposing the rubric across agents** (different *criteria*), not from giving an agent a *personality*; persona descriptions are "often arbitrarily designed." [arXiv:2507.21028](https://arxiv.org/abs/2507.21028) · [arXiv:2508.02994](https://arxiv.org/html/2508.02994v1)
- **A persona only buys expertise the base model already has — CONFIRMED.** Safe: lenses that re-weight *known* signals. Unsafe: personas that purport to inject domain expertise the model lacks.
- **Real vs cargo-cult:** *Real* = different model families; different evidence/tools; different rubric criteria; robust aggregation. *Cargo-cult* = many instances of the same model with different "personalities"/backstories/demographics — adds latency + bias, not independent signal.

## 2. Pitfalls of persona-prompting

- **Assigning a persona can crater reasoning accuracy — CONFIRMED.** Gupta et al., "Bias Runs Deep" (19 personas × 4 LLMs × 24 datasets): ~**56%** drop (atheist persona, college physics), **69%**, **64%** on others; **80% of personas showed measurable degradation**. (socio-demographic priming on the *solver* — bounds the risk of identity-laden judge personas.) [arXiv:2311.04892](https://arxiv.org/html/2311.04892v2)
- **The bias is implicit, not just refusal — CONFIRMED.** Both explicit abstention and silent reasoning errors (**39%** drop with no abstention). Exactly what would silently poison a judge's call.
- **De-biasing instructions don't fix it — CONFIRMED.** "Don't stereotype / treat as human" had minimal effect; only task-specific expertise helped, and that doesn't generalize.
- **Expert personas trade accuracy for "alignment" — CONFIRMED (title-level; decimals UNCERTAIN).** PRISM: "Expert Personas Improve Alignment but Damage Accuracy." All expert-persona variants reduced MMLU accuracy. [arXiv:2603.18507](https://arxiv.org/pdf/2603.18507)
- **Personas don't faithfully simulate the named group, and resist steering — CONFIRMED.** High inter-persona agreement ⇒ the diversity you think you're getting may be *cosmetic* — directly undermines divergence-as-signal. [arXiv:2601.20757](https://arxiv.org/abs/2601.20757) · [NAACL 2025](https://aclanthology.org/2025.naacl-long.50.pdf)
- **Sycophancy / false consensus under debate — UNCERTAIN (directional).** The concordance gate must treat *agreement* (Kendall's *W*) and *correctness* as separable — high *W* can reflect a shared blind spot, not a right answer.

## 3. Five Factor Model (OCEAN) → decision behavior

Verdict: a **credible-but-modest** signal at broad-trait level; meaningful effects mostly at facet level; noisy across studies. Enough to ground a *principled, defensible* trait→weight prior; not enough to claim a precise validated mapping. Be candid.

- **Conscientiousness → thoroughness/reliability + facet-level risk-aversion — CONFIRMED, moderate.** The "responsibility" facet drove most Big-Five variance in risk-taking. → a judge that over-weights **reliability/capacity**. [SD S0191886920301203](https://www.sciencedirect.com/science/article/abs/pii/S0191886920301203) · [SD S0191886924004422](https://www.sciencedirect.com/science/article/abs/pii/S0191886924004422)
- **Openness → exploration/novelty — CONFIRMED, moderate.** → a judge that rewards **novel/non-obvious fit**.
- **Neuroticism → loss-aversion via negativity bias — CONFIRMED (two-hop).** Bias→loss-aversion link confirmed (M=2.99 vs 2.24, p=0.035) but that paper doesn't invoke neuroticism; neuroticism→negativity-bias is separate. Defensible but flag as two-hop. → over-weights **downside/risk avoidance**. [PMC9779195](https://pmc.ncbi.nlm.nih.gov/articles/PMC9779195/)
- **Agreeableness → cooperation/customer-orientation — CONFIRMED conceptually, WEAK in decision-task data.** → over-weights **customer experience**; weakest mapping.
- **Extraversion → reward-sensitivity/approach — CONFIRMED, moderate-but-inconsistent.** → over-weights **upside/conversion**.
- **Global caveat — CONFIRMED.** Some behavioral-decision studies found minimal N/E/O/C relationships. Treat trait vectors as a **prior for weights**, not a law.

### 3b — Big Five as a generic, cited prior — CONFIRMED
The Five-Factor Model (OCEAN) is a standard, well-established personality taxonomy — we cite it generically as the source of the trait basis, with **no library dependency**. It gives us a principled continuous generator for judge weight vectors (sample/perturb five numbers to spawn a judge) and a "we cover the trait space" narrative. It is used **only to initialize deterministic criteria weights in code** — never as a role-play prompt. The **trait→weights behavior mapping is our contribution**; the Five-Factor Model itself supplies only the trait representation.

## 4. Recommended judge panel (routing)

Each is defensible as a real business stakeholder *and* carries an optional OCEAN vector `[O,C,E,A,N]` (0–1) as a weight prior. Criteria pool: capability/fit, capacity/availability, proximity, conversion, in-network/brand-trust, customer-experience.

| # | Name | Over-weights | OCEAN [O,C,E,A,N] |
|---|------|--------------|-------------------|
| 1 | **The Matchmaker** | capability/fit (2nd proximity) | [0.85, 0.55, 0.45, 0.40, 0.30] |
| 2 | **The Operator** | capacity/availability (2nd brand-trust) | [0.25, 0.90, 0.40, 0.45, 0.65] |
| 3 | **The Closer** | conversion (2nd proximity) | [0.55, 0.35, 0.85, 0.45, 0.20] |
| 4 | **The Concierge** | customer-experience (2nd fit) | [0.55, 0.50, 0.50, 0.90, 0.45] |
| 5 | **The Steward** | in-network/brand-trust (2nd capacity) | [0.20, 0.80, 0.35, 0.55, 0.75] |

- They **deliberately disagree** (Matchmaker best-fit-even-out-of-network vs Steward safe-in-network; Closer upside vs Operator/Steward downside). When even these judges reach high concordance (Kendall's *W*), that agreement is meaningful.
- For a tighter/lower-latency panel ship **3**: Matchmaker, Closer, Steward (sharpest tensions).
- **Run across different model families** where keys allow — the evidence-backed diversity.
- Implement each lens as a **weight vector applied to pre-computed sub-scores**, not a free-form "act cautious" instruction.

## 4b. Measuring jury agreement — the statistics

Once each of the `m` judges emits a ranking of the `n` candidates, we need one number for "how much do they agree?" and one procedure for "who won?"

- **Concordance = Kendall's *W* — CONFIRMED.** The **coefficient of concordance** `W ∈ [0, 1]` (Kendall & Babington Smith, 1939) is the standard measure of agreement among `m` rankers over `n` items. `W = 1` → identical rankings (unanimous); `W = 0` → no agreement. This is the jury's headline agreement statistic and what the required-agreement slider thresholds. [Kendall & Babington Smith 1939, *Annals of Mathematical Statistics* 10(3):275–287](https://doi.org/10.1214/aoms/1177732186)
- **One statistic, three costumes — CONFIRMED.** Kendall's *W* is not ad-hoc; it is algebraically the same object as two familiar statistics:
  - **Average pairwise agreement:** `ρ̄ = (mW − 1) / (m − 1)`, the mean Spearman rank correlation over all `C(m,2)` judge pairs. So "average how correlated are the judges" *is* *W* rescaled.
  - **Friedman test statistic:** `χ² = m(n − 1)W`. So a significance test on the panel's agreement is *W* rescaled too.
  - Practically: "average agreement," "concordance," and "Friedman significance" are the same statistic in three costumes — the slider is a threshold on all three at once.
- **Consensus winner = Borda count — CONFIRMED.** We aggregate the `m` rankings into one consensus order by **Borda count** (positional scoring: a candidate earns points for its rank in each judge's list; highest total wins). Fast, transparent, and standard for rank aggregation. We also record the **top-1 margin** (Borda winner vs runner-up) as a second gate.
- **Gold standard = Kemeny–Young — CONFIRMED.** The exact, Condorcet-consistent aggregator is **Kemeny–Young**: the ordering minimizing total pairwise disagreement (Kendall-tau distance) with the judges. It is NP-hard in general, but *free* here — with `n ≤ 4` partners there are `≤ 4! = 24` orderings, so we brute-force all of them and confirm the Borda winner. Borda/Kemeny–Young disagreement is itself an escalation signal. [Young & Levenglick 1978; the method traces to Kemeny 1959, "Mathematics without numbers," *Daedalus* 88:577–591]

## 5. Verdict: OCEAN-grounded vs pure domain-lens

**Ship domain-lens archetypes (criteria-weight vectors) as the system of record. Use OCEAN as an optional, labeled *prior* for initializing those weights — never a role-played personality.**

- Divergence must be *real*; persona-prompting gives *cosmetic* diversity (§2) — the opposite of what the concordance gate needs (cosmetic agreement inflates Kendall's *W* without informing the decision).
- Persona prompts degrade the judge's reasoning (§2) — indefensible for a gating decision.
- The strongest evidence (§1) credits **family/criteria diversity**, not personalities.
- OCEAN→decision-style is real but modest (§3) — good to *justify/explain* a weight prior, not to *be* the mechanism.

**Steelman for OCEAN:** a shared 5-D trait basis is a principled continuous generator (sample/perturb 5 numbers to spawn judges; tune diversity by spreading vectors; "we cover the trait space"). Pure archetypes are hand-authored and can hide *correlated blind spots* (author bias inherited by all lenses) — a real threat to a convergence gate.

**Best of both (recommended):**
1. Executable layer = **criteria-weight vectors** (auditable; no persona reasoning-degradation).
2. An **OCEAN→weights function** to *initialize + document* each lens (the continuous generator + trait-space narrative) without ever prompting "be neurotic."
3. **Decorrelate explicitly:** different model families per lens; measure inter-judge correlation on held-out cases; if two agree too often, widen their weights.

## Design implications

- Diversify the evidence-backed thing: **model family first, criteria-weights second, persona prose last (or never).**
- Each judge = a **weight vector over pre-computed sub-scores**, not a role-played character.
- Treat **agreement (Kendall's *W*) and correctness as separate axes**; validate the gate against ground-truth outcomes, and keep the human gate as the correctness backstop.
- **Never let the model that scored a candidate also judge it** (self-preference); cross-family juries are the fix.
- If using OCEAN, label it a **prior for weights**, sourced + hedged; cite the Five-Factor Model generically, with no library dependency.
- **Measure inter-judge correlation** and prune/respread redundant judges — independence is a first-class metric.

### Sources
[PoLL 2404.18796](https://arxiv.org/abs/2404.18796) · [ReConcile 2309.13007](https://arxiv.org/html/2309.13007) · [Multiagent Debate (ICML 2024)](https://openreview.net/pdf?id=zj7YuTE4t8) · [Bias Runs Deep 2311.04892](https://arxiv.org/html/2311.04892v2) · [PRISM 2603.18507](https://arxiv.org/pdf/2603.18507) · [Persona Prompting 2601.20757](https://arxiv.org/abs/2601.20757) · [Self-Preference 2410.21819](https://arxiv.org/abs/2410.21819) · [LLMs-as-Judges survey 2412.05579](https://arxiv.org/pdf/2412.05579) · [Multi-Agent-as-Judge 2507.21028](https://arxiv.org/abs/2507.21028) · [Big Five & decision tasks](https://www.sciencedirect.com/science/article/abs/pii/S0191886920301203) · [Big Five & risk-taking](https://www.sciencedirect.com/science/article/abs/pii/S0191886924004422) · [Negativity bias → loss aversion PMC9779195](https://pmc.ncbi.nlm.nih.gov/articles/PMC9779195/) · [Kendall's W — Kendall & Babington Smith 1939](https://doi.org/10.1214/aoms/1177732186) · Borda count (positional rank aggregation) · [Kemeny–Young — Young & Levenglick 1978; Kemeny 1959]

> Source-confidence flags: the PoLL κ decimals and PRISM MMLU numbers came from secondary summaries — directions CONFIRMED, verify exact figures before quoting. ReConcile, Gupta, self-preference, Kendall's-W, and Big-Five sections are primary/primary-mirror.
