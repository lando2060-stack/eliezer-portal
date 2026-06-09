import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, FileText, TrendingUp, Receipt } from 'lucide-react';
import ReceiptReviewDialog from '@/components/ReceiptReviewDialog';

const actions = [
  { label: 'הוסף עסקה',   icon: FileText,   color: 'bg-blue-500',   path: '/admin/deals?new=1' },
  { label: 'הוסף הכנסה',  icon: TrendingUp, color: 'bg-emerald-500', path: '/admin/reports' },
  { label: 'הוסף הוצאה',  icon: Receipt,    color: 'bg-amber-500',  path: null },
];

export default function AdminFab() {
  const [open, setOpen] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action) => {
    setOpen(false);
    if (action.path) {
      navigate(action.path);
    } else {
      setShowReceiptDialog(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Speed dial actions */}
      {open && (
        <div className="fixed bottom-20 left-6 z-50 flex flex-col-reverse gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              className="flex items-center gap-3 bg-white shadow-xl rounded-2xl px-4 py-3 border border-border hover:shadow-2xl transition-all"
            >
              <div className={`p-2 rounded-xl ${action.color}`}>
                <action.icon className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium text-sm whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-white transition-transform active:scale-95 hover:shadow-xl"
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>

      {/* Receipt upload + review dialog */}
      <ReceiptReviewDialog
        open={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        isAdminView
        onSaved={() => setShowReceiptDialog(false)}
      />
    </>
  );
}
