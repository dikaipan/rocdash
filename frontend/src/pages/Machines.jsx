import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useMachineData } from "../hooks/useEngineerData.js";
import { useCrud } from "../hooks/useCrud.js";
import { useMachineFilters } from "../hooks/useMachineFilters.js";
import { useMachineKPIs } from "../hooks/useMachineKPIs.js";
import { useMachineHandlers } from "../hooks/useMachineHandlers.js";
import { useMachineExport } from "../hooks/useExport.js";
import toast from 'react-hot-toast';
// Import only needed icons for better tree-shaking
import { 
  Search, Maximize, Minimize, Download, 
  ChevronLeft, ChevronRight, Upload, 
  Edit, Trash2, X, Hash, 
  Home, User, MapPin, 
  Calendar, Settings, 
  AlertCircle, Info, Filter, 
  CheckCircle, XCircle
} from "react-feather";

// Import Recharts - Vite already handles code splitting for this library
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import PageLayout from "../components/layout/PageLayout.jsx";
import { SearchFilter, CustomAlert, CustomConfirm } from "../components/common";
import { getKPICard, TEXT_STYLES, BUTTON_STYLES, cn } from '../constants/styles';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import InlineLoadingSpinner from '../components/common/InlineLoadingSpinner';
import { useTheme } from '../contexts/ThemeContext';
import { API_BASE_URL } from "../utils/apiConfig.js";

