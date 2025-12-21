/**
 * Script pour générer 50 alertes aléatoires de test pour 2025
 * Usage: node scripts/generate-test-alerts.cjs
 */

// Éléments et catégories simulés
const ELEMENTS = [
  { name: 'LAD', category: 'Intranet' },
  { name: 'SAP PE1', category: 'SAP' },
  { name: 'Messageries Outlook', category: 'Communication' },
  { name: 'Liaison intersites (WAN)', category: 'Réseau' },
  { name: 'Internet (proxy)', category: 'Réseau' },
  { name: 'AMIClic', category: 'Applications' },
  { name: 'Liaisons intrasites (LAN)', category: 'Réseau' },
  { name: 'Horizon', category: 'Intranet' },
  { name: 'GAIA', category: 'Applications' },
  { name: 'SAP Autres', category: 'SAP' },
];

const SEVERITIES = ['fatal', 'critique', 'mineur'];
const SEVERITY_WEIGHTS = [0.1, 0.3, 0.6]; // 10% fatal, 30% critique, 60% mineur

const DESCRIPTIONS = [
  'Incident réseau majeur',
  'Panne serveur',
  'Problème de connexion',
  'Maintenance imprévue',
  'Erreur applicative',
  'Surcharge système',
  'Coupure électrique',
  'Problème DNS',
  'Certificat expiré',
  'Base de données indisponible',
  'Mise à jour en cours',
  'Incident sécurité',
  'Problème VPN',
  'Saturation réseau',
  'Défaillance matérielle',
];

// Générer une date aléatoire en 2025
function randomDate2025() {
  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-12-31T23:59:59Z');
  const now = new Date();
  const maxEnd = now < end ? now : end;

  return new Date(start.getTime() + Math.random() * (maxEnd.getTime() - start.getTime()));
}

// Générer une durée aléatoire (entre 30 min et 48h)
function randomDuration() {
  const minMinutes = 30;
  const maxMinutes = 48 * 60;
  return Math.floor(minMinutes + Math.random() * (maxMinutes - minMinutes));
}

// Sélectionner une sévérité selon les poids
function randomSeverity() {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < SEVERITIES.length; i++) {
    cumulative += SEVERITY_WEIGHTS[i];
    if (r < cumulative) return SEVERITIES[i];
  }
  return SEVERITIES[SEVERITIES.length - 1];
}

// Générer un ID unique
function generateId() {
  return 'alert_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Générer les 50 alertes
function generateAlerts() {
  const alerts = [];

  for (let i = 0; i < 50; i++) {
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    const startDate = randomDate2025();
    const durationMinutes = randomDuration();
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const severity = randomSeverity();
    const isResponsible = Math.random() > 0.3; // 70% responsable, 30% non responsable

    alerts.push({
      id: generateId(),
      domainId: '', // Sera rempli plus tard
      severity: severity,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      targetDomainName: 'Production',
      targetCategoryName: element.category,
      targetElementName: element.name,
      responsible: isResponsible,
      description: DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)] + ` (#${i + 1})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Trier par date de début
  alerts.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return alerts;
}

// Afficher les alertes générées
const alerts = generateAlerts();

console.log('=== 50 Alertes générées pour 2025 ===\n');

console.log('--- Résumé ---');
const fatalCount = alerts.filter(a => a.severity === 'fatal').length;
const critiqueCount = alerts.filter(a => a.severity === 'critique').length;
const mineurCount = alerts.filter(a => a.severity === 'mineur').length;
const responsibleCount = alerts.filter(a => a.responsible).length;

console.log(`Fatal: ${fatalCount}`);
console.log(`Critique: ${critiqueCount}`);
console.log(`Mineur: ${mineurCount}`);
console.log(`Responsable (Oui): ${responsibleCount}`);
console.log(`Non responsable (Non): ${alerts.length - responsibleCount}`);
console.log('');

// Écrire dans un fichier
const fs = require('fs');
const outputPath = './test-alerts-2025.json';
fs.writeFileSync(outputPath, JSON.stringify(alerts, null, 2));
console.log(`Alertes sauvegardées dans: ${outputPath}`);
console.log('\nPour les importer, copiez le contenu du fichier JSON et collez-le dans la console de votre navigateur avec:');
console.log('');
console.log('// Dans la console du navigateur sur le site:');
console.log('const alerts = [/* contenu du JSON */];');
console.log('const store = window.__ZUSTAND_STORE__;');
console.log('// Puis ajoutez chaque alerte avec store.getState().addIncident(domainId, alert);');



