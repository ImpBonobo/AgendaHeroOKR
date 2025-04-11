/**
 * Task Operations Service
 * 
 * This service is responsible for CRUD operations on Tasks,
 * including importing tasks from Markdown files.
 */

import { App, Notice, TFile } from 'obsidian';
import { Task } from '../models/okr-models';
import { OkrDataManager } from './okr-data-manager';
import { OkrPersistenceService } from './okr-persistence-service';
import { OkrRelationshipManager } from './okr-relationship-manager';
import { TimeBlockManager } from './time-block-manager';
import { TimeBlockInfo } from '../utils/time-manager';

/**
 * Handles CRUD operations for Tasks and task-related functionalities
 */
export class TaskOperationsService {
    private app: App;
    private dataManager: OkrDataManager;
    private persistenceService: OkrPersistenceService;
    private relationshipManager: OkrRelationshipManager;
    private timeBlockManager: TimeBlockManager;
    
    // Static counter for task IDs
    private static taskCounter = 1;
    
    constructor(
        app: App, 
        dataManager: OkrDataManager,
        persistenceService: OkrPersistenceService,
        relationshipManager: OkrRelationshipManager,
        timeBlockManager: TimeBlockManager
    ) {
        this.app = app;
        this.dataManager = dataManager;
        this.persistenceService = persistenceService;
        this.relationshipManager = relationshipManager;
        this.timeBlockManager = timeBlockManager;
        
        console.log('Task Operations Service initialized');
    }
    
    /**
     * Load all tasks from projects
     */
    async loadAllTasks(): Promise<void> {
        console.log("Starting loadAllTasks");
        
        // Get existing tasks and create a map for quick lookup
        const existingTasks = this.dataManager.getTasks();
        const existingTasksMap = new Map(existingTasks.map(task => [task.id, task]));
        
        // Prepare a new task array
        const newTasks: Task[] = [];
        
        // Load tasks from projects
        const projects = this.dataManager.getProjects();
        for (const project of projects) {
            if (project.sourceFile) {
                const projectTasks = await this.persistenceService.loadTasksFromFile(project.sourceFile.path);
                
                // Set project ID for each task
                projectTasks.forEach(task => {
                    task.projectId = project.id;
                    
                    // Check if this task already exists
                    const existingTask = existingTasksMap.get(task.id);
                    if (existingTask) {
                        // Merge properties while keeping existing task state
                        Object.assign(existingTask, task);
                        newTasks.push(existingTask);
                    } else {
                        newTasks.push(task);
                    }
                });
            }
        }
        
        // Load tasks from sprints
        const sprints = this.dataManager.getSprints();
        for (const sprint of sprints) {
            const sprintTasks = sprint.tasks || [];
            
            // Check which tasks are not already loaded
            for (const sprintTask of sprintTasks) {
                if (!newTasks.some(task => task.id === sprintTask.id)) {
                    // Check if this task already exists in existing tasks
                    const existingTask = existingTasksMap.get(sprintTask.id);
                    if (existingTask) {
                        newTasks.push(existingTask);
                    } else {
                        newTasks.push(sprintTask);
                    }
                }
            }
        }
        
        // Add any existing tasks that might not be in projects or sprints
        for (const existingTask of existingTasks) {
            if (!newTasks.some(task => task.id === existingTask.id)) {
                newTasks.push(existingTask);
            }
        }
        
        // Update tasks in the data manager
        this.dataManager.setTasks(newTasks);
        
        console.log("After loadAllTasks. Current tasks:", newTasks.length);
        
        // Schedule tasks with estimated duration
        this.setupTaskScheduling();
        
        // Notify of updates
        this.dataManager.notifyUpdates();
    }
    
    /**
     * Set up scheduling for tasks with estimated duration
     */
    private setupTaskScheduling(): void {
        // Schedule unscheduled tasks that have estimated duration
        const tasksToSchedule = this.dataManager.getTasks().filter(task => 
            task.estimatedDuration && 
            task.dueDate &&
            !task.completed &&
            !this.timeBlockManager.hasScheduledBlocks(task.id)
        );
        
        // Schedule each task
        for (const task of tasksToSchedule) {
            this.scheduleTask(task);
        }
    }
    
