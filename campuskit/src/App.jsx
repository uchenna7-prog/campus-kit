import { Routes, Route } from "react-router-dom";

function Test() {
  return <h1 style={{padding:40}}>CampusKit is working</h1>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Test />} />
    </Routes>
  );
}

export default App;