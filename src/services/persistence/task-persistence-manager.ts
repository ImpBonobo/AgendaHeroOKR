import { App, TFile } from 'obsidian';
import { Task, OkrStatus } from '../../models/okr-models';
import { BasePersistenceManager, OkrPersistenceConfig } from './persistence-config';
import { FileSystemHelper } from './file-system-helper';
import { MarkdownParser } from './markdown-parser';

/**
 * Manager responsible for persisting Task entities
 */
export class TaskPersistenceManager extends BasePersistenceManager {
    private fileSystemHelper: FileSystemHelper;
    private markdownParser: MarkdownParser;
    
    constructor(app: App, config: OkrPersistenceConfig, fileSystemHelper: FileSystemHelper, markdownParser: MarkdownParser) {
        super(app, config);
        this.fileSystemHelper = fileSystemHelper;
        this.markdownParser = markdownParser;
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
            if (!await this.fileSystemHelper.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.fileSystemHelper.getFile(filePath);
            const content = await this.app.vault.read(file);
            
            // Generate task markdown
            const taskMarkdown = this.generateTaskMarkdown(task);
            
            // Append task to file content
            // This is a simple implementation that just appends the task at the end
            // A more advanced implementation might insert it in a specific section
            const newContent = content + '\n' + taskMarkdown;
            
            // Update file
            await this.app.vault.modify(file, newContent);
            
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
            if (!await this.fileSystemHelper.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.fileSystemHelper.getFile(filePath);
            const content = await this.app.vault.read(file);
            
            // Split content into lines
            const lines = content.split('\n');
            
            // Find the line with this task
            const taskIdRegex = new RegExp(`\\[.*\\].*${this.fileSystemHelper.escapeRegExp(task.id)}`);
            const taskLineIndex = lines.findIndex(line => taskIdRegex.test(line));
            
            if (taskLineIndex === -1) {
                return false;
            }
            
            // Generate updated task markdown
            const updatedTaskMarkdown = this.generateTaskMarkdown(task);
            
            // Replace the line
            lines[taskLineIndex] = updatedTaskMarkdown;
            
            // Update file
            await this.app.vault.modify(file, lines.join('\n'));
            
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
            if (!await this.fileSystemHelper.fileExists(filePath)) {
                return false;
            }
            
            // Get file content
            const file = this.fileSystemHelper.getFile(filePath);
            const content = await this.app.vault.read(file);
            
            // Split content into lines
            const lines = content.split('\n');
            
            // Find the line with this task
            const taskIdRegex = new RegExp(`\\[.*\\].*${this.fileSystemHelper.escapeRegExp(taskId)}`);
            const taskLineIndex = lines.findIndex(line => taskIdRegex.test(line));
            
            if (taskLineIndex === -1) {
                return false;
            }
            
            // Remove the line
            lines.splice(taskLineIndex, 1);
            
            // Update file
            await this.app.vault.modify(file, lines.join('\n'));
            
            return true;
        } catch (error) {
            console.error('Error removing task from file:', error);
            return false;
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
            if (!await this.fileSystemHelper.fileExists(filePath)) {
                return [];
            }
            
            // Get file content
            const file = this.fileSystemHelper.getFile(filePath);
            const content = await this.app.vault.read(file);
            
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
            if (!await this.fileSystemHelper.folderExists(folderPath)) {
                return [];
            }
            
            // Get files in folder
            const files = await this.fileSystemHelper.getFilesInFolder(folderPath);
            
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
    
    /**
     * Generate markdown for a task
     * @param task The task
     * @returns Markdown content for the task
     */
    generateTaskMarkdown(task: Task): string {
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
            taskMarkdown += ` @due(${this.markdownParser.formatDate(task.dueDate)})`;
            
            // Add time if present
            if (task.dueDate.getHours() !== 0 || task.dueDate.getMinutes() !== 0) {
                taskMarkdown += ` @time(${this.markdownParser.formatTime(task.dueDate)})`;
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
     * Parse tasks from markdown content
     * @param content Markdown content
     * @param sourcePath Source file path
     * @returns Array of parsed tasks
     */
    parseTasksFromContent(content: string, sourcePath: string): Task[] {
        const tasks: Task[] = [];
        
        // Split content into lines
        const lines = content.split('\n');
        
        // Regular expression for task lines
        const taskRegex = /^-\s*\[([ xX])\]\s*(.*)/;
        
        // Additional patterns for task attributes
        const idPattern = /#id:([a-zA-Z0-9_-]+)(?=\s|$)/;
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
                dueDate = this.markdownParser.parseDate(dueDateMatch[1]);
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
                // Skip the ID tag
                if (tagMatch[1].startsWith('id:')) continue;
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
}