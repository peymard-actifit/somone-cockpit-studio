import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

console.log('🚀 Application SOMONE Cockpit Studio démarre...');

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  );
  console.log('✅ Rendu React réussi');
} catch (error) {
  console.error('❌ Erreur lors du rendu React:', error);
  document.getElementById('root')!.innerHTML = `
    <div style="padding: 20px; background: #7f1d1d; color: white; min-height: 100vh;">
      <h1>Erreur de démarrage</h1>
      <pre style="background: rgba(0,0,0,0.5); padding: 10px; overflow: auto;">${error}</pre>
    </div>
  `;
}