export default function Machines() {
  const { isDark } = useTheme();
  const { rows: machines, loading } = useMachineData();
  const { create, update, remove, bulkDelete, loading: crudLoading } = useCrud({
    endpoint: `${API_BASE_URL}/machines`,
    primaryKey: 'wsid',
    eventName: 'machineDataChanged'
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [warrantyFilter, setWarrantyFilter] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [showWarrantyInsightModal, setShowWarrantyInsightModal] = useState(false);
  const [showExpiringSoonModal, setShowExpiringSoonModal] = useState(false);
  const [showMachineTypesModal, setShowMachineTypesModal] = useState(false);
  const [showAreaGroupModal, setShowAreaGroupModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Get all unique fields from machines data
  const allMachineFields = useMemo(() => {
    if (!machines || machines.length === 0) return [];
    const fieldsSet = new Set();
    machines.forEach(m => {
      Object.keys(m).forEach(key => {
        fieldsSet.add(key);
      });
    });
    return Array.from(fieldsSet).sort();
  }, [machines]);

  // Create initial form data with all fields
  const createInitialFormData = useCallback(() => {
    const initialData = {};
    if (allMachineFields.length > 0) {
      allMachineFields.forEach(field => {
        initialData[field] = "";
      });
    }
    return initialData;
  }, [allMachineFields]);

  // CRUD States
  const [crudShowModal, setCrudShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [formData, setFormData] = useState({});
  const [formInitialized, setFormInitialized] = useState(false);
  
  // Update formData when allMachineFields changes (only once)
  useEffect(() => {
    if (allMachineFields.length > 0 && !formInitialized) {
      setFormData(createInitialFormData());
      setFormInitialized(true);
    }
  }, [allMachineFields, formInitialized, createInitialFormData]);

  // Reset form function - using useCallback to ensure stable reference
  const resetForm = useCallback(() => {
    const initialData = createInitialFormData();
    setFormData(initialData);
    setFormInitialized(false);
    setModalMode("create");
  }, [createInitialFormData]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use custom hooks for business logic (after state and effects)
  const filteredMachines = useMachineFilters(machines, { 
    debouncedSearch, 
    customerFilter, 
    regionFilter, 
    warrantyFilter
  });
  
  const { handleExport, isExporting } = useMachineExport(() => filteredMachines);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [customerFilter, regionFilter, warrantyFilter, debouncedSearch]);

  // Helper function to get field icon
  const getFieldIcon = useCallback((field) => {
    if (field.includes('wsid') || field.includes('id')) return <Hash size={16} className="text-blue-400" />;
    if (field.includes('branch') || field.includes('name')) return <Home size={16} className="text-green-400" />;
    if (field.includes('customer')) return <User size={16} className="text-purple-400" />;
    if (field.includes('city') || field.includes('region') || field.includes('area') || field.includes('provinsi') || field.includes('address')) return <MapPin size={16} className="text-orange-400" />;
    if (field.includes('year') || field.includes('date') || field.includes('instal')) return <Calendar size={16} className="text-cyan-400" />;
    if (field.includes('status') || field.includes('maintenance') || field.includes('warranty')) return <AlertCircle size={16} className="text-yellow-400" />;
    if (field.includes('type') || field.includes('model') || field.includes('software') || field.includes('service')) return <Settings size={16} className="text-pink-400" />;
    return <Info size={16} className="text-slate-400" />;
  }, []);

  // Helper function to get field placeholder
  const getFieldPlaceholder = useCallback((field) => {
    if (field === 'wsid') return 'Contoh: WS001234';
    if (field === 'branch_name') return 'Nama cabang/lokasi mesin';
    if (field === 'customer') return 'Nama customer/pemilik';
    if (field === 'machine_type') return 'Tipe mesin (cth: ATM, CRM)';
    if (field === 'year') return 'Tahun instalasi (cth: 2023)';
    if (field === 'city') return 'Kota lokasi mesin';
    if (field === 'provinsi') return 'Provinsi lokasi mesin';
    if (field === 'area_group') return 'Area group (cth: JAKARTA 1)';
    if (field === 'region') return 'Region (Region 1/2/3)';
    if (field === 'address') return 'Alamat lengkap lokasi mesin (cth: Jl. Sudirman No. 123)';
    return `Masukkan ${field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').toLowerCase()}`;
  }, []);

  // Extract unique values for dropdown fields from machines data
  const dropdownOptions = useMemo(() => {
    const options = {};
    if (!machines || machines.length === 0) return options;
    
    // Fields that should NOT have dropdowns (always input)
    const excludeFromDropdown = ['address', 'wsid', 'branch_name', 'year'];
    
    // Fields that should have dropdowns (repeated values)
    // Auto-detect fields with repeated values (appears more than 2 times)
    const fieldCounts = {};
    machines.forEach(m => {
      Object.keys(m).forEach(key => {
        // Skip fields that should not be dropdowns
        if (excludeFromDropdown.includes(key.toLowerCase())) {
          return;
        }
        
        const value = m[key];
        if (value !== null && value !== undefined && value !== '') {
          if (!fieldCounts[key]) {
            fieldCounts[key] = new Set();
          }
          fieldCounts[key].add(String(value).trim());
        }
      });
    });
    
    // Fields that should always have dropdowns
    const alwaysDropdownFields = [
      'region', 'area_group', 'machine_type', 'city', 'provinsi', 
      'customer', 'model', 'distance',
      'maintenance_status', 'service_hour', 'software_version',
      'island', 'zona', 'machine_status', 'vendor'
    ];
    
    // Auto-detect fields with repeated values (more than 2 unique values)
    const autoDropdownFields = Object.keys(fieldCounts).filter(field => {
      // Skip fields that should not be dropdowns (always input)
      if (excludeFromDropdown.includes(field.toLowerCase())) {
        return false;
      }
      // Skip date fields and numeric fields
      if (field.includes('date') || field.includes('year') || field === 'wsid' || field === 'sn') {
        return false;
      }
      // Skip branch_name - should be input text, not dropdown
      if (field === 'branch_name') {
        return false;
      }
      // Skip fields that should be removed
      if (field === 'sub_region' || field === 'response_resolution' || 
          field === 'warranty_stop' || field === 'software_cu_model') {
        return false;
      }
      // Include if has more than 2 unique values
      return fieldCounts[field].size > 2;
    });
    
    // Combine both lists, but exclude address and other manual input fields
    const dropdownFields = [...new Set([...alwaysDropdownFields, ...autoDropdownFields])].filter(field => {
      return !excludeFromDropdown.includes(field.toLowerCase());
    });
    
    dropdownFields.forEach(field => {
      const valuesSet = new Set();
      machines.forEach(m => {
        const value = m[field];
        if (value !== null && value !== undefined && value !== '') {
          valuesSet.add(String(value).trim());
        }
      });
      options[field] = Array.from(valuesSet).sort();
    });
    
    return options;
  }, [machines]);

  // Helper function to check if field should be date input
  const isDateField = useCallback((field) => {
    return field.includes('date') || field.includes('instal') || field === 'warranty_start' || field === 'warranty_end';
  }, []);

  // Helper function to format date for input (YYYY-MM-DD)
  const formatDateForInput = useCallback((dateStr) => {
    if (!dateStr) return '';
    // Try to parse DD-MM-YYYY or DD-MM-YY format
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
          year = '20' + year;
        }
        return `${year}-${month}-${day}`;
      }
    }
    return '';
  }, []);

  // Helper function to format date for output (DD-MM-YYYY)
  const formatDateForOutput = useCallback((dateStr) => {
    if (!dateStr) return '';
    // If already in YYYY-MM-DD format (from date input)
    if (dateStr.includes('-') && dateStr.length === 10) {
      const parts = dateStr.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }, []);

  // Group fields by category
  const fieldGroups = useMemo(() => {
    const groups = {
      basic: ['wsid', 'branch_name', 'customer', 'machine_type', 'model', 'sn'],
      location: ['address', 'city', 'provinsi', 'area_group', 'region', 'zona'],
      status: ['machine_status', 'maintenance_status', 'warranty_start', 'warranty_end'],
      technical: ['instal_date', 'year', 'distance', 'response_time', 'resolution_time'],
      other: []
    };
    
    allMachineFields.forEach(field => {
      // Skip fields that should be removed
      if (field === 'sub_region' || field === 'response_resolution' || 
          field === 'warranty_stop' || field === 'software_cu_model') {
        return; // Skip these fields
      }
      
      let categorized = false;
      for (const [group, fields] of Object.entries(groups)) {
        if (fields.some(f => field.includes(f) || f.includes(field))) {
          if (!groups[group].includes(field)) {
            groups[group].push(field);
          }
          categorized = true;
          break;
        }
      }
      if (!categorized) {
        groups.other.push(field);
      }
    });
    
    return groups;
  }, [allMachineFields]);
  
  // Pagination
  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage);
  const paginatedMachines = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMachines.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMachines, currentPage, itemsPerPage]);

  // Use custom hooks for KPIs
  const kpis = useMachineKPIs(filteredMachines, machines);
  const { 
    totalMachines, 
    onWarranty, 
    outOfWarranty, 
    warrantyRemaining,
    topAreaGroups, 
    topCustomers 
  } = kpis;
  
  const warrantyPercentage = totalMachines > 0 ? (onWarranty / totalMachines * 100) : 0;

  // Calculate detailed warranty insights for modal
  const warrantyInsights = useMemo(() => {
    if (!filteredMachines || filteredMachines.length === 0) {
      return {
        totalOnWarranty: 0,
        expiringSoonMachines: [],
        distribution: { critical: 0, warning: 0, good: 0 },
        timeRanges: {
          '0-30 hari': 0,
          '31-90 hari': 0,
          '91-180 hari': 0,
          '181-365 hari': 0,
          '> 365 hari': 0
        },
        avgRemaining: { avgDays: 0, avgMonths: 0, avgYears: 0 }
      };
    }

    // Helper function to calculate warranty remaining
    const calculateRemaining = (year, warrantyPeriodYears = 2) => {
      if (!year) return { days: 0, expired: true, status: 'expired' };
      const installYear = parseInt(year) || new Date().getFullYear();
      const currentDate = new Date();
      const warrantyEndDate = new Date(installYear + warrantyPeriodYears, 11, 31);
      const diffTime = warrantyEndDate - currentDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { days: 0, expired: true, status: 'expired' };
      
      let status = 'good';
      if (diffDays < 90) status = 'critical';
      else if (diffDays < 180) status = 'warning';
      
      return { days: diffDays, expired: false, status, months: Math.floor(diffDays / 30) };
    };

    // Get machines on warranty with detailed info
    const machinesOnWarranty = filteredMachines
      .filter(m => m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty')
      .map(m => ({
        ...m,
        warrantyInfo: calculateRemaining(m.year, 2)
      }))
      .filter(m => !m.warrantyInfo.expired);

    // Machines expiring soon (critical)
    const expiringSoonMachines = machinesOnWarranty
      .filter(m => m.warrantyInfo.status === 'critical')
      .sort((a, b) => a.warrantyInfo.days - b.warrantyInfo.days)
      .slice(0, 10);

    // Distribution by status
    const distribution = machinesOnWarranty.reduce((acc, m) => {
      acc[m.warrantyInfo.status] = (acc[m.warrantyInfo.status] || 0) + 1;
      return acc;
    }, { critical: 0, warning: 0, good: 0 });

    // Distribution by time ranges
    const timeRanges = {
      '0-30 hari': machinesOnWarranty.filter(m => m.warrantyInfo.days <= 30).length,
      '31-90 hari': machinesOnWarranty.filter(m => m.warrantyInfo.days > 30 && m.warrantyInfo.days <= 90).length,
      '91-180 hari': machinesOnWarranty.filter(m => m.warrantyInfo.days > 90 && m.warrantyInfo.days <= 180).length,
      '181-365 hari': machinesOnWarranty.filter(m => m.warrantyInfo.days > 180 && m.warrantyInfo.days <= 365).length,
      '> 365 hari': machinesOnWarranty.filter(m => m.warrantyInfo.days > 365).length
    };

    return {
      totalOnWarranty: machinesOnWarranty.length,
      expiringSoonMachines,
      distribution,
      timeRanges,
      avgRemaining: warrantyRemaining
    };
  }, [filteredMachines, warrantyRemaining]);

  // Normalize top area groups for display
  const normalizedTopAreaGroups = useMemo(() => {
    if (!filteredMachines || filteredMachines.length === 0) return [];
    
    // Calculate area groups with normalization
    const groups = {};
    filteredMachines.forEach(m => {
      const rawGroup = m.area_group || 'Unknown';
      let normalizedGroup = rawGroup.trim().toUpperCase();
      
      // Remove trailing numbers (e.g., "SURABAYA 1" -> "SURABAYA")
      normalizedGroup = normalizedGroup.replace(/\s+\d+$/, '');
      
      // Map "KOTA" to "SURABAYA" if it's the city name
      if (normalizedGroup === 'SURABAYA KOTA') {
        normalizedGroup = 'SURABAYA';
      }
      
      groups[normalizedGroup] = (groups[normalizedGroup] || 0) + 1;
    });
    
    // Sort by count and return top 3
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [filteredMachines]);


  const avgAge = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ages = filteredMachines.map(m => currentYear - parseInt(m.year || currentYear)).filter(age => age >= 0);
    return ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  }, [filteredMachines]);

  const machineTypes = useMemo(() => {
    const types = {};
    filteredMachines.forEach(m => {
      const type = m.machine_type || 'Unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [filteredMachines]);

  const allMachineTypes = useMemo(() => {
    const types = {};
    filteredMachines.forEach(m => {
      const type = m.machine_type || 'Unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).sort((a, b) => b[1] - a[1]);
  }, [filteredMachines]);

  const allAreaGroups = useMemo(() => {
    const groups = {};
    filteredMachines.forEach(m => {
      // Normalize: trim whitespace and convert to uppercase for consistency
      const rawGroup = m.area_group || 'Unknown';
      let normalizedGroup = rawGroup.trim().toUpperCase();
      
      // Remove trailing numbers (e.g., "SURABAYA 1" -> "SURABAYA")
      normalizedGroup = normalizedGroup.replace(/\s+\d+$/, '');
      
      // Map "SURABAYA KOTA" to "SURABAYA" if it's the city name
      if (normalizedGroup === 'SURABAYA KOTA') {
        normalizedGroup = 'SURABAYA';
      }
      
      groups[normalizedGroup] = (groups[normalizedGroup] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filteredMachines]);

  const allCustomers = useMemo(() => {
    const customers = {};
    filteredMachines.forEach(m => {
      const customer = m.customer || 'Unknown';
      customers[customer] = (customers[customer] || 0) + 1;
    });
    return Object.entries(customers).sort((a, b) => b[1] - a[1]);
  }, [filteredMachines]);

  const regionalCoverage = useMemo(() => {
    const regions = new Set(filteredMachines.map(m => m.region).filter(Boolean));
    return regions.size;
  }, [filteredMachines]);


  const totalCustomers = useMemo(() => {
    const uniqueCustomers = new Set(filteredMachines.map(m => m.customer).filter(Boolean));
    return uniqueCustomers.size;
  }, [filteredMachines]);

  const maintenanceBreakdown = useMemo(() => {
    const breakdown = {};
    filteredMachines.forEach(m => {
      const status = m.maintenance_status || 'Unknown';
      breakdown[status] = (breakdown[status] || 0) + 1;
    });
    return breakdown;
  }, [filteredMachines]);

  // Memoize chart data to prevent React error #310
  const warrantyTimeRangesChartData = useMemo(() => {
    if (!warrantyInsights?.timeRanges) return [];
    return Object.entries(warrantyInsights.timeRanges).map(([name, value]) => ({ name, value }));
  }, [warrantyInsights?.timeRanges]);

  const machineTypesChartData = useMemo(() => {
    return (allMachineTypes || []).slice(0, 10).map(([name, value]) => ({ name, value }));
  }, [allMachineTypes]);

  const areaGroupsChartData = useMemo(() => {
    return (allAreaGroups || []).slice(0, 10).map(([name, value]) => ({ name, value }));
  }, [allAreaGroups]);

  const customersChartData = useMemo(() => {
    return (allCustomers || []).slice(0, 10).map(([name, value]) => ({ name, value }));
  }, [allCustomers]);

  // Create mapping from address to location data (city, provinsi, area_group)
  const addressToLocationMap = useMemo(() => {
    const map = new Map();
    if (!machines || machines.length === 0) return map;
    
    machines.forEach(m => {
      const address = (m.address || '').trim().toLowerCase();
      if (address && m.city && m.provinsi && m.area_group) {
        // Store normalized address as key
        const normalizedAddress = address.replace(/\s+/g, ' ').trim();
        if (!map.has(normalizedAddress)) {
          map.set(normalizedAddress, {
            city: m.city,
            provinsi: m.provinsi,
            area_group: m.area_group
          });
        }
      }
    });
    return map;
  }, [machines]);

  // Create mapping from distance to response/resolution time
  const distanceToTimeMap = useMemo(() => {
    const map = new Map();
    if (!machines || machines.length === 0) return map;
    
    machines.forEach(m => {
      const distance = (m.distance || '').toString().trim();
      if (distance && m.response_time && m.resolution_time) {
        if (!map.has(distance)) {
          map.set(distance, {
            response_time: m.response_time,
            resolution_time: m.resolution_time
          });
        }
      }
    });
    return map;
  }, [machines]);

  // Create mapping from zona to distance, response_time, resolution_time
  const zonaToDataMap = useMemo(() => {
    const map = new Map();
    if (!machines || machines.length === 0) return map;
    
    machines.forEach(m => {
      const zona = (m.zona || '').toString().trim();
      if (zona && m.distance && m.response_time && m.resolution_time) {
        if (!map.has(zona)) {
          map.set(zona, {
            distance: m.distance,
            response_time: m.response_time,
            resolution_time: m.resolution_time
          });
        }
      }
    });
    return map;
  }, [machines]);

  // Handler for address change - auto-fill city, provinsi, area_group
  const handleAddressChange = useCallback((address) => {
    const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Try exact match first
    let locationData = addressToLocationMap.get(normalizedAddress);
    
    // If no exact match, try partial match (check if address contains key parts)
    if (!locationData) {
      for (const [key, value] of addressToLocationMap.entries()) {
        // Check if address contains significant parts of the key address
        const keyParts = key.split(' ').filter(part => part.length > 3);
        const addressParts = normalizedAddress.split(' ').filter(part => part.length > 3);
        
        // If at least 2 significant parts match, use this location data
        const matchingParts = keyParts.filter(part => 
          addressParts.some(addrPart => addrPart.includes(part) || part.includes(addrPart))
        );
        
        if (matchingParts.length >= 2) {
          locationData = value;
          break;
        }
      }
    }
    
    if (locationData) {
      setFormData(prev => ({
        ...prev,
        address: address,
        city: locationData.city,
        provinsi: locationData.provinsi,
        area_group: locationData.area_group
      }));
    } else {
      setFormData(prev => ({ ...prev, address: address }));
    }
  }, [addressToLocationMap]);

  // Handler for distance change - auto-fill response_time and resolution_time
  const handleDistanceChange = useCallback((distance) => {
    const distanceStr = distance.toString().trim();
    const timeData = distanceToTimeMap.get(distanceStr);
    
    if (timeData) {
      setFormData(prev => ({
        ...prev,
        distance: distance,
        response_time: timeData.response_time,
        resolution_time: timeData.resolution_time
      }));
    } else {
      setFormData(prev => ({ ...prev, distance: distance }));
    }
  }, [distanceToTimeMap]);

  // Handler for zona change - auto-fill distance, response_time, resolution_time
  const handleZonaChange = useCallback((zona) => {
    const zonaStr = zona.toString().trim();
    const zonaData = zonaToDataMap.get(zonaStr);
    
    if (zonaData) {
      setFormData(prev => ({
        ...prev,
        zona: zona,
        distance: zonaData.distance,
        response_time: zonaData.response_time,
        resolution_time: zonaData.resolution_time
      }));
    } else {
      setFormData(prev => ({ ...prev, zona: zona }));
    }
  }, [zonaToDataMap]);

  // Use custom hooks for handlers
  const handlers = useMachineHandlers({
    create,
    update,
    remove,
    bulkDelete,
    setModalMode,
    setFormData,
    setCrudShowModal,
    setSelectedMachines,
    resetForm
  });
  
  // Extract alert and confirm from handlers
  const { alert, confirm } = handlers;

  // Wrapper handlers for UI
  const handleEdit = (machine) => {
    setModalMode("edit");
    // Include ALL fields from machine object
    const allFields = {};
    Object.keys(machine).forEach(key => {
      allFields[key] = machine[key] || "";
    });
    // Also include fields that might not be in machine object
    allMachineFields.forEach(field => {
      if (!(field in allFields)) {
        allFields[field] = "";
      }
    });
    setFormData(allFields);
    setCrudShowModal(true);
  };

  const handleDelete = (machine) => {
    handlers.handleDelete(machine);
  };

  const handleSave = async () => {
    if (!formData || Object.keys(formData).length === 0) {
      alert.warning('Form data tidak valid. Silakan coba lagi.');
      return;
    }
    await handlers.handleSave(formData, modalMode);
  };

  const handleSelectAll = (e) => {
    handlers.handleSelectAll(e, filteredMachines);
  };

  const handleSelectOne = (wsid) => {
    handlers.handleSelectOne(wsid, selectedMachines);
  };

  const handleBulkDelete = async () => {
    await handlers.handleBulkDelete(selectedMachines);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setCustomerFilter("");
    setRegionFilter("");
    setWarrantyFilter("");
    setSearchTerm("");
  };

  // Clear specific filter
  const handleClearFilter = (filterType) => {
    if (filterType === "customer") {
      setCustomerFilter("");
    } else if (filterType === "region") {
      setRegionFilter("");
    } else if (filterType === "warranty") {
      setWarrantyFilter("");
    } else if (filterType === "search") {
      setSearchTerm("");
    }
  };

  // Check if any filter is active
  const hasActiveFilters = customerFilter || regionFilter || warrantyFilter || searchTerm;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Export is now handled by useMachineExport hook

  const handleUploadCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert.warning('Silakan upload file CSV');
      return;
    }

    setUploadingCSV(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target', 'machines');

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

      alert.success('CSV uploaded successfully!', 'Upload Berhasil');
      // Trigger data refresh
      window.dispatchEvent(new Event('machineDataChanged'));
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading CSV:', error);
      alert.error(`Failed to upload CSV: ${error.message}`);
    } finally {
      setUploadingCSV(false);
    }
  };


  // Only show full-screen loading on initial load, not during background refresh
  // Don't block UI if there's a modal or confirm dialog open
  const isInitialLoad = loading && machines.length === 0;
  const hasActiveModal = crudShowModal || confirm.confirmState.isOpen;
  
  if (isInitialLoad && !hasActiveModal) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSkeleton type="spinner" message="Memuat data mesin..." size="lg" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Machines Management"
    >
      {/* Show bulk delete when items selected */}
      {selectedMachines.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} /> Hapus ({selectedMachines.length})
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Garansi dengan Progress Bar */}
        <div className={cn(getKPICard('green', true), 'min-h-[400px] max-h-[500px] flex flex-col overflow-hidden')}>
          <div className="flex items-start justify-between mb-4 flex-shrink-0 gap-3">
            <div className="flex-1 min-w-0">
              <p className={cn(TEXT_STYLES.kpiTitle, 'truncate')}>Coverage Garansi</p>
              <h3 className={cn(TEXT_STYLES.kpiValue, 'truncate')}>{warrantyPercentage.toFixed(1)}%</h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowWarrantyInsightModal(true)}
                className={cn(
                  "transition-colors p-2 rounded",
                  isDark 
                    ? "text-slate-400 hover:text-green-400 hover:bg-slate-700/50 bg-green-600/20 hover:bg-green-600/30"
                    : "text-gray-600 hover:text-green-600 hover:bg-gray-200 bg-green-100 hover:bg-green-200"
                )}
                title="Lihat Insight Detail"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Progress Bar dengan Breakdown */}
          <div className="mt-4 flex-shrink-0">
            <div className={cn(
              "w-full h-4 rounded-full overflow-hidden relative",
              isDark ? "bg-slate-700" : "bg-gray-300"
            )}>
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${warrantyPercentage}%` }}
              ></div>
              <div 
                className="absolute top-0 right-0 h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                style={{ width: `${100 - warrantyPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between items-center mt-2.5 text-xs gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full bg-green-400 flex-shrink-0"></div>
                <span className="text-green-400 font-semibold truncate">{onWarranty.toLocaleString()} aktif</span>
                <span className={cn(
                  "flex-shrink-0",
                  isDark ? "text-slate-500" : "text-gray-600"
                )}>({warrantyPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                <div className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0"></div>
                <span className="text-red-400 font-semibold truncate">{outOfWarranty.toLocaleString()} expired</span>
                <span className={cn(
                  "flex-shrink-0",
                  isDark ? "text-slate-500" : "text-gray-600"
                )}>({(100 - warrantyPercentage).toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Status Breakdown dengan Visualisasi */}
          {warrantyRemaining && warrantyRemaining.avgDays > 0 && (
            <div className={cn(
              "mt-4 pt-4 border-t flex-1 flex flex-col min-h-0 overflow-hidden",
              isDark ? "border-slate-700/50" : "border-gray-300"
            )}>
              {/* Grid Layout untuk Status */}
              <div className="grid grid-cols-2 gap-3 mb-4 flex-shrink-0">
                {/* Rata-rata Sisa */}
                <div className={cn(
                  "rounded-lg p-3 border min-w-0",
                  isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-100 border-gray-300"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base flex-shrink-0">⏱️</span>
                    <span className={cn(
                      "text-xs truncate",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>Rata-rata Sisa</span>
                  </div>
                  <div className="text-base font-bold text-green-400 truncate">
                    {warrantyRemaining.avgMonths > 0 
                      ? `${warrantyRemaining.avgMonths} bulan`
                      : `${warrantyRemaining.avgDays} hari`
                    }
                  </div>
                </div>

                {/* Total Aktif */}
                <div className={cn(
                  "rounded-lg p-3 border min-w-0",
                  isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-100 border-gray-300"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base flex-shrink-0">✅</span>
                    <span className={cn(
                      "text-xs truncate",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>Total Aktif</span>
                  </div>
                  <div className="text-base font-bold text-green-400 truncate">
                    {onWarranty.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Top 3 Expiring Soon Machines - Table Format */}
              {warrantyInsights && warrantyInsights.expiringSoonMachines && warrantyInsights.expiringSoonMachines.length > 0 && (
                <div className="mb-3 flex-shrink-0 min-h-0">
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <div className={cn(
                      "text-xs font-semibold flex items-center gap-1.5 min-w-0",
                      isDark ? "text-slate-400" : "text-gray-600"
                    )}>
                      <span className="flex-shrink-0 text-sm">⚠️</span>
                      <span className="truncate">Expiring Soon</span>
                    </div>
                    {warrantyInsights.expiringSoonMachines.length > 3 && (
                      <button
                        onClick={() => setShowExpiringSoonModal(true)}
                        className="text-xs text-green-400 hover:text-green-300 transition-colors font-semibold flex-shrink-0 whitespace-nowrap px-1"
                      >
                        Detail →
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={cn(
                          "border-b",
                          isDark ? "border-slate-700/50" : "border-gray-300"
                        )}>
                          <th className={cn(
                            "text-center py-2 px-2 font-semibold text-[10px] w-8",
                            isDark ? "text-slate-400" : "text-gray-600"
                          )}>#</th>
                          <th className={cn(
                            "text-left py-2 px-2 font-semibold text-[10px] min-w-[70px]",
                            isDark ? "text-slate-400" : "text-gray-600"
                          )}>WSID</th>
                          <th className={cn(
                            "text-left py-2 px-2 font-semibold text-[10px] min-w-[60px]",
                            isDark ? "text-slate-400" : "text-gray-600"
                          )}>Area</th>
                          <th className={cn(
                            "text-right py-2 px-2 font-semibold text-[10px] min-w-[50px]",
                            isDark ? "text-slate-400" : "text-gray-600"
                          )}>Sisa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warrantyInsights.expiringSoonMachines.slice(0, 3).map((machine, idx) => (
                          <tr 
                            key={idx} 
                            className={cn(
                              "border-b transition-colors last:border-b-0",
                              isDark 
                                ? "border-slate-700/30 hover:bg-slate-800/50" 
                                : "border-gray-300 hover:bg-gray-100"
                            )}
                          >
                            <td className={cn(
                              "py-2 px-2 font-mono text-center text-[11px]",
                              isDark ? "text-slate-300" : "text-gray-700"
                            )}>{idx + 1}</td>
                            <td className="py-2 px-2 min-w-0">
                              <div className={cn(
                                "font-mono text-[11px] truncate",
                                isDark ? "text-slate-200" : "text-gray-900"
                              )} title={machine.wsid || 'Unknown'}>
                                {machine.wsid || 'Unknown'}
                              </div>
                            </td>
                            <td className="py-2 px-2 min-w-0">
                              <div className={cn(
                                "text-[11px] truncate",
                                isDark ? "text-slate-400" : "text-gray-600"
                              )} title={machine.area_group || 'Unknown'}>
                                {machine.area_group || 'Unknown'}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className={`text-[11px] font-bold whitespace-nowrap ${
                                machine.warrantyInfo.days <= 30 ? 'text-red-400' : 
                                machine.warrantyInfo.days <= 60 ? 'text-orange-400' : 'text-yellow-400'
                              }`}>
                                {machine.warrantyInfo.days}h
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className={cn(
                "mt-auto pt-3 border-t flex-shrink-0",
                isDark ? "border-slate-700/50" : "border-gray-300"
              )}>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={cn(
                    "min-w-0",
                    isDark ? "text-slate-400" : "text-gray-600"
                  )}>
                    <div className="truncate">Total Mesin:</div>
                    <div className={cn(
                      "font-semibold truncate",
                      isDark ? "text-slate-200" : "text-gray-900"
                    )}>{filteredMachines.length.toLocaleString()}</div>
                  </div>
                  <div className={cn(
                    "text-right min-w-0",
                    isDark ? "text-slate-400" : "text-gray-600"
                  )}>
                    <div className="truncate">Coverage:</div>
                    <div className="text-green-400 font-semibold truncate">{warrantyPercentage.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tipe Mesin Populer - Enhanced with Insights */}
        <div className={cn(getKPICard('purple', true), 'min-h-[400px] max-h-[500px] flex flex-col overflow-hidden')}>

          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className={TEXT_STYLES.kpiTitle}>Tipe Mesin Populer</p>
              <h3 className={cn(TEXT_STYLES.heading3, 'truncate break-words')} title={machineTypes[0]?.[0]}>{machineTypes[0]?.[0] || 'N/A'}</h3>
              <p className={cn('text-xs text-purple-400 mt-1')}>{machineTypes[0]?.[1] || 0} unit • {filteredMachines.length > 0 ? ((machineTypes[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMachineTypesModal(true)}
                className={cn(
                  "transition-colors p-2 rounded",
                  isDark 
                    ? "text-slate-400 hover:text-purple-400 hover:bg-slate-700/50 bg-purple-600/20 hover:bg-purple-600/30"
                    : "text-gray-600 hover:text-purple-600 hover:bg-gray-200 bg-purple-100 hover:bg-purple-200"
                )}
                title="Lihat Insight Detail"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
            <div className={cn(
              "rounded-lg p-2 border",
              isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-100 border-gray-300"
            )}>
              <div className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-gray-600"
              )}>Total Tipe</div>
              <div className="text-lg font-bold text-purple-400">
                {Object.keys(filteredMachines.reduce((acc, m) => { acc[m.machine_type || 'Unknown'] = true; return acc; }, {})).length}
              </div>
            </div>
            <div className={cn(
              "rounded-lg p-2 border",
              isDark ? "bg-slate-800/50 border-slate-700/50" : "bg-gray-100 border-gray-300"
            )}>
              <div className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-gray-600"
              )}>Dominasi</div>
              <div className="text-lg font-bold text-purple-400">
                {filteredMachines.length > 0 ? ((machineTypes[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>

          {/* Top Types dengan Warranty Breakdown */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            {machineTypes.map(([type, count], idx) => {
              const percentage = filteredMachines.length > 0 ? (count / filteredMachines.length * 100) : 0;
              
              // Calculate warranty breakdown for this type
              const typeWarrantyBreakdown = filteredMachines.filter(m => (m.machine_type || 'Unknown') === type).reduce((acc, m) => {
                if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                  acc.onWarranty++;
                } else {
                  acc.outOfWarranty++;
                }
                return acc;
              }, { onWarranty: 0, outOfWarranty: 0 });
              
              const warrantyPercentage = count > 0 ? (typeWarrantyBreakdown.onWarranty / count * 100) : 0;
              
              return (
                <div key={idx} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  {/* Type Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-purple-500/20 text-purple-400' :
                        idx === 1 ? 'bg-purple-600/20 text-purple-400' :
                        'bg-purple-700/20 text-purple-400'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate" title={type}>{type}</div>
                        <div className="text-xs text-slate-400">{count} unit • {percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        idx === 0 ? 'bg-gradient-to-r from-purple-400 to-purple-500' :
                        idx === 1 ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                        'bg-gradient-to-r from-purple-600 to-purple-700'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  
                  {/* Warranty Breakdown */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-slate-400">On: </span>
                      <span className="text-green-400 font-semibold">{typeWarrantyBreakdown.onWarranty}</span>
                      <span className="text-slate-500">({warrantyPercentage.toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span className="text-slate-400">Out: </span>
                      <span className="text-red-400 font-semibold">{typeWarrantyBreakdown.outOfWarranty}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Insight */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
            <div className="text-xs text-slate-400">
              💡 <span className="text-slate-300 font-semibold">{machineTypes[0]?.[0] || 'Tidak ada data'}</span> mendominasi dengan {filteredMachines.length > 0 ? ((machineTypes[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total mesin
            </div>
          </div>
        </div>

        {/* Area Group Mesin Terbanyak - Enhanced with Insights */}
        <div className={cn(getKPICard('orange', true), 'min-h-[400px] max-h-[500px] flex flex-col overflow-hidden')}>
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className={TEXT_STYLES.kpiTitle}>Area Group Mesin Terbanyak</p>
              <h3 className={cn(TEXT_STYLES.heading3, 'truncate break-words')} title={normalizedTopAreaGroups[0]?.[0]}>{normalizedTopAreaGroups[0]?.[0] || 'N/A'}</h3>
              <p className={cn('text-xs text-orange-400 mt-1')}>{normalizedTopAreaGroups[0]?.[1] || 0} unit • {filteredMachines.length > 0 ? ((normalizedTopAreaGroups[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAreaGroupModal(true)}
                className="text-slate-400 hover:text-orange-400 transition-colors p-2 rounded hover:bg-slate-700/50 bg-orange-600/20 hover:bg-orange-600/30"
                title="Lihat Insight Detail"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
              <div className="text-xs text-slate-400">Total Area</div>
              <div className="text-lg font-bold text-orange-400">
                {allAreaGroups.length}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
              <div className="text-xs text-slate-400">Dominasi</div>
              <div className="text-lg font-bold text-orange-400">
                {filteredMachines.length > 0 ? ((normalizedTopAreaGroups[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>

          {/* Top Area Groups dengan Warranty Breakdown */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            {normalizedTopAreaGroups.map(([areaGroup, count], idx) => {
              const percentage = filteredMachines.length > 0 ? (count / filteredMachines.length * 100) : 0;
              
              // Calculate warranty breakdown for this area - normalize area_group for comparison
              const areaWarrantyBreakdown = filteredMachines.filter(m => {
                const rawGroup = m.area_group || 'Unknown';
                let normalizedGroup = rawGroup.trim().toUpperCase();
                normalizedGroup = normalizedGroup.replace(/\s+\d+$/, '');
                if (normalizedGroup === 'SURABAYA KOTA') {
                  normalizedGroup = 'SURABAYA';
                }
                return normalizedGroup === areaGroup;
              }).reduce((acc, m) => {
                if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                  acc.onWarranty++;
                } else {
                  acc.outOfWarranty++;
                }
                return acc;
              }, { onWarranty: 0, outOfWarranty: 0 });
              
              const warrantyPercentage = count > 0 ? (areaWarrantyBreakdown.onWarranty / count * 100) : 0;
              
              return (
                <div key={idx} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  {/* Area Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-orange-500/20 text-orange-400' :
                        idx === 1 ? 'bg-orange-600/20 text-orange-400' :
                        'bg-orange-700/20 text-orange-400'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate" title={areaGroup}>{areaGroup}</div>
                        <div className="text-xs text-slate-400">{count} unit • {percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        idx === 0 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                        idx === 1 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                        'bg-gradient-to-r from-orange-600 to-orange-700'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  
                  {/* Warranty Breakdown */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-slate-400">On: </span>
                      <span className="text-green-400 font-semibold">{areaWarrantyBreakdown.onWarranty}</span>
                      <span className="text-slate-500">({warrantyPercentage.toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span className="text-slate-400">Out: </span>
                      <span className="text-red-400 font-semibold">{areaWarrantyBreakdown.outOfWarranty}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Insight */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
            <div className="text-xs text-slate-400">
              💡 <span className="text-slate-300 font-semibold">{normalizedTopAreaGroups[0]?.[0] || 'Tidak ada data'}</span> mendominasi dengan {filteredMachines.length > 0 ? ((normalizedTopAreaGroups[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total mesin
            </div>
          </div>
        </div>

        {/* Top Customer - Enhanced with Insights */}
        <div className={cn(getKPICard('cyan', true), 'min-h-[400px] max-h-[500px] flex flex-col overflow-hidden')}>
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <p className={TEXT_STYLES.kpiTitle}>Top Customer</p>
              <h3 className={cn(TEXT_STYLES.heading3, 'truncate break-words')} title={topCustomers[0]?.name}>{topCustomers[0]?.name || 'N/A'}</h3>
              <p className={cn('text-xs text-cyan-400 mt-1')}>{topCustomers[0]?.value || 0} unit • {filteredMachines.length > 0 ? ((topCustomers[0]?.value || 0) / filteredMachines.length * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCustomerModal(true)}
                className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded hover:bg-slate-700/50 bg-cyan-600/20 hover:bg-cyan-600/30"
                title="Lihat Insight Detail"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
              <div className="text-xs text-slate-400">Total Customer</div>
              <div className="text-lg font-bold text-cyan-400">
                {allCustomers.length}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/50">
              <div className="text-xs text-slate-400">Dominasi</div>
              <div className="text-lg font-bold text-cyan-400">
                {filteredMachines.length > 0 ? ((topCustomers[0]?.value || 0) / filteredMachines.length * 100).toFixed(0) : 0}%
              </div>
            </div>
          </div>

          {/* Top Customers dengan Warranty Breakdown */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            {topCustomers.slice(0, 3).map((customer, idx) => {
              const percentage = filteredMachines.length > 0 ? (customer.value / filteredMachines.length * 100) : 0;
              
              // Calculate warranty breakdown for this customer
              const customerWarrantyBreakdown = filteredMachines.filter(m => (m.customer || 'Unknown') === customer.name).reduce((acc, m) => {
                if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                  acc.onWarranty++;
                } else {
                  acc.outOfWarranty++;
                }
                return acc;
              }, { onWarranty: 0, outOfWarranty: 0 });
              
              const warrantyPercentage = customer.value > 0 ? (customerWarrantyBreakdown.onWarranty / customer.value * 100) : 0;
              
              return (
                <div key={idx} className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
                  {/* Customer Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-cyan-500/20 text-cyan-400' :
                        idx === 1 ? 'bg-cyan-600/20 text-cyan-400' :
                        'bg-cyan-700/20 text-cyan-400'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-200 truncate" title={customer.name}>{customer.name}</div>
                        <div className="text-xs text-slate-400">{customer.value} unit • {percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        idx === 0 ? 'bg-gradient-to-r from-cyan-400 to-cyan-500' :
                        idx === 1 ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' :
                        'bg-gradient-to-r from-cyan-600 to-cyan-700'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  
                  {/* Warranty Breakdown */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span className="text-slate-400">On: </span>
                      <span className="text-green-400 font-semibold">{customerWarrantyBreakdown.onWarranty}</span>
                      <span className="text-slate-500">({warrantyPercentage.toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                      <span className="text-slate-400">Out: </span>
                      <span className="text-red-400 font-semibold">{customerWarrantyBreakdown.outOfWarranty}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Insight */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
            <div className="text-xs text-slate-400">
              💡 <span className="text-slate-300 font-semibold">{topCustomers[0]?.name || 'Tidak ada data'}</span> mendominasi dengan {filteredMachines.length > 0 ? ((topCustomers[0]?.value || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total mesin
            </div>
          </div>
        </div>

      
      </div>

      {/* Filter Section - Compact Design */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
        {/* Compact Filter Row */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Customer Filter */}
          <div className="flex-1 min-w-[160px] sm:min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">👤 Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              aria-label="Filter by customer"
            >
              <option value="">-- Semua Customer --</option>
              {[...new Set(machines.map(m => m.customer).filter(Boolean))].sort().map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div className="flex-1 min-w-[160px] sm:min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">📍 Region</label>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              aria-label="Filter by region"
            >
              <option value="">-- Semua Region --</option>
              {[...new Set(machines.map(m => m.region).filter(Boolean))].sort().map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* Warranty Status Filter */}
          <div className="flex-1 min-w-[160px] sm:min-w-[180px]">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">⚠️ Status Garansi</label>
            <select
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              aria-label="Filter by warranty status"
            >
              <option value="">-- Semua Status --</option>
              <option value="On Warranty">✅ Aktif</option>
              <option value="Out Of Warranty">❌ Expired</option>
            </select>
          </div>

          {/* Active Filters Info & Clear Button */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 text-blue-400 rounded text-xs whitespace-nowrap">
                  <span>{filteredMachines.length}</span>
                  <span className="text-slate-400">hasil</span>
                </div>
                <button
                  onClick={handleClearAllFilters}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors rounded hover:bg-slate-700/50 flex items-center gap-1"
                  title="Hapus semua filter"
                >
                  <X size={14} />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Active Filter Chips - Compact */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 items-center mt-2.5 pt-2.5 border-t border-slate-700/50">
            {customerFilter && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                <span className="truncate max-w-[120px]">
                  👤 {customerFilter.length > 15 ? customerFilter.substring(0, 15) + "..." : customerFilter}
                </span>
                <button
                  onClick={() => handleClearFilter("customer")}
                  className="hover:text-blue-300 transition-colors ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {regionFilter && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                <span className="truncate max-w-[120px]">
                  📍 {regionFilter.length > 15 ? regionFilter.substring(0, 15) + "..." : regionFilter}
                </span>
                <button
                  onClick={() => handleClearFilter("region")}
                  className="hover:text-blue-300 transition-colors ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {warrantyFilter && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                <span>⚠️ {warrantyFilter === "On Warranty" ? "Aktif" : "Expired"}</span>
                <button
                  onClick={() => handleClearFilter("warranty")}
                  className="hover:text-green-300 transition-colors ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {searchTerm && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                <Search size={10} className="inline" />
                <span className="truncate max-w-[100px]">"{searchTerm}"</span>
                <button
                  onClick={() => handleClearFilter("search")}
                  className="hover:text-purple-300 transition-colors ml-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table Section - Normal View */}
      {!isFullscreen && (
        <>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Table Header with Search & Actions */}
            <div className="p-4 border-b border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Data Mesin</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{filteredMachines.length} dari {machines.length} mesin</p>
                </div>
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setModalMode("create");
                      const initialData = createInitialFormData();
                      setFormData(initialData);
                      setCrudShowModal(true);
                    }}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 sm:gap-1.5"
                  >
                    <span className="text-xs sm:text-sm">+</span> <span className="hidden sm:inline">Tambah</span> <span className="sm:hidden">+</span>
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={filteredMachines.length === 0 || isExporting}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1 sm:gap-1.5"
                    title={filteredMachines.length === 0 ? "Tidak ada data untuk diekspor" : "Export data ke CSV"}
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
                  <label className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer">
                    <Upload size={12} className="sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleUploadCSV}
                      className="hidden"
                      disabled={uploadingCSV}
                    />
                  </label>
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 sm:gap-1.5"
                    title="Fullscreen"
                  >
                    <Maximize size={12} className="sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari mesin berdasarkan branch, WSID, customer..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            
            {/* Table Content */}
            <div className="overflow-auto max-h-[600px]">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/95 backdrop-blur-sm sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center sticky left-0 bg-slate-900/95 backdrop-blur-sm z-20 w-12 border-b border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedMachines.length === paginatedMachines.length && paginatedMachines.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-800"
                      aria-label="Select all machines"
                    />
                  </th>
                  {/* Important columns with fixed width */}
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-32 border-b border-slate-700">WSID</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-48 border-b border-slate-700">Branch</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-40 border-b border-slate-700">Customer</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-32 border-b border-slate-700">Type</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-32 border-b border-slate-700">City</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-32 border-b border-slate-700">Region</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap w-32 border-b border-slate-700">Status</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider sticky right-0 bg-slate-900/95 backdrop-blur-sm z-20 w-24 border-b border-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {paginatedMachines.length > 0 ? (
                  paginatedMachines.map((m, i) => (
                    <tr 
                      key={i} 
                      className={`hover:bg-slate-700/40 transition-colors ${
                        i % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800/30'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center sticky left-0 bg-slate-800/95 backdrop-blur-sm z-10">
                        <input
                          type="checkbox"
                          checked={selectedMachines.includes(m.wsid)}
                          onChange={() => handleSelectOne(m.wsid)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-800"
                          aria-label={`Select machine ${m.wsid}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-100 font-mono truncate" title={m.wsid || ''}>{m.wsid || '-'}</td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.branch_name || ''}>{m.branch_name || '-'}</td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.customer || ''}>{m.customer || '-'}</td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.machine_type || ''}>{m.machine_type || '-'}</td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.city || ''}>{m.city || '-'}</td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm">
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                          {m.region || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs sm:text-sm">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded font-medium border whitespace-nowrap ${
                          m.machine_status === "On Warranty" || m.machine_status === "In Warranty" 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          {m.machine_status === "On Warranty" || m.machine_status === "In Warranty" ? '✅' : '⚠️'} {m.machine_status || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 sticky right-0 bg-slate-800/95 backdrop-blur-sm z-10">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(m)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Edit"
                            aria-label={`Edit machine ${m.wsid}`}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            title="Delete"
                            aria-label={`Delete machine ${m.wsid}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-5xl">📭</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200 mb-1">Tidak ada mesin ditemukan</p>
                          <p className="text-xs text-slate-400">Coba ubah filter atau hapus beberapa filter untuk melihat hasil</p>
                        </div>
                        {(customerFilter || regionFilter || warrantyFilter || searchTerm) && (
                          <button
                            onClick={handleClearAllFilters}
                            className="mt-2 px-4 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                            Hapus Semua Filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-700 flex-shrink-0 bg-slate-800/50">
              <div className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
                Menampilkan <span className="font-semibold text-slate-300">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-semibold text-slate-300">{Math.min(currentPage * itemsPerPage, filteredMachines.length)}</span> dari <span className="font-semibold text-slate-300">{filteredMachines.length.toLocaleString()}</span> mesin
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
                <span className="text-xs sm:text-sm text-slate-300 px-2">
                  Halaman {currentPage} dari {totalPages}
                </span>
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
        </>
      )}

      {/* Fullscreen Table Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col" style={{ zIndex: 9999 }}>
          {/* Fullscreen Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0 bg-slate-800">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Data Mesin - Fullscreen</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filteredMachines.length} dari {machines.length} mesin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport(filteredMachines, null, 'mesin')}
                disabled={filteredMachines.length === 0 || isExporting}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                title={filteredMachines.length === 0 ? "Tidak ada data untuk diekspor" : "Export data ke CSV"}
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Export CSV</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Exit Fullscreen"
              >
                <Minimize size={14} /> Keluar Fullscreen
              </button>
            </div>
          </div>

          {/* Fullscreen Search Bar */}
          <div className="p-4 border-b border-slate-700 flex-shrink-0 bg-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari mesin berdasarkan branch, WSID, customer..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Fullscreen Table Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-800">
            <div className="flex-1 overflow-auto">
              <div className="overflow-x-auto h-full">
                <table className="w-full">
                  <thead className="bg-slate-900 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center sticky left-0 bg-slate-900 z-10 w-12">
                        <input
                          type="checkbox"
                          checked={selectedMachines.length === paginatedMachines.length && paginatedMachines.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                        />
                      </th>
                      {/* Important columns with fixed width */}
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-32">WSID</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-48">Branch</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-40">Customer</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-32">Type</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-32">City</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-32">Region</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-300 whitespace-nowrap w-32">Status</th>
                      <th className="px-3 py-2 text-center text-xs text-slate-300 sticky right-0 bg-slate-900 z-10 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {paginatedMachines.length > 0 ? (
                      paginatedMachines.map((m, i) => (
                        <tr 
                          key={i} 
                          className={`hover:bg-slate-700/40 transition-colors ${
                            i % 2 === 0 ? 'bg-slate-800/50' : 'bg-slate-800/30'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center sticky left-0 bg-slate-800/95 backdrop-blur-sm z-10">
                            <input
                              type="checkbox"
                              checked={selectedMachines.includes(m.wsid)}
                              onChange={() => handleSelectOne(m.wsid)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-800"
                              aria-label={`Select machine ${m.wsid}`}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-100 font-mono truncate" title={m.wsid || ''}>{m.wsid || '-'}</td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.branch_name || ''}>{m.branch_name || '-'}</td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.customer || ''}>{m.customer || '-'}</td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.machine_type || ''}>{m.machine_type || '-'}</td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm text-slate-300 truncate" title={m.city || ''}>{m.city || '-'}</td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm">
                            <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                              {m.region || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs sm:text-sm">
                            <span className={`inline-flex items-center px-2 py-1 text-xs rounded font-medium border whitespace-nowrap ${
                              m.machine_status === "On Warranty" || m.machine_status === "In Warranty" 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}>
                              {m.machine_status === "On Warranty" || m.machine_status === "In Warranty" ? '✅' : '⚠️'} {m.machine_status || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 sticky right-0 bg-slate-800/95 backdrop-blur-sm z-10">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEdit(m)}
                                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title="Edit"
                                aria-label={`Edit machine ${m.wsid}`}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(m)}
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                                title="Delete"
                                aria-label={`Delete machine ${m.wsid}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="text-5xl">📭</div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200 mb-1">Tidak ada mesin ditemukan</p>
                              <p className="text-xs text-slate-400">Coba ubah filter atau hapus beberapa filter untuk melihat hasil</p>
                            </div>
                            {(customerFilter || regionFilter || warrantyFilter || searchTerm) && (
                              <button
                                onClick={handleClearAllFilters}
                                className="mt-2 px-4 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                              >
                                Hapus Semua Filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fullscreen Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 flex-shrink-0 bg-slate-800">
                <div className="text-sm text-slate-400">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredMachines.length)} dari {filteredMachines.length} mesin
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} className="text-slate-300" />
                  </button>
                  <span className="text-sm text-slate-300">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
            {/* CRUD Modal */}
      {crudShowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 px-6 py-5 flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  {modalMode === "create" ? (
                    <Hash className="text-blue-400" size={20} />
                  ) : (
                    <Edit className="text-blue-400" size={20} />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">
                    {modalMode === "create" ? "Tambah Mesin Baru" : "Edit Mesin"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {modalMode === "create" ? "Isi form di bawah untuk menambahkan mesin baru" : "Perbarui informasi mesin"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCrudShowModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 p-2 rounded-lg transition-all"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-8 max-h-[calc(90vh-180px)] overflow-y-auto custom-scrollbar">

              {/* Basic Information Section */}
              {fieldGroups.basic.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Hash className="text-blue-400" size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Informasi Dasar</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fieldGroups.basic.map((field) => {
                      const fieldValue = formData[field] || "";
                      const fieldLabel = field.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                      const isRequired = field === 'wsid' || field === 'branch_name';
                      // Branch name should always be input text, not dropdown
                      const hasDropdown = field !== 'branch_name' && dropdownOptions[field] && dropdownOptions[field].length > 0;
                      
                      return (
                        <div key={field} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            {getFieldIcon(field)}
                            <span>{fieldLabel} {isRequired && <span className="text-red-400 ml-1">*</span>}</span>
                          </label>
                          {hasDropdown ? (
                            <select
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              disabled={modalMode === "edit" && field === 'wsid'}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            >
                              <option value="" className="bg-slate-800">-- Pilih {fieldLabel} --</option>
                              {dropdownOptions[field].map((option, idx) => (
                                <option key={idx} value={option} className="bg-slate-800">{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              disabled={modalMode === "edit" && field === 'wsid'}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-slate-700/80 hover:border-slate-500"
                              placeholder={getFieldPlaceholder(field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Location Information Section */}
              {fieldGroups.location.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                      <MapPin className="text-orange-400" size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Informasi Lokasi</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fieldGroups.location.map((field) => {
                      const fieldValue = formData[field] || "";
                      const fieldLabel = field.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                      const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                      // Check if field is auto-filled (city, provinsi, area_group when address is filled)
                      const isAutoFilled = field !== 'address' && formData.address && 
                        (field === 'city' || field === 'provinsi' || field === 'area_group');
                      
                      return (
                        <div key={field} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            {getFieldIcon(field)}
                            <span>{fieldLabel}</span>
                            {isAutoFilled && (
                              <span className="text-xs text-cyan-400 font-normal">(Auto-filled)</span>
                            )}
                          </label>
                          {hasDropdown ? (
                            <select
                              value={fieldValue}
                              onChange={(e) => {
                                if (field === 'zona') {
                                  handleZonaChange(e.target.value);
                                } else {
                                  setFormData({...formData, [field]: e.target.value});
                                }
                              }}
                              readOnly={isAutoFilled}
                              className={`w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all hover:bg-slate-700/80 hover:border-slate-500 ${isAutoFilled ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                              <option value="" className="bg-slate-800">-- Pilih {fieldLabel} --</option>
                              {dropdownOptions[field].map((option, idx) => (
                                <option key={idx} value={option} className="bg-slate-800">{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => {
                                if (field === 'address') {
                                  handleAddressChange(e.target.value);
                                } else {
                                  setFormData({...formData, [field]: e.target.value});
                                }
                              }}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                              placeholder={getFieldPlaceholder(field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status & Warranty Section */}
              {fieldGroups.status.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <AlertCircle className="text-yellow-400" size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Status & Garansi</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fieldGroups.status.map((field) => {
                      const fieldValue = formData[field] || "";
                      const fieldLabel = field.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                      const isDate = isDateField(field);
                      const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                      
                      if (field === 'machine_status') {
                        return (
                          <div key={field} className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel}</span>
                            </label>
                            <select
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            >
                              <option value="" className="bg-slate-800">Pilih Status Garansi</option>
                              <option value="On Warranty" className="bg-slate-800">On Warranty</option>
                              <option value="In Warranty" className="bg-slate-800">In Warranty</option>
                              <option value="Out Of Warranty" className="bg-slate-800">Out Of Warranty</option>
                            </select>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={field} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            {getFieldIcon(field)}
                            <span>{fieldLabel}</span>
                          </label>
                          {isDate ? (
                            <input
                              type="date"
                              value={formatDateForInput(fieldValue)}
                              onChange={(e) => setFormData({...formData, [field]: formatDateForOutput(e.target.value)})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            />
                          ) : hasDropdown ? (
                            <select
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            >
                              <option value="" className="bg-slate-800">-- Pilih {fieldLabel} --</option>
                              {dropdownOptions[field].map((option, idx) => (
                                <option key={idx} value={option} className="bg-slate-800">{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                              placeholder={getFieldPlaceholder(field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Technical Information Section */}
              {fieldGroups.technical.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                      <Settings className="text-pink-400" size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Informasi Teknis</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fieldGroups.technical.map((field) => {
                      const fieldValue = formData[field] || "";
                      const fieldLabel = field.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                      const isDate = isDateField(field);
                      const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                      // Check if field is auto-filled from zona (distance, response_time, resolution_time when zona is filled)
                      const isAutoFilledFromZona = formData.zona && 
                        (field === 'distance' || field === 'response_time' || field === 'resolution_time');
                      // Check if field is auto-filled from distance (response_time, resolution_time when distance is filled)
                      const isAutoFilledFromDistance = field !== 'distance' && formData.distance && !formData.zona &&
                        (field === 'response_time' || field === 'resolution_time');
                      const isAutoFilled = isAutoFilledFromZona || isAutoFilledFromDistance;
                      
                      return (
                        <div key={field} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            {getFieldIcon(field)}
                            <span>{fieldLabel}</span>
                            {isAutoFilled && (
                              <span className="text-xs text-cyan-400 font-normal">(Auto-filled)</span>
                            )}
                          </label>
                          {isDate ? (
                            <input
                              type="date"
                              value={formatDateForInput(fieldValue)}
                              onChange={(e) => setFormData({...formData, [field]: formatDateForOutput(e.target.value)})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            />
                          ) : hasDropdown ? (
                            <select
                              value={fieldValue}
                              onChange={(e) => {
                                if (field === 'distance') {
                                  handleDistanceChange(e.target.value);
                                } else {
                                  setFormData({...formData, [field]: e.target.value});
                                }
                              }}
                              readOnly={isAutoFilled}
                              className={`w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all hover:bg-slate-700/80 hover:border-slate-500 ${isAutoFilled ? 'opacity-75 cursor-not-allowed' : ''}`}
                            >
                              <option value="" className="bg-slate-800">-- Pilih {fieldLabel} --</option>
                              {dropdownOptions[field].map((option, idx) => (
                                <option key={idx} value={option} className="bg-slate-800">{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => {
                                if (field === 'distance') {
                                  handleDistanceChange(e.target.value);
                                } else {
                                  setFormData({...formData, [field]: e.target.value});
                                }
                              }}
                              readOnly={isAutoFilled}
                              className={`w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all hover:bg-slate-700/80 hover:border-slate-500 ${isAutoFilled ? 'opacity-75 cursor-not-allowed' : ''}`}
                              placeholder={getFieldPlaceholder(field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other Fields Section */}
              {fieldGroups.other.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-700/50">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <Info className="text-slate-400" size={18} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-200">Informasi Lainnya</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fieldGroups.other.map((field) => {
                      const fieldValue = formData[field] || "";
                      const fieldLabel = field.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                      const isDate = isDateField(field);
                      const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                      
                      return (
                        <div key={field} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                            {getFieldIcon(field)}
                            <span>{fieldLabel}</span>
                          </label>
                          {isDate ? (
                            <input
                              type="date"
                              value={formatDateForInput(fieldValue)}
                              onChange={(e) => setFormData({...formData, [field]: formatDateForOutput(e.target.value)})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            />
                          ) : hasDropdown ? (
                            <select
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                            >
                              <option value="" className="bg-slate-800">-- Pilih {fieldLabel} --</option>
                              {dropdownOptions[field].map((option, idx) => (
                                <option key={idx} value={option} className="bg-slate-800">{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all hover:bg-slate-700/80 hover:border-slate-500"
                              placeholder={getFieldPlaceholder(field)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="sticky bottom-0 bg-gradient-to-r from-slate-800 to-slate-700 border-t border-slate-600 px-6 py-5 flex justify-end gap-3 shadow-lg">
              <button
                onClick={() => {
                  setCrudShowModal(false);
                  resetForm();
                }}
                className="px-3 sm:px-6 py-1.5 sm:py-3 bg-slate-700/80 hover:bg-slate-600 text-slate-100 rounded-xl transition-all text-xs sm:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="px-3 sm:px-6 py-1.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl transition-all text-xs sm:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-1.5 sm:gap-2"
              >
                {modalMode === "create" ? (
                  <>
                    <span className="text-sm sm:text-base">+</span> <span className="hidden sm:inline">Tambah Mesin</span> <span className="sm:hidden">Tambah</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm sm:text-base">✓</span> <span className="hidden sm:inline">Simpan Perubahan</span> <span className="sm:hidden">Simpan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Soon Modal - Top 5 */}
      {showExpiringSoonModal && warrantyInsights && warrantyInsights.expiringSoonMachines && Array.isArray(warrantyInsights.expiringSoonMachines) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="bg-slate-900 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>⚠️</span> Top 5 Mesin yang Expiring Soon
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Menampilkan 5 dari {warrantyInsights.expiringSoonMachines.length} mesin dengan status critical
                </p>
              </div>
              <button
                onClick={() => setShowExpiringSoonModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">#</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">WSID</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">Nama Mesin</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">Area</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">Customer</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-semibold">Region</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-semibold">Sisa Hari</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warrantyInsights.expiringSoonMachines.slice(0, 5).map((machine, idx) => (
                      <tr 
                        key={idx} 
                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-300 font-bold text-red-400">#{idx + 1}</td>
                        <td className="py-3 px-4 text-slate-200 font-mono text-sm">{machine.wsid}</td>
                        <td className="py-3 px-4 text-slate-200 font-semibold">{machine.branch_name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-slate-300">{machine.area_group || 'Unknown'}</td>
                        <td className="py-3 px-4 text-slate-300">{machine.customer || 'Unknown'}</td>
                        <td className="py-3 px-4 text-slate-300">{machine.region || 'Unknown'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className={`font-bold text-lg ${
                            machine.warrantyInfo.days <= 30 ? 'text-red-400' : 
                            machine.warrantyInfo.days <= 60 ? 'text-orange-400' : 'text-yellow-400'
                          }`}>
                            {machine.warrantyInfo.days}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {machine.warrantyInfo.months > 0 ? `${machine.warrantyInfo.months} bulan` : '< 1 bulan'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 font-semibold">Critical</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warranty Insight Modal */}
      {showWarrantyInsightModal && warrantyInsights && warrantyInsights.totalOnWarranty !== undefined && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="bg-slate-900 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>📊</span> Insight Detail Warranty
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Analisis lengkap status warranty {warrantyInsights.totalOnWarranty} mesin
                </p>
              </div>
              <button
                onClick={() => setShowWarrantyInsightModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total On Warranty</p>
                  <p className="text-2xl font-bold text-green-400">{warrantyInsights.totalOnWarranty}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Rata-rata Sisa</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {warrantyInsights.avgRemaining?.avgMonths > 0 
                      ? `${warrantyInsights.avgRemaining.avgMonths} bulan`
                      : `${warrantyInsights.avgRemaining?.avgDays || 0} hari`
                    }
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
                  <p className="text-slate-400 text-xs mb-1">Expiring Soon</p>
                  <p className="text-2xl font-bold text-red-400">{warrantyInsights.expiringSoonMachines.length}</p>
                  <p className="text-xs text-slate-500 mt-1">&lt; 90 hari</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                  <p className="text-slate-400 text-xs mb-1">Warning</p>
                  <p className="text-2xl font-bold text-yellow-400">{warrantyInsights.distribution.warning || 0}</p>
                  <p className="text-xs text-slate-500 mt-1">90-180 hari</p>
                </div>
              </div>

              {/* Distribution Chart */}
              {warrantyTimeRangesChartData.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Distribusi Sisa Waktu Warranty</h3>
                  <div style={{ minWidth: '100px', position: 'relative', width: '100%', display: 'block' }}>
                    <ResponsiveContainer width="100%" height={250} minHeight={250} minWidth={100}>
                      <BarChart data={warrantyTimeRangesChartData}>
                      <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #10b981', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Status Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-red-400 font-semibold">Critical</span>
                    <span className="text-2xl font-bold text-red-400">{warrantyInsights.distribution.critical || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400">Mesin dengan sisa &lt; 90 hari</p>
                  <div className="mt-2 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-500"
                      style={{ width: `${warrantyInsights.totalOnWarranty > 0 ? (warrantyInsights.distribution.critical / warrantyInsights.totalOnWarranty * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-yellow-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-400 font-semibold">Warning</span>
                    <span className="text-2xl font-bold text-yellow-400">{warrantyInsights.distribution.warning || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400">Mesin dengan sisa 90-180 hari</p>
                  <div className="mt-2 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500"
                      style={{ width: `${warrantyInsights.totalOnWarranty > 0 ? (warrantyInsights.distribution.warning / warrantyInsights.totalOnWarranty * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-green-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-green-400 font-semibold">Good</span>
                    <span className="text-2xl font-bold text-green-400">{warrantyInsights.distribution.good || 0}</span>
                  </div>
                  <p className="text-xs text-slate-400">Mesin dengan sisa &gt; 180 hari</p>
                  <div className="mt-2 w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500"
                      style={{ width: `${warrantyInsights.totalOnWarranty > 0 ? (warrantyInsights.distribution.good / warrantyInsights.totalOnWarranty * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Expiring Soon Machines List */}
              {warrantyInsights.expiringSoonMachines.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <span>⚠️</span> Mesin yang Expiring Soon (Top 10)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left p-2 text-slate-400">WSID</th>
                          <th className="text-left p-2 text-slate-400">Branch</th>
                          <th className="text-left p-2 text-slate-400">Customer</th>
                          <th className="text-left p-2 text-slate-400">Area</th>
                          <th className="text-right p-2 text-slate-400">Sisa Hari</th>
                          <th className="text-right p-2 text-slate-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warrantyInsights.expiringSoonMachines.map((machine, idx) => (
                          <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-2 text-slate-200 font-mono text-xs">{machine.wsid}</td>
                            <td className="p-2 text-slate-300">{machine.branch_name}</td>
                            <td className="p-2 text-slate-300">{machine.customer}</td>
                            <td className="p-2 text-slate-300">{machine.area_group}</td>
                            <td className="p-2 text-right">
                              <span className="text-red-400 font-semibold">{machine.warrantyInfo.days} hari</span>
                            </td>
                            <td className="p-2 text-right">
                              <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400">Critical</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Machine Types Insight Modal */}
      {showMachineTypesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="bg-slate-900 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>⚙️</span> Insight Detail Tipe Mesin
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Analisis lengkap distribusi {allMachineTypes.length} tipe mesin
                </p>
              </div>
              <button
                onClick={() => setShowMachineTypesModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Tipe Mesin</p>
                  <p className="text-2xl font-bold text-purple-400">{allMachineTypes.length}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Tipe Terpopuler</p>
                  <p className="text-lg font-bold text-purple-400 truncate" title={allMachineTypes[0]?.[0]}>{allMachineTypes[0]?.[0] || 'N/A'}</p>
                  <p className="text-xs text-slate-500 mt-1">{allMachineTypes[0]?.[1] || 0} unit</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
                  <p className="text-slate-400 text-xs mb-1">Dominasi Terbesar</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {filteredMachines.length > 0 ? ((allMachineTypes[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{allMachineTypes[0]?.[0] || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Mesin</p>
                  <p className="text-2xl font-bold text-purple-400">{filteredMachines.length}</p>
                </div>
              </div>

              {/* Distribution Chart */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Distribusi Tipe Mesin (Top 10)</h3>
                <div style={{ minWidth: '100px', position: 'relative', width: '100%', display: 'block' }}>
                  <ResponsiveContainer width="100%" height={300} minHeight={300} minWidth={100}>
                    <BarChart data={machineTypesChartData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#cbd5e1', fontSize: 10 }} 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #a855f7', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Table - All Types */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>📊</span> Detail Semua Tipe Mesin
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400">#</th>
                        <th className="text-left p-3 text-slate-400">Tipe Mesin</th>
                        <th className="text-right p-3 text-slate-400">Jumlah</th>
                        <th className="text-right p-3 text-slate-400">Persentase</th>
                        <th className="text-right p-3 text-slate-400">On Warranty</th>
                        <th className="text-right p-3 text-slate-400">Out Warranty</th>
                        <th className="text-center p-3 text-slate-400">Warranty %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMachineTypes.map(([type, count], idx) => {
                        const percentage = filteredMachines.length > 0 ? (count / filteredMachines.length * 100) : 0;
                        
                        // Calculate warranty breakdown for this type
                        const typeWarrantyBreakdown = filteredMachines.filter(m => (m.machine_type || 'Unknown') === type).reduce((acc, m) => {
                          if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                            acc.onWarranty++;
                          } else {
                            acc.outOfWarranty++;
                          }
                          return acc;
                        }, { onWarranty: 0, outOfWarranty: 0 });
                        
                        const warrantyPercentage = count > 0 ? (typeWarrantyBreakdown.onWarranty / count * 100) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-3 text-slate-300 font-bold">
                              {idx < 3 ? (
                                <span className={`
                                  ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : 'text-orange-400'}
                                `}>
                                  #{idx + 1}
                                </span>
                              ) : (
                                <span className="text-slate-500">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-200 font-semibold">{type}</td>
                            <td className="p-3 text-right text-slate-200 font-bold">{count}</td>
                            <td className="p-3 text-right">
                              <span className="text-purple-400 font-semibold">{percentage.toFixed(1)}%</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-green-400 font-semibold">{typeWarrantyBreakdown.onWarranty}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-red-400 font-semibold">{typeWarrantyBreakdown.outOfWarranty}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex-1 max-w-[100px] h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500"
                                    style={{ width: `${warrantyPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-slate-400 w-12 text-right">{warrantyPercentage.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>💡</span> Key Insights
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      <span className="font-semibold text-white">{allMachineTypes[0]?.[0]}</span> adalah tipe mesin paling populer dengan <span className="font-semibold text-purple-400">{allMachineTypes[0]?.[1]} unit</span> ({filteredMachines.length > 0 ? ((allMachineTypes[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total)
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Terdapat <span className="font-semibold text-white">{allMachineTypes.length} tipe mesin</span> berbeda yang digunakan
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Top 3 tipe mesin ({allMachineTypes.slice(0, 3).map(([type]) => type).join(', ')}) mencakup <span className="font-semibold text-purple-400">{((allMachineTypes.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / filteredMachines.length) * 100).toFixed(1)}%</span> dari total mesin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Area Group Insight Modal */}
      {showAreaGroupModal && warrantyInsights && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="bg-slate-900 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>🗺️</span> Insight Detail Area Group
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Analisis lengkap distribusi {allAreaGroups.length} area group
                </p>
              </div>
              <button
                onClick={() => setShowAreaGroupModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Area Group</p>
                  <p className="text-2xl font-bold text-purple-400">{allAreaGroups.length}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Area Group Terpopuler</p>
                  <p className="text-lg font-bold text-purple-400 truncate" title={allAreaGroups[0]?.[0]}>{allAreaGroups[0]?.[0] || 'N/A'}</p>
                  <p className="text-xs text-slate-500 mt-1">{allAreaGroups[0]?.[1] || 0} unit</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-purple-500/30">
                  <p className="text-slate-400 text-xs mb-1">Dominasi Terbesar</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {filteredMachines.length > 0 ? ((allAreaGroups[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{allAreaGroups[0]?.[0] || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Mesin</p>
                  <p className="text-2xl font-bold text-purple-400">{filteredMachines.length}</p>
                </div>
              </div>

              {/* Distribution Chart */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Distribusi Area Group (Top 10)</h3>
                <div style={{ minWidth: '100px', position: 'relative', width: '100%', display: 'block' }}>
                  <ResponsiveContainer width="100%" height={300} minHeight={300} minWidth={100}>
                    <BarChart data={areaGroupsChartData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#cbd5e1', fontSize: 10 }} 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #a855f7', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Table - All Area Groups */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>📊</span> Detail Semua Area Group
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400">#</th>
                        <th className="text-left p-3 text-slate-400">Area Group</th>
                        <th className="text-right p-3 text-slate-400">Jumlah</th>
                        <th className="text-right p-3 text-slate-400">Persentase</th>
                        <th className="text-right p-3 text-slate-400">On Warranty</th>
                        <th className="text-right p-3 text-slate-400">Out Warranty</th>
                        <th className="text-center p-3 text-slate-400">Warranty %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAreaGroups.map(([group, count], idx) => {
                        const percentage = filteredMachines.length > 0 ? (count / filteredMachines.length * 100) : 0;
                        
                        // Calculate warranty breakdown for this group - normalize area_group for comparison
                        const groupWarrantyBreakdown = filteredMachines.filter(m => {
                          const rawGroup = m.area_group || 'Unknown';
                          let normalizedGroup = rawGroup.trim().toUpperCase();
                          normalizedGroup = normalizedGroup.replace(/\s+\d+$/, '');
                          if (normalizedGroup === 'SURABAYA KOTA') {
                            normalizedGroup = 'SURABAYA';
                          }
                          return normalizedGroup === group;
                        }).reduce((acc, m) => {
                          if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                            acc.onWarranty++;
                          } else {
                            acc.outOfWarranty++;
                          }
                          return acc;
                        }, { onWarranty: 0, outOfWarranty: 0 });
                        
                        const warrantyPercentage = count > 0 ? (groupWarrantyBreakdown.onWarranty / count * 100) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-3 text-slate-300 font-bold">
                              {idx < 3 ? (
                                <span className={`
                                  ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : 'text-orange-400'}
                                `}>
                                  #{idx + 1}
                                </span>
                              ) : (
                                <span className="text-slate-500">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-200 font-semibold">{group}</td>
                            <td className="p-3 text-right text-slate-200 font-bold">{count}</td>
                            <td className="p-3 text-right">
                              <span className="text-purple-400 font-semibold">{percentage.toFixed(1)}%</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-green-400 font-semibold">{groupWarrantyBreakdown.onWarranty}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-red-400 font-semibold">{groupWarrantyBreakdown.outOfWarranty}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex-1 max-w-[100px] h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500"
                                    style={{ width: `${warrantyPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-slate-400 w-12 text-right">{warrantyPercentage.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>💡</span> Key Insights
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      <span className="font-semibold text-white">{allAreaGroups[0]?.[0]}</span> adalah area group paling populer dengan <span className="font-semibold text-purple-400">{allAreaGroups[0]?.[1]} unit</span> ({filteredMachines.length > 0 ? ((allAreaGroups[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total)
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Terdapat <span className="font-semibold text-white">{allAreaGroups.length} area group</span> berbeda yang digunakan
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-purple-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Top 3 area group ({allAreaGroups.slice(0, 3).map(([group]) => group).join(', ')}) mencakup <span className="font-semibold text-purple-400">{((allAreaGroups.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / filteredMachines.length) * 100).toFixed(1)}%</span> dari total mesin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Customer Insight Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" style={{ zIndex: 9999 }}>
          <div className="bg-slate-900 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>👑</span> Insight Detail Customer
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Analisis lengkap distribusi {allCustomers.length} customer
                </p>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Customer</p>
                  <p className="text-2xl font-bold text-cyan-400">{allCustomers.length}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Customer Terbesar</p>
                  <p className="text-lg font-bold text-cyan-400 truncate" title={allCustomers[0]?.[0]}>{allCustomers[0]?.[0] || 'N/A'}</p>
                  <p className="text-xs text-slate-500 mt-1">{allCustomers[0]?.[1] || 0} unit</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-cyan-500/30">
                  <p className="text-slate-400 text-xs mb-1">Dominasi Terbesar</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {filteredMachines.length > 0 ? ((allCustomers[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{allCustomers[0]?.[0] || 'N/A'}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <p className="text-slate-400 text-xs mb-1">Total Mesin</p>
                  <p className="text-2xl font-bold text-cyan-400">{filteredMachines.length}</p>
                </div>
              </div>

              {/* Distribution Chart */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Distribusi Customer (Top 10)</h3>
                <div style={{ minWidth: '100px', position: 'relative', width: '100%', display: 'block' }}>
                  <ResponsiveContainer width="100%" height={300} minHeight={300} minWidth={100}>
                    <BarChart data={customersChartData}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#cbd5e1', fontSize: 10 }} 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #06b6d4', borderRadius: '8px' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Table - All Customers */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>📋</span> Detail Semua Customer
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400">#</th>
                        <th className="text-left p-3 text-slate-400">Customer</th>
                        <th className="text-right p-3 text-slate-400">Jumlah</th>
                        <th className="text-right p-3 text-slate-400">Persentase</th>
                        <th className="text-right p-3 text-slate-400">On Warranty</th>
                        <th className="text-right p-3 text-slate-400">Out Warranty</th>
                        <th className="text-center p-3 text-slate-400">Warranty %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCustomers.map(([customer, count], idx) => {
                        const percentage = filteredMachines.length > 0 ? (count / filteredMachines.length * 100) : 0;
                        
                        // Calculate warranty breakdown for this customer
                        const customerWarrantyBreakdown = filteredMachines.filter(m => (m.customer || 'Unknown') === customer).reduce((acc, m) => {
                          if (m.machine_status === 'On Warranty' || m.machine_status === 'In Warranty') {
                            acc.onWarranty++;
                          } else {
                            acc.outOfWarranty++;
                          }
                          return acc;
                        }, { onWarranty: 0, outOfWarranty: 0 });
                        
                        const warrantyPercentage = count > 0 ? (customerWarrantyBreakdown.onWarranty / count * 100) : 0;
                        
                        return (
                          <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="p-3 text-slate-300 font-bold">
                              {idx < 3 ? (
                                <span className={`
                                  ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-400' : 'text-orange-400'}
                                `}>
                                  #{idx + 1}
                                </span>
                              ) : (
                                <span className="text-slate-500">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-200 font-semibold">{customer}</td>
                            <td className="p-3 text-right text-slate-200 font-bold">{count}</td>
                            <td className="p-3 text-right">
                              <span className="text-cyan-400 font-semibold">{percentage.toFixed(1)}%</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-green-400 font-semibold">{customerWarrantyBreakdown.onWarranty}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-red-400 font-semibold">{customerWarrantyBreakdown.outOfWarranty}</span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="flex-1 max-w-[100px] h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-500"
                                    style={{ width: `${warrantyPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-slate-400 w-12 text-right">{warrantyPercentage.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Insights */}
              <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <span>💡</span> Key Insights
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold">•</span>
                    <p className="text-slate-300">
                      <span className="font-semibold text-white">{allCustomers[0]?.[0]}</span> adalah customer terbesar dengan <span className="font-semibold text-cyan-400">{allCustomers[0]?.[1]} unit</span> ({filteredMachines.length > 0 ? ((allCustomers[0]?.[1] || 0) / filteredMachines.length * 100).toFixed(1) : 0}% dari total)
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Terdapat <span className="font-semibold text-white">{allCustomers.length} customer</span> yang menggunakan mesin
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400 font-bold">•</span>
                    <p className="text-slate-300">
                      Top 3 customer ({allCustomers.slice(0, 3).map(([customer]) => customer).join(', ')}) mencakup <span className="font-semibold text-cyan-400">{((allCustomers.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / filteredMachines.length) * 100).toFixed(1)}%</span> dari total mesin
                    </p>
                  </div>
                </div>
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
