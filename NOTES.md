# NOTES.md — Decisions and learnings

**Project:** Data Onboarding Assistant — CSV Data Audit
**Author:** David Tarazona · Keyrus AI technical challenge (Intern)
**Time invested:** ~7 hours (Monday Aug 17, afternoon/evening)

## AI tools used and how

- **Kilo Code (VS Code) with `deepseek/deepseek-v4-flash-0731` as tutor/guide**: guided, step-by-step development. I validated the logic of every check in Python first (Jupyter/pandas) and then translated it 1:1 to browser JS. The agent taught each piece before writing it — it did not paste code blindly.
- **Vision models to get past blockers**: when the text model couldn't read browser screenshots (image input error), I used **Qwen3.8 Max** and **minimax/m3** to interpret UI captures and the network panel. That pattern — screenshot + vision model for visual diagnosis — was key when the app "didn't look right" but the code was fine.
- **Runtime LLM (OpenRouter)**: exactly one call per analysis. Translates engine findings into business language + 5 kickoff questions. Provider is configurable (base URL + model + key) to work with OpenRouter, Groq, Ollama, or Claude via OpenRouter.
- **PapaParse**: CSV parsing in the browser. **Tailwind v4**: UI.

## What worked well

1. **The engine is 100% generic** — no check knows Lakeside's column names. Every detector infers from behavior: date columns (≥80% of values parseable, year 1900–2100), record keys (≥90% unique values), totals (best math formula found in the data). Tested with a second, unrelated CSV: it detected the same kinds of problems without touching the code.
2. **One-purpose LLM translation** — executive summary in plain language + business consequences + "ask the client" per finding + kickoff questions. That is the assessment the brief asks for, not a chatbot.
3. **Sober UI** (inspired by the anti-AI-slop "Hallmark" skill): editorial, no gradients, severity colors, left-aligned text.

## Where the AI got it wrong and how I noticed

These are the real corrections now encoded in `skill/SKILL.md`:

1. **Date false positives.** The first detector flagged `qty` and `csat_score` as date columns — `Date.parse("250")` reads a bare number as a *year*. I noticed by comparing against the pandas analysis: counts didn't match. Fix: validate year within 1900–2100 + deterministic per-format parser.
2. **Inflated duplicates.** The first check reported 902 "duplicates" (pandas: 20). `prod_sku` repeats legitimately (same product across many orders) and I treated it as a row key. I noticed because 902 was absurdly high. Fix: only columns ≥90% unique qualify as keys.
3. **Broken JSON from LLMs.** Free models prepend preamble ("User Safety: safe") or narrate their reasoning before the JSON. I noticed via the parse error in the console. Fix: extract JSON from the first `{` to the last `}`, strict retry, shape validation.
4. **Free-model rate limits.** OpenRouter returned 429 repeatedly (free and with paid credits, during peak usage). Fix: automatic fallback chain across free models, plus a configurable model field so users can supply any model with credits.

## Debugging the "slow" LLM call with a HAR file

The app seemed stuck on "Generating..." — it wasn't. The HAR export from the browser network panel showed the full story:

| Time | Status | Duration | What happened |
|---|---|---|---|
| 00:35:57 | 200 | 25.3s | First attempt (mimo-v2.5) — responded fine |
| 00:36:22 | 200 | 16.4s | Strict JSON retry (first response wasn't parseable) |
| 00:36:38 | 429 | 0.3s | Rate-limited |
| 00:36:39 | 200 | 17.7s | Fallback rotated and the fourth model responded |

Real elapsed time: ~60s, not infinite. Each attempt takes 16–25s because the LLM is slow, not the app — and the 204s are normal CORS preflights (68ms). The provider routing did exactly what it was designed to do.

## What I cut and why

- **Native Anthropic protocol (`/v1/messages`)**: covered by OpenRouter with a single OpenAI-compatible adapter. A second adapter was ~15 lines the brief doesn't require (it prioritizes free/open models).
- **LLM column-meaning detector** (interpreting acronyms like `csat_score`): the LLM already does this implicitly when translating findings.
- **Data correction**: the app is an auditor, not a cleaner. The brief doesn't ask to fix the data, and a consultant must not correct without client authorization.

## What I'd do with two more days

1. Post-generation factual verifier: extract numbers/dates from the LLM's final text and compare against the engine (so the model can't invent figures).
2. Novelty gate: embeddings of recent reports to avoid repeated angles.
3. Explicit discount heuristics — the engine found 92% of totals = qty×price with no discount; I report it, but with more time I'd test explicit discount patterns.
4. Golden suite: 10–15 curated CSVs to measure per-check accuracy.

## Language note

The UI and docs are in English because the challenge brief, the review, and the follow-up interview are in English. All user-facing strings, prompts, comments, README, NOTES, and the skill are English-only.
