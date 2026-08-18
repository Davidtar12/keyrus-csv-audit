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

function numericValues(rows, col) {
  return rows.map((r) => {
    const v = String(r[col] ?? "").replace(/[$%,]/g, "").trim();
    const n = Number(v);
    return isNaN(n) ? null : n;
  });
}

export function detectMathInconsistencies(rows) {
  const columns = Object.keys(rows[0] || {});
  const numeric = columns.filter((col) => {
    const vals = numericValues(rows, col);
    const ok = vals.filter((v) => v !== null).length;
    return ok / vals.length >= 0.7;
  });

  const totals = numeric.filter((c) => /total|amount|sum|revenue/i.test(c));
  const factors = numeric.filter((c) => !totals.includes(c));
  const findings = [];

  totals.forEach((totalCol) => {
    const totalVals = numericValues(rows, totalCol);
    let best = null;

    factors.forEach((a) => {
      const av = numericValues(rows, a);
      factors.forEach((b) => {
        if (b <= a) return;
        const bv = numericValues(rows, b);

        // Opción 1: producto simple a × b
        let match = 0, checked = 0;
        totalVals.forEach((t, i) => {
          if (t === null || av[i] === null || bv[i] === null) return;
          checked++;
          if (Math.abs(t - av[i] * bv[i]) <= 0.01) match++;
        });
        const scoreSimple = checked > 0 ? match / checked : 0;

        // Opción 2: con descuento a × b × (1 − c)
        let bestDisc = null;
        const candidatesDisc = factors.filter((c) => c !== a && c !== b);
        candidatesDisc.forEach((c) => {
          const cv = numericValues(rows, c);
          let dm = 0, dc = 0, dSum = 0;
          totalVals.forEach((t, i) => {
            if (t === null || av[i] === null || bv[i] === null || cv[i] === null) return;
            dc++;
            const expected = av[i] * bv[i] * (1 - cv[i]);
            if (Math.abs(t - expected) <= 0.01) dm++;
          });
          if (dc > 0 && (!bestDisc || dm / dc > bestDisc.score)) {
            bestDisc = { col: c, score: dm / dc, match: dm, checked: dc };
          }
        });

        const scoreBest = bestDisc && bestDisc.score > scoreSimple ? bestDisc.score : scoreSimple;
        const bestMatch = bestDisc && bestDisc.score > scoreSimple ? bestDisc.match : match;
        const bestChecked = bestDisc && bestDisc.score > scoreSimple ? bestDisc.checked : checked;

        if (checked > 0 && (!best || scoreBest > best.score)) {
          best = {
            factorA: a, factorB: b,
            discountCol: bestDisc && bestDisc.score > scoreSimple ? bestDisc.col : null,
            score: scoreBest, match: bestMatch, checked: bestChecked,
          };
        }
      });
    });

    if (best && best.checked > 0 && best.score < 1) {
      findings.push({
        totalColumn: totalCol,
        factorA: best.factorA,
        factorB: best.factorB,
        discountCol: best.discountCol,
        mismatches: best.checked - best.match,
        mismatchPct: Math.round((1 - best.score) * 100),
        bestFormula:
          best.discountCol
            ? `${best.factorA} x ${best.factorB} x (1 - ${best.discountCol})`
            : `${best.factorA} x ${best.factorB}`,
      });
    }
  });

  return findings;
}

export function detectDuplicateRows(rows) {
  const seen = new Map();
  const duplicates = { exact: [], byKey: [] };
  const columns = Object.keys(rows[0] || {});

  rows.forEach((row, idx) => {
    const key = JSON.stringify(Object.values(row).map((v) => String(v).toLowerCase()));
    if (seen.has(key)) {
      duplicates.exact.push({ first: seen.get(key), duplicate: idx });
    } else {
      seen.set(key, idx);
    }
  });

  // Solo columnas ID casi-únicas califican como llave de fila
  const keyCols = columns.filter((col) => {
    if (!/id$/i.test(col)) return false;
    const vals = rows.map((r) => r[col]).filter((v) => v !== "" && v !== null);
    const unique = new Set(vals).size;
    return unique / vals.length >= 0.9; // 90%+ únicos -> es una llave de registro
  });

  keyCols.forEach((col) => {
    const byKey = new Map();
    rows.forEach((row, idx) => {
      const v = row[col];
      if (v === "" || v === null) return;
      if (byKey.has(v)) {
        duplicates.byKey.push({ first: byKey.get(v), duplicate: idx, column: col });
      } else {
        byKey.set(v, idx);
      }
    });
  });

  return duplicates.exact.length + duplicates.byKey.length > 0
    ? duplicates
    : [];
}

