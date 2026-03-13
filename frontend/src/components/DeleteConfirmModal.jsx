import React from 'react';

export default function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  expenseName, 
  expenseAmount 
}) {
  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    return `Rp ${Number(amount).toLocaleString('id-ID').replace(/,/g, '.')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-6">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-xl font-bold text-white text-center mb-2">
            Hapus Transaksi?
          </h3>
          <p className="text-gray-400 text-center text-sm">
            Hapus <span className="text-gray-200 font-medium">{expenseName || 'Transaksi'}</span> - 
            <span className="text-rose-400 font-medium"> {expenseAmount ? formatCurrency(expenseAmount) : ''}</span>?
          </p>
          <p className="text-gray-500 text-xs text-center mt-2">
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded-xl font-medium transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-red-600/20"
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
