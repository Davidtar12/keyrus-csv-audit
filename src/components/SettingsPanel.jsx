export default function SettingsPanel({ settings, onChange }) {
  const fields = [
    { key: "baseUrl", label: "Base URL", placeholder: "https://openrouter.ai/api/v1" },
    { key: "model", label: "Model", placeholder: "z-ai/glm-5.2:free" },
    { key: "apiKey", label: "API Key", placeholder: "sk-...", type: "password" },
  ];

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
    </div>
  );
}