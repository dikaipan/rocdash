/**
 * API Configuration
 * Handles API base URL for different environments
 * 
 * Usage:
 * - Development: Uses Vite proxy to /api (proxied to http://localhost:5000)
 * - Production: Uses VITE_API_BASE_URL environment variable if set,
 *   otherwise uses relative path /api (assumes backend on same domain)
 * 
 * To configure production API URL in Vercel:
 * 1. Go to Vercel project settings → Environment Variables
 * 2. Add: VITE_API_BASE_URL = https://your-backend-api.com/api
 * 3. Redeploy the application
 * 
 * Note: If backend is deployed separately, make sure to set CORS headers
 * to allow requests from your Vercel domain.
 */

// Get API base URL from environment variable or use default
const getApiBaseUrl = () => {
  // Check if we have a custom API URL in environment (works in both dev and prod)
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envApiUrl) {
    // Remove trailing slash if present
    return envApiUrl.replace(/\/$/, '');
  }
  
  // Default: use relative path
  // - In development: Works with Vite proxy (see vite.config.js)
  // - In production: Assumes backend is on same domain or via reverse proxy
  return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Log API configuration (only in development)
if (import.meta.env.DEV) {
  console.log('[API Config] Environment:', import.meta.env.MODE);
  console.log('[API Config] API Base URL:', API_BASE_URL);
  console.log('[API Config] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '(not set, using default /api)');
}

