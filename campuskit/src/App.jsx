import { Routes, Route, Navigate } from "react-router-dom";
import CgpaCalculator from "./pages/CgpaCalculator/CgpaCalculator";
import PassportMaker from "./pages/PassportMaker/PassportMaker";

function App() {
  return (
    <Routes>
      {/* Redirect root to CGPA Calculator for now */}
      <Route path="/" element={<Navigate to="/cgpa-calculator" replace />} />

      {/* Academic Tools */}
      <Route path="/cgpa-calculator" element={<CgpaCalculator />} />

      {/* Student Utilities */}
      <Route path="/passport-maker" element={<PassportMaker />} />
    </Routes>
  );
}

export default App;
