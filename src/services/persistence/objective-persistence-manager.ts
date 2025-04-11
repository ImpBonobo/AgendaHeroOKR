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