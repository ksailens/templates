import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

//customRenderer(
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        minify: false,
    },
    plugins: [tsconfigPaths()],
});
