import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import CategoryChart from '../components/CategoryChart';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const CATEGORY_COLORS = {
  "Makanan & Minuman": "#FF6384",
  "Transportasi": "#36A2EB",
  "Belanja & Kebutuhan": "#FFCE56",
  "Kesehatan": "#4BC0C0",
  "Tagihan & Utilitas": "#9966FF",
  "Hiburan & Lifestyle": "#FF9F40",
  "Pendidikan & Pekerjaan": "#C9CBCF",
  "Lainnya": "#D3D3D3"
};

const CATEGORY_EMOJIS = {
  "Makanan & Minuman": "🍔",
  "Transportasi": "🚗",
  "Belanja & Kebutuhan": "🛍️",
  "Kesehatan": "🏥",
  "Tagihan & Utilitas": "💡",
  "Hiburan & Lifestyle": "🎮",
  "Pendidikan & Pekerjaan": "📚",
  "Lainnya": "📦"
};

export default function Dashboard() {
  const { waNumber, isLoading: authLoading } = useAuth();
  
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rekapData, setRekapData] = useState({ total: 0, byCategory: [] });
  const [expenseList, setExpenseList] = useState([]);

  // Filter State
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('');
  const [debouncedMaxAmount, setDebouncedMaxAmount] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  // Debounce effect for amounts
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMinAmount(minAmount);
      setDebouncedMaxAmount(maxAmount);
    }, 500);
    return () => clearTimeout(handler);
  }, [minAmount, maxAmount]);

  useEffect(() => {
    // Only fetch if auth is ready
    if (authLoading) return;
    fetchDashboardData();
  }, [month, year, authLoading, selectedCategories, debouncedMinAmount, debouncedMaxAmount]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Rekap
      const rekapRes = await client.get('/api/v1/expenses/rekap', {
        params: { month, year }
      });
      
      let rawRekap = [];
      let totalAmount = 0;
      
      if (rekapRes.data && rekapRes.data.data) {
        totalAmount = rekapRes.data.total || 0;
        rawRekap = rekapRes.data.data;
      } else {
        rawRekap = rekapRes.data || [];
        totalAmount = rawRekap.reduce((sum, item) => sum + (item.total || item.amount || 0), 0);
      }

      const chartData = rawRekap.map(item => {
        const catName = item.kategori || item.category || item._id || "Lainnya";
        const catValue = item.total || item.amount || 0;
        return {
          name: catName,
          value: catValue,
          color: CATEGORY_COLORS[catName] || CATEGORY_COLORS["Lainnya"]
        };
      });

      // Recalculate total if the backend doesn't return a total
      setRekapData({
        total: totalAmount || chartData.reduce((sum, item) => sum + item.value, 0),
        byCategory: chartData
      });

      // 2. Fetch Transactions (limit 20)
      const queryParams = { limit: 20, month, year };
      if (selectedCategories.length > 0) {
        queryParams.kategori = selectedCategories.join(',');
      }
      if (debouncedMinAmount) queryParams.min_jumlah = debouncedMinAmount;
      if (debouncedMaxAmount) queryParams.max_jumlah = debouncedMaxAmount;

      const listRes = await client.get('/api/v1/expenses', {
        params: queryParams
      });
      
      let expenses = [];
      if (listRes.data && Array.isArray(listRes.data.data)) {
        expenses = listRes.data.data;
      } else if (Array.isArray(listRes.data)) {
        expenses = listRes.data;
      } else if (listRes.data && Array.isArray(listRes.data.expenses)) {
        expenses = listRes.data.expenses;
      }
      
      setExpenseList(expenses);

    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dashboard. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id, name, amount) => {
    setExpenseToDelete({ id, name, amount });
    setIsDeleteModalOpen(true);
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const response = await client.get('/api/v1/expenses/export', {
        params: { month, year },
        responseType: 'blob', // Important for file download
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('link');
      link.href = url;
      
      // Extract filename from header if possible, else fallback
      const contentDisposition = response.headers['content-disposition'];
      let filename = `catatuang-${month}-${year}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ERROR]', new Date().toISOString(), err.message);
      setError('Gagal mengunduh CSV. Silakan coba lagi.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    
    setIsDeleteModalOpen(false);
    const { id, amount } = expenseToDelete;
    
    // 1. Snapshot previous state for rollback
    const previousList = [...expenseList];
    const previousRekap = { ...rekapData };
    
    // 2. Optimistic Update
    setExpenseList(prev => prev.filter(exp => (exp.id || exp._id) !== id));
    
    // (Optional but good) Optimistically update summary total as well
    setRekapData(prev => ({
      ...prev,
      total: Math.max(0, prev.total - amount)
    }));

    try {
      // 3. API Call
      await client.delete(`/api/v1/expenses/${id}`);
      setExpenseToDelete(null);
      
      // We could optionally re-fetch chart data here, but instruction says:
      // "Jangan reload halaman atau re-fetch semua data"
      // Wait for next month change to refresh everything neatly.
      
    } catch (err) {
      console.error('[ERROR]', new Date().toISOString(), err.message);
      // 4. Rollback on Error
      setExpenseList(previousList);
      setRekapData(previousRekap);
      setError('Gagal menghapus transaksi. Silakan coba lagi.');
      setTimeout(() => setError(null), 3000); // clear toast after 3s
    }
  };

  const formatCurrency = (amount) => {
    return `Rp ${Number(amount).toLocaleString('id-ID').replace(/,/g, '.')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <div className="max-w-md mx-auto min-h-screen border-x border-gray-800 bg-gray-900 pb-10">
        
        {/* Header Section */}
        <header className="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900/90 backdrop-blur z-10">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              CatatUang
            </h1>
            <p className="text-xs text-gray-400">Halo{waNumber ? `, ${waNumber}` : ''}</p>
          </div>

          {/* Month/Year Filter */}
          <div className="flex space-x-2 text-sm">
            <select 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded p-1 text-white focus:outline-none focus:border-green-500 cursor-pointer"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('id-ID', { month: 'short' })}</option>
              ))}
            </select>
            <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded p-1 text-white focus:outline-none focus:border-green-500 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 space-y-6">
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 p-3 rounded-xl justify-center text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Summary Card */}
          <section className="bg-gradient-to-br from-green-600 to-emerald-800 rounded-2xl p-5 shadow-lg shadow-green-900/20 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-[-20%] w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div>
              <h2 className="text-green-100 text-sm font-medium mb-1 relative z-10">Total Pengeluaran Bulan Ini</h2>
              {loading ? (
                <div className="h-10 bg-white/20 rounded animate-pulse w-2/3 mt-2" />
              ) : (
                <div className="text-3xl font-bold text-white tracking-tight relative z-10">
                  {formatCurrency(rekapData.total)}
                </div>
              )}
            </div>
            
            <div className="mt-4 flex justify-end relative z-10">
              <button 
                onClick={handleExportCSV}
                disabled={isExporting || loading}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white text-xs py-1.5 px-3 rounded-lg border border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengekspor...</span>
                  </>
                ) : (
                  <>
                    <span>⬇️</span>
                    <span>Export CSV</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Category Chart */}
          <section className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Sebaran Kategori</h3>
            {loading && !rekapData.byCategory.length ? (
              <div className="h-48 w-full bg-gray-800 animate-pulse rounded-xl" />
            ) : (
              <CategoryChart data={rekapData.byCategory} />
            )}
          </section>

          {/* Transaction List with Filters */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-gray-300">Transaksi Terbaru</h3>
                {(selectedCategories.length > 0 || debouncedMinAmount || debouncedMaxAmount) && (
                  <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium border border-green-500/30">
                    Filter Aktif
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-1.5 rounded-lg text-sm transition-colors ${isFilterOpen ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                ⚙️ Filter
              </button>
            </div>

            {/* Filter Panel */}
            {isFilterOpen && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4 space-y-4 shadow-lg animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-xs text-gray-400 block mb-2">Kategori</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(CATEGORY_COLORS).map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                          selectedCategories.includes(cat)
                            ? 'bg-green-600 border-green-500 text-white shadow-md shadow-green-900/20'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                        }`}
                      >
                        {CATEGORY_EMOJIS[cat]} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Min Nominal</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs text-muted">Rp</span>
                      <input 
                        type="number"
                        placeholder="0"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Max Nominal</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Rp</span>
                      <input 
                        type="number"
                        placeholder="Tak hingga"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button 
                    onClick={() => {
                      setSelectedCategories([]);
                      setMinAmount('');
                      setMaxAmount('');
                    }}
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5"
                  >
                    Reset Filter
                  </button>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {loading && !expenseList.length ? (
                // Skeletons
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl animate-pulse border border-gray-700/30">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-full" />
                      <div className="space-y-2">
                        <div className="w-24 h-4 bg-gray-700 rounded" />
                        <div className="w-16 h-3 bg-gray-700 rounded" />
                      </div>
                    </div>
                    <div className="w-20 h-5 bg-gray-700 rounded" />
                  </div>
                ))
              ) : expenseList.length > 0 ? (
                expenseList.map((exp, idx) => {
                  const id = exp.id || exp._id || idx;
                  const categoryName = exp.kategori || exp.category || "Lainnya";
                  const emoji = CATEGORY_EMOJIS[categoryName] || "📦";
                  const tgl = exp.tanggal || exp.date || exp.createdAt;
                  const nama = exp.nama || exp.name || "Pengeluaran";
                  const nom = exp.nominal || exp.amount || 0;
                  
                  return (
                    <div key={id} className="flex items-center justify-between bg-gray-800 border border-gray-700/50 p-3 rounded-xl hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl shrink-0">
                          {emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-100 truncate w-32 md:w-40" title={nama}>
                            {nama}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(tgl)} • {categoryName}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 pl-2">
                        <div className="font-semibold text-sm text-rose-400 whitespace-nowrap">
                          {formatCurrency(nom)}
                        </div>
                        <button 
                          onClick={() => handleDelete(id, nama, nom)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                          title="Hapus transaksi"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm bg-gray-800/30 rounded-xl border border-gray-800 border-dashed">
                  Belum ada transaksi di bulan ini.
                </div>
              )}
            </div>
          </section>

        </main>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        expenseName={expenseToDelete?.name}
        expenseAmount={expenseToDelete?.amount}
      />
    </div>
  );
}
