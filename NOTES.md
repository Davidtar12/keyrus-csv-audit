# NOTES.md — Decisions and learnings

**Project:** Data Onboarding Assistant — CSV Data Audit
**Author:** David Tarazona · Keyrus AI technical challenge (Intern)
**Time invested:** ~7 hours (Monday Aug 17, afternoon/evening)

## AI tools used and how

- **Kilo Code (VS Code) as tutor/guide**: started on `deepseek/deepseek-v4-flash-0731`; switched to `qwen3.8-max` mid-session when the flash model stalled on the CORS/LLM debugging. Guided, step-by-step development. I validated the logic of every check in Python first (Jupyter/pandas — notebook `Notebooks/prueba keyrus.ipynb`, where I profiled types, nulls, mixed dates, temporal anomalies, duplicates and outliers against the Lakeside sample) and then translated that logic 1:1 to browser JS. The agent taught each piece before writing it — it did not paste code blindly.
- **Vision models at bottlenecks**: when the text model couldn't read a browser screenshot (image-input error) or the network panel was ambiguous, I switched to **Qwen3.8 Max** / **minimax-m3** (vision) to interpret the capture. Screenshot + vision model was the unlock whenever "the app doesn't look right but the code seems fine".
- **Runtime LLM (OpenRouter)**: exactly one call per analysis. Translates engine findings into business language + 5 kickoff questions. Provider is configurable (base URL + model + key) to work with OpenRouter, Groq, Ollama, or Claude via OpenRouter.
- **PapaParse**: CSV parsing in the browser. **Tailwind v4**: UI.

## What worked well

1. **The engine is 100% generic** — no check knows Lakeside's column names. Every detector infers from behavior: date columns (≥80% of values parseable, year 1900–2100), record keys (≥90% unique values), totals (best math formula found in the data). Tested with a second, unrelated CSV: it detected the same kinds of problems without touching the code.
2. **One-purpose LLM translation** — executive summary in plain language + business consequences + "ask the client" per finding + kickoff questions. That is the assessment the brief asks for, not a chatbot.
3. **Sober UI** — inspired by the anti-AI-slop "Hallmark" design skill ([github.com/Nutlope/hallmark](https://github.com/Nutlope/hallmark)): editorial, no gradients, severity colors, left-aligned text, all user-facing copy in English (the challenge, review and interview are in English).

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

## Provider support, verified by CORS preflight

The app runs entirely in the browser (the brief forbids a backend), so the LLM provider must allow cross-origin requests. I verified this empirically with `curl -X OPTIONS` preflights (2026-08-17) instead of assuming: OpenRouter, Anthropic, OpenAI, Groq, and Gemini all return `Access-Control-Allow-Origin` for a browser origin. Anthropic additionally requires the official `anthropic-dangerous-direct-browser-access: true` header for direct browser calls — the app sends it automatically when the endpoint is `anthropic.com`. Conclusion: the app is genuinely provider-agnostic across the majors; "only OpenRouter works" would have been a false claim, so I did not ship it.

## What I cut and why

- **Automatic provider fallback chain (removed).** I first built a chain that rotated to other free models when the configured one hit a rate limit (429). I removed it. Why: a fallback model aimed at a foreign endpoint is meaningless — an OpenRouter free model sent to Anthropic's URL is a different protocol entirely — and silently swapping the model is worse than failing loudly. The evaluator should see exactly which model ran and a precise reason when it fails, not magic. Now: one configured model, clear per-code error messages (429, HTTP status, or invalid JSON). Trade-off: less robustness during OpenRouter peak-hour rate limits, better transparency and honesty.
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