    /**
     * Schedule a task using the time block manager
     * @param task The task to schedule
     * @returns Result object with success status and scheduled time blocks
     */
    scheduleTask(task: Task): { success: boolean, timeBlocks: TimeBlockInfo[] } {
        // Check if task has required scheduling properties
        if (!task.estimatedDuration || !task.dueDate) {
            return { success: false, timeBlocks: [] };
        }
        
        // Schedule the task
        const blocks = this.timeBlockManager.scheduleTask(task);
        
        // If blocks were created, add them to the data manager
        if (blocks.length > 0) {
            this.dataManager.addTimeBlocks(blocks);
            return { success: true, timeBlocks: blocks };
        }
        
        return { success: false, timeBlocks: [] };
    }
    
    /**
     * Import tasks from markdown files
     * This scans your vault for markdown task syntax and adds them to the system
     */
    async importMarkdownTasks(): Promise<void> {
        try {
            // Get all markdown files
            const markdownFiles = this.app.vault.getMarkdownFiles();
            let discoveredProjects = 0;
            let discoveredTasks = 0;
            
            // Skip files that are already part of the OKR system
            const okrFolders = [
                this.persistenceService.getConfig().objectivesFolder,
                this.persistenceService.getConfig().keyResultsFolder,
                this.persistenceService.getConfig().projectsFolder,
                this.persistenceService.getConfig().sprintsFolder
            ];
            
            // Get the project tag from settings (you need to add this to your settings)
            // For now, we'll use a default tag
            const projectTag = '#project';
            
            // First pass: discover projects
            for (const file of markdownFiles) {
                // Skip OKR system files
                if (okrFolders.some(folder => file.path.startsWith(folder))) {
                    continue;
                }
                
                const content = await this.app.vault.read(file);
                
                // Check if file has project tag
                if (content.includes(projectTag)) {
                    // Extract title
                    const titleMatch = /^#\s+(.*)/m.exec(content);
                    if (!titleMatch) continue;
                    
                    const projectTitle = titleMatch[1].trim();
                    
                    // Check if project already exists
                    const existingProject = this.dataManager.getProjects().find(p => 
                        p.title === projectTitle && 
                        p.sourcePath === file.path
                    );
                    
                    if (!existingProject) {
                        // Find or create a default key result
                        let defaultKeyResult = this.dataManager.getKeyResults().find(kr => kr.title === "External Tasks");
                        
                        if (!defaultKeyResult) {
                            // Find or create a default objective
                            let defaultObjective = this.dataManager.getObjectives().find(obj => obj.title === "External Content");
                            
                            if (!defaultObjective) {
                                // Create a new default objective
                                defaultObjective = await this.createDefaultObjective();
                                if (!defaultObjective) {
                                    console.error("Failed to create default objective");
                                    continue; // Skip this file
                                }
                            }
                            
                            // Create a new default key result
                            defaultKeyResult = await this.createDefaultKeyResult(defaultObjective.id);
                            if (!defaultKeyResult) {
                                console.error("Failed to create default key result");
                                continue; // Skip this file
                            }
                        }
                        
                        // Create project
                        const project = {
                            title: projectTitle,
                            description: "Externally discovered project",
                            keyResultId: defaultKeyResult.id,
                            status: "in-progress" as const,
                            startDate: defaultKeyResult.startDate,
                            endDate: defaultKeyResult.endDate,
                            progress: 0,
                            priority: 3,
                            tags: [],
                            sourcePath: file.path // Add required sourcePath property
                        } as any;
                        
                        // Use the OkrOperationsService to create the project
                        // This is a bit of a circular dependency, so we'll use a workaround
                        const newProject = await this.persistenceService.saveProject(project);
                        project.id = this.generateId('prj');
                        project.creationDate = new Date();
                        project.sourcePath = file.path;
                        project.tasks = [];
                        
                        // Add to data manager
                        this.dataManager.addProject(project);
                        
                        discoveredProjects++;
                        
                        // Second pass: load tasks from this project
                        const tasks = await this.persistenceService.loadTasksFromFile(file.path);

                        for (const task of tasks) {
                            // Skip tasks that already exist
                            const existingTask = this.dataManager.getTasks().find(t => 
                                t.title === task.title && 
                                t.sourcePath === file.path
                            );
                            
                            if (!existingTask) {
                                task.projectId = project.id;
                                
                                // Set autoSchedule property for the task to appear in the calendar
                                if (task.dueDate) {
                                    task.autoSchedule = true;
                                    
                                    // Set estimatedDuration if not present
                                    if (!task.estimatedDuration) {
                                        task.estimatedDuration = 60; // Default to 60 minutes
                                    }
                                }
                                
                                // Add to data manager
                                this.dataManager.addTask(task);
                                
                                // Link to project
                                this.relationshipManager.addTaskToProject(task, project.id);
                                
                                // Schedule task if it has a due date for calendar view
                                if (task.dueDate && task.estimatedDuration && task.autoSchedule) {
                                    this.scheduleTask(task);
                                }
                                
                                discoveredTasks++;
                            }
                        }
                    }
                }
            }
            
            if (discoveredProjects > 0 || discoveredTasks > 0) {
                new Notice(`Discovered ${discoveredProjects} projects and ${discoveredTasks} tasks from markdown files`);
            }
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
        } catch (error) {
            console.error('Error discovering projects and tasks:', error);
            new Notice('Error discovering projects and tasks');
        }
    }
    
