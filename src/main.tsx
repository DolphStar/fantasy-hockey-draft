import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted so type never depends on a third-party request. One superfamily,
// two files: Archivo's `wdth` axis (62-125%) gives us both the body face and the
// expanded display face, and Archivo Narrow carries every number.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/archivo-narrow'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { MembershipProvider } from './context/MembershipContext'
import { ComparisonProvider } from './context/ComparisonContext'
import { SoundProvider } from './context/SoundContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <MembershipProvider>
            <ComparisonProvider>
              <SoundProvider>
                <MotionConfig reducedMotion="user">
                  <App />
                </MotionConfig>
                <ReactQueryDevtools initialIsOpen={false} />
              </SoundProvider>
            </ComparisonProvider>
          </MembershipProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
