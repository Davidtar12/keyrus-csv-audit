const OPENROUTER_URL = "https://openrouter.ai/api/v1";

const RECOMMENDED = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek Chat" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "openrouter/free", label: "Free (auto)" },
];

export default function SettingsPanel({ settings, onChange }) {
  const fields = [
    { key: "baseUrl", label: "API endpoint (Base URL)", placeholder: OPENROUTER_URL },
    { key: "model", label: "Model", placeholder: "openai/gpt-4o-mini" },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", type: "password" },
  ];

  const pick = (id) => onChange({ ...settings, baseUrl: OPENROUTER_URL, model: id });

  return (
    <div className="border border-line bg-white rounded-md p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Model credentials
      </h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-muted block mb-1">{f.label}</span>
            <input
              type={f.type || "text"}
              value={settings[f.key] ?? ""}
              onChange={(e) => onChange({ ...settings, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full border border-line rounded-md px-3 py-2 text-sm bg-paper focus:border-accent focus:outline-none"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Suggested:</span>
        {RECOMMENDED.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => pick(m.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              settings.model === m.id
                ? "bg-accent text-white border-accent"
                : "border-line text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted mt-3 leading-relaxed">
        Want another? Browse{" "}
        <a
          href="https://openrouter.ai/models"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-accent"
        >
          openrouter.ai/models
        </a>{" "}
        and paste any model id. Any OpenAI-compatible endpoint works (OpenRouter, Anthropic, OpenAI, Groq, Gemini, Ollama).
      </p>
    </div>
  );
}