export function detectOutliers(rows) {
  const columns = Object.keys(rows[0] || {});
  const findings = [];

  columns.forEach((col) => {
    const vals = numericValues(rows, col).filter((v) => v !== null);
    if (vals.length < 10) return;

    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;

    const outliers = vals.filter((v) => v < low || v > high);
    if (outliers.length > 0) {
      findings.push({
        column: col,
        count: outliers.length,
        min: Math.min(...outliers),
        max: Math.max(...outliers),
        q1, q3, low, high,
        examples: outliers.slice(0, 3),
      });
    }
  });

  return findings;
}

export function detectCasingInconsistencies(rows) {
  const columns = Object.keys(rows[0] || {});
  const findings = [];

  columns.forEach((col) => {
    const vals = rows.map((r) => r[col]).filter((v) => !MISSING_MARKERS.includes(v));
    if (vals.length === 0) return;

    const groups = new Map();
    vals.forEach((v) => {
      const key = String(v).toLowerCase();
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(String(v));
    });

    groups.forEach((forms, key) => {
      if (forms.size > 1) {
        findings.push({
          column: col,
          value: key,
          variants: [...forms],
          counts: [...forms].map((f) => vals.filter((v) => String(v) === f).length),
        });
      }
    });
  });

  return findings;
}

export function formatFindingsForLLM(report) {
  const lines = [];
  const { rows, findings } = report;
  lines.push(`The file has ${rows} data rows.`);

  const missingCols = findings.columns.filter((c) => c.missing > 0);
  if (missingCols.length > 0) {
    const totalMissing = missingCols.reduce((s, c) => s + c.missing, 0);
    const worst = [...missingCols].sort((a, b) => b.missing - a.missing)[0];
    lines.push(
      `${missingCols.length} of ${findings.columns.length} columns have missing values (${totalMissing} cells total). ` +
      `Worst affected: "${worst.name}" missing in ${worst.missing} rows.`
    );
  }

  findings.dateFormats.forEach((f) => {
    lines.push(
      `Column "${f.column}" has ${f.patterns.length} different date formats (e.g. "${f.patterns[0].pattern}" appears ${f.patterns[0].count} times).`
    );
  });

  findings.temporal.forEach((f) => {
    lines.push(
      `In ${f.count} rows, "${f.columnB}" is earlier than "${f.columnA}" (e.g. shipped before ordered).`
    );
  });

  findings.math.forEach((f) => {
    lines.push(
      `In ${f.mismatches} rows (${f.mismatchPct}%), "${f.totalColumn}" does not match ${f.bestFormula}.`
    );
  });

  const dup = findings.duplicates;
  if (dup && dup.exact && dup.exact.length > 0) {
    lines.push(`${dup.exact.length} rows are exact duplicates.`);
  }
  if (dup && dup.byKey && dup.byKey.length > 0) {
    lines.push(`${dup.byKey.length} rows repeat the same record key (e.g. same order id).`);
  }

  findings.outliers.forEach((f) => {
    lines.push(
      `Column "${f.column}" has ${f.count} unusual values (range ${f.min} to ${f.max}).`
    );
  });

  findings.casing.forEach((f) => {
    const total = f.counts.reduce((a, b) => a + b, 0);
    lines.push(
      `Column "${f.column}" writes "${f.value}" in ${f.variants.length} different ways across ${total} rows (e.g. ${f.variants.join(", ")}).`
    );
  });

  return lines.join("\n");
}