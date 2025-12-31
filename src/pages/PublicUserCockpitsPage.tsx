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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <MuiIcon name="Refresh" size={48} className="text-white" />
          </div>
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <MuiIcon name="Error" size={64} className="text-red-400 mb-4" />
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MuiIcon name="Dashboard" size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">SOMONE Cockpit Studio</h1>
              <p className="text-xs text-slate-400">Cockpits publiés</p>
            </div>
          </div>
          <span className="text-xs text-slate-500">{VERSION_DISPLAY}</span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* User info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <MuiIcon name="Person" size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{data?.userName || 'Utilisateur'}</h2>
                <p className="text-slate-400 text-sm">
                  {data?.cockpits.length || 0} cockpit{(data?.cockpits.length || 0) > 1 ? 's' : ''} publié{(data?.cockpits.length || 0) > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            {/* Bouton copier l'URL de cette page */}
            <button
              onClick={() => copyToClipboard(getPageUrl())}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                copiedUrl === getPageUrl()
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/50'
              }`}
            >
              <MuiIcon name={copiedUrl === getPageUrl() ? 'Check' : 'ContentCopy'} size={18} />
              {copiedUrl === getPageUrl() ? 'URL copiée !' : 'Copier l\'URL de cette page'}
            </button>
          </div>
        </div>

        {/* Liste des cockpits */}
        {data?.cockpits.length === 0 ? (
          <div className="text-center py-16">
            <MuiIcon name="Inbox" size={64} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Aucun cockpit publié pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.cockpits.map((cockpit) => {
              const fullUrl = getFullUrl(cockpit.publicId);
              return (
                <div
                  key={cockpit.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/public/${cockpit.publicId}`}
                        className="text-lg font-semibold text-white hover:text-blue-400 transition-colors block truncate"
                      >
                        {cockpit.name}
                      </Link>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <MuiIcon name="Layers" size={14} />
                          {cockpit.domainsCount} domaine{cockpit.domainsCount > 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <MuiIcon name="Schedule" size={14} />
                          Publié le {new Date(cockpit.publishedAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500 font-mono truncate">
                        {fullUrl}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => copyToClipboard(fullUrl)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                          copiedUrl === fullUrl
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                        title="Copier l'URL"
                      >
                        <MuiIcon name={copiedUrl === fullUrl ? 'Check' : 'ContentCopy'} size={18} />
                        {copiedUrl === fullUrl ? 'Copié !' : 'Copier'}
                      </button>
                      <Link
                        to={`/public/${cockpit.publicId}`}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-lg transition-all"
                      >
                        <MuiIcon name="OpenInNew" size={18} />
                        Ouvrir
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center text-sm text-slate-500">
          SOMONE Cockpit Studio © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
