import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { LeagueProvider } from './context/LeagueContext'
import { DraftProvider } from './context/DraftContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LeagueProvider>
        <DraftProvider>
          <App />
        </DraftProvider>
      </LeagueProvider>
    </AuthProvider>
  </StrictMode>,
)
