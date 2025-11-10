import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Plus, Edit, Trash2, Search, Grid, List, Eye, Camera, Upload, X, Save, Image } from 'react-feather';
import { useTheme } from '../../contexts/ThemeContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useCrud } from '../../hooks/useCrud';
import CustomConfirm from '../common/CustomConfirm';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../utils/apiConfig';

const InventoryTools = () => {
  const { isDark } = useTheme();
  const confirm = useConfirm();
  
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('gallery'); // 'table' or 'gallery'
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [editingTool, setEditingTool] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [formData, setFormData] = useState({
    tools_name: '',
    current_stock: 0,
    stock_new: 0,
    stock_old: 0,
    stock_detail: '',
    photo: '',
    description: '',
    uom: 'Pcs',
    remark: '',
    location: ''
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Use refs for persistent state across renders
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  // CRUD hook
  const crud = useCrud({
    endpoint: `${API_BASE_URL}/tools`,
    primaryKey: 'tools_name',
    eventName: 'toolDataChanged'
  });

  // Fetch tools
  useEffect(() => {
    isMountedRef.current = true;
    const fetchTools = async () => {
      if (fetchInProgressRef.current) {
        console.log('[InventoryTools] Fetch already in progress, skipping');
        return;
      }
      fetchInProgressRef.current = true;
      try {
        if (isMountedRef.current) setLoading(true);
        const response = await fetch(`${API_BASE_URL}/tools`);
        if (!isMountedRef.current) {
          fetchInProgressRef.current = false;
          return;
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[InventoryTools] Expected JSON but got:', contentType, text.substring(0, 100));
          if (isMountedRef.current) {
            setTools([]);
            setLoading(false);
          }
          fetchInProgressRef.current = false;
          return;
        }
        if (response.ok) {
          const data = await response.json();
          if (!isMountedRef.current) {
            fetchInProgressRef.current = false;
            return;
          }
          if (Array.isArray(data)) {
            setTools(data);
          } else if (data.data && Array.isArray(data.data)) {
            setTools(data.data);
          } else if (data.rows && Array.isArray(data.rows)) {
            setTools(data.rows);
          } else {
            console.warn('[InventoryTools] Unexpected data format:', data);
            setTools([]);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[InventoryTools] Error response:', response.status, errorData);
          if (isMountedRef.current) setTools([]);
        }
      } catch (error) {
        if (!isMountedRef.current) {
          fetchInProgressRef.current = false;
          return;
        }
        console.error('[InventoryTools] Error fetching tools:', error);
        setTools([]);
      } finally {
        if (isMountedRef.current) setLoading(false);
        fetchInProgressRef.current = false;
      }
    };

    fetchTools();
    
    let debounceTimeout = null;
    const handleDataChange = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        console.log('[InventoryTools] Data change event received, fetching...');
        fetchTools();
      }, 500);
    };
    
    window.addEventListener('toolDataChanged', handleDataChange);
    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      window.removeEventListener('toolDataChanged', handleDataChange);
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Filter tools based on search
  const filteredTools = useMemo(() => {
    let filtered = tools;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(tool => 
        (tool.tools_name || tool['Part Name'] || tool['TOOLS NAME'] || '').toLowerCase().includes(search) ||
        (tool.description || tool['Detail Specification'] || '').toLowerCase().includes(search) ||
        (tool.stock_detail || tool['Detail Specification'] || '').toLowerCase().includes(search) ||
        (tool.remark || tool['Remark'] || '').toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [tools, searchTerm]);

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    try {
      setUploadingPhoto(true);
      
      // Create preview immediately for better UX
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/upload-photo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload photo');
      }

      const result = await response.json();
      
      // Store the server path (not base64) in form data
      setFormData(prev => ({ ...prev, photo: result.path }));
      
      // Update preview to use server path
      setPhotoPreview(result.path);
      
      toast.success('Foto berhasil diunggah');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Gagal mengunggah foto');
      // Reset preview on error
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Reset form helper
  const resetForm = () => {
    setFormData({
      tools_name: '',
      current_stock: 0,
      stock_new: 0,
      stock_old: 0,
      stock_detail: '',
      photo: '',
      description: '',
      uom: 'Pcs',
      remark: '',
      location: ''
    });
    setPhotoPreview(null);
    setEditingTool(null);
  };

  // Open modal for create/edit
  const openModal = (tool = null) => {
    if (tool) {
      setEditingTool(tool);
      setModalMode('edit');
      setFormData({
        tools_name: tool.tools_name || tool['Part Name'] || tool['TOOLS NAME'] || '',
        current_stock: tool.current_stock || tool['Total'] || tool['CURRENT STOCK'] || 0,
        stock_new: tool.stock_new || tool['NEW'] || 0,
        stock_old: tool.stock_old || tool['OLD'] || 0,
        stock_detail: tool.stock_detail || tool['Detail Specification'] || '',
        photo: tool.photo || tool['Picture'] || '',
        description: tool.description || tool['Detail Specification'] || '',
        uom: tool.uom || tool['UOM'] || 'Pcs',
        remark: tool.remark || tool['Remark'] || '',
        location: tool.location || ''
      });
      setPhotoPreview(tool.photo || tool['Picture'] || null);
    } else {
      resetForm();
      setModalMode('create');
    }
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Compare form data with original tool data to detect changes
  const hasChanges = (originalTool, newFormData) => {
    if (!originalTool) return true; // Create mode always has changes
    
    // Normalize values for comparison
    const normalize = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value;
      return String(value).trim();
    };
    
    // Get original value with fallback to alternative field names
    const getOriginalValue = (field, altFields = []) => {
      let value = originalTool[field];
      if (!value || value === '') {
        for (const alt of altFields) {
          value = originalTool[alt];
          if (value) break;
        }
      }
      return normalize(value || '');
    };
    
    // Get new value from form data
    const getNewValue = (field) => {
      return normalize(newFormData[field] || '');
    };
    
    // Compare tools_name
    const origName = getOriginalValue('tools_name', ['Part Name', 'TOOLS NAME']);
    const newName = getNewValue('tools_name');
    if (origName !== newName) return true;
    
    // Compare numbers (stock values)
    const origStock = parseInt(getOriginalValue('current_stock', ['Total', 'CURRENT STOCK'])) || 0;
    const newStock = parseInt(getNewValue('current_stock')) || 0;
    if (origStock !== newStock) return true;
    
    const origNew = parseInt(getOriginalValue('stock_new', ['NEW'])) || 0;
    const newNew = parseInt(getNewValue('stock_new')) || 0;
    if (origNew !== newNew) return true;
    
    const origOld = parseInt(getOriginalValue('stock_old', ['OLD'])) || 0;
    const newOld = parseInt(getNewValue('stock_old')) || 0;
    if (origOld !== newOld) return true;
    
    // Compare stock_detail (can be from stock_detail or description or Detail Specification)
    const origDetail = getOriginalValue('stock_detail', ['Detail Specification', 'description']);
    const newDetail = getNewValue('stock_detail') || getNewValue('description');
    if (origDetail !== newDetail) return true;
    
    // Compare photo
    const origPhoto = getOriginalValue('photo', ['Picture']);
    const newPhoto = getNewValue('photo');
    if (origPhoto !== newPhoto) return true;
    
    // Compare UOM
    const origUom = getOriginalValue('uom', ['UOM']) || 'Pcs';
    const newUom = getNewValue('uom') || 'Pcs';
    if (origUom !== newUom) return true;
    
    // Compare remark
    const origRemark = getOriginalValue('remark', ['Remark']);
    const newRemark = getNewValue('remark');
    if (origRemark !== newRemark) return true;
    
    // Location is not saved to CSV, so we don't compare it
    
    return false; // No changes found
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tools_name.trim()) {
      toast.error('Nama tools wajib diisi');
      return;
    }
    
    try {
      if (editingTool) {
        // Check if there are any changes (frontend check)
        if (!hasChanges(editingTool, formData)) {
          // No changes detected, inform user and close modal
          toast('Tidak ada perubahan data', {
            duration: 2000,
            icon: 'ℹ️',
          });
          closeModal();
          return;
        }
        
        // There are changes, proceed with update
        const originalName = editingTool.tools_name || editingTool['Part Name'] || editingTool['TOOLS NAME'];
        const result = await crud.update(originalName, formData);
        
        // Check if backend also detected no changes (double check)
        if (result && result.no_changes) {
          toast('Tidak ada perubahan data', {
            duration: 2000,
            icon: 'ℹ️',
          });
        } else {
          toast.success('Tools berhasil diperbarui');
        }
      } else {
        // Create mode - always proceed
        await crud.create(formData);
        toast.success('Tools berhasil ditambahkan');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving tool:', error);
      toast.error(error.message || 'Gagal menyimpan tools');
    }
  };

  // Handle delete
  const handleDelete = (tool) => {
    const toolName = tool.tools_name || tool['Part Name'] || tool['TOOLS NAME'];
    confirm.showConfirm(
      `Apakah Anda yakin ingin menghapus "${toolName}"?`,
      async () => {
        try {
          await crud.remove(toolName);
          toast.success('Tools berhasil dihapus');
        } catch (error) {
          console.error('Error deleting tool:', error);
          toast.error(error.message || 'Gagal menghapus tools');
        }
      },
      {
        title: 'Hapus Tools',
        confirmText: 'Hapus',
        cancelText: 'Batal',
        type: 'danger'
      }
    );
  };

  // Helper function to get photo URL (supports both base64 and server path)
  const getPhotoUrl = (photo) => {
    if (!photo) return null;
    // If it's a base64 data URL, return as is
    if (photo.startsWith('data:image/')) {
      return photo;
    }
    // If it's a server path (starts with /api/), return as is
    if (photo.startsWith('/api/')) {
      return photo;
    }
    // If it's a relative path, prepend /api/ if needed
    if (photo.startsWith('uploads/')) {
      return `/api/${photo}`;
    }
    // Otherwise, assume it's a server path
    return photo;
  };

  // Get stock status
  const getStockStatus = (stock) => {
    if (stock === 0) {
      return { label: 'Habis', color: 'text-red-400', bg: 'bg-red-500/20' };
    } else if (stock < 5) {
      return { label: 'Kritis', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    } else if (stock < 10) {
      return { label: 'Rendah', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    } else {
      return { label: 'Aman', color: 'text-green-400', bg: 'bg-green-500/20' };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className={`mt-4 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Memuat data tools...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl p-6 border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-lg`}>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'} mb-2`}>
              Inventory Tools
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              Kelola inventori tools dan peralatan developer
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            Tambah Tools
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-300' : 'text-gray-500'}`} size={20} />
            <input
              type="text"
              placeholder="Cari tools, detail, remark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                isDark
                  ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
          </div>
          {/* View Mode Toggle */}
          <div className={`flex rounded-lg border ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-gray-300 bg-gray-50'} p-1`}>
            <button
              onClick={() => setViewMode('gallery')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'gallery'
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid size={18} />
              <span className="hidden sm:inline">Galeri</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'table'
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={18} />
              <span className="hidden sm:inline">Tabel</span>
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className={`text-sm mt-4 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
          Menampilkan <span className="font-bold text-purple-400">{filteredTools.length}</span> dari <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{tools.length}</span> tools
        </div>
      </div>

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool, index) => {
            const toolName = tool.tools_name || tool['Part Name'] || tool['TOOLS NAME'] || 'Unknown';
            const stock = tool.current_stock || tool['Total'] || tool['CURRENT STOCK'] || 0;
            const stockStatus = getStockStatus(stock);
            const photo = tool.photo || tool['Picture'] || null;
            const stockDetail = tool.stock_detail || tool['Detail Specification'] || '';
            const uom = tool.uom || tool['UOM'] || 'Pcs';
            const stockNew = tool.stock_new || tool['NEW'] || 0;
            const stockOld = tool.stock_old || tool['OLD'] || 0;

            return (
              <div
                key={index}
                className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${
                  isDark ? 'border-slate-700' : 'border-gray-200'
                } shadow-lg hover:shadow-xl transition-all overflow-hidden group`}
              >
                {/* Photo Section */}
                <div className="relative h-48 bg-slate-900/50 overflow-hidden cursor-pointer" onClick={() => {
                  setSelectedTool(tool);
                  setShowDetailModal(true);
                }}>
                  {getPhotoUrl(photo) ? (
                    <img
                      src={getPhotoUrl(photo)}
                      alt={toolName}
                      className="w-full h-full object-contain bg-slate-800 group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23334155" width="200" height="200"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14">No Image</text></svg>';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                      <Camera className="text-slate-400" size={48} />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full ${stockStatus.bg} ${stockStatus.color} text-xs font-bold backdrop-blur-sm border ${isDark ? 'border-slate-600' : 'border-white/20'}`}>
                    {stock} {uom}
                  </div>
                  {/* View overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye className="text-white" size={32} />
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-slate-100' : 'text-gray-900'} line-clamp-2`}>
                    {toolName}
                  </h3>

                  {/* Stock Status */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${stockStatus.color.replace('text-', 'bg-')}`}></div>
                    <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                      {stockStatus.label}
                    </span>
                  </div>

                  {/* Stock Detail Preview */}
                  {stockDetail && (
                    <div className={`text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'} line-clamp-2`}>
                      {stockDetail}
                    </div>
                  )}

                  {/* Stock Breakdown */}
                  <div className={`flex items-center gap-3 text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    {stockNew > 0 && (
                      <span>
                        <span className="font-semibold text-green-400">New:</span> {stockNew}
                      </span>
                    )}
                    {stockOld > 0 && (
                      <span>
                        <span className="font-semibold text-blue-400">Old:</span> {stockOld}
                      </span>
                    )}
                    <span className="ml-auto">
                      <span className="font-semibold">UOM:</span> {uom}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    <button
                      onClick={() => {
                        setSelectedTool(tool);
                        setShowDetailModal(true);
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isDark
                          ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-600'
                      }`}
                    >
                      <Eye size={16} />
                      Detail
                    </button>
                    <button
                      onClick={() => openModal(tool)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isDark
                          ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                      }`}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tool)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isDark
                          ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                          : 'bg-red-50 hover:bg-red-100 text-red-600'
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-lg overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDark ? 'bg-slate-700/50' : 'bg-gray-50'} border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Foto
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Nama Tools
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Stock Detail
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Stock
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Status
                  </th>
                  <th className={`px-6 py-3 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-200'}`}>
                {filteredTools.map((tool, index) => {
                  const toolName = tool.tools_name || tool['Part Name'] || tool['TOOLS NAME'] || 'Unknown';
                  const stock = tool.current_stock || tool['Total'] || tool['CURRENT STOCK'] || 0;
                  const stockStatus = getStockStatus(stock);
                  const photo = getPhotoUrl(tool.photo || tool['Picture'] || null);
                  const stockDetail = tool.stock_detail || tool['Detail Specification'] || '-';
                  const uom = tool.uom || tool['UOM'] || 'Pcs';
                  const stockNew = tool.stock_new || tool['NEW'] || 0;
                  const stockOld = tool.stock_old || tool['OLD'] || 0;

                  return (
                    <tr key={index} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all bg-slate-800"
                          onClick={() => {
                            setSelectedTool(tool);
                            setShowDetailModal(true);
                          }}
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={toolName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23334155" width="64" height="64"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="10">No Image</text></svg>';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                              <Camera className="text-slate-400" size={24} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-100' : 'text-gray-900'} font-medium`}>
                        {toolName}
                      </td>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-200' : 'text-gray-800'} text-sm max-w-xs`}>
                        <div className="line-clamp-2 mb-1">
                          {stockDetail}
                        </div>
                        {(stockNew > 0 || stockOld > 0) && (
                          <div className="text-xs mt-1">
                            {stockNew > 0 && <span className="text-green-400 font-medium">New: {stockNew}</span>}
                            {stockNew > 0 && stockOld > 0 && <span className={`mx-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>•</span>}
                            {stockOld > 0 && <span className="text-blue-400 font-medium">Old: {stockOld}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${stockStatus.color}`}>
                          {stock}
                        </div>
                        <div className={`text-xs mt-1 font-medium ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                          {uom}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedTool(tool);
                              setShowDetailModal(true);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              isDark
                                ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-600'
                            }`}
                            title="Lihat Detail"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openModal(tool)}
                            className={`p-2 rounded-lg transition-all ${
                              isDark
                                ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                            }`}
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tool)}
                            className={`p-2 rounded-lg transition-all ${
                              isDark
                                ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                                : 'bg-red-50 hover:bg-red-100 text-red-600'
                            }`}
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredTools.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
          <Package size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold mb-2">
            {searchTerm ? 'Tidak ada tools yang ditemukan' : 'Belum ada tools'}
          </p>
          <p className="text-sm">
            {searchTerm
              ? 'Coba gunakan kata kunci lain'
              : 'Klik "Tambah Tools" untuk menambahkan tools pertama'}
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
          <div
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                Detail Tools
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Photo Section */}
                <div>
                  <div className="relative h-80 rounded-xl overflow-hidden bg-slate-900/50 border border-slate-700">
                    {getPhotoUrl(selectedTool.photo || selectedTool['Picture']) ? (
                      <img
                        src={getPhotoUrl(selectedTool.photo || selectedTool['Picture'])}
                        alt={selectedTool.tools_name || selectedTool['Part Name'] || selectedTool['TOOLS NAME']}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect fill="%23334155" width="400" height="400"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="20">No Image Available</text></svg>';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                        <Image className={isDark ? 'text-slate-400' : 'text-gray-400'} size={80} />
                        <p className={`${isDark ? 'text-slate-300' : 'text-gray-600'} mt-4`}>Tidak ada foto</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Section */}
                <div className="space-y-4">
                  {/* Tool Name */}
                  <div>
                    <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wide`}>
                      Part Name
                    </label>
                    <p className={`text-xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                      {selectedTool.tools_name || selectedTool['Part Name'] || selectedTool['TOOLS NAME']}
                    </p>
                  </div>

                  {/* Stock */}
                  <div>
                    <label className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wide`}>
                      Total Stock
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-3xl font-bold ${
                        getStockStatus(selectedTool.current_stock || selectedTool['Total'] || selectedTool['CURRENT STOCK'] || 0).color
                      }`}>
                        {selectedTool.current_stock || selectedTool['Total'] || selectedTool['CURRENT STOCK'] || 0}
                      </span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        getStockStatus(selectedTool.current_stock || selectedTool['Total'] || selectedTool['CURRENT STOCK'] || 0).bg
                      } ${
                        getStockStatus(selectedTool.current_stock || selectedTool['Total'] || selectedTool['CURRENT STOCK'] || 0).color
                      }`}>
                        {getStockStatus(selectedTool.current_stock || selectedTool['Total'] || selectedTool['CURRENT STOCK'] || 0).label}
                      </span>
                      <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {(selectedTool.uom || selectedTool['UOM'] || 'Pcs')}
                      </span>
                    </div>
                    {/* Stock Breakdown */}
                    {(selectedTool.stock_new || selectedTool['NEW'] || selectedTool.stock_old || selectedTool['OLD']) && (
                      <div className="flex items-center gap-4 mt-2">
                        {(selectedTool.stock_new || selectedTool['NEW']) && (
                          <div>
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>New:</span>
                            <span className={`ml-1 font-bold text-green-400`}>
                              {selectedTool.stock_new || selectedTool['NEW'] || 0}
                            </span>
                          </div>
                        )}
                        {(selectedTool.stock_old || selectedTool['OLD']) && (
                          <div>
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Old:</span>
                            <span className={`ml-1 font-bold text-blue-400`}>
                              {selectedTool.stock_old || selectedTool['OLD'] || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Detail Specification */}
                  {(selectedTool.stock_detail || selectedTool['Detail Specification'] || selectedTool.description) && (
                    <div>
                      <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wide`}>
                        Detail Specification
                      </label>
                      <p className={`mt-1 text-base ${isDark ? 'text-slate-100' : 'text-gray-900'} whitespace-pre-line`}>
                        {selectedTool.stock_detail || selectedTool['Detail Specification'] || selectedTool.description}
                      </p>
                    </div>
                  )}

                  {/* Remark */}
                  {(selectedTool.remark || selectedTool['Remark']) && (
                    <div>
                      <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wide`}>
                        Remark
                      </label>
                      <p className={`mt-1 text-base ${isDark ? 'text-slate-100' : 'text-gray-900'} whitespace-pre-line`}>
                        {selectedTool.remark || selectedTool['Remark']}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-700">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openModal(selectedTool);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } shadow-lg hover:shadow-xl`}
                >
                  <Edit size={20} />
                  Edit Tools
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDelete(selectedTool);
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                      : 'bg-red-50 hover:bg-red-100 text-red-600'
                  }`}
                >
                  <Trash2 size={20} />
                  Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
              <h3 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                {editingTool ? 'Edit Tools' : 'Tambah Tools Baru'}
              </h3>
              <button
                onClick={closeModal}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Photo Upload Section */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Foto Tools
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-dashed border-slate-600 bg-slate-900/50">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="text-slate-500" size={32} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className={`block w-full px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                      isDark
                        ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 text-slate-300'
                        : 'bg-gray-50 border-gray-300 hover:bg-gray-100 text-gray-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Upload size={20} />
                        <span>{photoPreview ? 'Ganti Foto' : 'Unggah Foto'}</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={uploadingPhoto}
                      />
                    </label>
                    <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                      Format: JPG, PNG, GIF (Max 5MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Tools Name */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Nama Tools <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.tools_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, tools_name: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Contoh: Screw Driver #6300"
                />
              </div>

              {/* Stock - Total */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Total Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.current_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark
                        ? 'bg-slate-700/50 border-slate-600 text-slate-100'
                        : 'bg-gray-50 border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    New
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_new}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_new: parseInt(e.target.value) || 0 }))}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark
                        ? 'bg-slate-700/50 border-slate-600 text-slate-100'
                        : 'bg-gray-50 border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    Old
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_old}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_old: parseInt(e.target.value) || 0 }))}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark
                        ? 'bg-slate-700/50 border-slate-600 text-slate-100'
                        : 'bg-gray-50 border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* UOM */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Unit of Measure (UOM)
                </label>
                <select
                  value={formData.uom}
                  onChange={(e) => setFormData(prev => ({ ...prev, uom: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100'
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Kg">Kg</option>
                  <option value="Box">Box</option>
                  <option value="Set">Set</option>
                  <option value="Unit">Unit</option>
                </select>
              </div>

              {/* Detail Specification */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Detail Specification
                </label>
                <textarea
                  value={formData.stock_detail || formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock_detail: e.target.value, description: e.target.value }))}
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
                  placeholder="Detail specification tools..."
                />
              </div>

              {/* Remark */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Remark
                </label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                  rows={2}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none`}
                  placeholder="Catatan tambahan..."
                />
              </div>

              {/* Location */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Lokasi
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Contoh: Gudang A, Rak 3"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-slate-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  } shadow-lg hover:shadow-xl`}
                >
                  <Save size={20} className="inline-block mr-2" />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
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
    </div>
  );
};

export default InventoryTools;

