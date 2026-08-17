// Verificación temporal: corre el motor real contra el CSV de Lakeside
import fs from "fs";
import Papa from "papaparse";
import { detectTemporalAnomalies } from "../src/lib/analysis.js";

const csv = fs.readFileSync("C:/Users/david/Downloads/AI Intern Challenge- Keyrus/lakeside_orders_sample.csv", "utf8");
const result = Papa.parse(csv, { header: true });
const rows = result.data.filter((r) =>
  Object.values(r).some((v) => v !== "" && v !== null)
);

console.log("Filas:", rows.length);
console.log("Temporal:", JSON.stringify(detectTemporalAnomalies(rows), null, 2));