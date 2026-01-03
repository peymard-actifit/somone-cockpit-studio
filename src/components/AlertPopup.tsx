import type { Alert, SubElement } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../types';
import { MuiIcon } from './IconPicker';

interface AlertPopupProps {
  alert: Alert;
  subElement: SubElement;
  breadcrumb: {
    domain: string;
    category: string;
    element: string;
    subCategory: string;
  };
  onClose: () => void;
}

export default function AlertPopup({ alert, subElement, breadcrumb, onClose }: AlertPopupProps) {
  const colors = STATUS_COLORS[subElement.status] || STATUS_COLORS.ok;
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec statut - Style PDF SOMONE mode clair */}
        <div 
          className="px-6 py-5 flex items-center justify-between"
          style={{ backgroundColor: colors.hex }}
        >
          <div className="flex items-center gap-4">
            <MuiIcon name="Warning" size={32} className="text-white" />
            <div>
              <h3 className="text-xl font-bold text-white">
                {STATUS_LABELS[subElement.status]}
              </h3>
              <p className="text-white/80 text-sm">{subElement.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <MuiIcon name="X" size={24} />
          </button>
        </div>
        
        {/* Contenu */}
        <div className="p-6">
          {/* Breadcrumb complet - Style PDF SOMONE mode clair */}
          <div className="mb-6 p-4 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0]">
            <p className="text-xs text-[#94A3B8] uppercase tracking-wider mb-2">Chemin</p>
            <div className="text-sm flex items-center flex-wrap gap-2">
              <span className="text-[#64748B]">{breadcrumb.domain}</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#64748B]">{breadcrumb.category}</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#64748B]">{breadcrumb.element}</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#64748B]">{breadcrumb.subCategory}</span>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#1E3A5F] font-semibold">{subElement.name}</span>
            </div>
          </div>
          
          {/* Tableau d'information - Style PDF SOMONE mode clair */}
          <div className="bg-[#F5F7FA] rounded-xl overflow-hidden border border-[#E2E8F0]">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-[#E2E8F0]">
                  <td className="px-5 py-4 text-[#64748B] text-sm font-medium w-40">Date</td>
                  <td className="px-5 py-4 text-[#1E3A5F] font-mono">{formatDate(alert.date)}</td>
                </tr>
                <tr className="border-b border-[#E2E8F0]">
                  <td className="px-5 py-4 text-[#64748B] text-sm font-medium">Criticité</td>
                  <td className="px-5 py-4">
                    <span 
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: colors.hex }}
                    >
                      {STATUS_LABELS[subElement.status]}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-[#E2E8F0]">
                  <td className="px-5 py-4 text-[#64748B] text-sm font-medium align-top">Description</td>
                  <td className="px-5 py-4 text-[#1E3A5F]">{alert.description || 'Aucune description'}</td>
                </tr>
                {alert.duration && (
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="px-5 py-4 text-[#64748B] text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <MuiIcon name="Clock" size={16} />
                        Durée
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#1E3A5F] font-semibold">{alert.duration}</td>
                  </tr>
                )}
                {alert.ticketNumber && (
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="px-5 py-4 text-[#64748B] text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <MuiIcon name="Ticket" size={16} />
                        Ticket
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#1E3A5F] font-mono">{alert.ticketNumber}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Actions suggérées */}
          {alert.actions && (
            <div className="mt-6 p-4 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-xl">
              <p className="text-xs text-[#1E3A5F] uppercase tracking-wider mb-2 font-semibold">Actions suggérées</p>
              <p className="text-sm text-[#1E3A5F]">{alert.actions}</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F5F7FA]">
          <button className="flex items-center gap-2 px-4 py-2 text-sm text-[#1E3A5F] hover:bg-[#1E3A5F]/10 rounded-lg transition-colors">
            <MuiIcon name="ExternalLink" size={16} />
            Créer un ticket
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#1E3A5F] hover:bg-[#2C4A6E] text-white font-medium rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
