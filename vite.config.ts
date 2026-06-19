import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pin the dev-server port so the headless verifier (.verify/verify.ts,
  // which hardcodes http://localhost:5273/) can find the running server
  // without racing on whatever the OS hands out.
  server: {
    port: 5273,
    strictPort: true,
  },
})
