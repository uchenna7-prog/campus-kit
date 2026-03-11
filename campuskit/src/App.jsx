import { Routes, Route } from "react-router-dom";
import CgpaCalculator from "./pages/CgpaCalculator/CgpaCalculator";

function App() {
  return (
    <Routes>
      {/* Root route: CGPA Calculator */}
      <Route path="/" element={<CgpaCalculator />} />
      {/* You can add more routes here in the future */}
    </Routes>
  );
}

export default App;