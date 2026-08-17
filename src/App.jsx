import FileUpload from './components/FileUpload'
import Papa from 'papaparse'
import { profileColumns, detectMixedDateFormats } from './lib/analysis'



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
    const profiler = profileColumns(filas);
  console.log("Profiler:", profiler);
const fechas = detectMixedDateFormats(filas);console.log("Fechas:", fechas);
}  })
}} />
    </div>
  );
}
export default App