    /**
     * Create a new task
     * @param task The task to create
     * @param filePath Optional file path to add the task to
     * @returns The created task
     */
    async createTask(task: Omit<Task, 'id' | 'creationDate'>, filePath?: string): Promise<Task> {
        console.log("Creating new task:", task.title, "Current tasks:", this.dataManager.getTasks().length);
        
        // Generate ID if not provided
        const newTask: Task = {
            ...task,
            id: this.generateId('task'),
            creationDate: new Date()
        };
        
        // Determine file path if not provided
        let targetFilePath = filePath;

        if (!targetFilePath && newTask.projectId) {
            const project = this.dataManager.getProject(newTask.projectId);
            if (project) {
                targetFilePath = project.sourcePath;
            }
        }

        // If still no file path and due date is set, use daily note for that date
        if (!targetFilePath && newTask.dueDate) {
            // Format date as YYYY-MM-DD for daily note
            const formattedDate = this.formatDateForDailyNote(newTask.dueDate);
            targetFilePath = `Daily/${formattedDate}.md`;
            
            // Create daily note folder if it doesn't exist
            await this.ensureFolderExists('Daily');
        }

        // If still no file path, use a default tasks file
        if (!targetFilePath) {
            targetFilePath = 'Tasks.md';
        }

        // Create file if it doesn't exist
        const file = this.app.vault.getAbstractFileByPath(targetFilePath);
        if (!file) {
            // If it's a daily note, use a template
            if (targetFilePath.startsWith('Daily/')) {
                await this.app.vault.create(
                    targetFilePath, 
                    `# Daily Note ${this.formatDateForDisplay(newTask.dueDate || new Date())}\n\n## Tasks\n\n`
                );
            } else {
                await this.app.vault.create(targetFilePath, '# Tasks\n\n');
            }
        }
        
        // Add task to file
        if (targetFilePath) {
            const success = await this.persistenceService.addTaskToFile(newTask, targetFilePath);
            if (!success) {
                throw new Error(`Failed to add task to ${targetFilePath}`);
            }
            
            newTask.sourcePath = targetFilePath;
        }
        
        // Add to data manager
        this.dataManager.addTask(newTask);
        
        // Link to project
        if (newTask.projectId) {
            this.relationshipManager.addTaskToProject(newTask, newTask.projectId);
        }
        
        // Schedule if it has estimated duration and due date
        if (newTask.estimatedDuration && newTask.dueDate) {
            this.scheduleTask(newTask);
        }
        
        // Recalculate progress
        this.relationshipManager.recalculateProgress();
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return newTask;
    }
    
