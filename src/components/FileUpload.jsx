export default function FileUpload({ onFileSelected }) {
  const handleFile = (event) => {
    const file = event.target.files[0];
    if (file) onFileSelected(file);
  };

  return (
    <input
      type="file"
      accept=".csv"
      onChange={handleFile}
    />
  );
}