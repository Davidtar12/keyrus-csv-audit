# CSV Data Audit — Data Onboarding Assistant

A React web app for consultants: drop in any CSV and get an honest first read before a client kickoff — what the data contains, what looks wrong, and what to ask the client. Built as the Keyrus AI Intern technical challenge.

The app runs **entirely in the browser**. No backend, no database, no deployment. The analysis engine is plain JavaScript; a single LLM call (by your own API key) translates the findings into plain language for a non-technical client.

## How it works

1. **Upload** — you drop a CSV in the browser (PapaParse reads it).
2. **Analyze** — 7 generic checks run in pure JS, none of them hardcoded to a specific schema:
   - Column completeness (missing values, including disguised blanks like `"n/a"`)
   - Mixed date formats (ISO, US, EU, epoch, month-name)
   - Temporal impossibilities (e.g. shipped before ordered)
   - Math reconciliation (does a "total" column match its factors?)
   - Duplicate rows and repeated record keys
   - Outliers (IQR)
   - Inconsistent casing / variants of the same value
3. **Summarize** — one LLM call turns the findings into an executive summary, per-finding consequences with severity, and 5 kickoff questions.
4. **Present** — a sober, editorial assessment UI (no table dump), inspired by the anti-AI-slop "Hallmark" design system ([github.com/Nutlope/hallmark](https://github.com/Nutlope/hallmark)).

## Install & run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. That's it — no build step needed for local use.

## Model credentials

The app is provider-agnostic: it speaks the OpenAI-compatible protocol (`POST {base}/chat/completions`), which every major provider exposes. At the top of the page set:

- **API endpoint (Base URL)** — e.g. `https://openrouter.ai/api/v1`, `https://api.anthropic.com/v1`, `https://api.openai.com/v1`, `https://api.groq.com/openai/v1`, or a local Ollama server.
- **Model** — recommended for this task (reliable structured JSON, cheap): `openai/gpt-4o-mini`, `anthropic/claude-haiku-4.5`, `deepseek/deepseek-chat-v3-0324`, `google/gemini-2.5-flash`. Free: `openrouter/free`, `z-ai/glm-5.2:free`. Avoid heavy reasoning models (`*-pro`, `*-reasoning`) — they can spend all output tokens thinking and return empty content (the app now gives them headroom and reports it clearly if it happens). Browse all: [openrouter.ai/models](https://openrouter.ai/models).
- **API Key** — yours. **Never committed**: the key lives only in React state, never touches disk, never reaches a server you control. A `.gitignore` blocks `.env` files and gitleaks scans every commit as a second layer.

Verified CORS preflights (2026-08-17) — the app runs entirely in the browser, so the provider must allow cross-origin calls. All of these do: OpenRouter, Anthropic (with the official `anthropic-dangerous-direct-browser-access` header, sent automatically), OpenAI, Groq, and Gemini. The exact model you configure is the model that runs — if it fails, the app says why (rate limit, HTTP error, or invalid JSON); it never silently swaps providers.

## Screenshot

![App screenshot](screenshot.png)

## What doesn't work yet

- The exact configured model runs; there is no silent provider fallback. Free-tier OpenRouter models are rate-limited during peak hours — a key with credits is more reliable.
- Claude works both direct (`https://api.anthropic.com/v1` using its OpenAI-compatible endpoint, with the browser-access header sent automatically) and via OpenRouter (`anthropic/claude-...`). The native `/v1/messages` protocol is not implemented — not needed, since the compatible endpoint covers it.
- Ambiguous date formats (e.g. `04/16/2024` vs `16/04/2024`) are parsed deterministically (US vs EU by separator); when a count depends on that choice the report says so explicitly.
- The math check picks the best matching formula among numeric columns; if a dataset uses an unusual formula (e.g. quantity × price × discount), rows may show as non-matching. It's reported honestly, not silently fixed.

## Project structure

```
├── README.md
├── NOTES.md
├── .gitignore
├── package.json
├── src/
│   ├── components/      # FileUpload, SettingsPanel
│   └── lib/             # analysis.js (engine), llm.js (one call)
├── skill/               # SKILL.md — reusable CSV data-quality audit skill
└── data/                # sample CSV (lakeside_orders_sample.csv)
```

## The skill

`skill/SKILL.md` is a reusable Claude skill encoding what this project had to correct three separate times: generic detection (no hardcoded columns), false positives from numeric parsers, and LLM JSON reliability. See `skill/SKILL.md` for install instructions.

## Notes for reviewers

- Commit history shows the work developed feature by feature.
- The engine was validated against the Lakeside sample in a pandas notebook first (see findings in NOTES.md), then translated 1:1 to JS.
- Tested with a second, unrelated CSV (test_ventas.csv) to prove the checks are generic.
