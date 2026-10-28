import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app also works from GitHub Pages or a file share.
export default defineConfig({ plugins: [react()], base: './' });
