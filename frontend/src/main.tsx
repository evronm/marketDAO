import React from 'react';
import ReactDOM from 'react-dom/client';
import { DAOProvider } from './contexts/DAOContext';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DAOProvider>
      <App />
    </DAOProvider>
  </React.StrictMode>
);
