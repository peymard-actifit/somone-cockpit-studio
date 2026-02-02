// SOMONE Cockpit Studio - Fonctions d'accès aux sources de données
// Refactoring: Extraction des fonctions fetch depuis api/index.ts

import * as XLSX from 'xlsx';
import { sql } from './database';

// Interface pour les étapes d'exécution
export interface ExecutionStep {
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Extrait des champs spécifiques d'un objet de données
 */
export function extractFields(data: any, fieldsSpec: string): any {
  if (!fieldsSpec) return data;
  
  const fields = fieldsSpec.split(',').map(f => f.trim());
  
  if (Array.isArray(data)) {
    return data.map(item => {
      const result: Record<string, any> = {};
      fields.forEach(field => {
        if (field.includes('.')) {
          // Champ imbriqué
          const parts = field.split('.');
          let value = item;
          for (const part of parts) {
            value = value?.[part];
          }
          result[field] = value;
        } else {
          result[field] = item[field];
        }
      });
      return result;
    });
  }
  
  const result: Record<string, any> = {};
  fields.forEach(field => {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = data;
      for (const part of parts) {
        value = value?.[part];
      }
      result[field] = value;
    } else {
      result[field] = data[field];
    }
  });
  return result;
}

/**
 * Fetch depuis une API REST
 */
export async function fetchFromAPI(url: string, connection?: string, fields?: string): Promise<any> {
  if (!url) return null;
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // Parser les headers de connexion si fournis
  if (connection) {
    try {
      const connConfig = JSON.parse(connection);
      if (connConfig.headers) {
        Object.assign(headers, connConfig.headers);
      }
      if (connConfig.apiKey) {
        headers['Authorization'] = `Bearer ${connConfig.apiKey}`;
      }
    } catch {
      // Si ce n'est pas du JSON, traiter comme une clé API
      if (connection.trim()) {
        headers['Authorization'] = `Bearer ${connection}`;
      }
    }
  }

  const response = await fetch(url, { headers, method: 'GET' });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extraire les champs spécifiques si demandé
  if (fields) {
    return extractFields(data, fields);
  }
  
  return data;
}

/**
 * Fetch depuis un fichier JSON
 */
export async function fetchFromJSON(url: string): Promise<any> {
  if (!url) return null;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`JSON fetch error: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Fetch depuis un fichier CSV
 */
export async function fetchFromCSV(url: string, _fields?: string): Promise<any> {
  if (!url) return null;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CSV fetch error: ${response.status}`);
  }
  
  const text = await response.text();
  const lines = text.split('\n').filter(l => l.trim());
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
  
  return data;
}

/**
 * Fetch depuis un fichier Excel
 */
export async function fetchFromExcel(url: string, fields?: string): Promise<any> {
  if (!url) return null;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Excel fetch error: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Prendre la première feuille ou celle spécifiée dans fields
    let sheetName = workbook.SheetNames[0];
    if (fields) {
      const sheetMatch = fields.match(/sheet:\s*([^,]+)/i);
      if (sheetMatch && workbook.SheetNames.includes(sheetMatch[1].trim())) {
        sheetName = sheetMatch[1].trim();
      }
    }
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    return data;
  } catch (error: any) {
    throw new Error(`Excel parse error: ${error.message}`);
  }
}

/**
 * Fetch depuis une base de données
 */
