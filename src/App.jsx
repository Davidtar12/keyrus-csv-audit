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

function App() {
  const [settings, setSettings] = useState({
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
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
        setReport({ rows: rows.length, findings: allChecks(rows) });
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

  const severityColor = {
    high: "#b91c1c",
    medium: "#b45309",
    low: "#166534",
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>CSV Data Audit</h1>
      <SettingsPanel settings={settings} onChange={setSettings} />
      <FileUpload onFileSelected={handleFile} />
      {report && (
        <>
          <p>Filas analizadas: <b>{report.rows}</b></p>
          <button type="button" onClick={runLLM} disabled={loading}>
            {loading ? "Generando..." : "Generar resumen ejecutivo"}
          </button>
          {llmResult && (
            <>
              <h2>Resumen ejecutivo</h2>
              <p>{llmResult.executiveSummary}</p>

              <h2>Hallazgos</h2>
              {llmResult.findings.map((f, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${severityColor[f.severity] || "#6b7280"}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    marginBottom: 8,
                  }}
                >
                  <strong>{f.plain}</strong>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{f.consequence}</div>
                  {f.needToUnderstand && (
                    <div style={{ fontSize: 13, marginTop: 4, color: "#4b5563" }}>
                      Clarificar con el cliente: {f.needToUnderstand}
                    </div>
                  )}
                </div>
              ))}

              <h2>Preguntas para el kickoff</h2>
              <ul>{llmResult.kickoffQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App