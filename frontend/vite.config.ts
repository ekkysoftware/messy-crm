import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Django mounts `frontend/dist` as `crm` static (settings.STATICFILES_DIRS) and
// django-vite resolves `src/app.tsx` through the manifest written here.
export default defineConfig({
  base: '/static/crm/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/app.tsx',
    },
  },
})
