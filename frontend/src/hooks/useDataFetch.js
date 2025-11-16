/**
 * Generic data fetching hook
 * Reusable hook for fetching data from API with error handling and loading states
 * Includes global cache to prevent unnecessary re-fetching on navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../utils/apiConfig';

// Check for scheduler.postTask availability (better priority management)
const hasPostTask = typeof scheduler !== 'undefined' && scheduler.postTask;

// Global cache for all fetched data
// Structure: { endpoint: { data, timestamp, parser } }
const dataCache = new Map();

// Global tracking of pending fetches to prevent duplicate requests
// Structure: { endpoint: Promise }
const pendingFetches = new Map();

// Cache expiration time: 5 minutes
const CACHE_EXPIRATION_MS = 5 * 60 * 1000;

// Background refresh threshold: don't refresh if cache is less than 30 seconds old
const BACKGROUND_REFRESH_THRESHOLD_MS = 30 * 1000;

// Check if cache entry is still valid
const isCacheValid = (cacheEntry) => {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  const age = Date.now() - cacheEntry.timestamp;
  return age < CACHE_EXPIRATION_MS;
};

// Get cached data for endpoint
const getCachedData = (endpoint, parser) => {
  const cacheEntry = dataCache.get(endpoint);
  if (!cacheEntry) return null;
  
  // Check if cache is valid
  if (!isCacheValid(cacheEntry)) {
    dataCache.delete(endpoint);
    return null;
  }
  
  // If parser changed, invalidate cache
  if (parser && cacheEntry.parser !== parser) {
    dataCache.delete(endpoint);
    return null;
  }
  
  return cacheEntry.data;
};

// Check if cache is fresh enough to skip background refresh
const isCacheFresh = (cacheEntry) => {
  if (!cacheEntry || !cacheEntry.timestamp) return false;
  const age = Date.now() - cacheEntry.timestamp;
  return age < BACKGROUND_REFRESH_THRESHOLD_MS;
};

// Set cached data for endpoint
const setCachedData = (endpoint, data, parser) => {
  dataCache.set(endpoint, {
    data,
    timestamp: Date.now(),
    parser: parser?.toString() || null
  });
};

/**
 * Generic data fetching hook
 * @param {string} endpoint - API endpoint (e.g., '/api/engineers')
 * @param {Object} options - Additional options
 * @param {Function} options.parser - Optional parser function for data transformation
 * @param {boolean} options.autoFetch - Whether to fetch automatically on mount (default: true)
 * @param {string} options.eventName - Custom event name to listen for data refresh
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @returns {Object} { data, loading, error, refetch }
 */