export async function fetchFromDatabase(_connection: string, query?: string): Promise<any> {
  // Pour les BDD, on utilise la connexion PostgreSQL configurée
  if (!sql || !query) return null;
  
  try {
    // Sécurité: on n'exécute que des SELECT
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery.startsWith('select')) {
      throw new Error('Seules les requêtes SELECT sont autorisées');
    }
    
    const result = await (sql as any).unsafe(query);
    return result;
  } catch (error: any) {
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Fetch depuis un outil de monitoring
 */
export async function fetchFromMonitoring(_type: string, url: string, connection?: string): Promise<any> {
  // Les outils de monitoring exposent généralement des APIs REST
  return await fetchFromAPI(url, connection);
}

/**
 * Récupère les données depuis une boîte email via API
 * Supporte: Microsoft Graph API, Gmail API, ou API personnalisée
 */
export async function fetchFromEmail(
  emailAddress: string | undefined, 
  connection: string | undefined, 
  fields: string | undefined,
  steps: ExecutionStep[]
): Promise<any> {
  const stepNum = steps.length;
  
  // Parser la configuration de connexion
  let config: any = {};
  if (connection) {
    try {
      config = JSON.parse(connection);
    } catch {
      // Si ce n'est pas du JSON, traiter comme un token
      config = { token: connection };
    }
  }

  const { 
    provider,
    token,
    apiUrl,
    folder = 'inbox',
    subject,
    from,
    maxResults = 10,
    extractPattern,
  } = config;

  // Déterminer le provider automatiquement si non spécifié
  const detectedProvider = provider || 
    (emailAddress?.includes('@outlook') || emailAddress?.includes('@microsoft') || emailAddress?.includes('@hotmail') ? 'microsoft' : 
     emailAddress?.includes('@gmail') ? 'gmail' : 'custom');

  try {
    let emails: any[] = [];

    // Microsoft Graph API
    if (detectedProvider === 'microsoft' && token) {
      const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
      
      const graphResponse = await fetch(graphUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!graphResponse.ok) {
        const errorData = await graphResponse.json().catch(() => ({}));
        throw new Error(`Microsoft Graph API error: ${graphResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const graphData = await graphResponse.json();
      emails = (graphData.value || []).map((msg: any) => ({
        id: msg.id,
        subject: msg.subject,
        from: msg.from?.emailAddress?.address,
        body: msg.body?.content || msg.bodyPreview,
        date: msg.receivedDateTime,
        isRead: msg.isRead,
      }));
    }
    // Gmail API
    else if (detectedProvider === 'gmail' && token) {
      let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
      if (subject) listUrl += `&q=subject:${encodeURIComponent(subject)}`;
      if (from) listUrl += `&q=from:${encodeURIComponent(from)}`;

      const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!listResponse.ok) {
        throw new Error(`Gmail API list error: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      const messageIds = (listData.messages || []).map((m: any) => m.id);

      for (const msgId of messageIds.slice(0, maxResults)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers || [];
          const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value;
          const fromHeader = headers.find((h: any) => h.name === 'From')?.value;
          const dateHeader = headers.find((h: any) => h.name === 'Date')?.value;
          
          let body = '';
          const parts = msgData.payload?.parts || [msgData.payload];
          for (const part of parts) {
            if (part?.mimeType === 'text/plain' && part?.body?.data) {
              body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
              break;
            } else if (part?.mimeType === 'text/html' && part?.body?.data) {
              body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
            }
          }

          emails.push({
            id: msgId,
            subject: subjectHeader,
            from: fromHeader,
            body: body,
            date: dateHeader,
          });
        }
      }
    }
    // API personnalisée
    else if (apiUrl && token) {
      const customResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!customResponse.ok) {
        throw new Error(`Custom email API error: ${customResponse.status}`);
      }

      const customResult = await customResponse.json();
      if (Array.isArray(customResult)) {
        emails = customResult;
      } else {
        emails = customResult.emails || customResult.messages || customResult.data || [customResult];
      }
    }
    else {
      steps[stepNum - 1].status = 'error';
      steps[stepNum - 1].message = `Email "${emailAddress}": Token d'accès requis. Configurez la connexion avec {"provider": "microsoft"|"gmail", "token": "votre_token"}`;
      return null;
    }

    // Filtrer par sujet si spécifié
    if (subject && emails.length > 0) {
      const subjectLower = subject.toLowerCase();
      emails = emails.filter((e: any) => 
        e.subject?.toLowerCase().includes(subjectLower)
      );
    }

    // Filtrer par expéditeur si spécifié
    if (from && emails.length > 0) {
      const fromLower = from.toLowerCase();
      emails = emails.filter((e: any) => 
        e.from?.toLowerCase().includes(fromLower)
      );
    }

    // Extraire les valeurs du corps des emails selon le pattern
    const pattern = extractPattern || fields;
    if (pattern && emails.length > 0) {
      const extractedValues: any[] = [];
      
      for (const email of emails) {
        const bodyText = email.body || '';
        
        try {
          const regex = new RegExp(pattern, 'gi');
          const matches = bodyText.match(regex);
          
          if (matches) {
            for (const match of matches) {
              const numMatch = match.match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                extractedValues.push({
                  emailId: email.id,
                  subject: email.subject,
                  date: email.date,
                  value: parseFloat(numMatch[1].replace(',', '.')),
                  rawMatch: match,
                });
              }
            }
          }
        } catch {
          if (bodyText.toLowerCase().includes(pattern.toLowerCase())) {
            const textPattern = new RegExp(pattern + '[\\s:=]*(\\d+(?:[.,]\\d+)?)', 'gi');
            const textMatch = bodyText.match(textPattern);
            if (textMatch) {
              const numMatch = textMatch[0].match(/(\d+(?:[.,]\d+)?)/);
              if (numMatch) {
                extractedValues.push({
                  emailId: email.id,
                  subject: email.subject,
                  date: email.date,
                  value: parseFloat(numMatch[1].replace(',', '.')),
                });
              }
            }
          }
        }
      }

      if (extractedValues.length > 0) {
        return extractedValues;
      }
    }

    return emails.map((e: any) => ({
      id: e.id,
      subject: e.subject,
      from: e.from,
      date: e.date,
      bodyPreview: e.body?.substring(0, 200),
    }));

  } catch (error: any) {
    steps[stepNum - 1].status = 'error';
    steps[stepNum - 1].message = `Erreur lecture email: ${error.message}`;
    return null;
  }
}

