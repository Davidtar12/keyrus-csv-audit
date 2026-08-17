const MISSING_MARKERS = ["", "n/a", "NA", "N/A", "null", "none", "-"];

function looksLikeDate(value) {
  return !isNaN(Date.parse(String(value))) && /\D/.test(String(value));
}

export function profileColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  return columns.map((col) => {
    const values = rows.map((r) => r[col]);
    const missing = values.filter((v) => MISSING_MARKERS.includes(v)).length;
    return {
      name: col,
      missing,
      nonMissing: values.length - missing,
      unique: new Set(values.filter((v) => !MISSING_MARKERS.includes(v))).size,
    };
  });
}

export function detectMixedDateFormats(rows) {
  const columns = Object.keys(rows[0] || {});
  const findings = [];

  columns.forEach((col) => {
    const values = rows.map((r) => r[col]).filter((v) => !MISSING_MARKERS.includes(v));
    if (values.length === 0) return;

    const dateLike = values.filter((v) => looksLikeDate(v)).length;
    if (dateLike / values.length < 0.8) return; // menos del 80% "sabe a fecha" -> no es columna de fechas

    const patterns = new Map();
    values.forEach((value) => {
      const pattern = String(value).replace(/\d/g, "9");
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    if (patterns.size > 1) {
      findings.push({
        column: col,
        patterns: [...patterns.entries()].map(([p, c]) => ({ pattern: p, count: c })),
      });
    }
  });

  return findings;
}