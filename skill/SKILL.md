---
name: csv-data-quality-audit
description: Audit any CSV for data quality issues and translate the findings into plain language a non-technical client can act on. Use when a client uploads a CSV with no data dictionary, or when preparing an assessment for a kickoff meeting.
---

# CSV Data Quality Audit

Help a consultant turn an unfamiliar CSV into an honest, non-technical read: what's in it, what looks wrong, and what to ask the client. This is an **assessment**, not a data-cleaning run — flag issues, never silently fix them.

## Rules for the analysis (always apply)

1. **Detect generically, never hardcode column names.** Every check must work on any reasonable CSV. Infer columns by behavior: a column is a *date* if ≥80% of its non-missing values parse as dates and fall in a plausible year range (1900–2100); a column is a *record key* only if its values are ≥90% unique. Never assume `order_id`, `date`, or `qty` exist.
2. **Watch for "disguised" missing values.** No data dictionary means you can't trust that empties are the only blanks. Values like `"n/a"`, `"NA"`, `"none"`, and `"-"` are missing too, but they encode differently than a real empty cell. Count both separately.
3. **Beware the false positives that numeric parsers create.** A bare number can parse as a year (`"250"` → year 250) and a numeric-suffix column can masquerade as a date. Confirm dates parse AND land in a real year range, and that record keys are actually near-unique before calling something a duplicate.
4. **Ambiguity is a finding, not a bug.** Mixed date formats, dash vs slash dates, `canceled` vs `cancelled`, `US` vs `U.S.` vs `United States` — these are all inconsistencies to report. When a count depends on how an ambiguous value is read (e.g. which is the day in `04/16/2024`), say so explicitly and put it to the client.
5. **Math checks pick the best formula, not a fixed one.** For a column that looks like a "total", try combinations of other numeric columns (simple product, or product with a `(1 - discount)` factor) and report which formula matches most rows and how many still don't reconcile. Never assume the formula.
6. **The app is an auditor, not a cleaner.** You observe and report. Correcting data without client authorization is the classic junior-consultant mistake.

## Rules for talking to non-technical clients (the hardest part)

7. **Translate every finding into business language.** No jargon: no *null*, *dtype*, *IQR*, *parse*, *outlier*, *normalize*, *column*. Use what the business cares about: incomplete, duplicated, inconsistent, unaccounted money, impossible dates. The word *duplicate* is fine; *null* is not.
8. **Say *why it matters*, not just what it is.** "21 duplicated orders" becomes "21 orders appear twice with identical data — this can inflate your sales figures."
9. **Explicitly call out what you'd need to clarify.** End each finding with the natural next question for the client. Prefer concrete questions grounded in the data over generic templates.
10. **Never fabricate a number, threshold, or conclusion.** If the analysis is ambiguous, the honest output is the ambiguity, not a confident guess.

## Rule for the LLM integration itself

11. **The model returns whatever it wants; the code decides.** LLMs regularly prepend preamble ("User Safety: safe", markdown fences) before JSON. Always strip to the first `{`…last `}`, parse, and validate the shape (e.g. `findings` is an array) before trusting it. Never let a model reply crash the app.

## Typical checks to run

- Column/row completeness (missing counts, including disguised blanks)
- Mixed date formats (ISO, US, EU, epoch, month-name) and date ranges
- Temporal impossibilities (e.g. shipped before ordered) across paired date columns
- Duplicate rows (exact) and repeated record keys
- Math reconciliation of "total-style" columns against their factors
- Outliers and impossible values (negative quantity, extreme line totals, off-scale scores)
- Inconsistent casing/variants of the same value (countries, statuses, channels)

## Output format

For each finding return: **plain** (one line, no jargon, no column names), **consequence** (why it matters for the business), **severity** (`high`/`medium`/`low`), and **needToUnderstand** (what to ask the client to clarify). End with an executive summary (max ~6 lines) and exactly 5 kickoff questions. JSON only.

## Install

Place this folder (`skill/`) in the project. In Claude Code / Claude Desktop, reference the skill directory in your config; the frontmatter `name` is how it is invoked. No dependencies beyond a working network connection and an LLM API key.