/**
 * Récupère les données depuis une source avec logging des étapes
 */
export async function fetchSourceData(source: any, steps: ExecutionStep[]): Promise<any> {
  const { type, location, connection, fields } = source;
  const stepNum = steps.length + 1;
  
  // Vérifier que la source est valide
  if (!source || !type) {
    steps.push({
      step: stepNum,
      action: 'validate_source',
      status: 'error',
      message: 'Source invalide ou type non défini',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  steps.push({
    step: stepNum,
    action: 'fetch_source',
    status: 'running',
    message: `Récupération de la source "${source.name || 'Sans nom'}" (${type})`,
    details: { type, location: location?.substring(0, 50) || 'Non défini' },
    timestamp: new Date().toISOString(),
  });

  try {
    let data = null;
    
    switch (type) {
      case 'api':
        if (!location) throw new Error('URL de l\'API non définie');
        data = await fetchFromAPI(location, connection, fields);
        break;
      
      case 'json':
        if (!location) throw new Error('URL du JSON non définie');
        data = await fetchFromJSON(location);
        break;
      
      case 'csv':
        if (!location) throw new Error('URL du CSV non définie');
        data = await fetchFromCSV(location, fields);
        break;
      
      case 'excel':
        steps[steps.length - 1].status = 'skipped';
        steps[steps.length - 1].message = `Excel: Utilisez un export CSV ou une API`;
        return null;
      
      case 'database':
        if (!connection) throw new Error('Connexion BDD non définie');
        data = await fetchFromDatabase(connection, fields);
        break;
      
      case 'supervision':
      case 'hypervision':
      case 'observability':
        if (!location) throw new Error('URL du service de monitoring non définie');
        data = await fetchFromMonitoring(type, location, connection);
        break;
      
      case 'email':
        data = await fetchFromEmail(location, connection, fields, steps);
        break;
      
      case 'manual':
      case 'static':
        if (source.config?.data) {
          data = source.config.data;
        } else if (fields) {
          try {
            data = JSON.parse(fields);
          } catch {
            data = null;
          }
        }
        break;
      
      case 'other':
      default:
        if (location && (location.startsWith('http://') || location.startsWith('https://'))) {
          data = await fetchFromAPI(location, connection, fields);
        } else if (fields) {
          try {
            data = JSON.parse(fields);
          } catch {
            const valueMatch = fields.match(/(?:valeur|value|total|count|nombre)[\s:=]+(\d+(?:[.,]\d+)?)/i);
            if (valueMatch) {
              data = { value: parseFloat(valueMatch[1].replace(',', '.')) };
            } else {
              const numberMatch = fields.match(/(\d+(?:[.,]\d+)?)/);
              if (numberMatch) {
                data = { value: parseFloat(numberMatch[1].replace(',', '.')) };
              } else {
                data = { rawText: fields, value: fields };
              }
            }
          }
        } else if (source.config?.data) {
          data = source.config.data;
        } else {
          steps[steps.length - 1].status = 'skipped';
          steps[steps.length - 1].message = `Type "${type}": Configurez une URL ou des données dans "Champs/règles"`;
          return null;
        }
    }
    
    const lastStep = steps[steps.length - 1];
    lastStep.status = 'success';
    lastStep.message = `Source "${source.name || 'Sans nom'}" récupérée`;
    lastStep.details = { 
      ...lastStep.details, 
      recordCount: Array.isArray(data) ? data.length : (data ? 1 : 0) 
    };
    
    return data;
    
  } catch (error: any) {
    const lastStep = steps[steps.length - 1];
    lastStep.status = 'error';
    lastStep.message = `Erreur: ${error.message}`;
    return null;
  }
}
