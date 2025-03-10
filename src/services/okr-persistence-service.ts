/**
 * OKR Persistence Service
 * 
 * This service handles saving and loading OKR elements to/from Markdown files.
 * It manages the file structure and formatting for Objectives, Key Results,
 * Projects, and Tasks.
 */

import { App, TFile, Vault, MetadataCache } from 'obsidian';
import { 
    OkrElement, 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    Sprint, 
    OkrStatus
} from '../models/okr-models';

/**
 * Configuration for the OKR persistence service
 */
export interface OkrPersistenceConfig {
    objectivesFolder: string;   // Folder for objectives
    keyResultsFolder: string;   // Folder for key results
    projectsFolder: string;     // Folder for projects
    sprintsFolder: string;      // Folder for sprints
    
    // File naming templates
    objectiveTemplate: string;  // Template for objective filenames
    keyResultTemplate: string;  // Template for key result filenames
    projectTemplate: string;    // Template for project filenames
    sprintTemplate: string;     // Template for sprint filenames
    
    // Metadata field names
    metadataFields: {
        id: string;
        status: string;
        priority: string;
        progress: string;
        startDate: string;
        endDate: string;
        dueDate: string;
        parent: string;         // For linking to parent element
        tags: string;
        estimatedDuration: string;
        timeDefense: string;
        allowedTimeWindows: string;
        splitUpBlock: string;
    };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OkrPersistenceConfig = {
    objectivesFolder: 'OKRs/Objectives',
    keyResultsFolder: 'OKRs/KeyResults',
    projectsFolder: 'OKRs/Projects',
    sprintsFolder: 'OKRs/Sprints',
    
    objectiveTemplate: '${year}-${title}-${id}',
    keyResultTemplate: '${year}-${objectiveTitle}-${title}-${id}',
    projectTemplate: '${year}-${keyResultTitle}-${title}-${id}',
    sprintTemplate: 'SB-${sprintNumber}-${month}M-${quarter}Q-${year}Y',
    
    metadataFields: {
        id: 'id',
        status: 'status',
        priority: 'priority',
        progress: 'progress',
        startDate: 'start_date',
        endDate: 'end_date',
        dueDate: 'due_date',
        parent: 'parent',
        tags: 'tags',
        estimatedDuration: 'estimated_duration',
        timeDefense: 'time_defense',
        allowedTimeWindows: 'allowed_time_windows',
        splitUpBlock: 'split_up_block'
    }
};

/**
 * Service class for persisting OKR elements
 */
export class OkrPersistenceService {
    private app: App;
    private vault: Vault;
    private metadataCache: MetadataCache;
    private config: OkrPersistenceConfig;
    
    constructor(app: App, config: Partial<OkrPersistenceConfig> = {}) {
        this.app = app;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            metadataFields: {
                ...DEFAULT_CONFIG.metadataFields,
                ...(config.metadataFields || {})
            }
        };
    }
    
    /**
     * Update the service configuration
     * @param config New configuration options
     */
    updateConfig(config: Partial<OkrPersistenceConfig>) {
        this.config = {
            ...this.config,
            ...config,
            metadataFields: {
                ...this.config.metadataFields,
                ...(config.metadataFields || {})
            }
        };
    }
    
    /**
     * Get the configuration
     * @returns Current configuration
     */
    getConfig(): OkrPersistenceConfig {
        return {...this.config};
    }
    
