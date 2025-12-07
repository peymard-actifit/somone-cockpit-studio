const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Configuration par défaut - sera remplacée lors de la génération
let publicCockpitUrl = process.env.COCKPIT_PUBLIC_URL || 'https://somone-cockpit-studio.vercel.app/public/';
let publicId = process.argv.find(arg => arg.startsWith('--public-id='))?.split('=')[1];

// Créer la fenêtre principale
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    titleBarStyle: 'default',
  });

  // Construire l'URL complète
  let url;
  if (publicId) {
    // Si un publicId est fourni, l'utiliser
    url = `${publicCockpitUrl.replace(/\/$/, '')}/${publicId}`;
  } else if (process.env.NODE_ENV === 'development') {
    // En développement, charger depuis localhost
    url = 'http://localhost:5173/public/test';
  } else {
    // Sinon, charger depuis la production
    url = publicCockpitUrl;
  }

  console.log('Chargement de la maquette depuis:', url);
  mainWindow.loadURL(url);

  // Ouvrir les liens externes dans le navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Gérer les erreurs de chargement
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Erreur de chargement:', errorCode, errorDescription, validatedURL);
    
    // Afficher une page d'erreur personnalisée
    mainWindow.loadFile(path.join(__dirname, 'error.html'), {
      query: {
        error: errorDescription,
        url: validatedURL
      }
    });
  });
}

// Cette méthode sera appelée quand Electron aura terminé son initialisation
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // Sur macOS, il est courant de recréer une fenêtre quand l'icône du dock est cliquée
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quitter quand toutes les fenêtres sont fermées, sauf sur macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Gérer les erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
});

