import { Routes, Route } from 'react-router-dom';
// Updated import to reflect the new component name
import CgpaCalculator from './pages/CgpaCalculator/CgpaCalculator';

function App() {
  return (
    <Routes>
     
      <Route path="/" element={<CgpaCalculator />} />
      
     
    </Routes>
  );
}

export default App;
