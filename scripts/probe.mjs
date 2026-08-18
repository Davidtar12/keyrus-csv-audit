// Full engine verification. Usage: node scripts/probe.mjs [path/to/file.csv]
// Defaults to the bundled Lakeside sample in data/.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] || path.join(here, "../data/lakeside_orders_sample.csv");
const csv = fs.readFileSync(csvPath, "utf8");
const result = Papa.parse(csv, { header: true });
const rows = result.data.filter((r) =>
  Object.values(r).some((v) => v !== "" && v !== null)
);

console.log(`=== ${path.basename(csvPath)} - ${rows.length} rows ===`);

console.log("\n[1] Completeness (columns with missing values):");
profileColumns(rows)
  .filter((c) => c.missing > 0)
  .forEach((c) => console.log(`  ${c.name}: ${c.missing} missing / ${c.unique} unique`));

console.log("\n[2] Mixed date formats:");
const dates = detectMixedDateFormats(rows);
dates.forEach((f) =>
  console.log(`  ${f.column}: ${f.patterns.length} patterns`)
);
if (dates.length === 0) console.log("  (none)");

console.log("\n[3] Temporal anomalies:");
const temporal = detectTemporalAnomalies(rows);
temporal.forEach((f) => console.log(`  ${f.columnA} vs ${f.columnB}: ${f.count} anomalies`));
if (temporal.length === 0) console.log("  (none)");

console.log("\n[4] Math inconsistencies:");
const math = detectMathInconsistencies(rows);
math.forEach((f) =>
  console.log(`  ${f.totalColumn} ~ ${f.bestFormula}: ${f.mismatches} rows off (${f.mismatchPct}%)`)
);
if (math.length === 0) console.log("  (none detected)");

console.log("\n[5] Duplicates:");
const dups = detectDuplicateRows(rows);
const exact = dups && Array.isArray(dups.exact) ? dups.exact : [];
console.log(`  ${exact.length} exact duplicate rows`);
exact.slice(0, 3).forEach((d) => console.log(`  row ${d.first} and ${d.duplicate}${d.column ? " by " + d.column : ""}`));

console.log("\n[6] Outliers (IQR 1.5x):");
const outliers = detectOutliers(rows);
outliers.forEach((f) => console.log(`  ${f.column}: ${f.count} outliers (min ${f.min}, max ${f.max})`));
if (outliers.length === 0) console.log("  (none)");

console.log("\n[7] Casing inconsistencies:");
const casing = detectCasingInconsistencies(rows);
casing.forEach((f) => console.log(`  ${f.column} "${f.value}": ${f.variants.length} variants`));
if (casing.length === 0) console.log("  (none)");