    /**
     * Update a task
     * @param task The updated task
     * @returns Whether the update was successful
     */
    async updateTask(task: Task): Promise<boolean> {
        // Find the current task
        const currentTask = this.dataManager.getTask(task.id);
        if (!currentTask) return false;
        
        // Check if due date changed
        const dueChanged = currentTask.dueDate?.getTime() !== task.dueDate?.getTime();
        const estimatedDurationChanged = currentTask.estimatedDuration !== task.estimatedDuration;
        const completedChanged = currentTask.completed !== task.completed;
        
        // Update in data manager
        const success = this.dataManager.updateTask(task);
        if (!success) return false;
        
        // Save to file
        try {
            await this.persistenceService.updateTaskInFile(task, task.sourcePath);
            
            // If due date or estimated duration changed, reschedule
            if ((dueChanged || estimatedDurationChanged) && task.estimatedDuration && task.dueDate) {
                // Remove existing blocks for this task
                this.timeBlockManager.removeScheduledBlocks(task.id);
                this.dataManager.removeTimeBlocksForTask(task.id);
                
                // Reschedule
                this.scheduleTask(task);
            }
            
            // If completed changed, update time blocks
            if (completedChanged && task.completed) {
                const taskBlocks = this.dataManager.getTimeBlocksForTask(task.id);
                for (const block of taskBlocks) {
                    this.timeBlockManager.markBlockCompleted(block.id);
                }
            }
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            return false;
        }
    }
    
    /**
     * Delete a task
     * @param id ID of the task to delete
     * @returns Whether the deletion was successful
     */
    async deleteTask(id: string): Promise<boolean> {
        // Find the task
        const task = this.dataManager.getTask(id);
        if (!task) return false;
        
        // Remove from project
        if (task.projectId) {
            this.relationshipManager.removeTaskFromProject(id, task.projectId);
        }
        
        // Remove from data manager
        this.dataManager.removeTask(id);
        
        // Remove from file
        try {
            await this.persistenceService.removeTaskFromFile(id, task.sourcePath);
        } catch (error) {
            console.error('Error removing task from file:', error);
            return false;
        }
        
        // Remove time blocks
        this.timeBlockManager.removeScheduledBlocks(id);
        this.dataManager.removeTimeBlocksForTask(id);
        
        // Recalculate progress
        this.relationshipManager.recalculateProgress();
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return true;
    }
    
    /**
     * Mark a task as completed
     * @param id ID of the task to complete
     * @returns Whether the operation was successful
     */
    async completeTask(id: string): Promise<boolean> {
        // Find the task
        const task = this.dataManager.getTask(id);
        if (!task) return false;
        
        // Update the task
        task.completed = true;
        task.status = 'completed';
        
        // Update in file
        try {
            await this.persistenceService.updateTaskInFile(task, task.sourcePath);
            
            // Mark time blocks as completed
            const taskBlocks = this.dataManager.getTimeBlocksForTask(id);
            for (const block of taskBlocks) {
                this.timeBlockManager.markBlockCompleted(block.id);
            }
            
            // Update in data manager
            this.dataManager.updateTask(task);
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error completing task:', error);
            return false;
        }
    }
    
