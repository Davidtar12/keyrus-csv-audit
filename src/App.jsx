import FileUpload from './components/FileUpload'
import Papa from 'papaparse'

function App() {
  return (
    <div>
      <h1>CSV Data Audit</h1>
      <FileUpload onFileSelected={(file) => {
  Papa.parse(file, {
    header: true,
complete: (result) => {
  const filas = result.data.filter((fila) =>
    Object.values(fila).some((valor) => valor !== "" && valor !== null)
  );
  console.log("Filas reales:", filas.length);
}  })
}} />
    </div>
  );
}
export default App