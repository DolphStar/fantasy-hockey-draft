import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { LeagueProvider } from './context/LeagueContext'
import { DraftProvider } from './context/DraftContext'
import { ComparisonProvider } from './context/ComparisonContext'
import { SoundProvider } from './context/SoundContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// Create a client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LeagueProvider>
          <DraftProvider>
            <ComparisonProvider>
              <SoundProvider>
                <App />
                <ReactQueryDevtools initialIsOpen={false} />
              </SoundProvider>
            </ComparisonProvider>
          </DraftProvider>
        </LeagueProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
