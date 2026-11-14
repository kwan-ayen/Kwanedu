import fs from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-legacy-static-assets',
        apply: 'build',
        closeBundle() {
          const output = path.resolve(import.meta.dirname, 'dist');
          fs.cpSync(path.resolve(import.meta.dirname, 'src/assets'), path.join(output, 'src/assets'), {
            recursive: true,
          });
          const uploads = path.resolve(import.meta.dirname, 'data/uploads');
          if (fs.existsSync(uploads)) {
            fs.cpSync(uploads, path.join(output, 'uploads'), { recursive: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
