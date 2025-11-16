import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { useLocation } from 'react-router-dom';
import { useEngineerData } from "../hooks/useEngineerData.js";
import { useCrud } from "../hooks/useCrud.js";
import { useEngineerFilters } from "../hooks/useEngineerFilters.js";
import { useEngineerKPIs } from "../hooks/useEngineerKPIs.js";
import { useEngineerHandlers } from "../hooks/useEngineerHandlers.js";
import { useEngineerExport } from "../hooks/useExport.js";
import toast from 'react-hot-toast';
import { API_BASE_URL } from "../utils/apiConfig.js";
import { Search, Maximize, Minimize, Edit, Trash2, X, Upload, Download, ChevronDown, ChevronRight, ChevronLeft, Hash, Home, User, MapPin, Calendar, Settings, AlertCircle, Info, Award, Briefcase } from "react-feather";
import { parseExperience } from "../utils/textUtils.js";
import PageLayout from "../components/layout/PageLayout.jsx";
import { SearchFilter, CustomAlert, CustomConfirm } from "../components/common";
import { getKPICard, TEXT_STYLES, cn } from '../constants/styles';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import InlineLoadingSpinner from '../components/common/InlineLoadingSpinner';
// Lazy load heavy components for better code splitting
const EngineerInsightModal = lazy(() => import('../components/engineers/EngineerInsightModal.jsx'));
const EngineerTrainingDetail = lazy(() => import('../components/charts/EngineerTrainingDetail.jsx'));
import { useTheme } from '../contexts/ThemeContext';

