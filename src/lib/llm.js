// Reasoning models burn output tokens thinking; give them headroom so the final JSON survives.
// For non-reasoning models this is just a cap they never reach.
const MAX_TOKENS = 8192;

async function callModel({ baseUrl, model, apiKey, messages, maxTokens }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // Anthropic blocks browser CORS by default; this header is the official opt-in for direct browser calls.
  if (/anthropic\.com/i.test(baseUrl)) {
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    headers["anthropic-version"] = "2023-06-01";
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  return response;
}

function tryExtractJson(raw) {
  if (typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function summarizeFindings(findings, { baseUrl, model, apiKey }) {
  const system = {
    role: "system",
    content:
      "You are a data consultant writing for a non-technical business manager who has never opened a spreadsheet. " +
      "RULES: (1) Never use jargon or raw column names. First interpret cryptic names into plain business terms " +
      "(e.g. 'cust_seg_cd' = customer segment, 'csat_score' = customer satisfaction score, 'disc_pct' = discount) and speak only in those terms. " +
      "(2) Prefer words over numbers; when you use a number, say in one clause what it means for the business. " +
      "(3) Never say null, dtype, parse, outlier, normalize, column, or row-count without a plain equivalent. " +
      "(4) Every finding must end with why the business should care. " +
      "Return ONLY valid JSON with this exact shape: " +
      '{"executiveSummary": string (plain language, max 6 lines), ' +
      '"findings": [{"plain": string (one line, no jargon, no column names), ' +
      '"consequence": string (why it matters for the business), ' +
      '"severity": "high"|"medium"|"low", ' +
      '"needToUnderstand": string (what you would ask the client to clarify)}], ' +
      '"kickoffQuestions": [array of exactly 5 questions for the client]}. ' +
      "No markdown, no preamble, no code fences.",
  };
  const user = {
    role: "user",
    content:
      "Here is the automated analysis of the client's CSV. Translate each finding for a non-technical audience:\n\n" +
      findings,
  };

  let response;
  try {
    response = await callModel({ baseUrl, model, apiKey, messages: [system, user], maxTokens: MAX_TOKENS });
  } catch (err) {
    throw new Error(`Network error calling ${model} on ${baseUrl}: ${err.message}`, { cause: err });
  }

  if (response.status === 429) {
    throw new Error(`Rate-limited (429) on ${model}. Wait ~30s and retry, or use a model with credits.`);
  }
  if (!response.ok) {
    throw new Error(`LLM error ${response.status} (${model}): ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  // Reasoning models can burn all output tokens thinking and return empty content.
  if (content === undefined || content === null || String(content).trim() === "") {
    throw new Error(
      `The model ${model} returned an empty response (common with reasoning models that used all their tokens thinking). Try a non-reasoning model or increase max_tokens.`
    );
  }

  let parsed = tryExtractJson(content);

  // If the model narrated instead of returning JSON, retry once, strictly.
  if (!parsed) {
    const retry = await callModel({
      baseUrl,
      model,
      apiKey,
      messages: [
        { role: "system", content: "You output JSON only. No commentary, no explanation, no markdown." },
        user,
      ],
        maxTokens: MAX_TOKENS,
    });
    if (retry.ok) {
      const retryData = await retry.json();
      parsed = tryExtractJson(retryData.choices?.[0]?.message?.content);
    }
  }

  if (parsed && Array.isArray(parsed.findings)) {
    return { ...parsed, modelUsed: model };
  }

  throw new Error(`The model ${model} did not return a usable JSON response. Check the model supports JSON output.`);
}
