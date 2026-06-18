import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useAppStore } from './state/store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Expose the zustand store on window for the headless verifier so it can
// read sweep results, params, etc. without scraping the DOM. This is a
// verification affordance only — production builds would strip it, but
// since this is a single-page browser playground the extra handle is
// fine.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__dendriticStore = useAppStore
}
