import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Force production mode for builds to avoid development chunks
  // This ensures react-router uses production builds, not development chunks
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    console.warn('⚠️  Warning: Building in non-production mode. This may cause module resolution issues.');
  } else {
    console.log('✅ Building in production mode');
  }
  
  return {
    // Explicitly set mode to production for builds
    mode: isProduction ? 'production' : mode,
    plugins: [react()],
    base: '/',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': '/src',
      },
      dedupe: ['react', 'react-dom', 'react-is', 'react-router', 'react-router-dom'], // Ensure single React instance
      preserveSymlinks: false,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable websocket proxy
          configure: (proxy, _options) => {
            proxy.on('error', (err, req, res) => {
              console.error('[Vite Proxy] Error:', err.message);
              console.error('[Vite Proxy] Request URL:', req.url);
              if (res && !res.headersSent) {
                res.writeHead(500, {
                  'Content-Type': 'application/json'
                });
                res.end(JSON.stringify({
                  error: 'Proxy error: Flask server may not be running',
                  message: 'Please ensure Flask server is running on port 5000'
                }));
              }
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite Proxy] Proxying:', req.method, req.url, '-> http://127.0.0.1:5000' + req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Response:', proxyRes.statusCode, req.url);
            });
          }
        }
      },
      historyApiFallback: true,
      open: true
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-is',
        'react-router',
        'react-router-dom',
        'react-hot-toast',
        'react-feather',
        'recharts', // Include recharts for pre-bundling to avoid runtime issues
        'react-leaflet', // Include react-leaflet for pre-bundling to avoid runtime issues
        'leaflet' // Include leaflet core for pre-bundling
      ],
      exclude: [],
      esbuildOptions: {
        target: 'esnext'
      }
    },
    build: {
      // Don't empty outDir automatically to avoid permission errors
      // We'll clean it manually in prebuild script
      emptyOutDir: false,
      target: 'esnext',
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Conservative chunking strategy to avoid React dependency issues:
            // 1. Split data files (safe, no React dependency)
            // 2. Split Leaflet core ONLY (safe, no React dependency - but react-leaflet needs React)
            // 3. EVERYTHING ELSE goes to vendor-react to ensure React is always available
            // 
            // This is safer than trying to guess which packages need React.
            // Some packages may have hidden React dependencies or peer dependencies.
            
            if (id.includes('node_modules')) {
              // Large data files (definitely safe to split - no dependencies)
              if (id.includes('geojson') || id.includes('indonesia-prov')) {
                return 'data-geojson';
              }
              
              // Leaflet core ONLY (not react-leaflet or @changey/react-leaflet)
              // Leaflet core doesn't need React, but react-leaflet wrappers do
              if (
                id.includes('node_modules/leaflet/') && 
                !id.includes('react-leaflet') && 
                !id.includes('@changey/react-leaflet')
              ) {
                return 'vendor-maps';
              }
              
              // React Router packages should stay together
              if (id.includes('react-router')) {
                return 'vendor-react';
              }
              
              // EVERYTHING ELSE (including all React packages, react-router, react-leaflet, papaparse, etc.)
              // goes into vendor-react to ensure React is always available when needed
              // This prevents "Cannot read properties of undefined (reading 'forwardRef')" errors
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      // Optimize chunk loading
      sourcemap: false, // Disable sourcemaps in production for smaller builds
      minify: 'esbuild', // Use esbuild for faster builds (terser requires additional package)
      // Note: To remove console.log, add this to build command or use a plugin
    },
  };
});