    /**
     * Save an objective to a file
     * @param objective The objective to save
     * @returns The file path where the objective was saved
     */
    async saveObjective(objective: Objective): Promise<string> {
        // Ensure folder exists
        await this.ensureFolderExists(this.config.objectivesFolder);
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Generate filename
        const filename = this.generateFilename(
            this.config.objectiveTemplate,
            { 
                id: objective.id,
                title: this.sanitizeFilename(objective.title),
                year: year
            }
        );
        
        // Build full path
        const filePath = `${this.config.objectivesFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateObjectiveContent(objective);
        
        // Save to file
        if (await this.fileExists(filePath)) {
            // Update existing file
            const file = this.getFile(filePath);
            await this.vault.modify(file, content);
        } else {
            // Create new file
            await this.vault.create(filePath, content);
        }
        
        return filePath;
    }
    
    /**
     * Save a key result to a file
     * @param keyResult The key result to save
     * @returns The file path where the key result was saved
     */
    async saveKeyResult(keyResult: KeyResult): Promise<string> {
        // Ensure folder exists
        await this.ensureFolderExists(this.config.keyResultsFolder);
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Get parent objective title
        let objectiveTitle = "unknown-objective";
        // Hier müssen wir den Objective-Titel abrufen
        const objective = this.app.vault.getMarkdownFiles()
            .find(file => file.path.includes(this.config.objectivesFolder) && 
                  file.path.includes(keyResult.objectiveId));
        
        if (objective) {
            const content = await this.vault.read(objective);
            const title = this.extractTitle(content);
            if (title) {
                objectiveTitle = this.sanitizeFilename(title);
            }
        }
        
        // Generate filename
        const filename = this.generateFilename(
            this.config.keyResultTemplate,
            { 
                id: keyResult.id,
                title: this.sanitizeFilename(keyResult.title),
                year: year,
                objectiveTitle: objectiveTitle
            }
        );
        
        // Build full path
        const filePath = `${this.config.keyResultsFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateKeyResultContent(keyResult);
        
        // Save to file
        if (await this.fileExists(filePath)) {
            // Update existing file
            const file = this.getFile(filePath);
            await this.vault.modify(file, content);
        } else {
            // Create new file
            await this.vault.create(filePath, content);
        }
        
        return filePath;
    }
    
    /**
     * Save a project to a file
     * @param project The project to save
     * @returns The file path where the project was saved
     */
    async saveProject(project: Project): Promise<string> {
        // Ensure folder exists
        await this.ensureFolderExists(this.config.projectsFolder);
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Get parent key result title
        let keyResultTitle = "unknown-keyresult";
        // Hier müssen wir den Key Result-Titel abrufen
        const keyResult = this.app.vault.getMarkdownFiles()
            .find(file => file.path.includes(this.config.keyResultsFolder) && 
                  file.path.includes(project.keyResultId));
        
        if (keyResult) {
            const content = await this.vault.read(keyResult);
            const title = this.extractTitle(content);
            if (title) {
                keyResultTitle = this.sanitizeFilename(title);
            }
        }
        
        // Generate filename
        const filename = this.generateFilename(
            this.config.projectTemplate,
            { 
                id: project.id,
                title: this.sanitizeFilename(project.title),
                year: year,
                keyResultTitle: keyResultTitle
            }
        );
        
        // Build full path
        const filePath = `${this.config.projectsFolder}/${filename}.md`;
        
        // Generate file content
        const content = this.generateProjectContent(project);
        
        // Save to file
        if (await this.fileExists(filePath)) {
            // Update existing file
            const file = this.getFile(filePath);
            await this.vault.modify(file, content);
        } else {
            // Create new file
            await this.vault.create(filePath, content);
        }
        
        return filePath;
    }
    
    /**
     * Save a sprint to a file
     * @param sprint The sprint to save
     * @returns The file path where the sprint was saved
     */
    async saveSprint(sprint: Sprint): Promise<string> {
        // Ensure folder exists
        await this.ensureFolderExists(this.config.sprintsFolder);
        
        // Generate filename
        const filename = this.generateFilename(
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
        if (await this.fileExists(filePath)) {
            // Update existing file
            const file = this.getFile(filePath);
            await this.vault.modify(file, content);
        } else {
            // Create new file
            await this.vault.create(filePath, content);
        }
        
        return filePath;
    }
    
    /**
     * Add a task to a markdown file
     * @param task The task to add
     * @param filePath The file path to add the task to
     * @returns Whether the operation was successful
     */
    async addTaskToFile(task: Task, filePath: string): Promise<boolean> {
        try {
            // Check if file exists
            if (!await this.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.getFile(filePath);
            const content = await this.vault.read(file);
            
            // Generate task markdown
            const taskMarkdown = this.generateTaskMarkdown(task);
            
            // Append task to file content
            // This is a simple implementation that just appends the task at the end
            // A more advanced implementation might insert it in a specific section
            const newContent = content + '\n' + taskMarkdown;
            
            // Update file
            await this.vault.modify(file, newContent);
            
            return true;
        } catch (error) {
            console.error('Error adding task to file:', error);
            return false;
        }
    }
    
    /**
     * Update a task in a markdown file
     * @param task The updated task
     * @param filePath The file path containing the task
     * @returns Whether the operation was successful
     */
    async updateTaskInFile(task: Task, filePath: string): Promise<boolean> {
        try {
            // Check if file exists
            if (!await this.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.getFile(filePath);
            const content = await this.vault.read(file);
            
            // Split content into lines
            const lines = content.split('\n');
            
            // Find the line with this task
            const taskIdRegex = new RegExp(`\\[.*\\].*${this.escapeRegExp(task.id)}`);
            const taskLineIndex = lines.findIndex(line => taskIdRegex.test(line));
            
            if (taskLineIndex === -1) {
                return false;
            }
            
            // Generate updated task markdown
            const updatedTaskMarkdown = this.generateTaskMarkdown(task);
            
            // Replace the line
            lines[taskLineIndex] = updatedTaskMarkdown;
            
            // Update file
            await this.vault.modify(file, lines.join('\n'));
            
            return true;
        } catch (error) {
            console.error('Error updating task in file:', error);
            return false;
        }
    }
    
    /**
     * Remove a task from a markdown file
     * @param taskId The ID of the task to remove
     * @param filePath The file path containing the task
     * @returns Whether the operation was successful
     */
    async removeTaskFromFile(taskId: string, filePath: string): Promise<boolean> {
        try {
            // Check if file exists
            if (!await this.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.getFile(filePath);
            const content = await this.vault.read(file);
            
            // Split content into lines
            const lines = content.split('\n');
            
            // Find the line with this task
            const taskIdRegex = new RegExp(`\\[.*\\].*${this.escapeRegExp(taskId)}`);
            const taskLineIndex = lines.findIndex(line => taskIdRegex.test(line));
            
            if (taskLineIndex === -1) {
                return false;
            }
            
            // Remove the line
            lines.splice(taskLineIndex, 1);
            
            // Update file
            await this.vault.modify(file, lines.join('\n'));
            
            return true;
        } catch (error) {
            console.error('Error removing task from file:', error);
            return false;
        }
    }
    
    /**
     * Load objectives from files
     * @returns Array of loaded objectives
     */
    async loadObjectives(): Promise<Objective[]> {
        try {
            const objectives: Objective[] = [];
            
            // Check if folder exists
            if (!await this.folderExists(this.config.objectivesFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.getFilesInFolder(this.config.objectivesFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.vault.read(file);
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
     * Load key results from files
     * @returns Array of loaded key results
     */
    async loadKeyResults(): Promise<KeyResult[]> {
        try {
            const keyResults: KeyResult[] = [];
            
            // Check if folder exists
            if (!await this.folderExists(this.config.keyResultsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.getFilesInFolder(this.config.keyResultsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.vault.read(file);
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
     * Load projects from files
     * @returns Array of loaded projects
     */
    async loadProjects(): Promise<Project[]> {
        try {
            const projects: Project[] = [];
            
            // Check if folder exists
            if (!await this.folderExists(this.config.projectsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.getFilesInFolder(this.config.projectsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.vault.read(file);
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
     * Load sprints from files
     * @returns Array of loaded sprints
     */
    async loadSprints(): Promise<Sprint[]> {
        try {
            const sprints: Sprint[] = [];
            
            // Check if folder exists
            if (!await this.folderExists(this.config.sprintsFolder)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.getFilesInFolder(this.config.sprintsFolder);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const content = await this.vault.read(file);
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
     * Load tasks from a specific file
     * @param filePath Path to the file containing tasks
     * @returns Array of loaded tasks
     */
    async loadTasksFromFile(filePath: string): Promise<Task[]> {
        try {
            // Check if file exists
            if (!await this.fileExists(filePath)) {
                return [];
            }
            
            // Get file content
            const file = this.getFile(filePath);
            const content = await this.vault.read(file);
            
            // Parse tasks
            return this.parseTasksFromContent(content, filePath);
        } catch (error) {
            console.error(`Error loading tasks from ${filePath}:`, error);
            return [];
        }
    }
    
    /**
     * Load all tasks from all files in a folder
     * @param folderPath Path to the folder
     * @returns Array of loaded tasks
     */
    async loadTasksFromFolder(folderPath: string): Promise<Task[]> {
        try {
            const tasks: Task[] = [];
            
            // Check if folder exists
            if (!await this.folderExists(folderPath)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.getFilesInFolder(folderPath);
            
            // Process each file
            for (const file of files) {
                if (file.extension !== 'md') continue;
                
                try {
                    const fileTasks = await this.loadTasksFromFile(file.path);
                    tasks.push(...fileTasks);
                } catch (error) {
                    console.error(`Error loading tasks from ${file.path}:`, error);
                }
            }
            
            return tasks;
        } catch (error) {
            console.error(`Error loading tasks from folder ${folderPath}:`, error);
            return [];
        }
    }
    
    // ----- Private helper methods -----
    
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
        content += `${this.config.metadataFields.startDate}: ${this.formatDate(objective.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.formatDate(objective.endDate)}\n`;
        
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
                content += `- [[${this.config.keyResultsFolder}/${this.generateFilename(this.config.keyResultTemplate, { id: keyResult.id })}|${keyResult.title}]]\n`;
            }
        } else {
            content += '*No key results defined yet*\n';
        }
        
        return content;
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
        content += `${this.config.metadataFields.startDate}: ${this.formatDate(keyResult.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.formatDate(keyResult.endDate)}\n`;
        
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
        content += `**Objective**: [[${this.config.objectivesFolder}/${this.generateFilename(this.config.objectiveTemplate, { id: keyResult.objectiveId })}]]\n\n`;
        
        // Add projects section
        content += '## Projects\n\n';
        
        // Add placeholders for projects
        if (keyResult.projects && keyResult.projects.length > 0) {
            for (const project of keyResult.projects) {
                content += `- [[${this.config.projectsFolder}/${this.generateFilename(this.config.projectTemplate, { id: project.id })}|${project.title}]]\n`;
            }
        } else {
            content += '*No projects defined yet*\n';
        }
        
        return content;
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
        content += `${this.config.metadataFields.startDate}: ${this.formatDate(project.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.formatDate(project.endDate)}\n`;
        
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
        content += `**Key Result**: [[${this.config.keyResultsFolder}/${this.generateFilename(this.config.keyResultTemplate, { id: project.keyResultId })}]]\n\n`;
        
        // Add tasks section
        content += '## Tasks\n\n';
        
        // Add tasks
        if (project.tasks && project.tasks.length > 0) {
            for (const task of project.tasks) {
                content += this.generateTaskMarkdown(task) + '\n';
            }
        } else {
            content += '*No tasks defined yet*\n';
        }
        
        return content;
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
        content += `${this.config.metadataFields.startDate}: ${this.formatDate(sprint.startDate)}\n`;
        content += `${this.config.metadataFields.endDate}: ${this.formatDate(sprint.endDate)}\n`;
        content += `status: ${sprint.status}\n`;
        content += `sprint_number: ${sprint.sprintNumber}\n`;
        content += `month: ${sprint.month}\n`;
        content += `quarter: ${sprint.quarter}\n`;
        content += `year: ${sprint.year}\n`;
        content += '---\n\n';
        
        // Add title
        content += `# ${sprint.title}\n\n`;
        
        // Add date range
        content += `**Duration**: ${this.formatDate(sprint.startDate)} to ${this.formatDate(sprint.endDate)}\n\n`;
        
        // Add tasks section
        content += '## Tasks\n\n';
        
        // Group tasks by status
        const tasksByStatus: Record<string, Task[]> = {};
        
        for (const task of sprint.tasks) {
            if (!tasksByStatus[task.status]) {
                tasksByStatus[task.status] = [];
            }
            
            tasksByStatus[task.status].push(task);
        }
        
        // Add tasks by status
        for (const status of ['next-up', 'in-progress', 'waiting-on', 'validating', 'completed', 'canceled']) {
            if (tasksByStatus[status] && tasksByStatus[status].length > 0) {
                const statusLabel = this.statusToLabel(status as OkrStatus);
                content += `### ${statusLabel}\n\n`;
                
                for (const task of tasksByStatus[status]) {
                    content += this.generateTaskMarkdown(task) + '\n';
                }
                
                content += '\n';
            }
        }
        
        return content;
    }
    
    /**
     * Generate markdown for a task
     * @param task The task
     * @returns Markdown content for the task
     */
    private generateTaskMarkdown(task: Task): string {
        // Checkbox state
        const checkboxState = task.completed ? 'x' : ' ';
        
        // Base task content
        let taskMarkdown = `- [${checkboxState}] ${task.title}`;
        
        // Add task ID as a hidden reference tag (to keep it out of regular tag search)
        taskMarkdown += ` #id:${task.id}`;
        
        // Add priority if not default
        if (task.priority < 4) {
            taskMarkdown += ` !${task.priority}`;
        }
        
        // Add due date if present
        if (task.dueDate) {
            taskMarkdown += ` @due(${this.formatDate(task.dueDate)})`;
            
            // Add time if present
            if (task.dueDate.getHours() !== 0 || task.dueDate.getMinutes() !== 0) {
                taskMarkdown += ` @time(${this.formatTime(task.dueDate)})`;
            }
        }
        
        // Add estimated duration if present
        if (task.estimatedDuration) {
            taskMarkdown += ` @duration(${task.estimatedDuration}m)`;
        }
        
        // Add split up block if present
        if (task.splitUpBlock) {
            taskMarkdown += ` @split(${task.splitUpBlock}m)`;
        }
        
        // Add time defense if present
        if (task.timeDefense) {
            taskMarkdown += ` @defense(${task.timeDefense})`;
        }
        
        // Add allowed time windows if present
        if (task.allowedTimeWindows && task.allowedTimeWindows.length > 0) {
            taskMarkdown += ` @windows(${task.allowedTimeWindows.join(',')})`;
        }
        
        // Add tags
        if (task.tags && task.tags.length > 0) {
            for (let tag of task.tags) {
                if (!tag.startsWith('#')) {
                    tag = '#' + tag;
                }
                taskMarkdown += ` ${tag}`;
            }
        }
        
        // Add recurring if needed
        if (task.recurring) {
            taskMarkdown += ' 🔁';
            
            // Add recurrence rule if present
            if (task.recurrenceRule) {
                taskMarkdown += ` ${task.recurrenceRule}`;
            }
        }
        
        return taskMarkdown;
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
            const frontmatter = this.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            if (!id) return null;
            
            // Extract and validate dates
            const startDate = this.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
            // Create the objective
            const objective: Objective = {
                id: id,
                title: this.extractTitle(content) || 'Untitled Objective',
                description: this.extractDescription(content),
                creationDate: new Date(),
                status: (frontmatter[this.config.metadataFields.status] as OkrStatus) || 'future',
                priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                tags: this.parseTags(frontmatter[this.config.metadataFields.tags]),
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
    
    /**
     * Parse key result content from markdown
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Parsed key result or null if invalid
     */
    private parseKeyResultContent(content: string, sourcePath: string): KeyResult | null {
        try {
            // Extract YAML frontmatter
            const frontmatter = this.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            const objectiveId = frontmatter[this.config.metadataFields.parent];
            if (!id || !objectiveId) return null;
            
            // Extract and validate dates
            const startDate = this.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
            // Create the key result
            const keyResult: KeyResult = {
                id: String(id),
                objectiveId: String(objectiveId),
                title: this.extractTitle(content) || 'Untitled Key Result',
                description: this.extractDescription(content),
                creationDate: new Date(),
                status: (frontmatter[this.config.metadataFields.status] as OkrStatus) || 'future',
                priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                tags: this.parseTags(frontmatter[this.config.metadataFields.tags]),
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
    
    /**
     * Parse project content from markdown
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Parsed project or null if invalid
     */
    private parseProjectContent(content: string, sourcePath: string): Project | null {
        try {
            // Extract YAML frontmatter
            const frontmatter = this.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            const keyResultId = frontmatter[this.config.metadataFields.parent];
            if (!id || !keyResultId) return null;
            
            // Extract and validate dates
            const startDate = this.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
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
                title: this.extractTitle(content) || 'Untitled Project',
                description: this.extractDescription(content),
                creationDate: new Date(),
                status: (frontmatter[this.config.metadataFields.status] as OkrStatus) || 'future',
                priority: parseInt(String(frontmatter[this.config.metadataFields.priority] || '3')),
                tags: this.parseTags(frontmatter[this.config.metadataFields.tags]),
                sourcePath: sourcePath,
                progress: parseInt(String(frontmatter[this.config.metadataFields.progress] || '0')),
                startDate: startDate || new Date(),
                endDate: endDate || new Date(),
                tasks: this.parseTasksFromContent(content, sourcePath),
                sprintIds: sprintIds
            };
            
            return project;
        } catch (error) {
            console.error('Error parsing project content:', error);
            return null;
        }
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
            const frontmatter = this.extractFrontmatter(content);
            if (!frontmatter) return null;
            
            // Extract essential fields
            const id = frontmatter[this.config.metadataFields.id];
            if (!id) return null;
            
            // Extract and validate dates
            const startDate = this.parseDate(frontmatter[this.config.metadataFields.startDate]);
            const endDate = this.parseDate(frontmatter[this.config.metadataFields.endDate]);
            
            // Get current year as fallback
            const currentYear = new Date().getFullYear();
            
            // Create the sprint
            const sprint: Sprint = {
                id: String(id),
                title: this.extractTitle(content) || String(frontmatter.title || 'Untitled Sprint'),
                startDate: startDate || new Date(),
                endDate: endDate || new Date(),
                status: (frontmatter.status as 'planned' | 'active' | 'completed' | 'canceled') || 'planned',
                tasks: this.parseTasksFromContent(content, sourcePath),
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
    
    /**
     * Parse tasks from markdown content
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Array of parsed tasks
     */
    private parseTasksFromContent(content: string, sourcePath: string): Task[] {
        const tasks: Task[] = [];
        
        // Split content into lines
        const lines = content.split('\n');
        
        // Regular expression for task lines
        const taskRegex = /^-\s*\[([ xX])\]\s*(.*)/;
        
        // Additional patterns for task attributes
        const idPattern = /#([a-zA-Z0-9_-]+)(?=\s|$)/;
        const priorityPattern = /!([1-4])(?=\s|$)/;
        const dueDatePattern = /@due\(([^)]+)\)(?=\s|$)/;
        const timePattern = /@time\(([^)]+)\)(?=\s|$)/;
        const durationPattern = /@duration\((\d+)m\)(?=\s|$)/;
        const splitPattern = /@split\((\d+)m\)(?=\s|$)/;
        const defensePattern = /@defense\(([^)]+)\)(?=\s|$)/;
        const windowsPattern = /@windows\(([^)]+)\)(?=\s|$)/;
        const tagsPattern = /#([a-zA-Z0-9_-]+)(?=\s|$)/g;
        const recurringPattern = /🔁\s*(.*)(?=\s|$)/;
        
        // Process each line
        for (const line of lines) {
            const taskMatch = taskRegex.exec(line);
            if (!taskMatch) continue;
            
            // Extract checkbox state and content
            const isCompleted = taskMatch[1].toLowerCase() === 'x';
            let taskContent = taskMatch[2];
            
            // Extract task ID
            let taskId = '';
            const idMatch = idPattern.exec(taskContent);
            if (idMatch) {
                taskId = idMatch[1];
                // Remove ID from content
                taskContent = taskContent.replace(idMatch[0], '');
            } else {
                // Generate a temporary ID
                taskId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            }
            
            // Extract priority
            let priority = 4; // Default: Low
            const priorityMatch = priorityPattern.exec(taskContent);
            if (priorityMatch) {
                priority = parseInt(priorityMatch[1]);
                // Remove priority from content
                taskContent = taskContent.replace(priorityMatch[0], '');
            }
            
            // Extract due date
            let dueDate: Date | null = null;
            const dueDateMatch = dueDatePattern.exec(taskContent);
            if (dueDateMatch) {
                dueDate = this.parseDate(dueDateMatch[1]);
                // Remove due date from content
                taskContent = taskContent.replace(dueDateMatch[0], '');
            }
            
            // Extract time if any
            const timeMatch = timePattern.exec(taskContent);
            if (timeMatch && dueDate) {
                const timeParts = timeMatch[1].split(':');
                if (timeParts.length >= 2) {
                    dueDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
                }
                // Remove time from content
                taskContent = taskContent.replace(timeMatch[0], '');
            }
            
            // Extract estimated duration
            let estimatedDuration: number | undefined;
            const durationMatch = durationPattern.exec(taskContent);
            if (durationMatch) {
                estimatedDuration = parseInt(durationMatch[1]);
                // Remove duration from content
                taskContent = taskContent.replace(durationMatch[0], '');
            }
            
            // Extract split up block
            let splitUpBlock: number | undefined;
            const splitMatch = splitPattern.exec(taskContent);
            if (splitMatch) {
                splitUpBlock = parseInt(splitMatch[1]);
                // Remove split from content
                taskContent = taskContent.replace(splitMatch[0], '');
            }
            
            // Extract time defense
            let timeDefense: 'always-busy' | 'always-free' | undefined;
            const defenseMatch = defensePattern.exec(taskContent);
            if (defenseMatch) {
                const defenseValue = defenseMatch[1];
                if (defenseValue === 'always-busy' || defenseValue === 'always-free') {
                    timeDefense = defenseValue;
                }
                // Remove defense from content
                taskContent = taskContent.replace(defenseMatch[0], '');
            }
            
            // Extract allowed time windows
            let allowedTimeWindows: string[] | undefined;
            const windowsMatch = windowsPattern.exec(taskContent);
            if (windowsMatch) {
                allowedTimeWindows = windowsMatch[1].split(',').map(w => w.trim());
                // Remove windows from content
                taskContent = taskContent.replace(windowsMatch[0], '');
            }
            
            // Extract tags
            const tags: string[] = [];
            let tagMatch;
            // Reset the tagsPattern regex lastIndex to ensure it starts from the beginning
            tagsPattern.lastIndex = 0;
            while ((tagMatch = tagsPattern.exec(taskContent)) !== null) {
                tags.push(tagMatch[1]);
            }
            
            // Remove tags from content
            taskContent = taskContent.replace(/#[a-zA-Z0-9_-]+/g, '');
            
            // Extract recurring info
            let recurring = false;
            let recurrenceRule: string | undefined;
            const recurringMatch = recurringPattern.exec(taskContent);
            if (recurringMatch) {
                recurring = true;
                if (recurringMatch[1]) {
                    recurrenceRule = recurringMatch[1].trim();
                }
                // Remove recurring from content
                taskContent = taskContent.replace(recurringMatch[0], '');
            }
            
            // Clean up content (remove extra spaces)
            taskContent = taskContent.trim();
            
            // Create the task object
            const task: Task = {
                id: taskId,
                title: taskContent,
                description: undefined,
                creationDate: new Date(),
                status: isCompleted ? 'completed' : 'next-up',
                priority: priority,
                tags: tags,
                sourcePath: sourcePath,
                projectId: '', // Will be set based on context
                dueDate: dueDate,
                completed: isCompleted,
                recurring: recurring,
                recurrenceRule: recurrenceRule,
                estimatedDuration: estimatedDuration,
                splitUpBlock: splitUpBlock,
                timeDefense: timeDefense,
                allowedTimeWindows: allowedTimeWindows
            };
            
            tasks.push(task);
        }
        
        return tasks;
    }
    
    // ----- Utility methods -----
    
    /**
     * Format a date as YYYY-MM-DD
     * @param date Date to format
     * @returns Formatted date string
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }
    
    /**
     * Format a time as HH:MM
     * @param date Date to extract time from
     * @returns Formatted time string
     */
    private formatTime(date: Date): string {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    
    /**
     * Parse a date string
     * @param dateStr Date string (YYYY-MM-DD)
     * @returns Date object or null if invalid
     */
    private parseDate(dateStr: string | string[] | undefined): Date | null {
        if (!dateStr) return null;
        
        // Ensure we're working with a string
        const dateString = Array.isArray(dateStr) ? dateStr[0] : String(dateStr);
        
        try {
            // For YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return new Date(dateString);
            }
            
            // Try to parse with Date constructor
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return null;
            }
            
            return date;
        } catch (error) {
            console.error(`Error parsing date ${dateString}:`, error);
            return null;
        }
    }
    
    /**
     * Parse tags from frontmatter
     * @param tagsValue Tags value from frontmatter
     * @returns Array of tags
     */
    private parseTags(tagsValue: any): string[] {
        if (!tagsValue) return [];
        
        if (typeof tagsValue === 'string') {
            // Remove brackets and split by commas
            return tagsValue.replace(/[\[\]]/g, '').split(',').map(t => t.trim());
        }
        
        if (Array.isArray(tagsValue)) {
            return tagsValue.map(t => String(t).trim());
        }
        
        return [];
    }
    
    /**
     * Extract YAML frontmatter from content
     * @param content Markdown content
     * @returns Parsed frontmatter object or null if none found
     */
    private extractFrontmatter(content: string): Record<string, any> | null {
        // Regular expression to extract YAML frontmatter
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        
        const match = frontmatterRegex.exec(content);
        if (!match) return null;
        
        const yamlContent = match[1];
        
        // Parse YAML content
        const frontmatter: Record<string, any> = {};
        
        // Simple YAML parser (for key-value pairs only)
        const lines = yamlContent.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            
            // Handle arrays
            if (value.startsWith('[') && value.endsWith(']')) {
                // Parse array values and assign directly to frontmatter
                frontmatter[key] = value.slice(1, -1).split(',').map(item => item.trim());
            } else {
                // Assign string value normally
                frontmatter[key] = value;
            }
        }
        
        return frontmatter;
    }
    
    /**
     * Extract title from content (first heading)
     * @param content Markdown content
     * @returns The title or null if none found
     */
    private extractTitle(content: string): string | null {
        // Regular expression to extract the first heading
        const titleRegex = /^#\s+(.*)/m;
        
        const match = titleRegex.exec(content);
        if (!match) return null;
        
        return match[1].trim();
    }
    
    /**
     * Extract description from content (text between title and next heading)
     * @param content Markdown content
     * @returns The description or null if none found
     */
    private extractDescription(content: string): string | undefined {
        // Remove frontmatter
        const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
        
        // Find first heading
        const firstHeadingIndex = contentWithoutFrontmatter.indexOf('# ');
        if (firstHeadingIndex === -1) return undefined;
        
        // Find the end of the first line
        const firstLineEnd = contentWithoutFrontmatter.indexOf('\n', firstHeadingIndex);
        if (firstLineEnd === -1) return undefined;
        
        // Find the next heading
        const nextHeadingIndex = contentWithoutFrontmatter.indexOf('\n#', firstLineEnd);
        
        // Extract text between first heading and next heading (or end of content)
        let descriptionEnd = nextHeadingIndex !== -1 ? nextHeadingIndex : contentWithoutFrontmatter.length;
        let description = contentWithoutFrontmatter.slice(firstLineEnd + 1, descriptionEnd).trim();
        
        // If description is empty, return undefined
        if (!description) return undefined;
        
        return description;
    }
    
    /**
     * Check if a file exists
     * @param path File path
     * @returns Whether the file exists
     */
    private async fileExists(path: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            return file instanceof TFile;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if a folder exists
     * @param path Folder path
     * @returns Whether the folder exists
     */
    private async folderExists(path: string): Promise<boolean> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            return folder !== null && !(folder instanceof TFile);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get a file by path
     * @param path File path
     * @returns The file
     */
    private getFile(path: string): TFile {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) {
            throw new Error(`File not found: ${path}`);
        }
        return file;
    }
    
    /**
     * Ensure a folder exists, creating it if necessary
     * @param path Folder path
     */
    private async ensureFolderExists(path: string): Promise<void> {
        if (await this.folderExists(path)) return;
        
        // Create folder
        await this.vault.createFolder(path);
    }
    
    /**
     * Get all files in a folder
     * @param path Folder path
     * @returns Array of files
     */
    private async getFilesInFolder(path: string): Promise<TFile[]> {
        // Get all files in the vault
        const allFiles = this.vault.getFiles();
        
        // Filter files in the specified folder
        return allFiles.filter(file => file.path.startsWith(path + '/'));
    }
    
    /**
     * Generate a filename from a template
     * @param template Filename template
     * @param data Data for template variables
     * @returns Generated filename
     */
    private generateFilename(template: string, data: Record<string, any>): string {
        // Replace variables in template
        let filename = template;
        
        for (const [key, value] of Object.entries(data)) {
            filename = filename.replace(`\${${key}}`, String(value));
        }
        
        return filename;
    }
    
    /**
     * Convert OKR status to user-friendly label
     * @param status OKR status
     * @returns User-friendly label
     */
    private statusToLabel(status: OkrStatus): string {
        switch (status) {
            case 'future': return 'Future';
            case 'next-up': return 'Next Up';
            case 'in-progress': return 'In Progress';
            case 'waiting-on': return 'Waiting On';
            case 'validating': return 'Validating';
            case 'completed': return 'Completed';
            case 'canceled': return 'Canceled';
            default: return 'Unknown';
        }
    }
    
    /**
     * Escape special characters in a string for use in a regular expression
     * @param string String to escape
     * @returns Escaped string
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

        /**
     * Sanitize a string for use in a filename
     * @param input String to sanitize
     * @returns Sanitized string
     */
    private sanitizeFilename(input: string): string {
        // Remove invalid characters and replace spaces with hyphens
        return input.replace(/[\\/:*?"<>|]/g, '')
                    .replace(/\s+/g, '-')
                    .substring(0, 50); // Limit length
    }
}