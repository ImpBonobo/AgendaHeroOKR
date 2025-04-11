import { App, TFile } from 'obsidian';
import { Project } from '../../models/okr-models';
import { BasePersistenceManager, OkrPersistenceConfig } from './persistence-config';
import { FileSystemHelper } from './file-system-helper';
import { MarkdownParser } from './markdown-parser';
import { TaskPersistenceManager } from './task-persistence-manager';

/**
 * Manager responsible for persisting Project entities
 */
export class ProjectPersistenceManager extends BasePersistenceManager {
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
     * Save a project to a file
     * @param project The project to save
     * @returns The file path where the project was saved
     */
    async saveProject(project: Project): Promise<string> {
        // Ensure folder exists
        await this.fileSystemHelper.ensureFolderExists(this.config.projectsFolder);
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Get parent key result title
        let keyResultTitle = "unknown-keyresult";
        // Get the associated key result file
        const keyResult = this.app.vault.getMarkdownFiles()
            .find(file => file.path.includes(this.config.keyResultsFolder) && 
                  file.path.includes(project.keyResultId));
        
        if (keyResult) {
            const content = await this.app.vault.read(keyResult);
            const title = this.markdownParser.extractTitle(content);
            if (title) {
                keyResultTitle = this.fileSystemHelper.sanitizeFilename(title);
            }
        }
        
        // Generate filename
        const filename = this.fileSystemHelper.generateFilename(
            this.config.projectTemplate,
            { 
                id: project.id,
                title: this.fileSystemHelper.sanitizeFilename(project.title),
                year: year,
                keyResultTitle: keyResultTitle
            }
        );
        
        // Build full path
        const filePath = `${this.config.projectsFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateProjectContent(project);
        
        // Save to file
        await this.fileSystemHelper.writeFile(filePath, content, true);
        
        return filePath;
    }
    
    /**
     * Load projects from files
     * @returns Array of loaded projects
     */
    async loadProjects(): Promise<Project[]> {
        try {
            const projects: Project[] = [];
            
            // Check if folder exists
            if (!await this.fileSystemHelper.folderExists(this.config.projectsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.fileSystemHelper.getFilesInFolder(this.config.projectsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.app.vault.read(file);
                    const project = this.parseProjectContent(content, file.path);
                    if (project) {
                        project.sourceFile = file;
                        projects.push(project);
                    }
                } catch (error) {
                    console.error(`Error parsing project file ${file.path}:`, error);
                }
            }
            
            return projects;
        } catch (error) {
            console.error('Error loading projects:', error);
            return [];
        }
    }
    
    /**
     * Generate content for a project file
     * @param project The project
     * @returns Markdown content
     */
    private generateProjectContent(project: Project): string {
        // Create YAML frontmatter
        let content = '---\n';
        content += `${this.config.metadataFields.id}: ${project.id}\n`;
        content += `${this.config.metadataFields.parent}: ${project.keyResultId}\n`;
        content += `${this.config.metadataFields.status}: ${project.status}\n`;
        content += `${this.config.metadataFields.priority}: ${project.priority}\n`;
        content += `${this.config.metadataFields.progress}: ${project.progress}\n`;
        content += `${this.config.metadataFields.startDate}: ${this.markdownParser.formatDate(project.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.markdownParser.formatDate(project.endDate)}\n`;
        
        // Add sprint IDs if present
        if (project.sprintIds && project.sprintIds.length > 0) {
            content += `sprints: [${project.sprintIds.join(', ')}]\n`;
        }
        
        // Add tags if present
        if (project.tags && project.tags.length > 0) {
            content += `${this.config.metadataFields.tags}: [${project.tags.join(', ')}]\n`;
        }
        
        content += '---\n\n';
        
        // Add title
        content += `# ${project.title}\n\n`;
        
        // Add description if present
        if (project.description) {
            content += `${project.description}\n\n`;
        }
        
        // Add parent key result link
        content += `**Key Result**: [[${this.config.keyResultsFolder}/${this.fileSystemHelper.generateFilename(this.config.keyResultTemplate, { id: project.keyResultId })}]]\n\n`;
        
        // Add tasks section
        content += '## Tasks\n\n';
        
        // Add tasks
        if (project.tasks && project.tasks.length > 0) {
            for (const task of project.tasks) {
                content += this.taskManager.generateTaskMarkdown(task) + '\n';
            }
        } else {
            content += '*No tasks defined yet*\n';
        }
        
        return content;
    }
    
    /**
     * Parse project content from markdown
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Parsed project or null if invalid
     */
    private parseProjectContent(content: string, sourcePath: string): Project | null {
        try {
            // Extract YAML frontmatter
            const frontmatter = this.markdownParser.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            const keyResultId = frontmatter[this.config.metadataFields.parent];
            if (!id || !keyResultId) return null;
            
            // Extract and validate dates
            const startDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.markdownParser.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
            // Parse sprint IDs
            let sprintIds: string[] | undefined;
            if (frontmatter.sprints !== undefined) {
                if (typeof frontmatter.sprints === 'string') {
                    // Split string by commas and trim
                    sprintIds = frontmatter.sprints.split(',').map(id => id.trim());
                } else if (Array.isArray(frontmatter.sprints)) {
                    sprintIds = frontmatter.sprints.map(id => String(id));
                }
            }
            
            // Create the project
            const project: Project = {
                id: String(id),
                keyResultId: String(keyResultId),
                title: this.markdownParser.extractTitle(content) || 'Untitled Project',
                description: this.markdownParser.extractDescription(content),
                creationDate: new Date(),
                status: (frontmatter[this.config.metadataFields.status] as any) || 'future',
                priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                tags: this.markdownParser.parseTags(frontmatter[this.config.metadataFields.tags]),
                sourcePath: sourcePath,
                progress: parseInt(String(frontmatter[this.config.metadataFields.progress] || '0')),
                startDate: startDate || new Date(),
                endDate: endDate || new Date(),
                tasks: this.taskManager.parseTasksFromContent(content, sourcePath),
                sprintIds: sprintIds
            };
            
            return project;
        } catch (error) {
            console.error('Error parsing project content:', error);
            return null;
        }
    }
}