export default function Engineers() {
  const { isDark } = useTheme();
  const location = useLocation();
  const selectedEngineer = location.state?.selectedEngineer;
  const { rows: engineers, loading } = useEngineerData();
  const { create, update, remove, bulkDelete, loading: crudLoading } = useCrud({
    endpoint: `${API_BASE_URL}/engineers`,
    primaryKey: 'id',
    eventName: 'engineerDataChanged'
  });
  
  // State declarations
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("experience"); // experience, region, vendor, area_group
  const [sortValue, setSortValue] = useState(""); // Value untuk dropdown dinamis
  const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen mode
  const [selectedEngineers, setSelectedEngineers] = useState([]); // For bulk delete
  const [uploadingCSV, setUploadingCSV] = useState(false); // CSV upload state
  const [expandedRows, setExpandedRows] = useState(new Set()); // For expandable rows
  const [visibleColumns, setVisibleColumns] = useState(new Set(['id', 'name', 'region', 'area_group', 'vendor', 'years_experience'])); // Default visible columns
  const [activeInsight, setActiveInsight] = useState(null); // 'total-engineers', 'experience', 'training' - State for insight modal
  const [currentPage, setCurrentPage] = useState(1); // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(10); // Items per page
  
  // Handle ESC key to close fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);
  
  // Get all unique fields from engineers data (filter out unnamed/empty columns)
  const allEngineerFields = useMemo(() => {
    if (!engineers || engineers.length === 0) return [];
    const fieldsSet = new Set();
    engineers.forEach(eng => {
      Object.keys(eng).forEach(key => {
        // Filter out unnamed columns, empty string keys, and columns that are all empty
        const normalizedKey = key ? key.trim().toLowerCase() : '';
        if (key && 
            key.trim() !== '' && 
            !normalizedKey.startsWith('unnamed') &&
            normalizedKey !== '') {
          // Check if this column has any non-empty values across all engineers
          const hasData = engineers.some(e => {
            const val = e[key];
            return val !== null && val !== undefined && String(val).trim() !== '';
          });
          if (hasData) {
            fieldsSet.add(key);
          }
        }
      });
    });
    return Array.from(fieldsSet).sort();
  }, [engineers]);

  // Create initial form data with all fields
  const createInitialFormData = useCallback(() => {
    const initialData = {};
    if (allEngineerFields.length > 0) {
      allEngineerFields.forEach(field => {
        initialData[field] = "";
      });
    } else {
      // Fallback: Initialize with basic required fields if allEngineerFields is empty
      initialData.id = "";
      initialData.name = "";
      initialData.region = "";
      initialData.area_group = "";
      initialData.vendor = "";
      initialData.years_experience = "";
      initialData.technical_skills_training = "";
      initialData.soft_skills_training = "";
    }
    return initialData;
  }, [allEngineerFields]);
  
  // CRUD States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" or "edit"
  const [selectedEngineerForEdit, setSelectedEngineerForEdit] = useState(null);
  const [formData, setFormData] = useState({});
  
  // Update formData when allEngineerFields changes (only on initial load)
  useEffect(() => {
    if (allEngineerFields.length > 0 && Object.keys(formData).length === 0) {
      setFormData(createInitialFormData());
    }
  }, [allEngineerFields, createInitialFormData]); // Remove formData from dependencies

  // Reset form function
  const resetForm = useCallback(() => {
    setFormData(createInitialFormData());
  }, [createInitialFormData]);
  
  // Toggle row expansion
  const toggleRow = useCallback((engineerId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(engineerId)) {
        newSet.delete(engineerId);
      } else {
        newSet.add(engineerId);
      }
      return newSet;
    });
  }, []);

  // Helper function to get field icon
  const getFieldIcon = useCallback((field) => {
    if (field.includes('id')) return <Hash size={16} className="text-blue-400" />;
    if (field.includes('name')) return <User size={16} className="text-green-400" />;
    if (field.includes('region') || field.includes('area') || field.includes('city') || field.includes('latitude') || field.includes('longitude')) return <MapPin size={16} className="text-orange-400" />;
    if (field.includes('vendor')) return <Briefcase size={16} className="text-purple-400" />;
    if (field.includes('experience') || field.includes('year')) return <Calendar size={16} className="text-cyan-400" />;
    if (field.includes('skill') || field.includes('training')) return <Award size={16} className="text-yellow-400" />;
    return <Info size={16} className={isDark ? "text-slate-400" : "text-gray-500"} />;
  }, [isDark]);

  // Helper function to get field placeholder
  const getFieldPlaceholder = useCallback((field) => {
    if (field === 'id') return 'ID Engineer (cth: ENG001)';
    if (field === 'name') return 'Nama lengkap engineer';
    if (field === 'region') return 'Region (Region 1/2/3)';
    if (field === 'area_group') return 'Area group (cth: JAKARTA 1)';
    if (field === 'vendor') return 'Nama vendor/perusahaan';
    if (field === 'years_experience') return 'Pengalaman (cth: 5 Tahun 3 Bulan atau 5)';
    if (field.includes('technical_skills')) return 'Keahlian teknis dipisahkan koma (cth: ATM Repair, CRM Maintenance)';
    if (field.includes('soft_skills')) return 'Soft skills dipisahkan koma (cth: Communication, Leadership)';
    if (field === 'latitude') return 'Koordinat latitude (cth: -6.2088)';
    if (field === 'longitude') return 'Koordinat longitude (cth: 106.8456)';
    return `Masukkan ${field.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').toLowerCase()}`;
  }, []);

  // Extract unique values for dropdown fields from engineers data
  const dropdownOptions = useMemo(() => {
    const options = {};
    if (!engineers || engineers.length === 0) return options;
    
    // Fields that should have dropdowns (repeated values)
    const dropdownFields = ['region', 'area_group', 'vendor'];
    
    dropdownFields.forEach(field => {
      const valuesSet = new Set();
      engineers.forEach(eng => {
        const value = eng[field];
        if (value !== null && value !== undefined && value !== '') {
          valuesSet.add(String(value).trim());
        }
      });
      options[field] = Array.from(valuesSet).sort();
    });
    
    return options;
  }, [engineers]);

  // Create mapping from area_group to latitude/longitude
  const areaGroupCoordinates = useMemo(() => {
    const mapping = {};
    if (!engineers || engineers.length === 0) return mapping;
    
    engineers.forEach(eng => {
      const areaGroup = eng.area_group;
      if (areaGroup && eng.latitude && eng.longitude) {
        // Use first occurrence of valid coordinates for each area_group
        if (!mapping[areaGroup]) {
          mapping[areaGroup] = {
            latitude: eng.latitude,
            longitude: eng.longitude
          };
        }
      }
    });
    
    return mapping;
  }, [engineers]);

  // Handler untuk auto-fill latitude/longitude saat area_group dipilih
  const handleAreaGroupChange = useCallback((areaGroup) => {
    const newFormData = { ...formData, area_group: areaGroup };
    
    // Auto-fill latitude dan longitude jika area_group memiliki koordinat
    if (areaGroup && areaGroupCoordinates[areaGroup]) {
      newFormData.latitude = areaGroupCoordinates[areaGroup].latitude;
      newFormData.longitude = areaGroupCoordinates[areaGroup].longitude;
    }
    
    setFormData(newFormData);
  }, [formData, areaGroupCoordinates]);

  // Handler untuk ID input dengan prefix "IDH"
  const handleIdChange = useCallback((value) => {
    // Hapus prefix "IDH" jika user mengetik manual
    let cleanValue = value.replace(/^IDH/i, '').replace(/\D/g, '');
    
    // Limit maksimal 5 digit
    if (cleanValue.length > 5) {
      cleanValue = cleanValue.substring(0, 5);
    }
    
    // Tambahkan prefix "IDH" jika ada nilai
    const finalValue = cleanValue ? `IDH${cleanValue}` : '';
    
    setFormData({ ...formData, id: finalValue });
  }, [formData]);

  // Validasi form untuk disable button
  const isFormValid = useMemo(() => {
    if (!formData) return false;
    
    // Required fields: id dan name
    const idValue = formData.id || '';
    const hasName = formData.name && formData.name.trim().length > 0;
    
    // Untuk create mode: ID harus memiliki 5 digit setelah IDH
    // Untuk edit mode: ID harus ada (tidak perlu validasi panjang)
    let hasValidId = false;
    if (modalMode === 'create') {
      const idWithoutPrefix = idValue.replace(/^IDH/i, '');
      hasValidId = idWithoutPrefix.length === 5;
    } else {
      hasValidId = idValue.trim().length > 0;
    }
    
    return hasValidId && hasName;
  }, [formData, modalMode]);

  // Helper function to check if field should be date input
  const isDateField = useCallback((field) => {
    return field.includes('date');
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
  const engineerFieldGroups = useMemo(() => {
    const groups = {
      basic: ['id', 'name', 'vendor'],
      location: ['region', 'area_group', 'latitude', 'longitude'],
      experience: ['years_experience'],
      skills: ['technical_skills_training', 'soft_skills_training'],
      other: []
    };
    
    allEngineerFields.forEach(field => {
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
  }, [allEngineerFields]);

  // Use custom hooks for business logic (after state declarations)
  const filteredEngineers = useEngineerFilters(engineers, { searchTerm, sortBy, sortValue });
  const kpis = useEngineerKPIs(filteredEngineers, engineers);
  const handlers = useEngineerHandlers({
    create,
    update,
    remove,
    bulkDelete,
    setModalMode,
    setSelectedEngineerForEdit,
    setFormData,
    setShowModal,
    setSelectedEngineers,
    resetForm
  });
  
  // Extract alert and confirm from handlers
  const { alert, confirm } = handlers;

  // Export is now handled by useEngineerExport hook
  const { handleExport, isExporting } = useEngineerExport(() => filteredEngineers);

  // Wrapper handlers for UI
  const handleEdit = (engineer) => {
    handlers.handleEdit(engineer);
  };

  const handleDelete = (engineer) => {
    handlers.handleDelete(engineer);
  };

  const handleSave = async () => {
    await handlers.handleSave(formData, modalMode);
  };

  const handleSelectAll = (e) => {
    handlers.handleSelectAll(e, filteredEngineers);
  };

  const handleSelectOne = (engineerId) => {
    handlers.handleSelectOne(engineerId, selectedEngineers);
  };

  const handleBulkDelete = async () => {
    await handlers.handleBulkDelete(selectedEngineers);
  };

  const handleUploadCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert.warning('Please upload a CSV file');
      return;
    }

    setUploadingCSV(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target', 'engineers');

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
      window.dispatchEvent(new Event('engineerDataChanged'));
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading CSV:', error);
      alert.error(`Failed to upload CSV: ${error.message}`);
    } finally {
      setUploadingCSV(false);
    }
  };

  // Reset selection and page when filters change
  useEffect(() => {
    setSelectedEngineers([]);
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortValue]);

  // Only show full-screen loading on initial load, not during background refresh
  // Don't block UI if there's a modal or confirm dialog open
  const isInitialLoad = loading && engineers.length === 0;
  const hasActiveModal = showModal || confirm.confirmState.isOpen;
  
  if (isInitialLoad && !hasActiveModal) {
    return (
      <div className={cn(
        "flex items-center justify-center h-screen",
        isDark ? "bg-slate-900" : "bg-gray-50"
      )}>
        <LoadingSkeleton type="spinner" message="Memuat data engineer..." size="lg" />
      </div>
    );
  }

  // KPIs are now calculated in useEngineerKPIs hook
  const { 
    totalEngineers, 
    totalAllEngineers, 
    percentageOfTotal, 
    avgExperience,
    minExperience,
    maxExperience,
    medianExperience,
    juniorCount,
    midLevelCount,
    seniorCount,
    completedTraining,
    onlyTechnical,
    onlySoftSkills,
    noTraining,
    trainingCompletionRate,
    regionStats,
    topVendors,
    insights
  } = kpis;


  return (
    <PageLayout
      title="Engineers Management"
    >

      {/* Training Progress Detail with KPI Cards */}
      <div className="mt-6">
        <Suspense fallback={<LoadingSkeleton type="spinner" message="Memuat detail training..." />}>
          <EngineerTrainingDetail engineers={engineers} kpis={kpis} />
        </Suspense>
      </div>

      {/* Toolbar with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 mt-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setModalMode("create");
              setFormData(createInitialFormData());
              setShowModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>+</span> Tambah Engineer
          </button>
          <button
            onClick={handleExport}
            disabled={filteredEngineers.length === 0 || isExporting}
            className={cn(
              "px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isDark ? "disabled:bg-slate-600" : "disabled:bg-gray-400"
            )}
            title={filteredEngineers.length === 0 ? "Tidak ada data untuk diekspor" : "Export data ke CSV"}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export CSV</span>
              </>
            )}
          </button>
          <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={16} />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleUploadCSV}
              disabled={uploadingCSV}
              className="hidden"
            />
          </label>
          {uploadingCSV && (
            <div className={cn(
              "flex items-center gap-2 text-sm",
              isDark ? "text-slate-400" : "text-gray-600"
            )}>
              <div className={cn(
                "w-4 h-4 border-2 border-t-transparent rounded-full animate-spin",
                isDark ? "border-slate-400" : "border-gray-400"
              )}></div>
              <span>Uploading...</span>
            </div>
          )}
        </div>
        <div className="w-full sm:w-auto">
          <SearchFilter
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Cari engineer..."
          />
        </div>
      </div>

      {/* Engineers Table - Beautiful & Scrollable */}
      <div className={cn(
        "rounded-xl border shadow-2xl overflow-hidden backdrop-blur-sm",
        isDark 
          ? "bg-gradient-to-br from-slate-800/90 via-slate-800/80 to-slate-900/90 border-slate-700/50"
          : "bg-white border-gray-200"
      )}>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full min-w-[800px]">
            <thead className={cn(
              "sticky top-0 z-20 backdrop-blur-md border-b-2 shadow-lg",
              isDark
                ? "bg-gradient-to-b from-slate-700/95 to-slate-800/95 border-slate-600/50"
                : "bg-gradient-to-b from-gray-100 to-gray-50 border-gray-300"
            )}>
              <tr>
                <th className={cn(
                  "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider sticky left-0 z-30",
                  isDark
                    ? "text-slate-200 bg-slate-700/80"
                    : "text-gray-800 bg-gray-100"
                )}>
                    <input
                      type="checkbox"
                      checked={selectedEngineers.length === filteredEngineers.length && filteredEngineers.length > 0}
                      onChange={handleSelectAll}
                      className={cn(
                        "rounded text-blue-500 focus:ring-2 focus:ring-blue-400 cursor-pointer transition-all hover:scale-110",
                        isDark
                          ? "border-slate-500 bg-slate-600"
                          : "border-gray-400 bg-white"
                      )}
                    />
                </th>
                {allEngineerFields.map((field) => {
                  if (!visibleColumns.has(field)) return null;
                  const fieldLabel = field.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ');
                  return (
                    <th
                      key={field}
                      className={cn(
                        "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors",
                        isDark
                          ? "text-slate-200 hover:bg-slate-600/50"
                          : "text-gray-800 hover:bg-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{fieldLabel}</span>
                      </div>
                    </th>
                  );
                })}
                <th className={cn(
                  "px-4 py-4 text-left text-xs font-bold uppercase tracking-wider sticky right-0 z-20 backdrop-blur-md",
                  isDark
                    ? "text-slate-200 bg-gradient-to-l from-slate-700/95 to-slate-800/95"
                    : "text-gray-800 bg-gradient-to-l from-gray-100 to-gray-50"
                )}>
                  <div className="flex items-center gap-2">
                    <span>Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={cn(
              "divide-y",
              isDark ? "divide-slate-700/50" : "divide-gray-200"
            )}>
              {(() => {
                // Pagination calculation
                const totalItems = filteredEngineers.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedEngineers = filteredEngineers.slice(startIndex, endIndex);
                
                if (paginatedEngineers.length === 0) {
                  return (
                    <tr>
                      <td colSpan={allEngineerFields.filter(f => visibleColumns.has(f)).length + 2} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center",
                            isDark ? "bg-slate-700/50" : "bg-gray-100"
                          )}>
                            <User size={32} className={isDark ? "text-slate-500" : "text-gray-400"} />
                          </div>
                          <p className={cn(
                            "font-medium",
                            isDark ? "text-slate-400" : "text-gray-600"
                          )}>
                            {searchTerm ? 'No engineers found matching your search' : 'No engineers data available'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                }
                
                return paginatedEngineers.map((engineer, idx) => (
                  <tr
                    key={engineer.id}
                    className={cn(
                      "group transition-all duration-200 border-b",
                      isDark
                        ? "hover:bg-gradient-to-r hover:from-blue-500/10 hover:via-slate-700/30 hover:to-slate-700/20 border-slate-700/30"
                        : "hover:bg-gradient-to-r hover:from-blue-50 hover:via-gray-50 hover:to-gray-50 border-gray-200"
                    )}
                  >
                    <td className={cn(
                      "px-4 py-4 whitespace-nowrap sticky left-0 z-10 transition-colors",
                      isDark
                        ? "bg-slate-800/80 group-hover:bg-slate-700/50"
                        : "bg-white group-hover:bg-gray-50"
                    )}>
                      <input
                        type="checkbox"
                        checked={selectedEngineers.includes(engineer.id)}
                        onChange={() => handleSelectOne(engineer.id)}
                        className={cn(
                          "rounded text-blue-500 focus:ring-2 focus:ring-blue-400 cursor-pointer transition-all hover:scale-110",
                          isDark
                            ? "border-slate-500 bg-slate-700"
                            : "border-gray-400 bg-white"
                        )}
                      />
                    </td>
                    {allEngineerFields.map((field) => {
                      if (!visibleColumns.has(field)) return null;
                      const value = engineer[field];
                      const displayValue = value !== null && value !== undefined ? String(value) : '-';
                      const isEmpty = !value || String(value).trim() === '';
                      
                      return (
                        <td
                          key={field}
                          className={cn(
                            "px-4 py-4 text-sm whitespace-nowrap transition-colors",
                            isEmpty
                              ? isDark ? "text-slate-500 italic" : "text-gray-400 italic"
                              : isDark ? "text-slate-200 group-hover:text-slate-100" : "text-gray-800 group-hover:text-gray-900"
                          )}
                        >
                          {displayValue.length > 50 ? (
                            <div className="flex items-center gap-2">
                              <span title={displayValue} className="truncate block max-w-xs">
                                {displayValue.substring(0, 50)}...
                              </span>
                              <span className={cn(
                                "text-xs opacity-0 group-hover:opacity-100 transition-opacity",
                                isDark ? "text-slate-500" : "text-gray-500"
                              )}>
                                {displayValue.length} chars
                              </span>
                            </div>
                          ) : (
                            <span className="block">{displayValue}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={cn(
                      "px-4 py-4 whitespace-nowrap sticky right-0 z-10 transition-all",
                      isDark
                        ? "bg-gradient-to-l from-slate-800/95 via-slate-800/90 to-slate-800/95 group-hover:from-slate-700/95 group-hover:via-slate-700/90 group-hover:to-slate-700/95"
                        : "bg-gradient-to-l from-white via-white to-white group-hover:from-gray-50 group-hover:via-gray-50 group-hover:to-gray-50"
                    )}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(engineer)}
                          className="p-2 text-blue-400 hover:text-blue-200 hover:bg-blue-500/20 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-blue-500/20"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(engineer)}
                          className="p-2 text-red-400 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-lg hover:shadow-red-500/20"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {(() => {
          const totalItems = filteredEngineers.length;
          const totalPages = Math.ceil(totalItems / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
          
          if (totalPages <= 1) return null;
          
          return (
            <div className={cn(
              "flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t-2 backdrop-blur-sm",
              isDark
                ? "border-slate-700/50 bg-gradient-to-r from-slate-800/90 via-slate-700/80 to-slate-800/90"
                : "border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50"
            )}>
              <div className={cn(
                "text-sm",
                isDark ? "text-slate-300" : "text-gray-700"
              )}>
                Showing <span className={cn("font-bold", isDark ? "text-blue-400" : "text-blue-600")}>{startIndex + 1}</span> to{' '}
                <span className={cn("font-bold", isDark ? "text-blue-400" : "text-blue-600")}>{endIndex}</span> of{' '}
                <span className={cn("font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>{totalItems}</span> engineers
              </div>
              
              <div className="flex items-center gap-2">
                {/* Items per page selector */}
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer",
                    isDark
                      ? "bg-slate-700/80 border-slate-600/50 text-slate-200 hover:bg-slate-600/80"
                      : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
                  )}
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 border",
                    isDark
                      ? "bg-slate-700/80 hover:bg-slate-600/80 border-slate-600/50"
                      : "bg-white hover:bg-gray-100 border-gray-300"
                  )}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} className={isDark ? "text-slate-200" : "text-gray-800"} />
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-w-[36px]",
                          currentPage === page
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                            : isDark
                            ? "bg-slate-700/80 text-slate-300 hover:bg-slate-600/80 hover:text-white hover:scale-105"
                            : "bg-white text-gray-700 hover:bg-gray-100 hover:scale-105 border border-gray-300"
                        )}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 border",
                    isDark
                      ? "bg-slate-700/80 hover:bg-slate-600/80 border-slate-600/50"
                      : "bg-white hover:bg-gray-100 border-gray-300"
                  )}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} className={isDark ? "text-slate-200" : "text-gray-800"} />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Column Visibility Toggle */}
      <div className={cn(
        "mt-4 p-4 rounded-lg border",
        isDark
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn(
            "text-sm font-semibold",
            isDark ? "text-slate-300" : "text-gray-800"
          )}>Visible Columns</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibleColumns(new Set(allEngineerFields))}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Show All
            </button>
            <button
              onClick={() => setVisibleColumns(new Set(['id', 'name', 'region', 'area_group', 'vendor', 'years_experience']))}
              className={cn(
                "text-xs",
                isDark ? "text-slate-400 hover:text-slate-300" : "text-gray-600 hover:text-gray-800"
              )}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allEngineerFields.map((field) => {
            const fieldLabel = field.split('_').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            return (
              <label
                key={field}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors",
                  isDark
                    ? "bg-slate-700/50 hover:bg-slate-700"
                    : "bg-gray-100 hover:bg-gray-200"
                )}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(field)}
                  onChange={(e) => {
                    const newSet = new Set(visibleColumns);
                    if (e.target.checked) {
                      newSet.add(field);
                    } else {
                      newSet.delete(field);
                    }
                    setVisibleColumns(newSet);
                  }}
                  className={cn(
                    "rounded text-blue-600 focus:ring-blue-500",
                    isDark
                      ? "border-slate-600 bg-slate-700"
                      : "border-gray-400 bg-white"
                  )}
                />
                <span className={cn(
                  "text-xs",
                  isDark ? "text-slate-300" : "text-gray-800"
                )}>{fieldLabel}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Show bulk delete when items selected */}
      {selectedEngineers.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} /> Hapus ({selectedEngineers.length})
          </button>
        </div>
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-100">
                  {modalMode === "create" ? "Tambah Engineer Baru" : "Edit Engineer"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Basic Information Section */}
                {engineerFieldGroups.basic.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                      <User className="text-green-400" size={20} />
                      <h3 className="text-lg font-semibold text-slate-200">Informasi Dasar</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {engineerFieldGroups.basic.map((field) => {
                        const fieldValue = formData[field] || "";
                        const fieldLabel = field.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        const isRequired = field === 'id' || field === 'name';
                        const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                        
                        // Special handling for ID field in create mode
                        if (field === 'id' && modalMode === 'create') {
                          return (
                            <div key={field} className="space-y-1.5">
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                                {getFieldIcon(field)}
                                <span>{fieldLabel} {isRequired && <span className="text-red-400">*</span>}</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">IDH</span>
                                <input
                                  type="text"
                                  value={fieldValue.replace(/^IDH/i, '')}
                                  onChange={(e) => handleIdChange(e.target.value)}
                                  maxLength={5}
                                  className="w-full pl-14 pr-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                                  placeholder="00000"
                                />
                              </div>
                              <p className="text-xs text-slate-400">
                                Format: IDH + 5 digit angka (contoh: IDH00001)
                                {fieldValue.replace(/^IDH/i, '').length > 0 && (
                                  <span className={`ml-2 ${fieldValue.replace(/^IDH/i, '').length === 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    ({fieldValue.replace(/^IDH/i, '').length}/5)
                                  </span>
                                )}
                              </p>
                            </div>
                          );
                        }
                        
                        return (
                          <div key={field} className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel} {isRequired && <span className="text-red-400">*</span>}</span>
                            </label>
                            {hasDropdown ? (
                              <select
                                value={fieldValue}
                                onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                                disabled={modalMode === "edit" && field === 'id'}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                <option value="">-- Pilih {fieldLabel} --</option>
                                {dropdownOptions[field].map((option, idx) => (
                                  <option key={idx} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={fieldValue}
                                onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                                disabled={modalMode === "edit" && field === 'id'}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                {engineerFieldGroups.location.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                      <MapPin className="text-orange-400" size={20} />
                      <h3 className="text-lg font-semibold text-slate-200">Informasi Lokasi</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {engineerFieldGroups.location.map((field) => {
                        const fieldValue = formData[field] || "";
                        const fieldLabel = field.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                        const isAutoFilled = (field === 'latitude' || field === 'longitude') && 
                                           formData.area_group && 
                                           areaGroupCoordinates[formData.area_group];
                        
                        return (
                          <div key={field} className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel}</span>
                              {isAutoFilled && (
                                <span className="text-xs text-green-400 font-normal">(Auto-filled)</span>
                              )}
                            </label>
                            {hasDropdown ? (
                              <select
                                value={fieldValue}
                                onChange={(e) => {
                                  if (field === 'area_group') {
                                    handleAreaGroupChange(e.target.value);
                                  } else {
                                    setFormData({...formData, [field]: e.target.value});
                                  }
                                }}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                              >
                                <option value="">-- Pilih {fieldLabel} --</option>
                                {dropdownOptions[field].map((option, idx) => (
                                  <option key={idx} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={fieldValue}
                                onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                                readOnly={isAutoFilled}
                                className={`w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all ${
                                  isAutoFilled ? 'bg-slate-600/50 cursor-not-allowed' : ''
                                }`}
                                placeholder={getFieldPlaceholder(field)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Experience Section */}
                {engineerFieldGroups.experience.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                      <Calendar className="text-cyan-400" size={20} />
                      <h3 className="text-lg font-semibold text-slate-200">Pengalaman</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {engineerFieldGroups.experience.map((field) => {
                        const fieldValue = formData[field] || "";
                        const fieldLabel = field.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        
                        return (
                          <div key={field} className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel}</span>
                            </label>
                            <input
                              type="text"
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                              placeholder={getFieldPlaceholder(field)}
                            />
                            <p className="text-xs text-slate-500">Format: "5 Tahun 3 Bulan" atau hanya "5"</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skills Section */}
                {engineerFieldGroups.skills.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                      <Award className="text-yellow-400" size={20} />
                      <h3 className="text-lg font-semibold text-slate-200">Keahlian & Training</h3>
                    </div>
                    <div className="space-y-4">
                      {engineerFieldGroups.skills.map((field) => {
                        const fieldValue = formData[field] || "";
                        const fieldLabel = field.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        
                        return (
                          <div key={field} className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel}</span>
                            </label>
                            <textarea
                              value={fieldValue}
                              onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                              className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all resize-none"
                              placeholder={getFieldPlaceholder(field)}
                              rows="3"
                            />
                            <p className="text-xs text-slate-500">Pisahkan setiap keahlian dengan koma (cth: Skill 1, Skill 2, Skill 3)</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Other Fields Section */}
                {engineerFieldGroups.other.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-700">
                      <Info className="text-slate-400" size={20} />
                      <h3 className="text-lg font-semibold text-slate-200">Informasi Lainnya</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {engineerFieldGroups.other.map((field) => {
                        const fieldValue = formData[field] || "";
                        const fieldLabel = field.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                        const isDate = isDateField(field);
                        const hasDropdown = dropdownOptions[field] && dropdownOptions[field].length > 0;
                        
                        return (
                          <div key={field} className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                              {getFieldIcon(field)}
                              <span>{fieldLabel}</span>
                            </label>
                            {isDate ? (
                              <input
                                type="date"
                                value={formatDateForInput(fieldValue)}
                                onChange={(e) => setFormData({...formData, [field]: formatDateForOutput(e.target.value)})}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                              />
                            ) : hasDropdown ? (
                              <select
                                value={fieldValue}
                                onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                              >
                                <option value="">-- Pilih {fieldLabel} --</option>
                                {dropdownOptions[field].map((option, idx) => (
                                  <option key={idx} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={fieldValue}
                                onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                                className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
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

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isFormValid}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isFormValid
                      ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {modalMode === "create" ? "Buat" : "Perbarui"}
                </button>
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

      {/* Engineer Insight Modal */}
      {activeInsight && (
        <Suspense fallback={null}>
          <EngineerInsightModal
            insightType={activeInsight}
            onClose={() => setActiveInsight(null)}
            kpis={kpis}
            insights={insights}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
