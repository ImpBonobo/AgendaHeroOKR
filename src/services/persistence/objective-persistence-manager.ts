
agenda-hero-okr/
├── .gitattributes                      # Git-Konfigurationen für Dateitypen
├── .gitignore                          # Dateien und Ordner, die von Git ignoriert werden
├── esbuild.config.mjs                  # Konfiguration für den esbuild-Bundler
├── LICENSE                             # Lizenzinformationen für das Plugin
├── manifest.json                       # Plugin-Metadaten für Obsidian
├── package-lock.json                   # Exakte Abhängigkeitsversionen
├── package.json                        # NPM-Projektdateien und Abhängigkeiten
├── README.md                           # Projektdokumentation
├── styles.css                          # Hauptstildatei für das Plugin
├── tsconfig.json                       # TypeScript-Konfiguration
├── version-bump.mjs                    # Skript zum Aktualisieren der Versionsnummer
├── versions.json                       # Versionsverlauf des Plugins
├── main.js                             # Kompilierte JavaScript-Hauptdatei
└── src/                                # Quellcode-Hauptordner
    ├── main.ts                         # Hauptdatei mit Plugin-Initialisierung
    ├── types/                          # Gemeinsame Typdefinitionen
    │   └── (noch keine Dateien)
    ├── models/                         # Datenmodelle
    │   └── okr-models.ts               # Modelle für Objectives, Key Results und Beziehungen
    ├── services/                       # Serviceschicht für Geschäftslogik
    │   └── persistence/                # Für spezialisierte Persistence-Manager
    │       ├── persistence-config.ts   # Konfigurationsschnittstelle und Basisklasse für Manager
    │       ├── file-system-helper.ts   # Hilfsfunktionen für Dateisystemoperationen
    │       ├── markdown-parser.ts      # Hilfsfunktionen zum Parsen von Markdown-Inhalten
    │       ├── objective-persistence-manager.ts  # Spezialisiert auf Objectives-Persistenz
    │       ├── key-result-persistence-manager.ts # Spezialisiert auf KeyResults-Persistenz
    │       ├── project-persistence-manager.ts    # Spezialisiert auf Projects-Persistenz
    │       ├── sprint-persistence-manager.ts     # Spezialisiert auf Sprints-Persistenz
    │       └── task-persistence-manager.ts       # Spezialisiert auf Tasks-Persistenz
    │   ├── index-services.ts           # Re-export aller Services
    │   ├── okr-service.ts              # Hauptservice (reduzierte Version als Facade)
    │   ├── okr-persistence-service.ts  # Facade-Klasse, die alle Manager koordiniert
    │   ├── okr-data-manager.ts         # Verwaltung der In-Memory-Daten
    │   ├── okr-relationship-manager.ts # Verwaltung der Beziehungen zwischen Entitäten
    │   ├── okr-operations-service.ts   # CRUD-Operationen für Objectives, Key Results und Projects
    │   ├── task-operations-service.ts  # CRUD-Operationen für Tasks
    │   ├── time-block-manager.ts       # Verwaltung von Zeitblöcken
    │   └── file-watcher-service.ts     # Überwachung von Dateiänderungen
    ├── utils/                          # Hilfsklassen und -funktionen
    │   ├── anthropic-integration/      # Integration mit Anthropic API
    │   │   ├── anthropic-batch.d.ts    # TypeScript-Deklarationen
    │   │   └── anthropic-batch.js      # JavaScript-Implementierung
    │   ├── scheduler-rules.ts          # Regeln für die intelligente Aufgabenplanung
    │   └── time-manager.ts             # Split-Up und Zeitblockplanungslogik
    ├── views/                          # Benutzeroberfläche-Ansichten
    │   ├── index-views.ts              # Re-export aller Views
    │   ├── calendar-view/              # Kalenderansicht
    │   │   ├── calendar-view.ts        # Hauptdatei für die Kalenderansicht
    │   │   ├── calendar-renderer.ts    # Rendering-Logik für Kalender
    │   │   ├── calendar-event-handler.ts # Event-Handler für Kalenderinteraktionen
    │   │   ├── calendar-drag-drop-manager.ts # Drag-and-Drop-Logik für Kalender
    │   │   ├── calendar-tooltip-manager.ts # Tooltip-Verwaltung für Kalender
    │   │   └── calendar-scheduling-manager.ts # Scheduling-Logik für Kalender
    │   ├── task-list-view/             # Aufgabenlistenansicht
    │   │   ├── task-list-view.ts       # Hauptaufgabenlistenansicht
    │   │   ├── task-list-filter-manager.ts  # Filter-Logik für Aufgabenliste
    │   │   ├── task-list-preview-renderer.ts # Rendering-Logik für Aufgabenvorschau
    │   │   └── task-list-drag-drop-manager.ts # Drag-and-Drop-Logik für Aufgabenliste
    │   ├── scrum-board-view/           # Scrum-Board-Ansicht
    │   │   ├── scrum-board-view.ts     # Hauptdatei für die Scrum-Board-Ansicht
    │   │   ├── scrum-board-manager.ts  # Management-Logik für Scrum-Board
    │   │   ├── scrum-column-renderer.ts # Rendering-Logik für Spalten
    │   │   ├── scrum-task-renderer.ts  # Rendering-Logik für Tasks im Scrum-Board
    │   │   └── scrum-board-drag-drop-manager.ts # Drag-and-Drop-Logik für Scrum-Board
    │   ├── okr-hierarchy-view/         # OKR-Hierarchieansicht
    │   │   ├── okr-hierarchy-view.ts   # Hauptdatei für OKR-Hierarchieansicht
    │   │   ├── okr-hierarchy-renderer.ts # Rendering-Logik für die gesamte Hierarchie
    │   │   ├── okr-objective-renderer.ts # Rendering-Logik für Objectives
    │   │   ├── okr-key-result-renderer.ts # Rendering-Logik für Key Results
    │   │   ├── okr-project-renderer.ts  # Rendering-Logik für Projects
    │   │   ├── okr-task-renderer.ts     # Rendering-Logik für Tasks
    │   │   └── okr-hierarchy-operations.ts # CRUD-Operationen für OKR-Elemente
    │   └── test-view/                  # Testansicht
    │       └── test-view.ts            # Testansicht für Debugging
    ├── components/                     # Wiederverwendbare UI-Komponenten
    │   ├── index-components.ts         # Re-export aller Komponenten
    │   ├── base-modal.ts               # Basisklasse für Modals
    │   ├── objective-modal.ts          # Modal für Objective-Erstellung/Bearbeitung
    │   ├── key-result-modal.ts         # Modal für Key Result-Erstellung/Bearbeitung
    │   ├── project-modal.ts            # Modal für Projekt-Erstellung/Bearbeitung
    │   ├── task-modal.ts               # Modal für Task-Erstellung/Bearbeitung
    │   ├── task-list-edit-modal.ts     # Modal für Task-Bearbeitung in der Listenansicht
    │   ├── time-block-modal.ts         # Modal für Zeitblock-Aktionen
    │   └── okr-modals.ts               # Re-Export der OKR-bezogenen Modals
    └── styles/                         # CSS-Stile (noch leer)
        └── (noch keine Dateien)





        import { App, TFile } from 'obsidian';
        import { Objective } from '../../models/okr-models';
        import { BasePersistenceManager, OkrPersistenceConfig } from './persistence-config';
        import { FileSystemHelper } from './file-system-helper';
        import { MarkdownParser } from './markdown-parser';
        
        /**
         * Manager responsible for persisting Objective entities
         */
        export class ObjectivePersistenceManager extends BasePersistenceManager {
            private fileSystemHelper: FileSystemHelper;
            private markdownParser: MarkdownParser;
            
            constructor(app: App, config: OkrPersistenceConfig, fileSystemHelper: FileSystemHelper, markdownParser: MarkdownParser) {
                super(app, config);
                this.fileSystemHelper = fileSystemHelper;
                this.markdownParser = markdownParser;
            }
            
            /**
             * Save an objective to a file
             * @param objective The objective to save
             * @returns The file path where the objective was saved
             */
            async saveObjective(objective: Objective): Promise<string> {
                // Ensure folder exists
                await this.fileSystemHelper.ensureFolderExists(this.config.objectivesFolder);
                
                // Get current year
                const year = new Date().getFullYear();
                
                // Generate filename
                const filename = this.fileSystemHelper.generateFilename(
                    this.config.objectiveTemplate,
                    { 
                        id: objective.id,
                        title: this.fileSystemHelper.sanitizeFilename(objective.title),
                        year: year
                    }
                );
                
                // Build full path
                const filePath = `${this.config.objectivesFolder}/${filename}.md`;
                
                // Generate file content
                const content = this.generateObjectiveContent(objective);
                
                // Save to file
                await this.fileSystemHelper.writeFile(filePath, content, true);
                
                return filePath;
            }
            
            /**
             * Load objectives from files
             * @returns Array of loaded objectives
             */
            async loadObjectives(): Promise<Objective[]> {
                try {
                    const objectives: Objective[] = [];
                    
                    // Check if folder exists
                    if (!await this.fileSystemHelper.folderExists(this.config.objectivesFolder)) {
                        return [];
                    }
                    
                    // Get files in folder
                    const files = await this.fileSystemHelper.getFilesInFolder(this.config.objectivesFolder);
                    
                    // Process each file
                    for (const file of files) {
                        if (file.extension !== 'md') continue;
                        
                        try {
                            const content = await this.app.vault.read(file);
                            const objective = this.parseObjectiveContent(content, file.path);
                            if (objective) {
                                objective.sourceFile = file;
                                objectives.push(objective);
                            }
                        } catch (error) {
                            console.error(`Error parsing objective file ${file.path}:`, error);
                        }
                    }
                    
                    return objectives;
                } catch (error) {
                    console.error('Error loading objectives:', error);
                    return [];
                }
            }
            
            /**
             * Generate content for an objective file
             * @param objective The objective
             * @returns Markdown content
             */
            private generateObjectiveContent(objective: Objective): string {
                // Create YAML frontmatter
                let content = '---\n';
                content += `${this.config.metadataFields.id}: ${objective.id}\n`;
                content += `${this.config.metadataFields.status}: ${objective.status}\n`;
                content += `${this.config.metadataFields.priority}: ${objective.priority}\n`;
                content += `${this.config.metadataFields.progress}: ${objective.progress}\n`;
                content += `${this.config.metadataFields.startDate}: ${this.markdownParser.formatDate(objective.startDate)}\n`;
                content += `${this.config.metadataFields.endDate}: ${this.markdownParser.formatDate(objective.endDate)}\n`;
                
                // Add tags if present
                if (objective.tags && objective.tags.length > 0) {
                    content += `${this.config.metadataFields.tags}: [${objective.tags.join(', ')}]\n`;
                }
                
                // Add quarter if present
                if (objective.quarter) {
                    content += `quarter: ${objective.quarter}\n`;
                }
                
                content += '---\n\n';
                
                // Add title
                content += `# ${objective.title}\n\n`;
                
                // Add description if present
                if (objective.description) {
                    content += `${objective.description}\n\n`;
                }
                
                // Add key results section
                content += '## Key Results\n\n';
                
                // Add placeholders for key results
                if (objective.keyResults && objective.keyResults.length > 0) {
                    for (const keyResult of objective.keyResults) {
                        content += `- [[${this.config.keyResultsFolder}/${this.fileSystemHelper.generateFilename(this.config.keyResultTemplate, { id: keyResult.id })}|${keyResult.title}]]\n`;
                    }
                } else {
                    content += '*No key results defined yet*\n';
                }
                
                return content;
            }
            
            /**
             * Parse objective content from markdown
             * @param content Markdown content
             * @param sourcePath Source file path
             * @returns Parsed objective or null if invalid
             */
            private parseObjectiveContent(content: string, sourcePath: string): Objective | null {
                try {
                    // Extract YAML frontmatter
                    const frontmatter = this.markdownParser.extractFrontmatter(content);
                    if (!frontmatter) return null;
                    
                    // Extract essential fields
                    const id = frontmatter[this.config.metadataFields.id];
                    if (!id) return null;
                    
                    // Extract and validate dates
                    const startDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.startDate]);
                    const endDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.endDate]);
                    
                    // Create the objective
                    const objective: Objective = {
                        id: id,
                        title: this.markdownParser.extractTitle(content) || 'Untitled Objective',
                        description: this.markdownParser.extractDescription(content),
                        creationDate: new Date(),
                        status: (frontmatter[this.config.metadataFields.status] as any) || 'future',
                        priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                        tags: this.markdownParser.parseTags(frontmatter[this.config.metadataFields.tags]),
                        sourcePath: sourcePath,
                        progress: parseInt(String(frontmatter[this.config.metadataFields.progress] || '0')),
                        startDate: startDate || new Date(),
                        endDate: endDate || new Date(),
                        keyResults: [],
                        quarter: String(frontmatter.quarter || '')
                    };
                    
                    return objective;
                } catch (error) {
                    console.error('Error parsing objective content:', error);
                    return null;
                }
            }
        }