export function useDataFetch(endpoint, options = {}) {
  const {
    parser = null,
    autoFetch = true,
    eventName = null,
    useCache = true, // Enable cache by default
  } = options;

  // Initialize with cached data if available
  const cachedData = useCache ? getCachedData(endpoint, parser) : null;
  const [data, setData] = useState(cachedData || []);
  const [loading, setLoading] = useState(autoFetch && !cachedData); // Don't show loading if we have cache
  const [error, setError] = useState(null);

  // Use useRef to store parser to avoid dependency issues
  // This ensures fetchData callback doesn't change when parser changes
  const parserRef = useRef(parser);
  parserRef.current = parser; // Update ref on every render (no effect needed)

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check if there's already a pending fetch for this endpoint
    const existingFetch = pendingFetches.get(endpoint);
    if (existingFetch && !forceRefresh) {
      // Wait for existing fetch to complete and use its result
      try {
        const result = await existingFetch;
        const processedData = parserRef.current ? parserRef.current(result) : result;
        setData(processedData);
        setLoading(false);
        setError(null);
        return;
      } catch (err) {
        // If existing fetch failed, continue with new fetch
      }
    }
    
    // Check cache first if not forcing refresh
    if (!forceRefresh && useCache) {
      const cached = getCachedData(endpoint, parserRef.current);
      if (cached) {
        setData(cached);
        setLoading(false);
        setError(null);
        // Still fetch in background for stale-while-revalidate strategy
        // But don't block UI with loading state
      }
    }
    
    // Create fetch promise and track it
    const fetchPromise = (async () => {
      try {
        if (forceRefresh || !useCache || !getCachedData(endpoint, parserRef.current)) {
          setLoading(true);
        }
        setError(null);
        
        const url = endpoint.startsWith('http')
          ? endpoint
          : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        // Use parserRef.current to get the latest parser without adding it to dependencies
        const processedData = parserRef.current ? parserRef.current(result) : result;
        
        // Update cache
        if (useCache) {
          setCachedData(endpoint, processedData, parserRef.current);
        }
        
        setData(processedData);
        return result;
      } catch (err) {
        console.error(`Error fetching data from ${endpoint}:`, err);
        setError(err.message);
        // On error, keep cached data if available
        if (useCache) {
          const cached = getCachedData(endpoint, parserRef.current);
          if (cached) {
            setData(cached);
          }
        }
        throw err;
      } finally {
        setLoading(false);
        // Remove from pending fetches when done
        if (pendingFetches.get(endpoint) === fetchPromise) {
          pendingFetches.delete(endpoint);
        }
      }
    })();
    
    // Track this fetch promise
    pendingFetches.set(endpoint, fetchPromise);
    
    // Wait for fetch to complete
    await fetchPromise;
  }, [endpoint, useCache]); // Only endpoint and useCache in dependencies - parser is accessed via ref

  useEffect(() => {
    // Abort controller for cleanup
    const abortController = new AbortController();
    let timeoutId = null;
    let isPending = false;
    let rafId = null;
    let idleCallbackId = null;
    let cleanupEvent = null;

    if (autoFetch && !abortController.signal.aborted) {
      // If we have cached data, use it immediately
      const cached = useCache ? getCachedData(endpoint, parserRef.current) : null;
      const cacheEntry = useCache ? dataCache.get(endpoint) : null;
      
      if (cached) {
        setData(cached);
        setLoading(false);
        
        // Only fetch in background if cache is stale enough and no fetch is pending
        // Skip background refresh if cache is very fresh (< 30 seconds)
        const shouldRefresh = !isCacheFresh(cacheEntry) && !pendingFetches.has(endpoint);
        
        if (shouldRefresh) {
          // Fetch in background to refresh cache (stale-while-revalidate)
          // Use setTimeout to avoid blocking initial render
          timeoutId = setTimeout(() => {
            if (!abortController.signal.aborted && !pendingFetches.has(endpoint)) {
              fetchData(true).catch(() => {
                // Silent fail for background refresh
              });
            }
          }, 100);
        }
      } else {
        // No cache, fetch immediately (but check for pending fetch first)
        const existingFetch = pendingFetches.get(endpoint);
        if (!existingFetch) {
          fetchData();
        } else {
          // Wait for existing fetch and use its result
          existingFetch.then((result) => {
            if (!abortController.signal.aborted) {
              const processedData = parserRef.current ? parserRef.current(result) : result;
              setData(processedData);
              setLoading(false);
            }
          }).catch(() => {
            // If existing fetch failed, try fetching again
            if (!abortController.signal.aborted) {
              fetchData();
            }
          });
        }
      }
    }

    // Listen for custom events to refresh data
    // Optimized: Debounce rapid events and use requestIdleCallback to avoid performance issues
    if (eventName) {
      const handleDataChange = () => {
        // Skip if aborted
        if (abortController.signal.aborted) return;
        
        // Clear existing timeout, RAF, and idle callback
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        if (idleCallbackId && window.cancelIdleCallback) {
          window.cancelIdleCallback(idleCallbackId);
        }
        
        // Aggressive debounce: wait 500ms before fetching to batch rapid events
        // This prevents message handler violations from too many rapid events
        timeoutId = setTimeout(() => {
          if (!isPending && !abortController.signal.aborted) {
            isPending = true;
            
            // Defer fetch to reduce message handler work
            // Use scheduler.postTask if available for better priority management
            const executeFetch = () => {
              if (abortController.signal.aborted) {
                isPending = false;
                return;
              }
              
              fetchData(true).then(() => {
                isPending = false;
              }).catch(() => {
                isPending = false;
              });
            };
            
            // Use scheduler.postTask for better performance (Chrome 94+)
            if (hasPostTask) {
              scheduler.postTask(executeFetch, { priority: 'user-visible' });
            } else if (window.requestIdleCallback) {
              // Fallback to requestIdleCallback
              idleCallbackId = window.requestIdleCallback(executeFetch, { timeout: 2000 });
            } else {
              // Final fallback: use setTimeout
              setTimeout(executeFetch, 0);
            }
          }
        }, 500); // Increased to 500ms to batch more events and reduce violations
      };

      window.addEventListener(eventName, handleDataChange, { passive: true });
      cleanupEvent = () => {
        window.removeEventListener(eventName, handleDataChange);
      };
    }

    // Always return cleanup function
    return () => {
      abortController.abort();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (idleCallbackId && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (cleanupEvent) {
        cleanupEvent();
      }
    };
  }, [autoFetch, eventName, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true), // Always force refresh on manual refetch
  };
}

// Export function to clear cache (useful for logout or manual refresh)
export function clearDataCache(endpoint = null) {
  if (endpoint) {
    dataCache.delete(endpoint);
  } else {
    dataCache.clear();
  }
}

// Export function to clear pending fetches (useful for cleanup)
export function clearPendingFetches(endpoint = null) {
  if (endpoint) {
    pendingFetches.delete(endpoint);
  } else {
    pendingFetches.clear();
  }
}

// Export function to get cache size (for debugging)
export function getCacheSize() {
  return dataCache.size;
}

