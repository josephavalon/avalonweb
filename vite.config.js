import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'info',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Split the main chunk so the Hero/above-the-fold ships before heavy
        // below-the-fold sections parse. React + Framer Motion stay in the
        // entry so transitions don't wait on a second request.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            // Heavy, below-the-fold landing sections become their own chunk.
            if (
              id.includes('/landing/OurDrips') ||
              id.includes('/landing/MembershipSection') ||
              id.includes('/landing/Testimonials') ||
              id.includes('/landing/FAQ')
            ) {
              return 'landing-below-fold'
            }
            return undefined
          }
          // Third-party split: keep Radix primitives out of the entry chunk
          // (they're only referenced by dialog, toast, accordion — all below
          // the fold on home).
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('lucide-react')) return 'icons'
          return undefined
        },
      },
    },
  },
});
