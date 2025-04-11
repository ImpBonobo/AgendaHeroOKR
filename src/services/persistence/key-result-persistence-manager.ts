import { App, TFile } from 'obsidian';
import { KeyResult } from '../../models/okr-models';
import { BasePersistenceManager, OkrPersistenceConfig } from './persistence-config';
import { FileSystemHelper } from './file-system-helper';
import { MarkdownParser } from './markdown-parser';

/**
 * Manager responsible for persisting KeyResult entities
 */
export class KeyResultPersistenceManager extends BasePersistenceManager {
    private fileSystemHelper: FileSystemHelper;
    private markdownParser: MarkdownParser;
    
    constructor(app: App, config: OkrPersistenceConfig, fileSystemHelper: FileSystemHelper, markdownParser: MarkdownParser) {
        super(app, config);
        this.fileSystemHelper = fileSystemHelper;
        this.markdownParser = markdownParser;
    }
    
    /**
     * Save a key result to a file
     * @param keyResult The key result to save
     * @returns The file path where the key result was saved
     */
    async saveKeyResult(keyResult: KeyResult): Promise<string> {
        // Ensure folder exists
        await this.fileSystemHelper.ensureFolderExists(this.config.keyResultsFolder);
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Get parent objective title
        let objectiveTitle = "unknown-objective";
        // Get the associated objective file
        const objective = this.app.vault.getMarkdownFiles()
            .find(file => file.path.includes(this.config.objectivesFolder) && 
                  file.path.includes(keyResult.objectiveId));
        
        if (objective) {
            const content = await this.app.vault.read(objective);
            const title = this.markdownParser.extractTitle(content);
            if (title) {
                objectiveTitle = this.fileSystemHelper.sanitizeFilename(title);
            }
        }
        
        // Generate filename
        const filename = this.fileSystemHelper.generateFilename(
            this.config.keyResultTemplate,
            { 
                id: keyResult.id,
                title: this.fileSystemHelper.sanitizeFilename(keyResult.title),
                year: year,
                objectiveTitle: objectiveTitle
            }
        );
        
        // Build full path
        const filePath = `${this.config.keyResultsFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateKeyResultContent(keyResult);
        
        // Save to file
        await this.fileSystemHelper.writeFile(filePath, content, true);
        
        return filePath;
    }
    
    /**
     * Load key results from files
     * @returns Array of loaded key results
     */
    async loadKeyResults(): Promise<KeyResult[]> {
        try {
            const keyResults: KeyResult[] = [];
            
            // Check if folder exists
            if (!await this.fileSystemHelper.folderExists(this.config.keyResultsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.fileSystemHelper.getFilesInFolder(this.config.keyResultsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.app.vault.read(file);
                    const keyResult = this.parseKeyResultContent(content, file.path);
                    if (keyResult) {
                        keyResult.sourceFile = file;
                        keyResults.push(keyResult);
                    }
                } catch (error) {
                    console.error(`Error parsing key result file ${file.path}:`, error);
                }
            }
            
            return keyResults;
        } catch (error) {
            console.error('Error loading key results:', error);
            return [];
        }
    }
    
    /**
     * Generate content for a key result file
     * @param keyResult The key result
     * @returns Markdown content
     */
    private generateKeyResultContent(keyResult: KeyResult): string {
        // Create YAML frontmatter
        let content = '---\n';
        content += `${this.config.metadataFields.id}: ${keyResult.id}\n`;
        content += `${this.config.metadataFields.parent}: ${keyResult.objectiveId}\n`;
        content += `${this.config.metadataFields.status}: ${keyResult.status}\n`;
        content += `${this.config.metadataFields.priority}: ${keyResult.priority}\n`;
        content += `${this.config.metadataFields.progress}: ${keyResult.progress}\n`;
        content += `${this.config.metadataFields.startDate}: ${this.markdownParser.formatDate(keyResult.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.markdownParser.formatDate(keyResult.endDate)}\n`;
        
        // Add metric information if present
        if (keyResult.metric) {
            content += `metric: ${keyResult.metric}\n`;
        }
        
        if (keyResult.startValue !== undefined) {
            content += `start_value: ${keyResult.startValue}\n`;
        }
        
        if (keyResult.targetValue !== undefined) {
            content += `target_value: ${keyResult.targetValue}\n`;
        }
        
        if (keyResult.currentValue !== undefined) {
            content += `current_value: ${keyResult.currentValue}\n`;
        }
        
        if (keyResult.format) {
            content += `format: ${keyResult.format}\n`;
        }
        
        // Add tags if present
        if (keyResult.tags && keyResult.tags.length > 0) {
            content += `${this.config.metadataFields.tags}: [${keyResult.tags.join(', ')}]\n`;
        }
        
        content += '---\n\n';
        
        // Add title
        content += `# ${keyResult.title}\n\n`;
        
        // Add description if present
        if (keyResult.description) {
            content += `${keyResult.description}\n\n`;
        }
        
        // Add parent objective link
        content += `**Objective**: [[${this.config.objectivesFolder}/${this.fileSystemHelper.generateFilename(this.config.objectiveTemplate, { id: keyResult.objectiveId })}]]\n\n`;
        
        // Add projects section
        content += '## Projects\n\n';
        
        // Add placeholders for projects
        if (keyResult.projects && keyResult.projects.length > 0) {
            for (const project of keyResult.projects) {
                content += `- [[${this.config.projectsFolder}/${this.fileSystemHelper.generateFilename(this.config.projectTemplate, { id: project.id })}|${project.title}]]\n`;
            }
        } else {
            content += '*No projects defined yet*\n';
        }
        
        return content;
    }
    
    /**
     * Parse key result content from markdown
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Parsed key result or null if invalid
     */
    private parseKeyResultContent(content: string, sourcePath: string): KeyResult | null {
        try {
            // Extract YAML frontmatter
            const frontmatter = this.markdownParser.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            const objectiveId = frontmatter[this.config.metadataFields.parent];
            if (!id || !objectiveId) return null;
            
            // Extract and validate dates
            const startDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
            // Create the key result
            const keyResult: KeyResult = {
                id: String(id),
                objectiveId: String(objectiveId),
                title: this.markdownParser.extractTitle(content) || 'Untitled Key Result',
                description: this.markdownParser.extractDescription(content),
                creationDate: new Date(),
                status: (frontmatter[this.config.metadataFields.status] as any) || 'future',
                priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                tags: this.markdownParser.parseTags(frontmatter[this.config.metadataFields.tags]),
                sourcePath: sourcePath,
                progress: parseInt(String(frontmatter[this.config.metadataFields.progress] || '0')),
                startDate: startDate || new Date(),
                endDate: endDate || new Date(),
                projects: []
            };
            
            // Parse metric information if present
            if (frontmatter.metric !== undefined) {
                keyResult.metric = String(frontmatter.metric);
            }
            
            if (frontmatter.start_value !== undefined) {
                keyResult.startValue = parseFloat(String(frontmatter.start_value));
            }
            
            if (frontmatter.target_value !== undefined) {
                keyResult.targetValue = parseFloat(String(frontmatter.target_value));
            }
            
            if (frontmatter.current_value !== undefined) {
                keyResult.currentValue = parseFloat(String(frontmatter.current_value));
            }
            
            if (frontmatter.format !== undefined) {
                keyResult.format = String(frontmatter.format);
            }
            
            return keyResult;
        } catch (error) {
            console.error('Error parsing key result content:', error);
            return null;
        }
    }
}