    /**
     * Handle file change event
     * @param file The modified file
     */
    async handleFileChange(file: TFile): Promise<void> {
        // Check if this file is relevant to our OKR system
        const okrFolders = [
            this.persistenceService.getConfig().objectivesFolder,
            this.persistenceService.getConfig().keyResultsFolder,
            this.persistenceService.getConfig().projectsFolder,
            this.persistenceService.getConfig().sprintsFolder
        ];
        
        const isOkrFile = okrFolders.some(folder => file.path.startsWith(folder));
        const hasTaskInSystem = this.dataManager.getTasks().some(task => task.sourcePath === file.path);
        
        if (isOkrFile || hasTaskInSystem) {
            // If it's a task file, reload tasks from that file
            if (hasTaskInSystem) {
                // Load tasks from the file
                const updatedTasks = await this.persistenceService.loadTasksFromFile(file.path);
                
                // Get existing tasks from that file
                const existingTasks = this.dataManager.getTasks().filter(task => task.sourcePath === file.path);
                
                // For each existing task, check if it still exists
                for (const existingTask of existingTasks) {
                    const stillExists = updatedTasks.some(t => t.id === existingTask.id);
                    
                    if (!stillExists) {
                        // Task was removed from the file
                        await this.deleteTask(existingTask.id);
                    }
                }
                
                // For each updated task, update or add it
                for (const updatedTask of updatedTasks) {
                    const existingTask = this.dataManager.getTask(updatedTask.id);
                    
                    if (existingTask) {
                        // Preserve some properties
                        updatedTask.projectId = existingTask.projectId;
                        
                        // Update the task
                        await this.updateTask(updatedTask);
                    } else {
                        // New task
                        await this.createTask(updatedTask, file.path);
                    }
                }
            }
            
            // Notify of updates
            this.dataManager.notifyUpdates();
        }
    }
    
    /**
     * Handle file deletion event
     * @param file The deleted file
     */
    async handleFileDelete(file: TFile): Promise<void> {
        // Check if any tasks were from this file
        const hadTasksFromFile = this.dataManager.getTasks().some(task => task.sourcePath === file.path);
        
        if (hadTasksFromFile) {
            // Remove tasks that belonged to this file
            const tasksToRemove = this.dataManager.getTasks().filter(task => task.sourcePath === file.path);
            
            for (const task of tasksToRemove) {
                // Remove from project
                if (task.projectId) {
                    this.relationshipManager.removeTaskFromProject(task.id, task.projectId);
                }
                
                // Remove from data manager
                this.dataManager.removeTask(task.id);
                
                // Remove time blocks
                this.timeBlockManager.removeScheduledBlocks(task.id);
                this.dataManager.removeTimeBlocksForTask(task.id);
            }
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
        }
    }
    
    // Helper methods
    
    /**
     * Create a default objective for imported content
     */
    private async createDefaultObjective(): Promise<any> {
        const objective = {
            title: "External Content",
            description: "Tasks and content imported from external sources",
            status: "in-progress" as const,
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            progress: 0,
            priority: 3,
            tags: [],
            id: this.generateId('obj'),
            creationDate: new Date(),
            keyResults: [],
            sourcePath: "" // Add required sourcePath property
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveObjective(objective);
        objective.sourcePath = filePath;
        
        // Add to data manager
        this.dataManager.addObjective(objective);
        
        return objective;
    }
    
    /**
     * Create a default key result for imported content
     */
    private async createDefaultKeyResult(objectiveId: string): Promise<any> {
        const objective = this.dataManager.getObjective(objectiveId);
        if (!objective) return null;
        
        const keyResult = {
            title: "External Tasks",
            description: "Tasks imported from markdown files",
            objectiveId: objectiveId,
            status: "in-progress" as const,
            startDate: objective.startDate,
            endDate: objective.endDate,
            progress: 0,
            priority: 3,
            tags: [],
            id: this.generateId('kr'),
            creationDate: new Date(),
            projects: [],
            sourcePath: "" // Add required sourcePath property
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveKeyResult(keyResult);
        keyResult.sourcePath = filePath;
        
        // Add to data manager
        this.dataManager.addKeyResult(keyResult);
        
        return keyResult;
    }
    
    /**
     * Generate a unique ID for a task
     * @returns Generated ID
     */
    private generateId(prefix: string): string {
        // Use the task counter
        const counter = TaskOperationsService.taskCounter++;
        
        // Add year to ID for additional context
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${counter}`;
    }
    
    /**
     * Format date for daily note filename
     * @param date The date to format
     * @returns Formatted date string (YYYY-MM-DD)
     */
    private formatDateForDailyNote(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Format date for display
     * @param date The date to format
     * @returns Formatted date string for display
     */
    private formatDateForDisplay(date: Date): string {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Ensure a folder exists
     * @param folderPath Path to the folder
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
        }
    }
}