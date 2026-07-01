import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { msalReady } from './lib/msal'

// MsalProvider necesita que la instancia esté inicializada antes de montar
// el árbol de React (procesa internamente la respuesta del login redirect).
msalReady.then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
