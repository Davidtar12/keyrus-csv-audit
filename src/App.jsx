import { useState } from 'react'
import FileUpload from './components/FileUpload'
import SettingsPanel from './components/SettingsPanel'
import Papa from 'papaparse'
import {
  profileColumns,
  detectMixedDateFormats,
  detectTemporalAnomalies,
  detectMathInconsistencies,
  detectDuplicateRows,
  detectOutliers,
  detectCasingInconsistencies,
  formatFindingsForLLM,
} from './lib/analysis'
import { summarizeFindings } from './lib/llm'

const severityStyles = {
  high: { border: "border-l-high", badge: "bg-high/10 text-high" },
  medium: { border: "border-l-medium", badge: "bg-medium/10 text-medium" },
  low: { border: "border-l-low", badge: "bg-low/10 text-low" },
};

function FindingCard({ finding }) {
  const s = severityStyles[finding.severity] || severityStyles.low;
  return (
    <article className={`border-l-4 ${s.border} bg-white border border-line border-l-4 rounded-r-md px-5 py-4 mb-3 hover:border-l-accent hover:shadow-sm transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium leading-snug">{finding.plain}</p>
        <span className={`shrink-0 uppercase text-[11px] tracking-wider font-semibold px-2 py-0.5 rounded-sm ${s.badge}`}>
          {finding.severity}
        </span>
      </div>
      <p className="text-sm text-muted mt-2 leading-relaxed">{finding.consequence}</p>
      {finding.needToUnderstand && (
        <p className="text-sm mt-3 pt-3 border-t border-line text-muted leading-relaxed">
          <span className="font-medium text-ink">Ask the client: </span>
          {finding.needToUnderstand}
        </p>
      )}
    </article>
  );
}

function App() {
  const [settings, setSettings] = useState({
    baseUrl: "https://openrouter.ai/api/v1",
    model: "z-ai/glm-5.2:free",
    apiKey: "",
  });
  const [report, setReport] = useState(null);
  const [llmResult, setLlmResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const allChecks = (rows) => ({
    columns: profileColumns(rows),
    dateFormats: detectMixedDateFormats(rows),
    temporal: detectTemporalAnomalies(rows),
    math: detectMathInconsistencies(rows),
    duplicates: detectDuplicateRows(rows),
    outliers: detectOutliers(rows),
    casing: detectCasingInconsistencies(rows),
  });

  const handleFile = (file) => {
    Papa.parse(file, {
      header: true,
      complete: (result) => {
        const rows = result.data.filter((r) =>
          Object.values(r).some((v) => v !== "" && v !== null)
        );
        setReport({ name: file.name, rows: rows.length, findings: allChecks(rows) });
        setLlmResult(null);
      },
    });
  };

  const runLLM = async () => {
    if (!settings.apiKey) {
      alert("Add your API key first (top of page).");
      return;
    }
    setLoading(true);
    try {
      const text = formatFindingsForLLM(report);
      const result = await summarizeFindings(text, settings);
      setLlmResult(result);
    } catch (err) {
      alert("LLM error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 text-left">
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted font-semibold mb-2">
          Data Onboarding Assistant
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          CSV Data Audit
        </h1>
        <div className="w-10 h-0.5 bg-accent mt-3" aria-hidden="true"></div>
        <p className="text-muted mt-4 leading-relaxed max-w-xl">
          An honest first read of a client data file before the kickoff:
          what it contains, what looks wrong, and what to ask the client.
        </p>
      </header>

      <section className="mb-8">
        <SettingsPanel settings={settings} onChange={setSettings} />
      </section>

      <section className="mb-8">
        <FileUpload onFileSelected={handleFile} />
      </section>

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4 border border-line bg-white rounded-md p-5 mb-2">
            {[
              { label: "Rows", value: report.rows.toLocaleString() },
              { label: "Columns", value: report.findings.columns.length },
              { label: "Checks", value: "7" },
            ].map((s) => (
              <div key={s.label} className="text-center sm:text-left">
                <p className="font-mono text-xl tracking-tight">{s.value}</p>
                <p className="text-xs text-muted uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mb-6 px-1">
            File: <span className="font-medium text-ink">{report.name}</span>
          </p>

          <button
            type="button"
            onClick={runLLM}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {loading && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true"></span>
            )}
            {loading ? "Generating..." : "Generate executive summary"}
          </button>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight mb-3">What the code found</h2>
            <p className="text-sm text-muted mb-3">
              The automated read, before any AI. The executive summary above translates this into plain language.
            </p>
            <ul className="space-y-1.5 text-sm text-muted list-disc list-inside">
              {formatFindingsForLLM(report).split("\n").map((l, i) => (
                <li key={i} className="leading-relaxed">{l}</li>
              ))}
            </ul>
          </section>

          {llmResult && (
            <div className="mt-8">
              {llmResult.modelUsed && (
                <p className="text-xs text-muted mb-4 font-mono">
                  Generated with {llmResult.modelUsed}
                </p>
              )}
              <section className="mb-8">
                <h2 className="text-xl font-semibold tracking-tight mb-3">Executive summary</h2>
                <p className="leading-relaxed text-[15px]">{llmResult.executiveSummary}</p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold tracking-tight mb-3">Findings</h2>
                {llmResult.findings.map((f, i) => (
                  <FindingCard key={i} finding={f} />
                ))}
              </section>

              <section>
                <h2 className="text-xl font-semibold tracking-tight mb-3">Kickoff questions</h2>
                <ol className="list-decimal list-inside space-y-2 text-[15px]">
                  {llmResult.kickoffQuestions.map((q, i) => (
                    <li key={i} className="leading-relaxed">{q}</li>
                  ))}
                </ol>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App