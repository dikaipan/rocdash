/**
 * ============================================================================
 * STOCK PART & FSL LOCATION PAGE
 * ============================================================================
 * 
 * Halaman ini mengelola 2 entitas utama:
 * 1. STOCK PARTS - Manajemen spare parts inventory
 * 2. FSL LOCATIONS - Field Service Location (gudang regional)
 * 
 * FITUR UTAMA:
 * - Stock Management: CRUD operations untuk spare parts
 * - FSL Management: Manage lokasi gudang regional
 * - Stock Alerts: Monitor critical/low/overstock levels
 * - Distribution Analytics: Charts untuk distribusi stock per FSL
 * - Interactive Map: Visualisasi lokasi FSL dengan Leaflet
 * - CSV Import/Export: Bulk operations
 * 
 * KOMPLEKSITAS:
 * - 1995 baris kode (perlu refactoring)
 * - 15+ state variables
 * - Multiple modal management
 * - Complex filtering dan aggregations
 * 
 * @module StockPartPage
 * @requires React, Leaflet, Recharts
 */

// ============================================================================
// SECTION 1: IMPORTS - Library dan Dependencies
// ============================================================================

// React core
import React, { useState, useMemo, useEffect } from 'react';

// Custom hooks untuk data fetching
import { useStockPartData, useFSLLocationData } from '../hooks/useEngineerData.js';
import { useCrud } from '../hooks/useCrud.js';
import { useStockPartFilters } from '../hooks/useStockPartFilters.js';
import { useStockPartKPIs } from '../hooks/useStockPartKPIs.js';
import { useStockPartHandlers } from '../hooks/useStockPartHandlers.js';
import { useStockPartExport } from '../hooks/useExport.js';
import PageLayout from '../components/layout/PageLayout.jsx';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import InlineLoadingSpinner from '../components/common/InlineLoadingSpinner';
import { CustomAlert, CustomConfirm } from '../components/common';
import toast from 'react-hot-toast';

// Lazy load heavy modal components for better code splitting
const StockPartDetailModal = React.lazy(() => import('../components/stockpart/StockPartDetailModal.jsx'));
const StockPartCRUDModal = React.lazy(() => import('../components/stockpart/StockPartCRUDModal.jsx'));
const StockPartKPIModals = React.lazy(() => import('../components/stockpart/StockPartKPIModals.jsx'));
const StockPartAlertDetailModal = React.lazy(() => import('../components/stockpart/StockPartAlertDetailModal.jsx'));

// Icons dari React Feather
import { 
  Maximize2,       // Icon untuk fullscreen
  Edit, Trash2,    // Icons untuk CRUD operations
  Search,          // Icon untuk search
  ChevronLeft, ChevronRight,  // Icons untuk pagination
  Plus,            // Icon untuk create new
  Upload, Download,  // Icons untuk CSV operations
  X,               // Icon untuk close/cancel
  Package,         // Icon untuk package/part
  Tag,             // Icon untuk tag
  Hash             // Icon untuk part number
} from 'react-feather';

// Recharts untuk visualisasi data - keep direct import for now (smaller charts)
import { 
  ResponsiveContainer, 
  BarChart, Bar, 
  XAxis, YAxis, 
  Tooltip, 
  PieChart, Pie, Cell 
} from 'recharts';

// React Leaflet untuk interactive maps
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import indonesiaGeoJSON_RAW_STRING from "../data/peta_indonesia_geojson/indonesia-prov.geojson?raw";

// Parse GeoJSON data
const geoJsonData = JSON.parse(indonesiaGeoJSON_RAW_STRING);

// Region colors for GeoJSON
const regionColors = {
  "Region 1": '#ef4444',
  "Region 2": '#3b82f6',
  "Region 3": '#10b981',
};

const getColorByRegion = (region) => regionColors[region] || '#94a3b8';

// Style system
import { getGradientCard, getKPICard, TEXT_STYLES, BUTTON_STYLES, ALERT_STYLES, CARD_STYLES, cn } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from "../utils/apiConfig.js";

// ============================================================================
// SECTION 2: CONSTANTS - Konfigurasi aplikasi
// ============================================================================

// City coordinates for FSL mapping
const CITY_COORDINATES = {
  'Jakarta': [-6.2088, 106.8456],
  'Surabaya': [-7.2575, 112.7521],
  'Bandung': [-6.9175, 107.6191],
  'Medan': [3.5952, 98.6722],
  'Semarang': [-6.9667, 110.4167],
  'Makassar': [-5.1477, 119.4327],
  'Palembang': [-2.9761, 104.7754],
  'Tangerang': [-6.1783, 106.6319],
  'Bogor': [-6.5971, 106.8060],
  'Yogyakarta': [-7.7956, 110.3695],
  'Malang': [-7.9797, 112.6304],
  'Denpasar': [-8.6705, 115.2126],
  'Balikpapan': [-1.2379, 116.8529],
  'Banjarmasin': [-3.3194, 114.5906],
  'Pekanbaru': [0.5071, 101.4478],
  'Padang': [-0.9471, 100.4172],
  'Manado': [1.4748, 124.8421],
  'Pontianak': [-0.0263, 109.3425],
  'Batam': [1.0456, 104.0305],
  'Jambi': [-1.6101, 103.6131],
  'Cirebon': [-6.7063, 108.5571],
  'Mataram': [-8.5833, 116.1167],
  'Kupang': [-10.1718, 123.6075],
  'Jayapura': [-2.5916, 140.6692],
  'Ambon': [-3.6954, 128.1814],
  'Palu': [-0.8999, 119.8707],
  'Purwokerto': [-7.4297, 109.2344],
  'Jember': [-8.1706, 113.6997],
  'Bandar Lampung': [-5.4294, 105.2628],
  'Palangkaraya': [-2.2088, 113.9213],
  'Bengkulu': [-3.8004, 102.2655],
  'Pematang Siantar': [2.9631, 99.0618]
};

// City to Province mapping for GeoJSON
const CITY_TO_PROVINCE = {
  'Jakarta': 'DKI JAKARTA',
  'Surabaya': 'JAWA TIMUR',
  'Bandung': 'JAWA BARAT',
  'Medan': 'SUMATERA UTARA',
  'Semarang': 'JAWA TENGAH',
  'Makassar': 'SULAWESI SELATAN',
  'Palembang': 'SUMATERA SELATAN',
  'Tangerang': 'BANTEN',
  'Bogor': 'JAWA BARAT',
  'Yogyakarta': 'DAERAH ISTIMEWA YOGYAKARTA',
  'Malang': 'JAWA TIMUR',
  'Denpasar': 'BALI',
  'Balikpapan': 'KALIMANTAN TIMUR',
  'Banjarmasin': 'KALIMANTAN SELATAN',
  'Pekanbaru': 'RIAU',
  'Padang': 'SUMATERA BARAT',
  'Manado': 'SULAWESI UTARA',
  'Pontianak': 'KALIMANTAN BARAT',
  'Batam': 'KEPULAUAN RIAU',
  'Jambi': 'JAMBI',
  'Cirebon': 'JAWA BARAT',
  'Mataram': 'NUSA TENGGARA BARAT',
  'Kupang': 'NUSA TENGGARA TIMUR',
  'Jayapura': 'PAPUA',
  'Ambon': 'MALUKU',
  'Palu': 'SULAWESI TENGAH',
  'Purwokerto': 'JAWA TENGAH',
  'Jember': 'JAWA TIMUR',
  'Bandar Lampung': 'LAMPUNG',
  'Palangkaraya': 'KALIMANTAN TENGAH',
  'Bengkulu': 'BENGKULU',
  'Pematang Siantar': 'SUMATERA UTARA',
  'Palopo': 'SULAWESI BARAT',
  'Mamuju': 'SULAWESI BARAT',
  'Polewali': 'SULAWESI BARAT',
  'Majene': 'SULAWESI BARAT'
};

