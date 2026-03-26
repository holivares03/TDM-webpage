// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://holivares03.github.io',
  base: '/TDM-webpage/',
  vite: {
    plugins: [tailwindcss()]
    
  }
});