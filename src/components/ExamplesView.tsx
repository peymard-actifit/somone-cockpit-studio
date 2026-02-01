import { useState, useEffect } from 'react';
import type { Domain } from '../types';
import { MuiIcon } from './IconPicker';
import { useCockpitStore } from '../store/cockpitStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface ExamplesViewProps {
  onClose: () => void;
}

/**
 * Vue Exemples - Sélecteur de vues exemples à afficher dans le cockpit courant
 * 
 * Permet de :
 * - Voir toutes les vues de type "examples" qui existent dans tous les cockpits accessibles
 * - Importer une vue exemples dans le cockpit en cours d'édition
 * - Voir et gérer les vues exemples déjà présentes dans le cockpit courant
 */
export default function ExamplesView({ onClose }: ExamplesViewProps) {
  const { t } = useLanguage();
  const confirmDialog = useConfirm();
  const {
    currentCockpit,
    availableExamplesViews,
    fetchAvailableExamplesViews,
    importExampleView,
    deleteDomain,
  } = useCockpitStore();

  const [isLoading, setIsLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Charger les vues exemples disponibles au montage
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchAvailableExamplesViews();
      setIsLoading(false);
    };
    load();
  }, [fetchAvailableExamplesViews]);

  // Vues exemples actuellement dans le cockpit courant
  const currentExamplesViews = (currentCockpit?.domains || []).filter(
    (d: Domain) => d.templateType === 'examples'
  );

  // Vues exemples disponibles (exclure celles qui viennent du cockpit courant ou qui sont déjà importées)
  const importedSourceIds = currentExamplesViews
    .map((d: Domain) => d.examplesSourceId)
    .filter(Boolean);
  
  const availableToImport = availableExamplesViews.filter(view => {
    // Exclure les vues du cockpit courant
    if (view.cockpitId === currentCockpit?.id) return false;
    // Exclure les vues déjà importées
    if (importedSourceIds.includes(view.id)) return false;
    return true;
  });

  // Afficher une notification
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Importer une vue exemples
  const handleImport = async (view: typeof availableExamplesViews[0]) => {
    setImporting(view.id);
    try {
      const result = await importExampleView(view.cockpitId, view.domainId);
      if (result.success) {
        showNotification('success', `Vue "${view.domainName}" importée avec succès`);
        // Rafraîchir la liste
        await fetchAvailableExamplesViews();
      } else {
        showNotification('error', `Erreur lors de l'importation`);
      }
    } catch {
      showNotification('error', `Erreur lors de l'importation`);
    } finally {
      setImporting(null);
    }
  };

  // Supprimer une vue exemples du cockpit courant
  const handleRemove = async (domain: Domain) => {
    const confirmed = await confirmDialog({
      title: t('examples.removeFromCockpit') || 'Retirer du cockpit',
      message: t('examples.removeFromCockpitConfirm')?.replace('{name}', domain.name) || 
        `Voulez-vous retirer la vue "${domain.name}" de ce cockpit ?`,
      confirmLabel: t('common.delete') || 'Supprimer',
      danger: true,
    });
    
    if (confirmed) {
      deleteDomain(domain.id);
      showNotification('success', `Vue "${domain.name}" retirée du cockpit`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-gradient-to-r from-amber-500 to-amber-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <MuiIcon name="LibraryBooks" size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {t('examples.title') || 'Vues Exemples'}
              </h2>
              <p className="text-sm text-white/80">
                {t('examples.selectDescription') || 'Sélectionnez les vues exemples à afficher dans ce cockpit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <MuiIcon name="Close" size={24} className="text-white" />
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mx-5 mt-4 px-4 py-3 rounded-lg flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <MuiIcon name={notification.type === 'success' ? 'CheckCircle' : 'Error'} size={20} />
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Vues exemples actives dans ce cockpit */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1E3A5F] mb-3">
              <MuiIcon name="Visibility" size={20} className="text-amber-500" />
              {t('examples.activeInCockpit') || 'Vues exemples actives dans ce cockpit'}
              <span className="text-sm font-normal text-[#64748B]">({currentExamplesViews.length})</span>
            </h3>
            
            {currentExamplesViews.length === 0 ? (
              <div className="bg-[#F5F7FA] rounded-xl p-6 text-center">
                <MuiIcon name="Inbox" size={40} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[#64748B]">
                  {t('examples.noActiveViews') || 'Aucune vue exemples dans ce cockpit'}
                </p>
                <p className="text-sm text-[#94A3B8] mt-1">
                  {t('examples.importHint') || 'Importez des vues depuis la liste ci-dessous'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {currentExamplesViews.map((domain: Domain) => (
                  <div
                    key={domain.id}
                    className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                        <MuiIcon name={domain.icon || 'Folder'} size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1E3A5F]">{domain.name}</p>
                        <p className="text-sm text-[#64748B]">
                          {domain.categories.length} {domain.categories.length > 1 ? 'catégories' : 'catégorie'}
                          {' • '}
                          {domain.categories.reduce((sum, cat) => sum + cat.elements.length, 0)} éléments
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(domain)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title={t('examples.removeFromCockpit') || 'Retirer du cockpit'}
                    >
                      <MuiIcon name="RemoveCircle" size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vues exemples disponibles à importer */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-[#1E3A5F] mb-3">
              <MuiIcon name="CloudDownload" size={20} className="text-blue-500" />
              {t('examples.availableToImport') || 'Vues exemples disponibles à importer'}
              <span className="text-sm font-normal text-[#64748B]">({availableToImport.length})</span>
            </h3>
            
            {isLoading ? (
              <div className="bg-[#F5F7FA] rounded-xl p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-[#64748B]">{t('common.loading') || 'Chargement...'}</p>
              </div>
            ) : availableToImport.length === 0 ? (
              <div className="bg-[#F5F7FA] rounded-xl p-6 text-center">
                <MuiIcon name="SearchOff" size={40} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[#64748B]">
                  {t('examples.noAvailableViews') || 'Aucune vue exemples disponible à importer'}
                </p>
                <p className="text-sm text-[#94A3B8] mt-1">
                  {t('examples.createHint') || 'Créez des vues de type "Exemples" dans vos cockpits pour les voir ici'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {availableToImport.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between p-4 bg-white border border-[#E2E8F0] rounded-xl hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <MuiIcon name={view.domainIcon || 'Folder'} size={20} className="text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1E3A5F]">{view.domainName}</p>
                        <p className="text-sm text-[#64748B]">
                          <span className="text-[#94A3B8]">depuis</span> {view.cockpitName}
                          {' • '}
                          {view.categoriesCount} {view.categoriesCount > 1 ? 'catégories' : 'catégorie'}
                          {' • '}
                          {view.elementsCount} éléments
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(view)}
                      disabled={importing === view.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importing === view.id ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          <span>{t('common.importing') || 'Import...'}</span>
                        </>
                      ) : (
                        <>
                          <MuiIcon name="Add" size={18} />
                          <span>{t('examples.import') || 'Importer'}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Instructions */}
          <section className="bg-blue-50 rounded-xl p-4">
            <h4 className="flex items-center gap-2 font-semibold text-blue-800 mb-2">
              <MuiIcon name="Info" size={18} />
              {t('examples.howItWorks') || 'Comment ça marche ?'}
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• {t('examples.hint1') || 'Les vues exemples sont des domaines de type "Exemples" créés dans les cockpits'}</li>
              <li>• {t('examples.hint2') || 'Importer une vue copie son contenu dans le cockpit courant'}</li>
              <li>• {t('examples.hint3') || 'Vous pouvez ensuite modifier la vue importée indépendamment de l\'originale'}</li>
              <li>• {t('examples.hint4') || 'Pour créer une nouvelle vue exemples, ajoutez un domaine et choisissez le type "Exemples"'}</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2C4A6E] transition-colors font-medium"
          >
            {t('common.close') || 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
}
