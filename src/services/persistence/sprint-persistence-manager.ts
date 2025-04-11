import { App, TFile } from 'obsidian';
import { Sprint } from '../../models/okr-models';
import { BasePersistenceManager, OkrPersistenceConfig } from './persistence-config';
import { FileSystemHelper } from './file-system-helper';
import { MarkdownParser } from './markdown-parser';
import { TaskPersistenceManager } from './task-persistence-manager';

/**
 * Manager responsible for persisting Sprint entities
 */
export class SprintPersistenceManager extends BasePersistenceManager {
    private fileSystemHelper: FileSystemHelper;
    private markdownParser: MarkdownParser;
    private taskManager: TaskPersistenceManager;
    
    constructor(
        app: App, 
        config: OkrPersistenceConfig, 
        fileSystemHelper: FileSystemHelper, 
        markdownParser: MarkdownParser,
        taskManager: TaskPersistenceManager
    ) {
        super(app, config);
        this.fileSystemHelper = fileSystemHelper;
        this.markdownParser = markdownParser;
        this.taskManager = taskManager;
    }
    
    /**
     * Save a sprint to a file
     * @param sprint The sprint to save
     * @returns The file path where the sprint was saved
     */
    async saveSprint(sprint: Sprint): Promise<string> {
        // Ensure folder exists
        await this.fileSystemHelper.ensureFolderExists(this.config.sprintsFolder);
        
        // Generate filename
        const filename = this.fileSystemHelper.generateFilename(
            this.config.sprintTemplate,
            { 
                id: sprint.id,
                sprintNumber: sprint.sprintNumber,
                month: sprint.month,
                quarter: sprint.quarter,
                year: sprint.year
            }
        );
        
        // Build full path
        const filePath = `${this.config.sprintsFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateSprintContent(sprint);
        
        // Save to file
        await this.fileSystemHelper.writeFile(filePath, content, true);
        
        return filePath;
    }
    
    /**
     * Load sprints from files
     * @returns Array of loaded sprints
     */
    async loadSprints(): Promise<Sprint[]> {
        try {
            const sprints: Sprint[] = [];
            
            // Check if folder exists
            if (!await this.fileSystemHelper.folderExists(this.config.sprintsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.fileSystemHelper.getFilesInFolder(this.config.sprintsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.app.vault.read(file);
                    const sprint = this.parseSprintContent(content, file.path);
                    if (sprint) {
                        sprints.push(sprint);
                    }
                } catch (error) {
                    console.error(`Error parsing sprint file ${file.path}:`, error);
                }
            }
            
            return sprints;
        } catch (error) {
            console.error('Error loading sprints:', error);
            return [];
        }
    }
    
    /**
     * Generate content for a sprint file
     * @param sprint The sprint
     * @returns Markdown content
     */
    private generateSprintContent(sprint: Sprint): string {
        // Create YAML frontmatter
        let content = '---\n';
        content += `${this.config.metadataFields.id}: ${sprint.id}\n`;
        content += `${this.config.metadataFields.startDate}: ${this.markdownParser.formatDate(sprint.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.markdownParser.formatDate(sprint.endDate)}\n`;
        content += `status: ${sprint.status}\n`;
        content += `sprint_number: ${sprint.sprintNumber}\n`;
        content += `month: ${sprint.month}\n`;
        content += `quarter: ${sprint.quarter}\n`;
        content += `year: ${sprint.year}\n`;
        content += '---\n\n';
        
        // Add title
        content += `# ${sprint.title}\n\n`;
        
        // Add date range
        content += `**Duration**: ${this.markdownParser.formatDate(sprint.startDate)} to ${this.markdownParser.formatDate(sprint.endDate)}\n\n`;
        
        // Add tasks section
        content += '## Tasks\n\n';
        
        // Group tasks by status
        const tasksByStatus: Record<string, any[]> = {};
        
        for (const task of sprint.tasks) {
            if (!tasksByStatus[task.status]) {
                tasksByStatus[task.status] = [];
            }
            
            tasksByStatus[task.status].push(task);
        }
        
        // Add tasks by status
        for (const status of ['next-up', 'in-progress', 'waiting-on', 'validating', 'completed', 'canceled']) {
            if (tasksByStatus[status] && tasksByStatus[status].length > 0) {
                const statusLabel = this.markdownParser.statusToLabel(status as any);
                content += `### ${statusLabel}\n\n`;
                
                for (const task of tasksByStatus[status]) {
                    content += this.taskManager.generateTaskMarkdown(task) + '\n';
                }
                
                content += '\n';
            }
        }
        
        return content;
    }
    
    /**
     * Parse sprint content from markdown
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Parsed sprint or null if invalid
     */
    private parseSprintContent(content: string, sourcePath: string): Sprint | null {
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
            
            // Get current year as fallback
            const currentYear = new Date().getFullYear();
            
            // Create the sprint
            const sprint: Sprint = {
                id: String(id),
                title: this.markdownParser.extractTitle(content) || String(frontmatter.title || 'Untitled Sprint'),
                startDate: startDate || new Date(),
                endDate: endDate || new Date(),
                status: (frontmatter.status as any) || 'planned',
                tasks: this.taskManager.parseTasksFromContent(content, sourcePath),
                sprintNumber: parseInt(String(frontmatter.sprint_number || '1')),
                month: parseInt(String(frontmatter.month || '1')),
                quarter: parseInt(String(frontmatter.quarter || '1')),
                year: parseInt(String(frontmatter.year || currentYear))
            };
            
            return sprint;
        } catch (error) {
            console.error('Error parsing sprint content:', error);
            return null;
        }
    }
}