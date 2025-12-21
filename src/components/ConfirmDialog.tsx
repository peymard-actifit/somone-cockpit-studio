import { MuiIcon } from './IconPicker';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div 
        className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 ${danger ? 'bg-red-50' : 'bg-[#1E3A5F]/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${danger ? 'bg-red-100' : 'bg-[#1E3A5F]/10'}`}>
              <MuiIcon 
                name={danger ? "AlertTriangleIcon" : "HelpCircle"} 
                size={24} 
                className={danger ? 'text-[#E57373]' : 'text-[#1E3A5F]'} 
              />
            </div>
            <h3 className="text-lg font-semibold text-[#1E3A5F]">{title}</h3>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-[#64748B]">{message}</p>
        </div>
        
        {/* Actions */}
        <div className="px-5 py-4 bg-[#F5F7FA] flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-[#64748B] hover:text-[#1E3A5F] hover:bg-white rounded-lg transition-colors border border-[#E2E8F0]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              danger 
                ? 'bg-[#E57373] hover:bg-red-500' 
                : 'bg-[#1E3A5F] hover:bg-[#2C4A6E]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
