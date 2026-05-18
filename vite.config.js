import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// TEMPORARY: Disabled React plugin due to $RefreshSig$ injection error in dev mode
// Using Vite's native JSX support instead (tsx/jsx auto-detected)

// https://vite.dev/config/
export default defineConfig({
  // Use relative base path for Electron file:// protocol support
  // Browser: server uses /assets/, Electron file:// uses ./assets/
  base: './',
  plugins: [
    // react({
    //   fastRefresh: false,
    // }),
    // Serve .wasm files with correct MIME type so ONNX Runtime can load them
    {
      name: 'wasm-content-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          // COOP + COEP headers — required for SharedArrayBuffer, which ONNX Runtime
          // WASM threading depends on. Without these, browsers disable SharedArrayBuffer
          // and the threaded WASM backend stalls silently on first use.
          // NOTE: Use 'credentialless' (not 'require-corp') — 'require-corp' blocks
          // cross-origin fetches from CDNs (like HuggingFace) that don't send a
          // Cross-Origin-Resource-Policy header, silently killing model downloads.
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
          next()
        })
      },
    },
  ],
  optimizeDeps: {
    // webaudio-tinysynth ships as a CJS UMD module — force pre-bundling so
    // Vite's ESM dev server can import it correctly.
    include: ['webaudio-tinysynth'],
  },
  build: {
    // Raise the chunk-size warning threshold to 1500 kB.
    // transformers.js and onnxruntime-web are large intentional third-party
    // dependencies — splitting them further would break their internal loading.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split known large third-party libs into their own named chunks.
        // NOTE: onnxruntime-web/dist/ort-web.min.js contains a direct `eval()` call
        // inside its own minified bundle. This is a known upstream issue in
        // onnxruntime-web (tracked at https://github.com/microsoft/onnxruntime/issues).
        // We have no control over it — it is NOT in our application code.
        // It is safe to acknowledge and ignore this warning for release builds.
        manualChunks: (id) => {
          if (id.includes('@xenova/transformers') || id.includes('@huggingface/transformers')) return 'vendor-transformers'
          if (id.includes('onnxruntime-web') || id.includes('onnxruntime-common')) return 'vendor-onnx'
          if (id.includes('pdfjs-dist')) return 'vendor-pdf'
          if (id.includes('jszip') || id.includes('pako')) return 'vendor-jszip'
        },
      },
    },
  },
})
