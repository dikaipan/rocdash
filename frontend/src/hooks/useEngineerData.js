/**
 * Data hooks using generic useDataFetch
 * Refactored to use reusable useDataFetch hook
 */
import { useDataFetch } from './useDataFetch';

// CSV Parser functions (kept for fallback support)
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    if (row.id && row.name) {
      row.area_group = row.area_group || 'Unknown';
      row.region = row.region || 'Unknown';
      row.vendor = row.vendor || 'Unknown';
      row.years_experience = row.years_experience || '0';
      row.latitude = row.latitude || '-6.1865';
      row.longitude = row.longitude || '106.6318';
      data.push(row);
    }
  }
  
  return data;
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

const parseMachinesCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    if (row.wsid && row.branch_name) {
      row.customer = row.customer || 'Unknown';
      row.provinsi = row.provinsi || 'Unknown';
      row.region = row.region || 'Unknown';
      row.area_group = row.area_group || 'Unknown';
      row.city = row.city || 'Unknown';
      row.machine_type = row.machine_type || 'Unknown';
      row.machine_status = row.machine_status || 'Unknown';
      row.maintenance_status = row.maintenance_status || 'Unknown';
      row.year = row.year || new Date().getFullYear().toString();
      row.latitude = row.latitude || "-6.1865";
      row.longitude = row.longitude || "106.6318";
      data.push(row);
    }
  }
  
  return data;
};

/**
 * Hook for fetching engineer data
 * Uses generic useDataFetch hook
 */
export function useEngineerData() {
  const { data, loading, error } = useDataFetch('/engineers', {
    eventName: 'engineerDataChanged',
  });

  return { 
    rows: data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching machine data
 * Uses generic useDataFetch hook
 */
export function useMachineData() {
  const { data, loading, error } = useDataFetch('/machines', {
    eventName: 'machineDataChanged',
  });

  return { 
    rows: data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching stock part data
 * Uses generic useDataFetch hook
 */
export function useStockPartData() {
  const { data, loading, error } = useDataFetch('/stock-parts', {
    eventName: 'stockPartDataChanged',
  });

  return { 
    rows: data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching FSL location data
 * Uses generic useDataFetch hook
 */
export function useFSLLocationData() {
  const { data, loading, error } = useDataFetch('/fsl-locations');

  return { 
    rows: data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching leveling data
 * Uses generic useDataFetch hook
 */
export function useLevelingData() {
  const { data, loading, error } = useDataFetch('/leveling');

  return { 
    rows: data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching SO (Service Order) resolution times data
 * Uses generic useDataFetch hook
 * @param {Array<string>} months - Optional array of months to filter (e.g., ['April', 'May', 'June'])
 */
export function useSOData(months = null) {
  const monthsParam = months ? months.join(',') : null;
  const endpoint = monthsParam 
    ? `/so-data?months=${encodeURIComponent(monthsParam)}`
    : '/so-data';
  
  const { data, loading, error } = useDataFetch(endpoint);

  return { 
    data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching raw SO records with all fields
 * Uses generic useDataFetch hook
 * @param {Array<string>} months - Optional array of months to filter (e.g., ['April', 'May', 'June'])
 */
export function useRawSOData(months = null) {
  const monthsParam = months ? months.join(',') : null;
  const endpoint = monthsParam 
    ? `/so-data/raw?months=${encodeURIComponent(monthsParam)}`
    : '/so-data/raw';
  
  // Untuk raw SO data, matikan cache agar selalu pakai data terbaru
  const { data, loading, error } = useDataFetch(endpoint, { useCache: false });

  return { 
    data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching customer intelligence data (aggregated by area_group)
 * Uses generic useDataFetch hook
 * Data sudah di-aggregate di backend dengan normalisasi area_group
 */
export function useCustomerIntelligenceData() {
  const endpoint = '/so-data/customer-intelligence';
  
  const { data, loading, error } = useDataFetch(endpoint, { useCache: false });

  return { 
    data, 
    loading, 
    error 
  };
}

/**
 * Hook for fetching engineer-customer relationship data
 * Uses generic useDataFetch hook
 * Returns matrix of engineer-customer pairs with SO counts and coverage stats
 */
export function useEngineerCustomerRelationships() {
  const endpoint = '/so-data/engineer-customer-relationships';
  
  const { data, loading, error } = useDataFetch(endpoint, { useCache: false });

  return { 
    data, 
    loading, 
    error 
  };
}

// Export CSV parsers for backward compatibility
export { parseCSV, parseMachinesCSV, parseCSVLine };