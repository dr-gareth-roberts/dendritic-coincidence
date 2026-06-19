import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useAppStore } from './state/store'
import type { AppState } from './state/store'

declare global {
  interface Window {
    /** Verification affordance: the headless verifier reads sweep
     *  results, params, etc. through this handle. */
    __dendriticStore: typeof useAppStore
    /** Convenience alias for the store's getState — `store.getState()`
     *  works too but `store.s` saves a method call in a long verifier. */
    __dendriticState?: () => AppState
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Expose the zustand store on window for the headless verifier.
if (typeof window !== 'undefined') {
  window.__dendriticStore = useAppStore
  window.__dendriticState = () => useAppStore.getState()
}
