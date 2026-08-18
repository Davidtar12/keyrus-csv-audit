const FREE_FALLBACKS = [
  "z-ai/glm-5.2:free",
  "openrouter/free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
];

async function callModel({ baseUrl, model, apiKey, messages, maxTokens }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
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
      "You are a data consultant preparing a client kickoff meeting for a non-technical manager. " +
      "Return ONLY valid JSON with this exact shape: " +
      '{"executiveSummary": string (plain language, max 6 lines, no jargon, no column names), ' +
      '"findings": [{"plain": string (one line, no jargon, no column names), ' +
      '"consequence": string (why it matters for the business), ' +
      '"severity": "high"|"medium"|"low", ' +
      '"needToUnderstand": string (what you would ask the client to clarify)}], ' +
      '"kickoffQuestions": [array of exactly 5 questions for the client]}. ' +
      "Translate every finding. No markdown, no preamble, no code fences.",
  };
  const user = {
    role: "user",
    content:
      "Here is the automated analysis of the client's CSV. Translate each finding for a non-technical audience:\n\n" +
      findings,
  };

  // Provider routing: if the chosen model is rate-limited (429), rotate to the next free one.
  const candidates = [model, ...FREE_FALLBACKS.filter((m) => m !== model)];

  for (const candidate of candidates) {
    let response;
    try {
      response = await callModel({ baseUrl, model: candidate, apiKey, messages: [system, user], maxTokens: 1200 });
    } catch {
      continue; // fallo de red: prueba el siguiente
    }

    if (response.status === 429) continue; // rate-limited: rota al siguiente modelo
    if (!response.ok) {
      throw new Error(`LLM error ${response.status} (${candidate}): ${await response.text()}`);
    }

    const data = await response.json();
    let parsed = tryExtractJson(data.choices[0].message.content);

    // If the model narrated instead of returning JSON, retry strictly on the same model.
    if (!parsed) {
      const retry = await callModel({
        baseUrl,
        model: candidate,
        apiKey,
        messages: [
          { role: "system", content: "You output JSON only. No commentary, no explanation, no markdown." },
          user,
        ],
        maxTokens: 1200,
      });
      if (retry.ok) {
        const retryData = await retry.json();
        parsed = tryExtractJson(retryData.choices[0].message.content);
      }
    }

    if (parsed && Array.isArray(parsed.findings)) {
      return { ...parsed, modelUsed: candidate };
    }
  }

  throw new Error("All free models are rate-limited right now. Wait ~30s and retry, or set a different model in the settings.");
}