import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// vite-plugin-singlefile inlines all JS/CSS into dist/index.html,
// so the build output is again ONE portable HTML file.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { target: 'es2020' }
})
