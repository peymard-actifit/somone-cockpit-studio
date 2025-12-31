import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MuiIcon } from '../components/IconPicker';
import { VERSION_DISPLAY } from '../config/version';

interface PublishedCockpit {
  id: string;
  name: string;
  publicId: string;
  publishedAt: string;
  domainsCount: number;
}

interface UserPublicData {
  userName: string;
  cockpits: PublishedCockpit[];
}

export default function PublicUserCockpitsPage() {
  const { userId } = useParams();
  const [data, setData] = useState<UserPublicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserCockpits = async () => {
      try {
        const response = await fetch(`/api/public/user/${userId}/cockpits`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Utilisateur non trouvé ou aucun cockpit publié.');
          } else {
            setError('Erreur lors du chargement des cockpits.');
          }
          setIsLoading(false);
          return;
        }

        const result = await response.json();
        setData(result);
        setIsLoading(false);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Erreur de connexion au serveur.');
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserCockpits();
    }
  }, [userId]);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Erreur copie:', err);
    }
  };

  const getFullUrl = (publicId: string) => {
    return `${window.location.origin}/public/${publicId}`;
  };

  const getPageUrl = () => {
    return window.location.href;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin">
          <MuiIcon name="Refresh" size={32} className="text-slate-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <MuiIcon name="Error" size={48} className="text-red-400 mb-2" />
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header compact */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <MuiIcon name="Dashboard" size={18} className="text-white" />
            </div>
            <span className="font-semibold text-sm">SOMONE Cockpit Studio</span>
          </div>
          <span className="text-[10px] text-slate-500">{VERSION_DISPLAY}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* User info - compact */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <MuiIcon name="Person" size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{data?.userName || 'Utilisateur'}</h1>
              <p className="text-xs text-slate-400">
                {data?.cockpits.length || 0} cockpit{(data?.cockpits.length || 0) > 1 ? 's' : ''} publié{(data?.cockpits.length || 0) > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => copyToClipboard(getPageUrl())}
            className={`p-2 rounded-md transition-all ${
              copiedUrl === getPageUrl()
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={copiedUrl === getPageUrl() ? 'URL copiée !' : 'Copier l\'URL de cette page'}
          >
            <MuiIcon name={copiedUrl === getPageUrl() ? 'Check' : 'Share'} size={18} />
          </button>
        </div>

        {/* Liste des cockpits - format tableau dense */}
        {data?.cockpits.length === 0 ? (
          <div className="text-center py-8">
            <MuiIcon name="Inbox" size={40} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Aucun cockpit publié</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            {/* En-tête du tableau */}
            <div className="grid grid-cols-[1fr_80px_100px_auto] gap-2 px-3 py-2 bg-slate-700/50 text-xs font-medium text-slate-400 uppercase tracking-wide">
              <div>Nom</div>
              <div className="text-center">Domaines</div>
              <div className="text-center">Publié le</div>
              <div className="text-center w-20">Actions</div>
            </div>
            
            {/* Lignes */}
            <div className="divide-y divide-slate-700/50">
              {data?.cockpits.map((cockpit) => {
                const fullUrl = getFullUrl(cockpit.publicId);
                const isCopied = copiedUrl === fullUrl;
                
                return (
                  <div
                    key={cockpit.id}
                    className="grid grid-cols-[1fr_80px_100px_auto] gap-2 px-3 py-2 items-center hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Nom + URL */}
                    <div className="min-w-0">
                      <Link
                        to={`/public/${cockpit.publicId}`}
                        className="font-medium text-white hover:text-blue-400 transition-colors truncate block"
                      >
                        {cockpit.name}
                      </Link>
                      <div className="text-[10px] text-slate-500 font-mono truncate">
                        {fullUrl}
                      </div>
                    </div>
                    
                    {/* Domaines */}
                    <div className="text-center text-sm text-slate-400">
                      {cockpit.domainsCount}
                    </div>
                    
                    {/* Date */}
                    <div className="text-center text-xs text-slate-400">
                      {new Date(cockpit.publishedAt).toLocaleDateString('fr-FR')}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1 w-20">
                      <button
                        onClick={() => copyToClipboard(fullUrl)}
                        className={`p-1.5 rounded transition-all ${
                          isCopied
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                        title={isCopied ? 'Copié !' : 'Copier l\'URL'}
                      >
                        <MuiIcon name={isCopied ? 'Check' : 'ContentCopy'} size={14} />
                      </button>
                      <Link
                        to={`/public/${cockpit.publicId}`}
                        className="p-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded transition-all"
                        title="Ouvrir"
                      >
                        <MuiIcon name="OpenInNew" size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer compact */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-2 text-center text-[10px] text-slate-600">
          SOMONE Cockpit Studio © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
