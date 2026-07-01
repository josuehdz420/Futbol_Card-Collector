import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://josuehdz420.github.io',
  base: '/Futbol_Card-Collector',
  output: 'static',
  build: {
    assets: 'assets'
  }
});