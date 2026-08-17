const MISSING_MARKERS = ["", "n/a", "NA", "N/A", "null", "none", "-"];

function parseDateValue(value) {
  const s = String(value).trim();
  if (s === "") return NaN;

  // epoch en segundos (10 dígitos)
  if (/^\d{10}$/.test(s)) return parseInt(s, 10) * 1000;

  // ISO: 2025-02-09 o 2025-02-09 04:00:00
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

  // US: 04/16/2024 (mes/día/año — el default de JS)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]).getTime();

  // EU: 30-09-2024 (día/mes/año — el de tu CSV)
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();

  // Mes escrito: "Mar 24, 2024" o "24 Mar 2024"
  m = s.match(/(\d{1,2})[ ,]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ ,]*(\d{2,4})/i);
  if (m) {
    const meses = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const dia = +m[1], mes = meses[m[2].toLowerCase()], anio = +m[3];
    return anio < 100 ? new Date(2000 + anio, mes, dia).getTime() : new Date(anio, mes, dia).getTime();
  }

  return NaN;
}

function looksLikeDate(value) {
  const t = parseDateValue(value);
  if (isNaN(t)) return false;
  const year = new Date(t).getFullYear();
  return year >= 1900 && year <= 2100;
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

function dateColumns(rows) {
  const columns = Object.keys(rows[0] || {});
  return columns.filter((col) => {
    const values = rows.map((r) => r[col]).filter((v) => !MISSING_MARKERS.includes(v));
    if (!values.length) return false;
    return values.filter((v) => looksLikeDate(v)).length / values.length >= 0.8;
  });
}

export function detectTemporalAnomalies(rows) {
  const cols = dateColumns(rows);
  const findings = [];

  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i], b = cols[j];
      if (a.split("_").pop() !== b.split("_").pop()) continue; // mismo sufijo

      let tooEarly = 0;
      const examples = [];
      rows.forEach((row, idx) => {
        const ta = parseDateValue(String(row[a]));
        const tb = parseDateValue(String(row[b]));
        if (!isNaN(ta) && !isNaN(tb) && tb < ta) {
          tooEarly++;
          if (examples.length < 3) examples.push(idx);
        }
      });

      if (tooEarly > 0) {
        findings.push({ columnA: a, columnB: b, count: tooEarly, examples });
      }
    }
  }
  return findings;
}