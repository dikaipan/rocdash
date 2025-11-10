import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Plus, Edit, Trash2, Search, Grid, List, Eye, X, Save } from 'react-feather';
import { useTheme } from '../../contexts/ThemeContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useCrud } from '../../hooks/useCrud';
import CustomConfirm from '../common/CustomConfirm';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../utils/apiConfig';

const InventoryBabyParts = () => {
  const { isDark } = useTheme();
  const confirm = useConfirm();
  
  const [babyParts, setBabyParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'gallery'
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBabyPart, setSelectedBabyPart] = useState(null);
  const [editingBabyPart, setEditingBabyPart] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [formData, setFormData] = useState({
    baby_parts: '',
    qty: 0,
  });

  // Use refs for persistent state across renders
  const isMountedRef = useRef(true);
  const fetchInProgressRef = useRef(false);
  const debounceTimeoutRef = useRef(null);

  // CRUD hook
  const crud = useCrud({
    endpoint: `${API_BASE_URL}/baby-parts`,
    primaryKey: 'baby_parts',
    eventName: 'babyPartDataChanged'
  });

  // Fetch baby parts
  useEffect(() => {
    isMountedRef.current = true;
    const fetchBabyParts = async () => {
      if (fetchInProgressRef.current) {
        console.log('[InventoryBabyParts] Fetch already in progress, skipping');
        return;
      }
      fetchInProgressRef.current = true;
      try {
        if (isMountedRef.current) setLoading(true);
        const response = await fetch(`${API_BASE_URL}/baby-parts`);
        if (!isMountedRef.current) {
          fetchInProgressRef.current = false;
          return;
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[InventoryBabyParts] Expected JSON but got:', contentType, text.substring(0, 100));
          if (isMountedRef.current) {
            setBabyParts([]);
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
          console.log('[InventoryBabyParts] Received data:', data);
          console.log('[InventoryBabyParts] Data type:', typeof data, 'Is array:', Array.isArray(data));
          
          let partsData = [];
          if (Array.isArray(data)) {
            partsData = data;
          } else if (data.data && Array.isArray(data.data)) {
            partsData = data.data;
          } else if (data.rows && Array.isArray(data.rows)) {
            partsData = data.rows;
          } else {
            console.warn('[InventoryBabyParts] Unexpected data format:', data);
            partsData = [];
          }
          
          console.log('[InventoryBabyParts] Parsed partsData:', partsData);
          console.log('[InventoryBabyParts] Parts count:', partsData.length);
          if (isMountedRef.current) {
            setBabyParts(partsData);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[InventoryBabyParts] Error response:', response.status, errorData);
          if (isMountedRef.current) setBabyParts([]);
        }
      } catch (error) {
        if (!isMountedRef.current) {
          fetchInProgressRef.current = false;
          return;
        }
        console.error('[InventoryBabyParts] Error fetching baby parts:', error);
        if (isMountedRef.current) setBabyParts([]);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          fetchInProgressRef.current = false;
        }
      }
    };

    fetchBabyParts();

    // Listen for data changes
    const handleDataChange = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          fetchBabyParts();
        }
      }, 300);
    };

    window.addEventListener('babyPartDataChanged', handleDataChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('babyPartDataChanged', handleDataChange);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Filter baby parts based on search term
  const filteredBabyParts = useMemo(() => {
    if (!searchTerm.trim()) {
      return babyParts;
    }

    const search = searchTerm.toLowerCase();
    return babyParts.filter(babyPart => {
      const name = (babyPart.baby_parts || babyPart['Baby Parts'] || '').toLowerCase();
      return name.includes(search);
    });
  }, [babyParts, searchTerm]);

  // Reset form helper
  const resetForm = () => {
    setFormData({
      baby_parts: '',
      qty: 0,
    });
    setEditingBabyPart(null);
  };

  // Open modal for create/edit
  const openModal = (babyPart = null) => {
    if (babyPart) {
      setEditingBabyPart(babyPart);
      setModalMode('edit');
      setFormData({
        baby_parts: babyPart.baby_parts || babyPart['Baby Parts'] || '',
        qty: babyPart.qty || babyPart['Qty'] || 0,
      });
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

  // Compare form data with original baby part data to detect changes
  const hasChanges = (originalBabyPart, newFormData) => {
    if (!originalBabyPart) return true; // Create mode always has changes
    
    // Normalize values for comparison
    const normalize = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value;
      return String(value).trim();
    };
    
    // Get original value with fallback to alternative field names
    const getOriginalValue = (field, altFields = []) => {
      let value = originalBabyPart[field];
      if (!value || value === '') {
        for (const alt of altFields) {
          value = originalBabyPart[alt];
          if (value) break;
        }
      }
      return normalize(value || '');
    };
    
    // Get new value from form data
    const getNewValue = (field) => {
      return normalize(newFormData[field] || '');
    };
    
    // Compare baby_parts name
    const origName = getOriginalValue('baby_parts', ['Baby Parts', 'BABY PARTS']);
    const newName = getNewValue('baby_parts');
    if (origName !== newName) return true;
    
    // Compare qty (numbers)
    const origQty = parseInt(getOriginalValue('qty', ['Qty', 'quantity'])) || 0;
    const newQty = parseInt(getNewValue('qty')) || 0;
    if (origQty !== newQty) return true;
    
    return false; // No changes found
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.baby_parts.trim()) {
      toast.error('Nama Baby Parts wajib diisi');
      return;
    }
    
    try {
      if (editingBabyPart) {
        // Check if there are any changes (frontend check)
        if (!hasChanges(editingBabyPart, formData)) {
          // No changes detected, inform user and close modal
          toast('Tidak ada perubahan data', {
            duration: 2000,
            icon: 'ℹ️',
          });
          closeModal();
          return;
        }
        
        // There are changes, proceed with update
        const originalName = editingBabyPart.baby_parts || editingBabyPart['Baby Parts'] || editingBabyPart['BABY PARTS'];
        const result = await crud.update(originalName, formData);
        
        // Check if backend also detected no changes (double check)
        if (result && result.no_changes) {
          toast('Tidak ada perubahan data', {
            duration: 2000,
            icon: 'ℹ️',
          });
        } else {
          toast.success('Baby Part berhasil diperbarui');
        }
      } else {
        // Create mode - always proceed
        await crud.create(formData);
        toast.success('Baby Part berhasil ditambahkan');
      }
      closeModal();
    } catch (error) {
      console.error('Error saving baby part:', error);
      toast.error(error.message || 'Gagal menyimpan baby part');
    }
  };

  // Handle delete
  const handleDelete = (babyPart) => {
    const babyPartName = babyPart.baby_parts || babyPart['Baby Parts'] || babyPart['BABY PARTS'];
    confirm.showConfirm(
      `Apakah Anda yakin ingin menghapus "${babyPartName}"?`,
      async () => {
        try {
          await crud.remove(babyPartName);
          toast.success('Baby Part berhasil dihapus');
        } catch (error) {
          console.error('Error deleting baby part:', error);
          toast.error(error.message || 'Gagal menghapus baby part');
        }
      },
      {
        title: 'Hapus Baby Part',
        confirmText: 'Hapus',
        cancelText: 'Batal',
        type: 'danger'
      }
    );
  };

  // Get quantity status
  const getQuantityStatus = (qty) => {
    if (qty === 0) {
      return { label: 'Habis', color: 'text-red-400', bg: 'bg-red-500/20' };
    } else if (qty < 5) {
      return { label: 'Kritis', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    } else if (qty < 10) {
      return { label: 'Rendah', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    } else {
      return { label: 'Aman', color: 'text-green-400', bg: 'bg-green-500/20' };
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        <p className={`mt-4 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Memuat data baby parts...</p>
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
              Inventory Baby Parts
            </h2>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              Kelola inventori baby parts
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            Tambah Baby Part
          </button>
        </div>

        {/* Search and View Mode */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDark ? 'text-slate-300' : 'text-gray-500'}`} size={20} />
            <input
              type="text"
              placeholder="Cari baby part..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDark
                  ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('gallery')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'gallery'
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : isDark
                    ? 'bg-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid size={18} />
              <span className="hidden sm:inline">Galeri</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'table'
                  ? isDark
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-600 text-white'
                  : isDark
                    ? 'bg-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            >
              <List size={18} />
              <span className="hidden sm:inline">Tabel</span>
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className={`text-sm mt-4 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
          Menampilkan <span className="font-bold text-purple-400">{filteredBabyParts.length}</span> dari <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>{babyParts.length}</span> baby parts
        </div>
      </div>

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <>
          {filteredBabyParts.length === 0 ? (
            <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-lg p-12 text-center`}>
              <Package className={`mx-auto mb-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} size={48} />
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                Tidak ada data baby parts
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'} mb-6`}>
                {searchTerm ? 'Tidak ada baby parts yang sesuai dengan pencarian Anda' : 'Belum ada baby parts yang ditambahkan'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl mx-auto"
                >
                  <Plus size={20} />
                  Tambah Baby Part Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredBabyParts.map((babyPart, index) => {
            const babyPartName = babyPart.baby_parts || babyPart['Baby Parts'] || 'Unknown';
            const qty = babyPart.qty || babyPart['Qty'] || 0;
            const qtyStatus = getQuantityStatus(qty);

            return (
              <div
                key={index}
                className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${
                  isDark ? 'border-slate-700' : 'border-gray-200'
                } shadow-lg hover:shadow-xl transition-all overflow-hidden group p-6`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-full ${qtyStatus.bg} flex items-center justify-center mb-4`}>
                    <Package className={qtyStatus.color} size={32} />
                  </div>
                  <h3 className={`font-bold text-lg mb-2 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                    {babyPartName}
                  </h3>
                  <div className={`text-2xl font-bold mb-2 ${qtyStatus.color}`}>
                    {qty}
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${qtyStatus.bg} ${qtyStatus.color} mb-4`}>
                    {qtyStatus.label}
                  </span>
                  <div className="flex items-center gap-2 w-full mt-4 pt-4 border-t border-slate-700/50">
                    <button
                      onClick={() => {
                        setSelectedBabyPart(babyPart);
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
                      onClick={() => openModal(babyPart)}
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
                      onClick={() => handleDelete(babyPart)}
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
        </>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className={`${isDark ? 'bg-slate-800/50' : 'bg-white'} rounded-xl border ${isDark ? 'border-slate-700' : 'border-gray-200'} shadow-lg overflow-hidden`}>
          {filteredBabyParts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className={`mx-auto mb-4 ${isDark ? 'text-slate-400' : 'text-gray-400'}`} size={48} />
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>
                Tidak ada data baby parts
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-600'} mb-6`}>
                {searchTerm ? 'Tidak ada baby parts yang sesuai dengan pencarian Anda' : 'Belum ada baby parts yang ditambahkan'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl mx-auto"
                >
                  <Plus size={20} />
                  Tambah Baby Part Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDark ? 'bg-slate-700/50' : 'bg-gray-50'} border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Baby Parts
                    </th>
                    <th className={`px-6 py-3 text-center text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wider`}>
                      Quantity
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
                  {filteredBabyParts.map((babyPart, index) => {
                  const babyPartName = babyPart.baby_parts || babyPart['Baby Parts'] || 'Unknown';
                  const qty = babyPart.qty || babyPart['Qty'] || 0;
                  const qtyStatus = getQuantityStatus(qty);

                  return (
                    <tr key={index} className={`${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className={`px-6 py-4 ${isDark ? 'text-slate-100' : 'text-gray-900'} font-medium`}>
                        {babyPartName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className={`text-lg font-bold ${qtyStatus.color}`}>
                          {qty}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${qtyStatus.bg} ${qtyStatus.color}`}>
                          {qtyStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedBabyPart(babyPart);
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
                            onClick={() => openModal(babyPart)}
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
                            onClick={() => handleDelete(babyPart)}
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
          )}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedBabyPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}>
          <div
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                Detail Baby Part
              </h2>
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
              <div className="space-y-4">
                {/* Baby Part Name */}
                <div>
                  <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wide`}>
                    Baby Parts
                  </label>
                  <p className={`text-xl font-bold mt-1 ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                    {selectedBabyPart.baby_parts || selectedBabyPart['Baby Parts'] || selectedBabyPart['BABY PARTS']}
                  </p>
                </div>

                {/* Quantity */}
                <div>
                  <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-700'} uppercase tracking-wide`}>
                    Quantity
                  </label>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-3xl font-bold ${
                      getQuantityStatus(selectedBabyPart.qty || selectedBabyPart['Qty'] || 0).color
                    }`}>
                      {selectedBabyPart.qty || selectedBabyPart['Qty'] || 0}
                    </span>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      getQuantityStatus(selectedBabyPart.qty || selectedBabyPart['Qty'] || 0).bg
                    } ${
                      getQuantityStatus(selectedBabyPart.qty || selectedBabyPart['Qty'] || 0).color
                    }`}>
                      {getQuantityStatus(selectedBabyPart.qty || selectedBabyPart['Qty'] || 0).label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-700 p-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openModal(selectedBabyPart);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                  isDark
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                } shadow-lg hover:shadow-xl`}
              >
                <Edit size={20} />
                Edit Baby Part
              </button>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleDelete(selectedBabyPart);
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
      )}

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeModal}>
          <div
            className={`${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>
                {modalMode === 'create' ? 'Tambah Baby Part' : 'Edit Baby Part'}
              </h2>
              <button
                onClick={closeModal}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Baby Parts Name */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Nama Baby Parts <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.baby_parts}
                  onChange={(e) => setFormData(prev => ({ ...prev, baby_parts: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="Masukkan nama baby parts"
                  required
                />
              </div>

              {/* Quantity */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.qty}
                  onChange={(e) => setFormData(prev => ({ ...prev, qty: parseInt(e.target.value) || 0 }))}
                  className={`w-full px-4 py-3 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700/50 border-slate-600 text-slate-100 placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  placeholder="0"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                    isDark
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  <Save size={20} />
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

export default InventoryBabyParts;

