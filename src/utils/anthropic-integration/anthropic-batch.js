// src/utils/anthropic-batch.js
const fs = require('fs');
const https = require('https');
const path = require('path');

// API-Key wird erst bei Bedarf geladen
let API_KEY = null;

/**
 * Lädt den API-Key aus der angegebenen Datei
 * @param {string} apiKeyPath - Pfad zur API-Key-Datei
 * @returns {string} - Der API-Key
 * @throws {Error} - Wenn der API-Key nicht gelesen werden kann
 */
function loadApiKey(apiKeyPath) {
    if (!apiKeyPath) {
        throw new Error('Kein API-Key-Pfad angegeben');
    }
    
    try {
        return fs.readFileSync(apiKeyPath, 'utf8').trim();
    } catch (error) {
        console.error(`Fehler beim Lesen des API-Keys aus ${apiKeyPath}:`, error);
        throw new Error(`API-Key konnte nicht gelesen werden: ${error.message}`);
    }
}

/**
 * Sendet Batch-Anfragen an die Anthropic API
 * @param {Array} requests - Array von Anfragen mit customId, model, maxTokens und prompt
 * @param {string} outputPath - Pfad, wohin die Ergebnisse gespeichert werden sollen
 * @param {Object} settings - Plugin-Einstellungen (optional)
 * @returns {Promise} - Promise, das aufgelöst wird, wenn die Anfrage abgeschlossen ist
 */
function sendBatchRequests(requests, outputPath, settings = null) {
    return new Promise((resolve, reject) => {
        try {
            // Prüfen, ob die Anthropic-Integration aktiviert ist
            if (settings && !settings.enableAnthropicIntegration) {
                throw new Error('Anthropic-Integration ist deaktiviert. Bitte aktivieren Sie sie in den Einstellungen.');
            }
            
            // API-Key laden, falls noch nicht geschehen
            if (!API_KEY) {
                const apiKeyPath = settings ? settings.anthropicApiKeyPath : null;
                API_KEY = loadApiKey(apiKeyPath);
            }
            
            const batchPayload = {
                requests: requests.map(req => ({
                    custom_id: req.customId,
                    params: {
                        model: req.model || "claude-3-5-haiku-20241022",
                        max_tokens: req.maxTokens || 100,
                        messages: [
                            {role: "user", content: req.prompt}
                        ]
                    }
                }))
            };

            console.log(`Sende ${requests.length} Anfragen an die Anthropic Batch API...`);

            const req = https.request(
                {
                    hostname: 'api.anthropic.com',
                    path: '/v1/messages/batches',
                    method: 'POST',
                    headers: {
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                        "x-api-key": API_KEY,
                        "anthropic-beta": "message-batches-2024-09-24"
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        try {
                            // Prüfen, ob der Statuscode erfolgreich ist
                            if (res.statusCode >= 400) {
                                console.error(`API-Fehler: ${res.statusCode} ${res.statusMessage}`);
                                reject(new Error(`API-Fehler: ${res.statusCode} ${res.statusMessage}`));
                                return;
                            }
                            
                            // Ergebnisse in eine Datei schreiben
                            fs.writeFileSync(outputPath, data);
                            console.log(`Batch-Ergebnisse wurden in ${outputPath} gespeichert`);
                            
                            // Ergebnisse parsen und zurückgeben
                            const results = JSON.parse(data);
                            console.log('Batch-Verarbeitung abgeschlossen!');
                            resolve(results);
                        } catch (e) {
                            console.error('Fehler beim Verarbeiten der Ergebnisse:', e);
                            reject(e);
                        }
                    });
                }
            );

            req.on('error', (error) => {
                console.error('Fehler bei der API-Anfrage:', error);
                reject(error);
            });

            req.write(JSON.stringify(batchPayload));
            req.end();
        } catch (error) {
            console.error('Fehler bei der Batch-Verarbeitung:', error);
            reject(error);
        }
    });
}

// Exportiere nur die benötigte Funktion
module.exports = {
    sendBatchRequests
};