const CHART_COLORS = {
  region1: '#3b82f6',
  region2: '#10b981', 
  region3: '#f59e0b',
  primary: '#06b6d4',
  secondary: '#8b5cf6'
};

export default function StockPart() {
  const { isDark } = useTheme();
  const { rows: stockParts, loading: loadingStock } = useStockPartData();
  const { rows: fslLocations, loading: loadingFSL } = useFSLLocationData();
  
  // Debug FSL data loading (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && fslLocations) {
      // Only log if there's an issue (empty array) or in development
      if (fslLocations.length === 0) {
        console.warn('[StockPart] No FSL locations loaded');
      }
    }
  }, [fslLocations]);
  
  const { create, update, remove, loading: crudLoading } = useCrud({
    endpoint: `${API_BASE_URL}/stock-parts`,
    primaryKey: 'part_number',
    eventName: 'stockPartDataChanged'
  });
  
  const [fullscreenChart, setFullscreenChart] = useState(null);
  const [fullscreenKPI, setFullscreenKPI] = useState(null); // For KPI cards fullscreen
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [sortBy, setSortBy] = useState('all');
  const [sortValue, setSortValue] = useState('');

  // CRUD Modal States
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAlertDetailModal, setShowAlertDetailModal] = useState(false);
  const [showSelectPartModal, setShowSelectPartModal] = useState(false); // Modal untuk memilih part yang akan di-edit
  const [selectPartSearchQuery, setSelectPartSearchQuery] = useState(''); // Search query khusus untuk modal select part
  const [selectedAlertType, setSelectedAlertType] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [editingFSL, setEditingFSL] = useState(null); // Track which FSL is being edited
  const [formData, setFormData] = useState({
    part_number: '',
    part_name: '',
    type_of_part: '',
    '20_top_usage': 'No',
    grand_total: '0'
  });

  // Add coordinates to FSL locations
  const fslWithCoords = useMemo(() => {
    return fslLocations.map(fsl => {
      // Handle different field name formats from JSON
      const city = fsl['FSL City'] || fsl.fsl_city || fsl.fslcity || '';
      const coords = CITY_COORDINATES[city] || [-6.2088, 106.8456]; // Default to Jakarta
      
      // Only log in development if coordinates are missing
      if (process.env.NODE_ENV === 'development' && !CITY_COORDINATES[city]) {
        console.warn(`[StockPart] Missing coordinates for city: ${city}, using Jakarta default`);
      }
      
      return {
        ...fsl,
        latitude: coords[0],
        longitude: coords[1],
        // Normalize field names for easier access
        fsl_city: city,
        fsl_name: fsl['FSL Name'] || fsl.fsl_name || fsl.fslname,
        fsl_id: fsl['FSL ID'] || fsl.fsl_id || fsl.fslid,
        region: fsl['Region '] || fsl.region || fsl['region ']
      };
    });
  }, [fslLocations]);

  // Sorting handlers
  const handleSortValue = (value) => {
    setSortValue(value);
    if (value) {
      setSortBy('city');
    } else {
      setSortBy('all');
    }
  };

  // Filter parts data (exclude Region row) - MUST be before stockAlerts
  const validParts = useMemo(() => {
    return stockParts.filter(part => {
      const partNumber = part.part_number || part['part number'] || '';
      return partNumber.toLowerCase() !== 'region';
    });
  }, [stockParts]);

  // Use custom hooks for business logic
  const { filteredStockParts, filteredParts } = useStockPartFilters(stockParts, validParts, { searchQuery, sortBy, sortValue });
  
  const { handleExport, isExporting } = useStockPartExport(() => filteredParts);

  // Parts distribution by FSL for chart
  const partsDistributionByFSL = useMemo(() => {
    if (sortBy === 'all' || !sortValue) return [];
    
    const distribution = {};
    
    filteredStockParts.forEach(part => {
      const fslColumns = Object.keys(part).filter(col => 
        col.toLowerCase().includes('idfsl') || col.toLowerCase().includes('idccw')
      );
      
      fslColumns.forEach(col => {
        const stock = parseInt(part[col] || 0);
        if (stock > 0) {
          const fslName = col.split(' - ')[1] || col.split(' - ')[0];
          if (fslName.toLowerCase().includes(sortValue.toLowerCase().substring(0, 5))) {
            distribution[fslName] = (distribution[fslName] || 0) + stock;
          }
        }
      });
    });
    
    return Object.entries(distribution)
      .map(([name, value]) => ({ name: name.substring(0, 15), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredStockParts, sortBy, sortValue]);

  // Use custom hooks for KPIs
  const kpis = useStockPartKPIs(validParts, filteredStockParts, fslLocations);
  const {
    stockAlerts,
    totalStockQuantity,
    regionDistribution,
    stockByType,
    topPartsByStock,
    top20UsageParts,
    stockHealth,
    stockUtilization,
    totalFSL,
    totalParts
  } = kpis;

  // Handle alert detail view
  const handleShowAlertDetail = (alertType) => {
    setSelectedAlertType(alertType);
    setShowAlertDetailModal(true);
  };

  // Get alert data based on type - returns alert entries (not parts directly)
  const getAlertData = () => {
    switch(selectedAlertType) {
      case 'critical': return { title: 'CRITICAL - Out of Stock', entries: stockAlerts.critical, color: 'red' };
      case 'urgent': return { title: 'URGENT - Very Low Stock (1-5 units)', entries: stockAlerts.urgent, color: 'orange' };
      case 'warning': return { title: 'WARNING - Low Stock (6-10 units)', entries: stockAlerts.warning, color: 'yellow' };
      case 'priority': return { title: 'PRIORITY - Top 20 with Low Stock', entries: stockAlerts.priorityCritical, color: 'purple' };
      default: return { title: '', entries: [], color: 'gray' };
    }
  };


  // Pagination
  const totalPages = Math.ceil(filteredParts.length / itemsPerPage);
  const paginatedParts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredParts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredParts, currentPage, itemsPerPage]);

  /**
   * resetForm - Reset form data ke default values
   * 
   * Fungsi untuk reset form ke state awal yang bersih.
   * Digunakan saat add new part atau setelah save/delete operations.
   */
  const resetForm = () => {
    setFormData({
      part_number: '',
      part_name: '',
      type_of_part: '',
      '20_top_usage': 'No',
      grand_total: '0'
    });
    setEditingFSL(null);
  };

  // Use custom hooks for handlers
  const handlers = useStockPartHandlers({
    create,
    update,
    remove,
    setModalMode,
    setFormData,
    setShowModal,
    resetForm
  });
  
  // Extract alert and confirm from handlers
  const { alert, confirm } = handlers;

  // Wrapper handlers for UI (with additional logic)
  const handleAdd = () => {
    setEditingFSL(null); // Reset FSL filter for add mode
    handlers.handleAdd();
  };

  // Handler untuk membuka modal pilihan part untuk edit
  const handleEditClick = () => {
    setSelectPartSearchQuery(''); // Reset search query saat membuka modal
    setShowSelectPartModal(true);
  };

  // Handler untuk memilih part dari modal dan membuka form edit
  const handleSelectPartForEdit = (part) => {
    setShowSelectPartModal(false);
    setSelectPartSearchQuery(''); // Reset search query setelah memilih
    handleEdit(part);
  };

  // Filter parts untuk modal select part
  const filteredPartsForSelect = useMemo(() => {
    if (!selectPartSearchQuery) return validParts;
    
    const search = selectPartSearchQuery.toLowerCase();
    return validParts.filter(part => {
      const partNumber = (part.part_number || part['part number'] || '').toLowerCase();
      const partName = (part.part_name || part['part name'] || '').toLowerCase();
      return partNumber.includes(search) || partName.includes(search);
    });
  }, [validParts, selectPartSearchQuery]);
  
  /**
   * handlePartNumberSelect - REFACTORED dengan helper functions
   * 
   * Menggunakan helper functions untuk improve maintainability:
   * - getPartNumber() untuk part number lookup
   * - createFormDataTemplate() untuk form data generation
   * 
   * @param {string} partNumber - Selected part number
   */
  const getPartNumber = (part) => {
    return part.part_number || part['part number'] || '';
  };

  const createFormDataTemplate = (selectedPart) => {
    // Get all FSL columns from selected part
    const partFSLData = {};
    Object.keys(selectedPart).forEach(key => {
      if (key.toLowerCase().includes('idfsl') || key.toLowerCase().includes('idccw')) {
        partFSLData[key] = 0; // Initialize with 0 for new part
      }
    });
    
    return {
      part_number: selectedPart.part_number || selectedPart['part number'] || '',
      part_name: selectedPart.part_name || selectedPart['part name'] || '',
      type_of_part: selectedPart.type_of_part || selectedPart['type of part'] || '',
      '20_top_usage': selectedPart['20_top_usage'] || selectedPart['20 top usage'] || 'No',
      grand_total: '0',
      ...partFSLData
    };
  };

  const handlePartNumberSelect = (partNumber) => {
    const selectedPart = validParts.find(p => 
      getPartNumber(p) === partNumber
    );
    
    if (selectedPart) {
      // Use helper function untuk create form data template
      const formDataTemplate = createFormDataTemplate(selectedPart);
      setFormData(formDataTemplate);
    }
  };
  const handleSave = async (saveData) => {
  // Handle both old format (backward compatibility) and new format
  // Create a copy to avoid mutating original data
  let data = { ...(saveData?.formData || saveData || formData) };
  const adjustmentMode = saveData?.mode || 'set';
  const metadata = {
    reason: saveData?.reason,
    notes: saveData?.notes,
    adjustmentMode: adjustmentMode,
    timestamp: new Date().toISOString(),
    user: 'current_user' // TODO: Replace with actual user from auth
  };
  
  // Get all FSL columns (used for both adjustment and grand total calculation)
  const fslColumns = Object.keys(data).filter(col => 
    col.toLowerCase().includes('idfsl') || col.toLowerCase().includes('idccw')
  );
  
  // Apply adjustment mode for edit mode
  if (modalMode === 'edit' && adjustmentMode !== 'set') {
    const originalPart = stockParts.find(p => 
      (p.part_number || p['part number']) === data.part_number
    );
    
    if (originalPart) {
      // Apply adjustment mode to each FSL column ONLY
      // Other fields remain unchanged
      fslColumns.forEach(col => {
        const inputValue = parseInt(data[col] || 0);
        const originalValue = parseInt(originalPart[col] || 0);
        
        let finalValue;
        if (adjustmentMode === 'add') {
          // Add input value to original stock
          finalValue = originalValue + inputValue;
        } else if (adjustmentMode === 'remove') {
          // Remove input value from original stock
          finalValue = Math.max(0, originalValue - inputValue); // Prevent negative
        } else {
          // Set mode: use input value directly
          finalValue = inputValue;
        }
        
        data[col] = finalValue;
      });
    }
  }
  
  // Always recalculate grand_total from FSL columns (for both create and edit)
  data.grand_total = fslColumns.reduce((sum, col) => {
    return sum + parseInt(data[col] || 0);
  }, 0);
  
  // Track history for edit mode with reason
  if (modalMode === 'edit' && saveData?.reason) {
    const originalPart = stockParts.find(p => 
      (p.part_number || p['part number']) === data.part_number
    );
    
    if (originalPart) {
      const historyEntry = {
        id: `${data.part_number}_${Date.now()}`,
        partNumber: data.part_number,
        partName: data.part_name,
        action: 'stock_adjustment',
        mode: metadata.adjustmentMode,
        reason: metadata.reason,
        notes: metadata.notes,
        timestamp: metadata.timestamp,
        user: metadata.user,
        changes: {},
        grandTotalBefore: parseInt(originalPart.grand_total || originalPart['grand total'] || 0),
        grandTotalAfter: data.grand_total
      };
      
      // Calculate before/after for FSL columns
      fslColumns.forEach(col => {
        const newValue = parseInt(data[col] || 0);
        const oldValue = parseInt(originalPart[col] || 0);
        
        if (newValue !== oldValue) {
          historyEntry.changes[col] = { 
            from: oldValue, 
            to: newValue, 
            diff: newValue - oldValue 
          };
        }
      });
      
      // Save to localStorage
      const history = JSON.parse(localStorage.getItem('stockPartHistory') || '[]');
      history.unshift(historyEntry);
      if (history.length > 1000) history.pop();
      localStorage.setItem('stockPartHistory', JSON.stringify(history));
      
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📦 History Saved:', historyEntry);
      }
      
      // Try backend API (non-blocking)
      fetch('/api/stock-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyEntry)
      }).catch(err => console.warn('Backend save failed:', err));
    }
  } else if (modalMode === 'edit') {
    // For edit mode without reason, still log basic change
    const originalPart = stockParts.find(p => 
      (p.part_number || p['part number']) === data.part_number
    );
    
    // Only log in development
    if (process.env.NODE_ENV === 'development' && originalPart) {
      console.log('📦 Stock Updated (no reason provided):', {
        partNumber: data.part_number,
        grandTotalBefore: parseInt(originalPart.grand_total || originalPart['grand total'] || 0),
        grandTotalAfter: data.grand_total
      });
    }
  }
  
  // Ensure all non-FSL fields are preserved from original (for edit mode)
  if (modalMode === 'edit') {
    const originalPart = stockParts.find(p => 
      (p.part_number || p['part number']) === data.part_number
    );
    
    if (originalPart) {
      // Preserve all non-FSL fields from original to prevent data loss
      Object.keys(originalPart).forEach(key => {
        // Only preserve if it's not an FSL column, not grand_total, and not already explicitly set in data
        const isFSLColumn = key.toLowerCase().includes('idfsl') || key.toLowerCase().includes('idccw');
        const isGrandTotal = key === 'grand_total' || key === 'grand total';
        const isBasicField = ['part_number', 'part number', 'part_name', 'part name', 
                              'type_of_part', 'type of part', '20_top_usage', '20 top usage'].includes(key);
        
        // Preserve fields that are not FSL columns, not grand_total, and not basic fields (which are already in formData)
        if (!isFSLColumn && !isGrandTotal && !isBasicField && !(key in data)) {
          data[key] = originalPart[key];
        }
      });
    }
  }
  
  await handlers.handleSave(data, modalMode, metadata, stockParts);
  setEditingFSL(null);
};

