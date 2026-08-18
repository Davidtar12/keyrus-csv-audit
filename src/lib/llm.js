export async function summarizeFindings(findings, { baseUrl, model, apiKey }) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
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
        },
        {
          role: "user",
          content:
            "Here is the automated analysis of the client's CSV. Translate each finding for a non-technical audience:\n\n" +
            findings,
        },
      ],
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content;

  // Los LLM a veces anteponen texto ("User Safety: safe", markdown, etc.)
  // Extraemos el JSON desde el primer { hasta el último }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Respuesta del LLM sin JSON: " + raw.slice(0, 200));
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || !Array.isArray(parsed.findings)) {
    throw new Error("Respuesta del LLM en formato inesperado");
  }
  return parsed;
}