import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { SideBarProvider } from './contexts/SideBarContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SideBarProvider>
        <App />
      </SideBarProvider>
    </BrowserRouter>
  </StrictMode>
);