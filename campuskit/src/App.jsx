import { Routes, Route } from "react-router-dom";
import CgpaCalculator from "./pages/CgpaCalculator/CgpaCalculator";

function App() {
  return (
    <Routes>
      <Route path="/" element={<CgpaCalculator />} />
    </Routes>
  );
}

export default App;