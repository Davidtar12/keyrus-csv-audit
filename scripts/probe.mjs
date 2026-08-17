// Verificación del motor completo contra el CSV de Lakeside
import fs from "fs";
import Papa from "papaparse";
import {
  profileColumns,
  detectMixedDateFormats,
  detectTemporalAnomalies,
  detectMathInconsistencies,
  detectDuplicateRows,
  detectOutliers,
  detectCasingInconsistencies,
} from "../src/lib/analysis.js";

const csv = fs.readFileSync("C:/Users/david/Downloads/AI Intern Challenge- Keyrus/lakeside_orders_sample.csv", "utf8");
const result = Papa.parse(csv, { header: true });
const rows = result.data.filter((r) =>
  Object.values(r).some((v) => v !== "" && v !== null)
);

console.log("=== Filas:", rows.length, "===");
console.log("\n[1] Profiler (nulls por columna):");
profileColumns(rows)
  .filter((c) => c.missing > 0)
  .forEach((c) => console.log(`  ${c.name}: ${c.missing} missing / ${c.unique} unique`));

console.log("\n[2] Fechas mixtas:");
detectMixedDateFormats(rows).forEach((f) =>
  console.log(`  ${f.column}: ${f.patterns.length} patrones ->`, JSON.stringify(f.patterns.slice(0, 3)))
);

console.log("\n[3] Temporal:");
detectTemporalAnomalies(rows).forEach((f) =>
  console.log(`  ${f.columnA} vs ${f.columnB}: ${f.count} anomalías, ejemplos ${JSON.stringify(f.examples)}`)
);
if (detectTemporalAnomalies(rows).length === 0) console.log("  (ninguna)");

const temporal = detectTemporalAnomalies(rows);
temporal.forEach((f) => console.log(`  ${f.columnA} vs ${f.columnB}: ${f.count} anomalias`));
if (temporal.length === 0) console.log("  (ninguna)");

console.log("\n[4] Math inconsistencies:");
detectMathInconsistencies(rows).forEach((f) =>
  console.log(`  ${f.totalColumn} ~ ${f.bestFormula}: ${f.mismatches} filas no cuadran (${f.mismatchPct}%)`)
);
if (detectMathInconsistencies(rows).length === 0) console.log("  (ninguna detectada)");

console.log("\n[5] Duplicados:");
const dups = detectDuplicateRows(rows);
console.log(`  ${dups.exact.length} filas duplicadas`);
dups.exact.slice(0, 3).forEach((d) => console.log(`  fila ${d.first} y ${d.duplicate}${d.column ? " por " + d.column : ""}`));

console.log("\n[6] Outliers (IQR 1.5x):");
detectOutliers(rows).forEach((f) =>
  console.log(`  ${f.column}: ${f.count} outliers (min ${f.min}, max ${f.max})`)
);
if (detectOutliers(rows).length === 0) console.log("  (ninguno)");

console.log("\n[7] Casing inconsistencies:");
detectCasingInconsistencies(rows).forEach((f) =>
  console.log(`  ${f.column} "${f.value}": ${JSON.stringify(f.variants)} (${JSON.stringify(f.counts)})`)
);
if (detectCasingInconsistencies(rows).length === 0) console.log("  (ninguna)");