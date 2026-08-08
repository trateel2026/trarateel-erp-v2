import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readFileSync, existsSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'patch-html',
      closeBundle() {
        const htmlPath = './dist/index.html';
        if (!existsSync(htmlPath)) return;
        let html = readFileSync(htmlPath, 'utf8');
        // Add no-cache meta
        html = html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />`
        );
        // SW unregister script
        const swScript = `<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    var hadSW = regs.length > 0;
    Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
      if ('caches' in window) {
        caches.keys().then(function(keys) { return Promise.all(keys.map(function(k) { return caches.delete(k); })); })
          .then(function() { if (hadSW && !sessionStorage.getItem('sw-killed-v16')) { sessionStorage.setItem('sw-killed-v16','1'); window.location.reload(); } });
      }
    });
  });
}
<\/script>`;
        html = html.replace('</head>', swScript + '</head>');
        writeFileSync(htmlPath, html);
        console.log('✓ index.html patched');
      }
    }
  ],
  build: {
    rollupOptions: { output: { manualChunks: undefined } }
  }
})