const handleEdit = (part, fslFilter = null) => {
  setEditingFSL(fslFilter);
  handlers.handleEdit(part, fslFilter);
};

const handleDelete = (part) => {
  handlers.handleDelete(part);
};

// Export functionality is now handled by useStockPartExport hook
// Removed local handleExport function - using handleExport from useStockPartExport hook

  const handleUploadCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Harap upload file CSV', {
        icon: '⚠️',
        duration: 3000
      });
      return;
    }

    setUploadingCSV(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target', 'stock-parts');

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = 'Failed to upload CSV';
        try {
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            if (errorData && (errorData.error || errorData.message)) {
              errorMessage = errorData.error || errorData.message;
            }
          }
        } catch (e) {
          // Ignore JSON parse errors and fall back to generic message
        }

        if (response.status) {
          errorMessage = `${errorMessage} (status ${response.status})`;
        }

        throw new Error(errorMessage);
      }

      toast.success('CSV berhasil diupload!', {
        icon: '✅',
        duration: 4000
      });
      // Trigger data refresh
      window.dispatchEvent(new Event('stockPartDataChanged'));
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error(`Gagal mengupload CSV: ${error.message}`, {
        icon: '❌',
        duration: 4000
      });
    } finally {
      setUploadingCSV(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Only show full-screen loading on initial load, not during background refresh
  // Don't block UI if there's a modal or confirm dialog open
  const isInitialLoad = (loadingStock || loadingFSL) && stockParts.length === 0 && fslLocations.length === 0;
  const hasActiveModal = showModal || showDetailModal || showAlertDetailModal || fullscreenKPI || confirm.confirmState.isOpen;
  
  if (isInitialLoad && !hasActiveModal) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSkeleton type="spinner" message="Memuat data stock part..." size="lg" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Stock Part Management"
    >

      {/* KPI Cards */}
      {fullscreenChart !== 'fsl-map' && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Stock Alerts - Focal point on the left */}
        <div className={cn(getGradientCard('red', true), 'min-h-[280px] flex flex-col lg:col-span-2')}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={TEXT_STYLES.kpiTitle}>Stock Alerts</p>
              <h3 className={TEXT_STYLES.kpiValue}>{stockAlerts.totalLowStock}</h3>
              <p className={TEXT_STYLES.kpiSubtitle}>Parts require attention</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreenKPI('stock-alerts')}
                className={BUTTON_STYLES.iconSmall}
                title="Lihat Analisis Lengkap"
              >
                <Maximize2 size={18} />
              </button>
              <div className="text-3xl">🚨</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2 mt-2">
            {/* Critical - Out of Stock */}
            <div 
              onClick={() => stockAlerts.criticalCount > 0 && handleShowAlertDetail('critical')}
              className={cn(ALERT_STYLES.critical, 'p-2.5 cursor-pointer hover:scale-[1.02]')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-lg">🔴</span>
                  <div>
                    <p className={cn(TEXT_STYLES.bodySmall, 'text-red-200')}>CRITICAL</p>
                    <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Out of stock</p>
                  </div>
                </div>
                <p className={cn('text-xl font-bold text-red-100')}>{stockAlerts.criticalCount}</p>
              </div>
            </div>
            
            {/* Priority Critical - Top 20 with Low Stock */}
            {stockAlerts.priorityCriticalCount > 0 && (
              <div 
                onClick={() => handleShowAlertDetail('priority')}
                className={cn(ALERT_STYLES.priority, 'p-2.5 cursor-pointer hover:scale-[1.02]')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 text-lg">⭐</span>
                    <div>
                      <p className={cn(TEXT_STYLES.bodySmall, 'text-purple-200')}>PRIORITY</p>
                      <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Top 20 + Low stock</p>
                    </div>
                  </div>
                  <p className={cn('text-xl font-bold text-purple-100')}>{stockAlerts.priorityCriticalCount}</p>
                </div>
              </div>
            )}
            
            {/* Urgent - Very Low Stock */}
            <div 
              onClick={() => stockAlerts.urgentCount > 0 && handleShowAlertDetail('urgent')}
              className={cn(ALERT_STYLES.urgent, 'p-2.5 cursor-pointer hover:scale-[1.02]')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-orange-400 text-lg">🟠</span>
                  <div>
                    <p className={cn(TEXT_STYLES.bodySmall, 'text-orange-200')}>URGENT</p>
                    <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>1-5 units left</p>
                  </div>
                </div>
                <p className={cn('text-xl font-bold text-orange-100')}>{stockAlerts.urgentCount}</p>
              </div>
            </div>
            
            {/* Warning - Low Stock */}
            <div 
              onClick={() => stockAlerts.warningCount > 0 && handleShowAlertDetail('warning')}
              className={cn(ALERT_STYLES.warning, 'p-2.5 cursor-pointer hover:scale-[1.02]')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-lg">🟡</span>
                  <div>
                    <p className={cn(TEXT_STYLES.bodySmall, 'text-yellow-200')}>WARNING</p>
                    <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>6-10 units left</p>
                  </div>
                </div>
                <p className={cn('text-xl font-bold text-yellow-100')}>{stockAlerts.warningCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Stock Quantity */}
        <div className={cn(getKPICard('green', true), 'min-h-[280px] flex flex-col')}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={TEXT_STYLES.kpiTitle}>Total Stock Quantity</p>
              <h3 className={TEXT_STYLES.kpiValue}>{totalStockQuantity.toLocaleString()}</h3>
              <p className={TEXT_STYLES.kpiSubtitle}>
                {totalStockQuantity > 0 ? `${totalParts} parts • ${stockUtilization.avgStockPerPart} avg/part` : 'Tidak ada stock tersedia'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreenKPI('total-stock')}
                className={BUTTON_STYLES.iconSmall}
                title="Lihat Analisis Inventory"
              >
                <Maximize2 size={18} />
              </button>
              <div className="text-3xl">📊</div>
            </div>
          </div>
          
          {totalStockQuantity > 0 ? (
            <div className="flex-1 flex flex-col gap-3 mt-2">
              {/* Stock Health Indicators */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(ALERT_STYLES.info, 'p-2.5')}>
                  <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Healthy Stock</p>
                  <p className={cn('text-base font-bold text-green-400')}>
                    {stockHealth.healthyCount}
                    {stockHealth.totalPartsCount > 0 && (
                      <span className="text-xs text-slate-400 ml-1">
                        ({stockHealth.healthyPercentage}%)
                      </span>
                    )}
                  </p>
                </div>
                <div className={cn('p-2.5 border rounded-lg', stockHealth.criticalCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/30 border-slate-600/30')}>
                  <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Out of Stock</p>
                  <p className={cn('text-base font-bold', stockHealth.criticalCount > 0 ? 'text-red-400' : 'text-slate-400')}>
                    {stockHealth.criticalCount}
                    {stockHealth.totalPartsCount > 0 && (
                      <span className="text-xs text-slate-400 ml-1">
                        ({stockHealth.criticalPercentage}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(getGradientCard('blue', false), 'p-2.5')}>
                  <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Total Parts</p>
                  <p className={cn('text-base font-bold text-blue-400')}>{totalParts}</p>
                </div>
                <div className={cn(getGradientCard('purple', false), 'p-2.5')}>
                  <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Median Stock</p>
                  <p className={cn('text-base font-bold text-purple-400')}>
                    {stockUtilization.medianStockPerPart}
                  </p>
                </div>
              </div>

              {/* Stock Distribution Indicator */}
              {stockUtilization.stockConcentration > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className={cn('text-[10px]', TEXT_STYLES.mutedSmall)}>Stock Concentration</p>
                    <p className={cn('text-[10px] font-semibold', 
                      stockUtilization.stockConcentration > 80 ? 'text-orange-400' :
                      stockUtilization.stockConcentration > 60 ? 'text-yellow-400' : 'text-green-400'
                    )}>
                      {stockUtilization.stockConcentration}%
                    </p>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={cn('h-full transition-all',
                        stockUtilization.stockConcentration > 80 ? 'bg-orange-500' :
                        stockUtilization.stockConcentration > 60 ? 'bg-yellow-500' : 'bg-green-500'
                      )}
                      style={{ width: `${Math.min(stockUtilization.stockConcentration, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 mt-4">
              <div className="text-4xl opacity-50">📦</div>
              <p className={cn('text-sm', TEXT_STYLES.mutedSmall)}>Belum ada data stock</p>
              <p className={cn('text-xs', TEXT_STYLES.mutedSmall)}>Tambahkan stock part untuk melihat informasi</p>
            </div>
          )}
        </div>

        {/* Top Parts by Stock */}
        <div className={cn(getKPICard('purple', true), 'min-h-[280px] flex flex-col')}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <p className={TEXT_STYLES.kpiTitle}>Top Parts by Stock</p>
              <p className={TEXT_STYLES.kpiSubtitle}>8 parts dengan stock terbanyak</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFullscreenKPI('top-parts')}
                className={BUTTON_STYLES.iconSmall}
                title="Lihat Analisis Detail"
              >
                <Maximize2 size={18} />
              </button>
              <div className="text-3xl">🏆</div>
            </div>
          </div>
          {topPartsByStock.length > 0 && (
            <div className="flex-1 mt-2" style={{ minWidth: '100px', position: 'relative', display: 'block' }}>
              <ResponsiveContainer width="100%" height={150} minHeight={150} minWidth={100}>
                <BarChart data={topPartsByStock} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 8, fill: '#94a3b8' }} 
                    angle={-35} 
                    textAnchor="end" 
                    height={45}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #8b5cf6', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(value) => [`${value} units`, 'Stock']}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Fullscreen Maps Overlay */}
      {fullscreenChart === 'fsl-map' && (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col" style={{ zIndex: 9999 }}>
          <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-2xl font-bold text-slate-100">Sebaran Lokasi FSL</h2>
            <button 
              onClick={() => setFullscreenChart(null)} 
              className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-hidden" style={{ minHeight: 0 }}>
            <div className="h-full w-full map-container relative">
              <MapContainer
                center={[-2.5489, 118.0149]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <GeoJSON
                  data={geoJsonData}
                  style={(feature) => {
                    const provinceName = (feature.properties.Propinsi || feature.properties.name || '').toUpperCase();
                    const fslInProvince = fslWithCoords.find(fsl => {
                      const city = fsl.fsl_city || fsl.fslcity || '';
                      const mappedProvince = CITY_TO_PROVINCE[city];
                      return mappedProvince && provinceName === mappedProvince;
                    });
                    
                    let baseColor = '#e5e7eb';
                    let fillOpacity = 0.1;
                    let borderWeight = 1;
                    
                    if (fslInProvince) {
                      const region = fslInProvince.region || fslInProvince['region '] || 'Unknown';
                      baseColor = getColorByRegion(region);
                      fillOpacity = 0.4;
                      borderWeight = 2;
                    }
                    
                    // Theme-aware border color
                    const borderColor = isDark ? '#ffffff' : (baseColor || '#94a3b8');
                    
                    return {
                      fillColor: baseColor,
                      fillOpacity: fillOpacity,
                      color: borderColor,
                      weight: borderWeight,
                      opacity: isDark ? 0.8 : 0.9
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    const provinceName = feature.properties.Propinsi || feature.properties.name || '';
                    const fslInProvince = fslWithCoords.filter(fsl => {
                      const city = fsl.fsl_city || fsl.fslcity || '';
                      const mappedProvince = CITY_TO_PROVINCE[city];
                      return mappedProvince && provinceName.toUpperCase() === mappedProvince;
                    });
                    
                    if (fslInProvince.length > 0) {
                      const region = fslInProvince[0].region || fslInProvince[0]['region '] || 'Unknown';
                      const baseColor = getColorByRegion(region);

                      // Build detailed FSL info HTML - theme-aware
                      const tooltipBg = isDark ? '#0f172a' : '#ffffff';
                      const tooltipText = isDark ? '#fff' : '#0f172a';
                      const tooltipBorder = baseColor;
                      const tooltipMuted = isDark ? '#94a3b8' : '#475569';
                      const tooltipDivider = isDark ? '#334155' : '#cbd5e1';
                      
                      let tooltipHTML = `
                        <div style="background: ${tooltipBg}; padding: 12px; border-radius: 10px; border: 2px solid ${tooltipBorder}; min-width: 280px; max-width: 350px; box-shadow: ${isDark ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 8px 24px rgba(0, 0, 0, 0.15)'};">
                          <div style="font-weight: 700; font-size: 14px; color: ${tooltipText}; margin-bottom: 8px; border-bottom: 1px solid ${tooltipBorder}; padding-bottom: 6px;">
                            📍 ${provinceName}
                          </div>
                      `;

                      // Add each FSL details
                      fslInProvince.forEach((fsl, idx) => {
                        const fslName = fsl.fsl_name || fsl.fslname || 'FSL';
                        const fslId = fsl.fsl_id || fsl.fslid || '-';
                        const fslCity = fsl.fsl_city || fsl.fslcity || '-';
                        const fslRegion = fsl.region || fsl['region '] || 'Unknown';
                        const fslAddress = fsl.fsl_address || fsl.fsladdress || 'No address';
                        const fslPic = fsl.fsl_pic || fsl.fslpic || '-';
                        const description = fsl.description || fsl.description || fsl.description || '-';

                        if (idx > 0) {
                          tooltipHTML += `<div style="border-top: 1px solid ${tooltipDivider}; margin: 8px 0;"></div>`;
                        }

                        tooltipHTML += `
                          <div style="margin-bottom: 4px;">
                            <div style="font-weight: 600; font-size: 12px; color: ${tooltipText}; margin-bottom: 4px;">🏢 ${fslName}</div>
                            <div style="font-size: 10px; color: ${tooltipMuted}; line-height: 1.4;">
                              <div>🆔 ID: <span style="color: ${isDark ? '#cbd5e1' : '#1e293b'}; font-weight: 500;">${fslId}</span></div>
                              <div>🏙️ Kota: <span style="color: ${isDark ? '#cbd5e1' : '#1e293b'}; font-weight: 500;">${fslCity}</span></div>
                              <div>📊 Region: <span style="color: ${baseColor}; font-weight: 600;">${fslRegion}</span></div>
                              <div>🧑‍💼 PIC: <span style="color: ${isDark ? '#10b981' : '#059669'}; font-weight: 600;">${fslPic}</span></div>
                              <div>🚚 Description: <span style="color: ${isDark ? '#3b82f6' : '#2563eb'}; font-weight: 600;">${description}</span></div>
                              <div style="margin-top: 3px; color: ${isDark ? '#cbd5e1' : '#475569'};">📍 ${fslAddress}</div>
                            </div>
                          </div>
                        `;
                      });

                      tooltipHTML += '</div>';

                      layer.bindTooltip(tooltipHTML, {
                        sticky: true,
                        className: 'custom-map-tooltip',
                        direction: 'top'
                      });
                      
                      layer.on({
                        mouseover: (e) => {
                          if (isDark) {
                            e.target.setStyle({ 
                              fillOpacity: 0.85, 
                              weight: 4,
                              color: baseColor,
                              opacity: 1
                            });
                          } else {
                            // Light mode: lebih kontras dengan border tebal dan fill lebih terang
                            e.target.setStyle({ 
                              fillOpacity: 0.75, 
                              weight: 5,
                              color: baseColor,
                              opacity: 1,
                              dashArray: '0'
                            });
                            // Tambahkan shadow effect dengan bringToFront
                            e.target.bringToFront();
                          }
                        },
                        mouseout: (e) => {
                          const borderColor = isDark ? '#ffffff' : baseColor;
                          if (isDark) {
                            e.target.setStyle({ fillOpacity: 0.4, weight: 2, color: borderColor, opacity: 0.8 });
                          } else {
                            // Light mode: kembali ke style normal
                            e.target.setStyle({ fillOpacity: 0.4, weight: 2, color: borderColor, opacity: 0.9 });
                            e.target.bringToBack();
                          }
                        }
                      });
                    }
                  }}
                />
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Maps Section */}
      {fullscreenChart !== 'fsl-map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* FSL Location Map */}
          <div className="bg-[var(--card-bg)] p-4 rounded-lg relative lg:col-span-2 min-h-[400px] flex flex-col" style={{ zIndex: (showModal || showDetailModal || showAlertDetailModal || fullscreenKPI) ? -1 : 1 }}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-slate-100">Sebaran Lokasi FSL</h2>
              <button onClick={() => setFullscreenChart('fsl-map')} className="text-[var(--muted)] hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            {!(showModal || showDetailModal || showAlertDetailModal || fullscreenKPI) && (
              <div className="flex-1 h-full">
                <div className="h-full map-container relative" style={{ 
                  borderRadius: '16px', 
                  overflow: 'hidden',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                <MapContainer
                  center={[-2.5489, 118.0149]}
                  zoom={5}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <GeoJSON
                    data={geoJsonData}
                    style={(feature) => {
                      const provinceName = (feature.properties.Propinsi || feature.properties.name || '').toUpperCase();
                      const fslInProvince = fslWithCoords.find(fsl => {
                        const city = fsl.fsl_city || fsl.fslcity || '';
                        const mappedProvince = CITY_TO_PROVINCE[city];
                        return mappedProvince && provinceName === mappedProvince;
                      });
                      
                      let baseColor = '#e5e7eb';
                      let fillOpacity = 0.1;
                      let borderWeight = 1;
                      
                      if (fslInProvince) {
                        const region = fslInProvince.region || fslInProvince['region '] || 'Unknown';
                        baseColor = getColorByRegion(region);
                        fillOpacity = 0.4;
                        borderWeight = 2;
                      }
                      
                      // Theme-aware border color for fullscreen map
                      const borderColorFullscreen = isDark ? '#ffffff' : (baseColor || '#94a3b8');
                      
                      return {
                        fillColor: baseColor,
                        fillOpacity: fillOpacity,
                        color: borderColorFullscreen,
                        weight: borderWeight,
                        opacity: isDark ? 0.8 : 0.9
                      };
                    }}
                    onEachFeature={(feature, layer) => {
                      const provinceName = feature.properties.Propinsi || feature.properties.name || '';
                      const fslInProvince = fslWithCoords.filter(fsl => {
                        const city = fsl.fsl_city || fsl.fslcity || '';
                        const mappedProvince = CITY_TO_PROVINCE[city];
                        return mappedProvince && provinceName.toUpperCase() === mappedProvince;
                      });
                      
                      if (fslInProvince.length > 0) {
                        const region = fslInProvince[0].region || fslInProvince[0]['region '] || 'Unknown';
                        const baseColor = getColorByRegion(region);

                        // Build detailed FSL info HTML for fullscreen - theme-aware
                        const tooltipBgFullscreen = isDark ? '#0f172a' : '#ffffff';
                        const tooltipTextFullscreen = isDark ? '#fff' : '#0f172a';
                        const tooltipBorderFullscreen = baseColor;
                        const tooltipMutedFullscreen = isDark ? '#94a3b8' : '#475569';
                        const tooltipDividerFullscreen = isDark ? '#334155' : '#cbd5e1';
                        
                        let tooltipHTML = `
                          <div style="background: ${tooltipBgFullscreen}; padding: 12px; border-radius: 10px; border: 2px solid ${tooltipBorderFullscreen}; min-width: 280px; max-width: 350px; box-shadow: ${isDark ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 8px 24px rgba(0, 0, 0, 0.15)'};">
                            <div style="font-weight: 700; font-size: 14px; color: ${tooltipTextFullscreen}; margin-bottom: 8px; border-bottom: 1px solid ${tooltipBorderFullscreen}; padding-bottom: 6px;">
                              📍 ${provinceName}
                            </div>
                        `;

                        // Add each FSL details
                        fslInProvince.forEach((fsl, idx) => {
                          const fslName = fsl.fsl_name || fsl.fslname || 'FSL';
                          const fslId = fsl.fsl_id || fsl.fslid || '-';
                          const fslCity = fsl.fsl_city || fsl.fslcity || '-';
                          const fslRegion = fsl.region || fsl['region '] || 'Unknown';
                          const fslAddress = fsl.fsl_address || fsl.fsladdress || 'No address';
                          const fslPic = fsl.fsl_pic || fsl.fslpic || '-';
                          const description = fsl.description || fsl.description || '-';

                          if (idx > 0) {
                            tooltipHTML += `<div style="border-top: 1px solid ${tooltipDividerFullscreen}; margin: 8px 0;"></div>`;
                          }
                          
                          tooltipHTML += `
                            <div style="margin-bottom: 4px;">
                              <div style="font-weight: 600; font-size: 12px; color: ${tooltipTextFullscreen}; margin-bottom: 4px;">🏢 ${fslName}</div>
                              <div style="font-size: 10px; color: ${tooltipMutedFullscreen}; line-height: 1.4;">
                                <div>🆔 ID: <span style="color: ${isDark ? '#cbd5e1' : '#1e293b'}; font-weight: 500;">${fslId}</span></div>
                                <div>🏙️ Kota: <span style="color: ${isDark ? '#cbd5e1' : '#1e293b'}; font-weight: 500;">${fslCity}</span></div>
                                <div>📊 Region: <span style="color: ${baseColor}; font-weight: 600;">${fslRegion}</span></div>
                                <div>🧑‍💼 PIC: <span style="color: ${isDark ? '#10b981' : '#059669'}; font-weight: 600;">${fslPic}</span></div>
                                <div>🚚 Description: <span style="color: ${isDark ? '#3b82f6' : '#2563eb'}; font-weight: 600;">${description}</span></div>
                                <div style="margin-top: 3px; color: ${isDark ? '#cbd5e1' : '#475569'};">📍 ${fslAddress}</div>
                              </div>
                            </div>
                          `;
                        });

                        tooltipHTML += '</div>';

                        layer.bindTooltip(tooltipHTML, {
                          sticky: true,
                          className: 'custom-map-tooltip',
                          direction: 'top'
                        });
                        
                        layer.on({
                          mouseover: (e) => {
                            if (isDark) {
                              e.target.setStyle({ 
                                fillOpacity: 0.85, 
                                weight: 4,
                                color: baseColor,
                                opacity: 1
                              });
                            } else {
                              // Light mode: lebih kontras dengan border tebal dan fill lebih terang
                              e.target.setStyle({ 
                                fillOpacity: 0.75, 
                                weight: 5,
                                color: baseColor,
                                opacity: 1,
                                dashArray: '0'
                              });
                              // Tambahkan shadow effect dengan bringToFront
                              e.target.bringToFront();
                            }
                          },
                          mouseout: (e) => {
                            const borderColorFullscreen = isDark ? '#ffffff' : baseColor;
                            if (isDark) {
                              e.target.setStyle({ fillOpacity: 0.4, weight: 2, color: borderColorFullscreen, opacity: 0.8 });
                            } else {
                              // Light mode: kembali ke style normal
                              e.target.setStyle({ fillOpacity: 0.4, weight: 2, color: borderColorFullscreen, opacity: 0.9 });
                              e.target.bringToBack();
                            }
                          }
                        });
                      }
                    }}
                  />
                </MapContainer>
              </div>
            </div>
          )}
        </div>

        {/* Region Distribution Pie Chart */}
        <div className="bg-[var(--card-bg)] p-4 rounded-lg relative lg:col-span-1 min-h-[400px] max-h-[500px] flex flex-col" style={{ zIndex: (showModal || showDetailModal || showAlertDetailModal || fullscreenKPI) ? -1 : 1 }}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-slate-100">Distribusi FSL per Region</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{totalFSL} lokasi</span>
              <button onClick={() => setFullscreenChart('region-dist')} className="text-[var(--muted)] hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
          {!fullscreenChart && (
            <div style={{ minWidth: '100px', position: 'relative', width: '100%', display: 'block' }}>
              <ResponsiveContainer width="100%" height={350} minHeight={350} minWidth={100}>
                <PieChart>
                <Pie
                  data={regionDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {regionDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(CHART_COLORS)[index % 3]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Stock Parts Table with CRUD */}
      {fullscreenChart !== 'fsl-map' && (
      <div className="bg-[var(--card-bg)] rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Stock Parts Management</h2>
                <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Kelola data stok spare part dengan fitur CRUD</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-300' : 'text-gray-500'}`} size={16} />
                  <input
                    type="text"
                    placeholder="Search parts..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className={`pl-10 pr-4 py-2 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-gray-300 text-gray-900'} border rounded-lg focus:outline-none focus:border-blue-500 w-64`}
                  />
                </div>
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{filteredParts.length} parts</span>
                
                <button
                  onClick={handleAdd}
                  className="px-2 sm:px-4 py-1 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <Plus size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Add Part</span>
                </button>
                
                <button
                  onClick={handleEditClick}
                  className="px-2 sm:px-4 py-1 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <Edit size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Edit Part</span>
                </button>
                
                <label className="px-2 sm:px-4 py-1 sm:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2 cursor-pointer">
                  <Upload size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleUploadCSV}
                    className="hidden"
                    disabled={uploadingCSV}
                  />
                </label>
                
                <button
                  onClick={handleExport}
                  disabled={filteredParts.length === 0 || isExporting}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1 sm:gap-1.5"
                  title={filteredParts.length === 0 ? "Tidak ada data untuk diekspor" : "Export data ke CSV"}
                >
                  {isExporting ? (
                    <>
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download size={12} className="sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sorting Filter */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-700">
              <span className="text-sm font-semibold text-slate-300">Filter by City/FSL:</span>
              
              {/* Dynamic Dropdown */}
              <select
                value={sortValue}
                onChange={(e) => handleSortValue(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 min-w-[200px]"
              >
                <option value="">Pilih FSL/City</option>
                {[...new Set(fslLocations.map(f => f.fsl_city || f.fslcity).filter(Boolean))]
                  .sort()
                  .map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))
                }
              </select>
              
              {sortValue && partsDistributionByFSL.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-400 font-semibold">
                    {partsDistributionByFSL.reduce((acc, item) => acc + item.value, 0)} total stock di {sortValue}
                  </span>
                  <button
                    onClick={() => setShowDetailModal(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    Detail
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/95 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap border-b border-slate-700">Part Number</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700">Part Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap border-b border-slate-700">Type</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap border-b border-slate-700">Top 20</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700">FSL Locations</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap border-b border-slate-700">FSL Stock</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider sticky right-0 bg-slate-900/95 backdrop-blur-sm z-20 w-24 border-b border-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedParts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={32} className="text-slate-500" />
                      <p className="text-sm">Tidak ada data stock part</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedParts.map((part, idx) => {
                const partNumber = part.part_number || part['part number'] || '-';
                const partName = part.part_name || part['part name'] || '-';
                const typeOfPart = part.type_of_part || part['type of part'] || '-';
                const topUsage = part['20_top_usage'] || part['20 top usage'] || 'No';
                
                // Get FSL locations with stock
                const fslColumns = Object.keys(part).filter(col => 
                  col.toLowerCase().includes('idfsl') || col.toLowerCase().includes('idccw')
                );
                
                const fslWithStock = fslColumns
                  .map(col => {
                    const stock = parseInt(part[col] || 0);
                    if (stock > 0) {
                      // Parse FSL name
                      let fslName = col;
                      if (col.includes('idfsl') && col.includes('_fsl_')) {
                        const cityPart = col.split('_fsl_')[1];
                        if (cityPart) {
                          fslName = 'FSL ' + cityPart.split('_').map(w => 
                            w.charAt(0).toUpperCase() + w.slice(1)
                          ).join(' ');
                        }
                      } else if (col.includes('idccw')) {
                        const descPart = col.replace(/^idccw\d+_/, '');
                        if (descPart) {
                          fslName = descPart.split('_').map(w => 
                            w.charAt(0).toUpperCase() + w.slice(1)
                          ).join(' ');
                          // Add Jakarta location for Country Central Warehouse
                          if (col.toLowerCase().includes('idccw00')) {
                            fslName += ' (Jakarta)';
                          }
                        }
                      }
                      return { name: fslName, stock };
                    }
                    return null;
                  })
                  .filter(Boolean)
                  .sort((a, b) => b.stock - a.stock);
                
                // Calculate total stock from all FSL locations
                const totalFslStock = fslWithStock.reduce((sum, fsl) => sum + fsl.stock, 0);
                
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-700/40 transition-colors ${
                      idx % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800/30'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-100 font-mono truncate" title={partNumber || ''}>
                      {partNumber || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-100 max-w-xs truncate" title={partName || ''}>
                      {partName || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-xs sm:text-sm whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 text-xs rounded font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30 whitespace-nowrap">
                        {typeOfPart || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs sm:text-sm text-center whitespace-nowrap">
                      {topUsage.toLowerCase() === 'yes' ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded font-medium border bg-green-500/20 text-green-400 border-green-500/30">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded font-medium border bg-slate-700/50 text-slate-400 border-slate-600/30">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs sm:text-sm">
                      <div className="flex flex-wrap gap-1">
                        {fslWithStock.length > 0 ? (
                          <>
                            {fslWithStock.slice(0, 3).map((fsl, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 text-xs rounded font-medium border bg-blue-500/20 text-blue-400 border-blue-500/30 whitespace-nowrap"
                              >
                                {fsl.name}: {fsl.stock}
                              </span>
                            ))}
                            {fslWithStock.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs rounded font-medium border bg-slate-700/50 text-slate-400 border-slate-600/30">
                                +{fslWithStock.length - 3}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">No stock</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs sm:text-sm text-center whitespace-nowrap">
                      <span className="text-sm font-bold text-cyan-400">{totalFslStock}</span>
                    </td>
                    <td className="px-3 py-2.5 sticky right-0 bg-slate-800/95 backdrop-blur-sm z-10">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(part)}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Edit"
                          aria-label={`Edit part ${partNumber}`}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(part)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                          title="Delete"
                          aria-label={`Delete part ${partNumber}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-3 sm:px-4 py-3 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-400">
              Menampilkan <span className="font-semibold text-slate-300">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-semibold text-slate-300">{Math.min(currentPage * itemsPerPage, filteredParts.length)}</span> dari <span className="font-semibold text-slate-300">{filteredParts.length.toLocaleString()}</span> parts
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} className="text-slate-300" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded-lg text-xs sm:text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    aria-label={`Go to page ${page}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Next page"
              >
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Lazy-loaded Modals with Suspense */}
      <React.Suspense fallback={
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      }>
        {/* Detail Modal - Filtered Parts Table */}
        {showDetailModal && (
          <StockPartDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            sortValue={sortValue}
            filteredStockParts={filteredStockParts}
            partsDistributionByFSL={partsDistributionByFSL}
            onEdit={handleEdit}
          />
        )}

        {/* CRUD Modal */}
        {showModal && (
          <StockPartCRUDModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingFSL(null);
            }}
            modalMode={modalMode}
            formData={formData}
            setFormData={setFormData}
            stockParts={stockParts}
            validParts={validParts}
            editingFSL={editingFSL}
            onPartNumberSelect={handlePartNumberSelect}
            onSave={handleSave}
          />
        )}

        {/* Fullscreen KPI Modals */}
        {fullscreenKPI && (
          <StockPartKPIModals
            activeKPI={fullscreenKPI}
            onClose={() => setFullscreenKPI(null)}
            stockAlerts={stockAlerts}
            totalStockQuantity={totalStockQuantity}
            totalParts={totalParts}
            totalFSL={totalFSL}
            validParts={validParts}
            topPartsByStock={topPartsByStock}
            onShowAlertDetail={handleShowAlertDetail}
          />
        )}

        {/* Alert Detail Modal */}
        {showAlertDetailModal && (
          <StockPartAlertDetailModal
            isOpen={showAlertDetailModal}
            onClose={() => setShowAlertDetailModal(false)}
            alertData={getAlertData()}
            onEdit={handleEdit}
          />
        )}
      </React.Suspense>

      {/* Select Part Modal for Edit */}
      {showSelectPartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 px-6 py-5 flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Edit className="text-blue-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Pilih Part untuk Edit</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Pilih part yang ingin Anda edit</p>
                </div>
              </div>
              <button
                onClick={() => setShowSelectPartModal(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-2 rounded-lg transition-all"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Cari part number atau part name..."
                    value={selectPartSearchQuery}
                    onChange={(e) => setSelectPartSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {filteredPartsForSelect.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Package size={48} className="mx-auto mb-3 opacity-50" />
                    <p>Tidak ada part yang ditemukan</p>
                  </div>
                ) : (
                  filteredPartsForSelect.map((part) => {
                    const partNumber = part.part_number || part['part number'] || '';
                    const partName = part.part_name || part['part name'] || '';
                    const partType = part.type_of_part || part['type of part'] || '';
                    const grandTotal = part.grand_total || part['grand total'] || 0;
                    
                    return (
                      <button
                        key={partNumber}
                        onClick={() => handleSelectPartForEdit(part)}
                        className="w-full text-left p-4 bg-slate-700/40 hover:bg-slate-700/80 border border-slate-600 hover:border-blue-500/50 rounded-xl transition-all group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Hash className="text-blue-400 group-hover:text-blue-300" size={16} />
                              <span className="font-semibold text-slate-100 group-hover:text-blue-300">
                                {partNumber}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300 mb-1 truncate">{partName}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                              {partType && (
                                <span className="flex items-center gap-1">
                                  <Tag size={12} />
                                  {partType}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Package size={12} />
                                Total: {grandTotal}
                              </span>
                            </div>
                          </div>
                          <Edit className="text-slate-400 group-hover:text-blue-400 transition-colors flex-shrink-0" size={20} />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Dialog */}
      <CustomAlert
        isOpen={alert.alertState.isOpen}
        onClose={alert.closeAlert}
        type={alert.alertState.type}
        title={alert.alertState.title}
        message={alert.alertState.message}
        duration={alert.alertState.duration}
      />

      {/* Custom Confirm Dialog */}
      <CustomConfirm
        isOpen={confirm.confirmState.isOpen}
        onClose={confirm.closeConfirm}
        onConfirm={confirm.handleConfirm}
        title={confirm.confirmState.title}
        message={confirm.confirmState.message}
        confirmText={confirm.confirmState.confirmText}
        cancelText={confirm.confirmState.cancelText}
        type={confirm.confirmState.type}
        confirmButtonColor={confirm.confirmState.confirmButtonColor}
      />

      {/* Inline Loading Spinner - Shows during CRUD operations */}
      {crudLoading && <InlineLoadingSpinner size="md" message="Memproses..." />}
    </PageLayout>
  );
}