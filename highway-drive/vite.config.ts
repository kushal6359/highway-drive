import { defineConfig } from 'vite';
export default defineConfig({base:'./',worker:{format:'es'},build:{target:'es2022',assetsInlineLimit:4096,chunkSizeWarningLimit:900},server:{host:'0.0.0.0'}});
