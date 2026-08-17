const MISSING_MARKERS = ["", "n/a", "NA", "N/A", "null", "none", "-"];

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