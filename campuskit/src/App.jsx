import { Routes, Route } from 'react-router-dom';
// Updated import to reflect the new component name
import CgpaCalculator from './pages/CgpaCalculator/CgpaCalculator'; 
import GPACalculator from './pages/GpaCalculator/GpaCalculator';
import CGPAPredictor from './pages/CgpaPredictor/CgpaPredictor';
import Settings from './pages/Settings/Settings';
import Summary from './pages/Summary/Summary';
import CGPAPredictorSummary from './pages/CGPAPredictorSummary/CGPAPredictorSummary';
import GpaCalculatorSummary from './pages/GpaCalculatorSummary/GpaCalculatorSummary';
import Guide from './pages/Guide/Guide';

function App() {
  return (
    <Routes>
      {/* The main landing page is now the CGPA Calculator */}
      <Route path="/" element={<CgpaCalculator />} />
      
      <Route path="/guide" element={<Guide />} />
      <Route path="/gpaCalculator" element={<GPACalculator />} />
      <Route path="/cgpaPredictor" element={<CGPAPredictor />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/cgpaPredictorSummary" element={<CGPAPredictorSummary />} />
      <Route path="/gpaCalculatorSummary" element={<GpaCalculatorSummary />} />
    </Routes>
  );
}

export default App;
