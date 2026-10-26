import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// En développement : modules séparés et rechargement instantané.
// À la construction : un seul fichier HTML autonome, publiable comme artefact.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100_000_000 },
  test: { environment: 'node' },
});
