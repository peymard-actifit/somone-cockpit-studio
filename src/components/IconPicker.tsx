import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ICONS, ICON_NAMES } from './icons';

// Préfixe pour les icônes personnalisées (images)
export const CUSTOM_ICON_PREFIX = 'custom:';

// Vérifie si c'est une icône personnalisée (image)
export function isCustomIcon(name: string | undefined): boolean {
  return !!name && name.startsWith(CUSTOM_ICON_PREFIX);
}

// Extrait les données de l'image personnalisée
export function getCustomIconData(name: string): string {
  return name.slice(CUSTOM_ICON_PREFIX.length);
}

// Composant SVG pour afficher une icône
interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string; // Couleur pour teinter l'image personnalisée
}

export function MuiIcon({ name, size = 24, className = '', color }: IconProps) {
  const [tintedImage, setTintedImage] = useState<string | null>(null);

  // Détecter la couleur automatiquement depuis className si non fournie
  const effectiveColor = useMemo(() => {
    if (color) return color;
    // Si className contient text-white, utiliser blanc pour les images personnalisées
    if (className.includes('text-white')) return '#FFFFFF';
    // Si className contient une couleur de texte Tailwind, on peut la mapper
    if (className.includes('text-[#1E3A5F]')) return '#1E3A5F';
    return null;
  }, [color, className]);

  // Effet pour teinter l'image personnalisée
  useEffect(() => {
    if (!isCustomIcon(name) || !effectiveColor) {
      setTintedImage(null);
      return;
    }

    const imageData = getCustomIconData(name);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dessiner l'image
      ctx.drawImage(img, 0, 0);

      // Appliquer la teinte sur les pixels non transparents (alpha > 0)
      // La transparence est PRÉSERVÉE
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageDataObj.data;

      // Convertir la couleur hex en RGB
      const hex = effectiveColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          // Pixel non transparent : appliquer la couleur unie
          // L'alpha reste INCHANGÉ pour préserver les bords doux et semi-transparences
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          // data[i + 3] = alpha; // On ne touche PAS à l'alpha
        }
        // Les pixels transparents (alpha = 0) ne sont PAS modifiés
      }

      ctx.putImageData(imageDataObj, 0, 0);
      setTintedImage(canvas.toDataURL('image/png'));
    };
    img.src = imageData;
  }, [name, effectiveColor]);

  // Si c'est une icône personnalisée (image)
  if (isCustomIcon(name)) {
    const imageData = getCustomIconData(name);
    const displaySrc = (effectiveColor && tintedImage) ? tintedImage : imageData;

    return (
      <img
        src={displaySrc}
        alt="icon"
        width={size}
        height={size}
        className={`object-contain ${className}`}
        style={{
          width: size,
          height: size,
        }}
      />
    );
  }

  if (!name) {
    // Icône par défaut si pas de nom
    const defaultPath = ICONS['Help'] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
      >
        <path d={defaultPath} />
      </svg>
    );
  }

  const path = ICONS[name];

  if (!path) {
    // Si l'icône n'existe pas, essayer de trouver une variante ou utiliser Help
    const fallbackName = name.endsWith('Icon') ? name.replace('Icon', '') : name + 'Icon';
    const fallbackPath = ICONS[fallbackName] || ICONS['Help'] || 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
        opacity="0.5"
      >
        <path d={fallbackPath} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

interface IconPickerProps {
  value: string | undefined;
  onChange: (iconName: string | undefined) => void;
  onClose: () => void;
}

export default function IconPicker({ value, onChange, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [directName, setDirectName] = useState('');
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [showCustomUpload, setShowCustomUpload] = useState(false);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);
  const [previewColor, setPreviewColor] = useState('#1E3A5F');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredIcons = useMemo(() => {
    if (!search) return ICON_NAMES;
    const searchLower = search.toLowerCase();
    return ICON_NAMES.filter(name => name.toLowerCase().includes(searchLower));
  }, [search]);

  // Vérifier si un nom d'icône est valide
  const isValidIconName = (name: string) => {
    return ICONS[name] !== undefined;
  };

  // Gérer la sélection directe par nom
  const handleDirectNameSelect = () => {
    const trimmedName = directName.trim();
    if (trimmedName && isValidIconName(trimmedName)) {
      onChange(trimmedName);
      setDirectName('');
      setShowDirectInput(false);
      onClose();
    } else if (trimmedName) {
      // Si le nom n'est pas valide, essayer de trouver une correspondance proche
      const closeMatch = ICON_NAMES.find(name =>
        name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (closeMatch) {
        onChange(closeMatch);
        setDirectName('');
        setShowDirectInput(false);
        onClose();
      }
    }
  };

  // Couleurs disponibles pour teinter les icônes personnalisées
  const availableColors = [
    { name: 'Bleu marine', color: '#1E3A5F' },
    { name: 'Vert', color: '#9CCC65' },
    { name: 'Orange', color: '#FFB74D' },
    { name: 'Rouge', color: '#E57373' },
    { name: 'Violet', color: '#8B5CF6' },
    { name: 'Bleu', color: '#3B82F6' },
    { name: 'Gris', color: '#64748B' },
    { name: 'Noir', color: '#1E293B' },
  ];

  // Gérer l'upload d'image personnalisée
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image (PNG, JPG, etc.)');
      return;
    }

    // Vérifier la taille (max 500KB pour les icônes)
    if (file.size > 500 * 1024) {
      alert('L\'image est trop grande. Taille max: 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCustomImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  // Valider l'image personnalisée
  const handleCustomImageSelect = () => {
    if (customImagePreview) {
      onChange(CUSTOM_ICON_PREFIX + customImagePreview);
      setCustomImagePreview(null);
      setShowCustomUpload(false);
      onClose();
    }
  };

  // Catégories d'icônes populaires
  const categories = [
    { name: 'Alertes', icons: ['Warning', 'Error', 'Info', 'CheckCircle', 'Cancel', 'Report'] },
    { name: 'Transport', icons: ['Flight', 'DirectionsCar', 'Train', 'DirectionsBoat', 'LocalShipping'] },
    { name: 'Technique', icons: ['Build', 'Engineering', 'Bolt', 'Speed', 'Thermostat', 'BatteryFull'] },
    { name: 'Réseau', icons: ['Wifi', 'Cloud', 'Router', 'Storage', 'Computer', 'Smartphone'] },
    { name: 'Sécurité', icons: ['Security', 'Shield', 'Lock', 'Key', 'Visibility', 'Fingerprint'] },
  ];

  // Utiliser un portail pour éviter les problèmes de z-index avec les parents
  // Utiliser un portail pour rendre le modal directement dans document.body
  // Cela garantit qu'il sera toujours au-dessus de tout le reste
  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      style={{
        zIndex: 99999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <div
        className="bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Choisir une icône</h3>
            <p className="text-xs text-slate-500">{ICON_NAMES.length} icônes Material Design</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <MuiIcon name="X" size={20} />
          </button>
        </div>

        {/* Recherche */}
        <div className="px-5 py-3 border-b border-slate-700 space-y-3">
          {/* Mode recherche dans la liste */}
          {!showDirectInput && !showCustomUpload && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <MuiIcon name="Search" size={20} />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une icône..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          )}

          {/* Input pour saisie directe par nom */}
          {showDirectInput && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <MuiIcon name="Edit" size={20} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={directName}
                  onChange={(e) => setDirectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDirectNameSelect();
                    }
                  }}
                  placeholder="Saisir le nom exact de l'icône (ex: Home, Settings, Person)..."
                  className="flex-1 pl-11 pr-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleDirectNameSelect}
                  disabled={!directName.trim() || !isValidIconName(directName.trim())}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <MuiIcon name="Check" size={18} />
                  Valider
                </button>
              </div>
              {directName.trim() && !isValidIconName(directName.trim()) && (
                <p className="mt-2 text-xs text-amber-400 flex items-center gap-1.5">
                  <MuiIcon name="Warning" size={14} />
                  Icône "{directName.trim()}" non trouvée. Utilisez la recherche pour trouver le nom correct.
                </p>
              )}
              {directName.trim() && isValidIconName(directName.trim()) && (
                <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400 flex items-center gap-2">
                    <MuiIcon name="CheckCircle" size={14} />
                    Icône "{directName.trim()}" trouvée. Appuyez sur Entrée ou cliquez sur Valider.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                      <MuiIcon name={directName.trim()} size={20} />
                    </div>
                    <span className="text-white text-sm font-medium">{directName.trim()}</span>
                  </div>
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">
                💡 Astuce: Tapez le nom exact de l'icône Material UI (ex: "Home", "Settings", "Person", etc.)
              </p>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center gap-2 flex-wrap">
            {!showCustomUpload && (
              <button
                onClick={() => {
                  setShowDirectInput(!showDirectInput);
                  setSearch('');
                  setDirectName('');
                  setShowCustomUpload(false);
                }}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-1.5"
                title={showDirectInput ? "Retour à la recherche" : "Saisir directement le nom de l'icône"}
              >
                <MuiIcon name={showDirectInput ? "Search" : "Edit"} size={14} />
                {showDirectInput ? 'Retour à la recherche' : 'Saisir par nom'}
              </button>
            )}

            <button
              onClick={() => {
                setShowCustomUpload(!showCustomUpload);
                setShowDirectInput(false);
                setSearch('');
                setCustomImagePreview(null);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${showCustomUpload
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              title="Utiliser une image personnalisée"
            >
              <MuiIcon name={showCustomUpload ? "ArrowBack" : "Image"} size={14} />
              {showCustomUpload ? 'Retour aux icônes' : 'Image personnalisée'}
            </button>

            {value && (
              <button
                onClick={() => {
                  onChange(undefined);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Supprimer l'icône
              </button>
            )}
          </div>
        </div>

        {/* Section upload image personnalisée */}
        {showCustomUpload && (
          <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/30">
            <p className="text-sm text-white mb-3 flex items-center gap-2">
              <MuiIcon name="Image" size={18} />
              Image personnalisée (PNG détouré recommandé)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {!customImagePreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl text-slate-400 hover:text-white transition-colors flex flex-col items-center gap-2"
              >
                <MuiIcon name="CloudUpload" size={32} />
                <span className="text-sm">Cliquez pour sélectionner une image</span>
                <span className="text-xs text-slate-500">PNG, JPG • Max 500KB</span>
              </button>
            ) : (
              <div className="space-y-4">
                {/* Aperçu avec couleurs */}
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center">
                    <img
                      src={customImagePreview}
                      alt="Preview"
                      className="max-w-[80px] max-h-[80px] object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-2">Aperçu avec couleur :</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: previewColor }}
                      >
                        <MuiIcon
                          name={CUSTOM_ICON_PREFIX + customImagePreview}
                          size={28}
                          color={previewColor === '#1E293B' ? '#ffffff' : previewColor}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sélecteur de couleur */}
                <div>
                  <p className="text-xs text-slate-400 mb-2">Couleur d'aperçu (en production, la couleur dépendra du statut) :</p>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((c) => (
                      <button
                        key={c.color}
                        onClick={() => setPreviewColor(c.color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${previewColor === c.color ? 'border-white scale-110' : 'border-transparent'
                          }`}
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCustomImageSelect}
                    className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <MuiIcon name="Check" size={18} />
                    Utiliser cette image
                  </button>
                  <button
                    onClick={() => {
                      setCustomImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Changer
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  💡 L'image sera automatiquement teintée selon le statut de l'élément (vert, orange, rouge, etc.)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Icône sélectionnée */}
        {value && (ICONS[value] || isCustomIcon(value)) && (
          <div className="px-5 py-3 border-b border-slate-700 bg-slate-800/50">
            <p className="text-xs text-slate-500 mb-2">Icône actuelle</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <MuiIcon name={value} size={28} />
              </div>
              <span className="text-white font-medium">
                {isCustomIcon(value) ? 'Image personnalisée' : value}
              </span>
            </div>
          </div>
        )}

        {/* Catégories populaires (si pas de recherche et pas de saisie directe et pas d'upload custom) */}
        {!search && !showDirectInput && !showCustomUpload && (
          <div className="px-5 py-3 border-b border-slate-700">
            <p className="text-xs text-slate-500 mb-3">Catégories populaires</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg">
                  <span className="text-xs text-slate-400">{cat.name}:</span>
                  {cat.icons.slice(0, 4).map((iconName) => (
                    <button
                      key={iconName}
                      onClick={() => {
                        onChange(iconName);
                        onClose();
                      }}
                      className="p-1.5 text-slate-300 hover:bg-slate-700 rounded transition-colors"
                      title={iconName}
                    >
                      <MuiIcon name={iconName} size={18} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grille d'icônes (masquée en mode saisie directe ou upload custom) */}
        {!showDirectInput && !showCustomUpload && (
          <div className="flex-1 overflow-y-auto p-5">
            {filteredIcons.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Aucune icône trouvée pour "{search}"
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-2">
                {filteredIcons.map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => {
                      onChange(iconName);
                      onClose();
                    }}
                    className={`
                    p-3 rounded-xl transition-all flex items-center justify-center
                    ${value === iconName
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }
                  `}
                    title={iconName}
                  >
                    <MuiIcon name={iconName} size={24} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            {filteredIcons.length} / {ICON_NAMES.length} icônes Material Design
          </p>
        </div>
      </div>
    </div>
  );

  // Rendre via un portail dans document.body pour garantir le z-index
  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
