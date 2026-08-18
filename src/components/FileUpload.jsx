export default function FileUpload({ onFileSelected }) {
  const handleFile = (event) => {
    const file = event.target.files[0];
    if (file) onFileSelected(file);
  };

  return (
    <label className="block border border-dashed border-muted/50 rounded-md bg-white p-8 text-center cursor-pointer hover:border-accent transition-colors">
      <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      <p className="font-medium text-[15px]">Upload a CSV file</p>
      <p className="text-sm text-muted mt-1">Any reasonable file — the analysis detects patterns, not fixed columns.</p>
    </label>
  );
}