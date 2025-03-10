/**
 * OKR Service
 * 
 * This service acts as an integration layer between the OKR data model,
 * persistence service, and UI components.
 */

import { App, TFile, Notice } from 'obsidian';
import { 
    OkrElement, 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    Sprint,
    calculateObjectiveProgress,
    calculateKeyResultProgress,
    calculateProjectProgress
} from '../models/okr-models';
import { OkrPersistenceService } from './okr-persistence-service';
import { TimeManager, TaskScheduleResult } from '../utils/time-manager';
import { TimeBlockInfo } from '../utils/time-manager';

/**
 * Handles the integration between the data model, persistence, and UI components
 */
export class OkrService {
    private app: App;
    private persistenceService: OkrPersistenceService;
    private timeManager: TimeManager;
    
    // Data stores
    private objectives: Objective[] = [];
    private keyResults: KeyResult[] = [];
    private projects: Project[] = [];
    private tasks: Task[] = [];
    private sprints: Sprint[] = [];
    private timeBlocks: TimeBlockInfo[] = [];
    
    // Event callbacks
    private updateCallbacks: Array<() => void> = [];
    
    constructor(app: App) {
        this.app = app;
        this.persistenceService = new OkrPersistenceService(app);
        this.timeManager = new TimeManager();
    }
    
    /**
     * Initialize the service by loading data
     */
    async initialize(): Promise<void> {
        try {
            await this.loadAll();
            await this.importMarkdownTasks();
            
            // Setup file watcher to update views when files change
            this.setupFileWatcher();
            
            console.log('OKR Service initialized');
        } catch (error) {
            console.error('Error initializing OKR Service:', error);
            new Notice('Error initializing OKR Service');
        }
    }
    
    /**
     * Setup a watcher for file changes
     */
    private setupFileWatcher(): void {
        // Watch for file modifications
        this.app.vault.on('modify', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileChange(file);
            }
        });
        
        // Watch for file deletions
        this.app.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileDelete(file);
            }
        });
    }
    
    /**
     * Handle file change event
     * @param file The modified file
     */
    private async handleFileChange(file: TFile): Promise<void> {
        // Check if this file is relevant to our OKR system
        const okrFolders = [
            this.persistenceService.getConfig().objectivesFolder,
            this.persistenceService.getConfig().keyResultsFolder,
            this.persistenceService.getConfig().projectsFolder,
            this.persistenceService.getConfig().sprintsFolder
        ];
        
        const isOkrFile = okrFolders.some(folder => file.path.startsWith(folder));
        const hasTaskInSystem = this.tasks.some(task => task.sourcePath === file.path);
        
        if (isOkrFile || hasTaskInSystem) {
            // Refresh all data since files have changed
            await this.loadAll();
            this.notifyUpdates();
        }
    }
    
    /**
     * Handle file deletion event
     * @param file The deleted file
     */
    private async handleFileDelete(file: TFile): Promise<void> {
        // Check if any tasks were from this file
        const hadTasksFromFile = this.tasks.some(task => task.sourcePath === file.path);
        
        if (hadTasksFromFile) {
            // Remove tasks that belonged to this file
            this.tasks = this.tasks.filter(task => task.sourcePath !== file.path);
            
            // Remove references from projects
            for (const project of this.projects) {
                if (project.tasks) {
                    project.tasks = project.tasks.filter(task => task.sourcePath !== file.path);
                }
            }
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
        }
        
        // Check if this was an OKR file
        if (file.path.includes(this.persistenceService.getConfig().objectivesFolder)) {
            // Remove objectives from this file
            this.objectives = this.objectives.filter(obj => obj.sourceFile?.path !== file.path);
            await this.loadAll(); // Reload all data to maintain consistency
        } else if (file.path.includes(this.persistenceService.getConfig().keyResultsFolder)) {
            // Remove key results from this file
            this.keyResults = this.keyResults.filter(kr => kr.sourceFile?.path !== file.path);
            await this.loadAll(); // Reload all data to maintain consistency
        } else if (file.path.includes(this.persistenceService.getConfig().projectsFolder)) {
            // Remove projects from this file
            this.projects = this.projects.filter(p => p.sourceFile?.path !== file.path);
            await this.loadAll(); // Reload all data to maintain consistency
        } else if (file.path.includes(this.persistenceService.getConfig().sprintsFolder)) {
            // For sprints, we need to check the path differently since they don't have sourceFile
            // We can use the filename pattern from the configuration
            const sprintConfig = this.persistenceService.getConfig();
            const filename = file.basename;
            this.sprints = this.sprints.filter(s => !filename.includes(s.id));
            await this.loadAll(); // Reload all data to maintain consistency
        }
    }
    
    /**
     * Register a callback for data updates
     * @param callback Function to call when data changes
     */
    registerUpdateCallback(callback: () => void): void {
        this.updateCallbacks.push(callback);
    }
    
    /**
 * Notify all registered callbacks of data updates
 */
    private notifyUpdates(): void {
        // Ensure timeblocks are updated before notifying views
        this.setupTimeBlocks();
        
        // Use setTimeout to ensure the notification happens after the current execution context
        // This prevents issues with callbacks being called during in-progress updates
        setTimeout(() => {
            this.updateCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('Error in update callback:', error);
                }
            });
        }, 0);
    }
    
    /**
     * Load all OKR data
     */
    async loadAll(): Promise<void> {
        console.log("Starting loadAll. Current tasks:", this.tasks.length);
        
        // Sichern der aktuellen Tasks
        const existingTasks = [...this.tasks];
        const existingTasksMap = new Map(existingTasks.map(task => [task.id, task]));
        
        // Load objectives
        this.objectives = await this.persistenceService.loadObjectives();
        
        // Load key results
        this.keyResults = await this.persistenceService.loadKeyResults();
        
        // Load projects
        this.projects = await this.persistenceService.loadProjects();
        
        // Load sprints
        this.sprints = await this.persistenceService.loadSprints();
        
        // Prepare a new task array
        const newTasks: Task[] = [];
        
        // Load tasks from projects
        for (const project of this.projects) {
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
        for (const sprint of this.sprints) {
            const sprintTasks = sprint.tasks;
            
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
        
        // Update tasks
        this.tasks = newTasks;
        
        console.log("After loadAll. Current tasks:", this.tasks.length);
        
        // Establish relationships
        this.setupRelationships();
        
        // Load time blocks from tasks with estimatedDuration
        this.setupTimeBlocks();
        
        // Notify listeners
        this.notifyUpdates();
    }

    /**
 * Import tasks from markdown files
 * This scans your vault for markdown task syntax and adds them to the system
 */
/**
 * Discovers projects and tasks in markdown files
 * This scans your vault for markdown files with specific tags and recognizes them as projects
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
                const existingProject = this.projects.find(p => 
                    p.title === projectTitle && 
                    p.sourcePath === file.path
                );
                
                if (!existingProject) {
                    // Find or create a default key result
                    let defaultKeyResult = this.keyResults.find(kr => kr.title === "External Tasks");
                    
                    if (!defaultKeyResult) {
                        // Find or create a default objective
                        let defaultObjective = this.objectives.find(obj => obj.title === "External Content");
                        
                        if (!defaultObjective) {
                            defaultObjective = await this.createObjective({
                                title: "External Content",
                                description: "Tasks and content imported from external sources",
                                status: "in-progress",
                                startDate: new Date(),
                                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                                progress: 0,
                                priority: 3,
                                tags: []
                            } as any);
                        }
                        
                        defaultKeyResult = await this.createKeyResult({
                            title: "External Tasks",
                            description: "Tasks imported from markdown files",
                            objectiveId: defaultObjective.id,
                            status: "in-progress",
                            startDate: defaultObjective.startDate,
                            endDate: defaultObjective.endDate,
                            progress: 0,
                            priority: 3,
                            tags: []
                        } as any);
                    }
                    
                    // Create project
                    const project = await this.createProject({
                        title: projectTitle,
                        description: "Externally discovered project",
                        keyResultId: defaultKeyResult.id,
                        status: "in-progress",
                        startDate: defaultKeyResult.startDate,
                        endDate: defaultKeyResult.endDate,
                        progress: 0,
                        priority: 3,
                        tags: []
                    } as any);
                    
                    // Set source path
                    project.sourcePath = file.path;
                    
                    discoveredProjects++;
                    
                    // Second pass: load tasks from this project
                    const tasks = await this.persistenceService.loadTasksFromFile(file.path);

                    for (const task of tasks) {
                        // Skip tasks that already exist
                        const existingTask = this.tasks.find(t => 
                            t.title === task.title && 
                            t.sourcePath === file.path
                        );
                        
                        if (!existingTask) {
                            task.projectId = project.id;
                            
                            // Wichtig: Setzen Sie die autoSchedule-Eigenschaft, damit der Task im Kalender erscheint
                            if (task.dueDate) {
                                task.autoSchedule = true;
                                
                                // Setze estimatedDuration wenn nicht vorhanden, damit Task in Kalender erscheint
                                if (!task.estimatedDuration) {
                                    task.estimatedDuration = 60; // Standardmäßig 60 Minuten
                                }
                            }
                            
                            this.tasks.push(task);
                            
                            // Link to project
                            if (!project.tasks) {
                                project.tasks = [];
                            }
                            project.tasks.push(task);
                            
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
        this.recalculateProgress();
        
        // Notify listeners
        this.notifyUpdates();
    } catch (error) {
        console.error('Error discovering projects and tasks:', error);
        new Notice('Error discovering projects and tasks');
    }
}
    
    /**
     * Set up relationships between OKR elements
     */
    private setupRelationships(): void {
        // Link key results to objectives
        for (const keyResult of this.keyResults) {
            const objective = this.objectives.find(obj => obj.id === keyResult.objectiveId);
            if (objective) {
                if (!objective.keyResults) {
                    objective.keyResults = [];
                }
                
                // Add only if not already in the array
                if (!objective.keyResults.some(kr => kr.id === keyResult.id)) {
                    objective.keyResults.push(keyResult);
                }
            }
        }
        
        // Link projects to key results
        for (const project of this.projects) {
            const keyResult = this.keyResults.find(kr => kr.id === project.keyResultId);
            if (keyResult) {
                if (!keyResult.projects) {
                    keyResult.projects = [];
                }
                
                // Add only if not already in the array
                if (!keyResult.projects.some(p => p.id === project.id)) {
                    keyResult.projects.push(project);
                }
            }
        }
        
        // Link tasks to projects
        for (const task of this.tasks) {
            if (task.projectId) {
                const project = this.projects.find(p => p.id === task.projectId);
                if (project) {
                    if (!project.tasks) {
                        project.tasks = [];
                    }
                    
                    // Add only if not already in the array
                    if (!project.tasks.some(t => t.id === task.id)) {
                        project.tasks.push(task);
                    }
                }
            }
        }
        
        // Update progress values
        this.recalculateProgress();
    }
    
    /**
     * Set up time blocks for tasks with estimated duration
     */
    private setupTimeBlocks(): void {
        // Get all scheduled blocks from the time manager
        this.timeBlocks = this.timeManager.getScheduledBlocks();
        
        // Schedule unscheduled tasks that have estimated duration
        const tasksToSchedule = this.tasks.filter(task => 
            task.estimatedDuration && 
            task.dueDate &&
            !task.completed &&
            !this.timeBlocks.some(block => block.taskId === task.id)
        );
        
        // Schedule each task
        for (const task of tasksToSchedule) {
            this.scheduleTask(task);
        }
    }
    
    /**
     * Schedule a task using the time manager
     * @param task The task to schedule
     * @returns Result of the scheduling operation
     */
    scheduleTask(task: Task): TaskScheduleResult {
        if (!task.estimatedDuration || !task.dueDate) {
            return {
                success: false,
                message: 'Task must have estimated duration and due date',
                timeBlocks: [],
                overdue: false,
                unscheduledMinutes: 0
            };
        }
        
        // Schedule the task
        const result = this.timeManager.scheduleTask(task);
        
        // If successful, add the new blocks to our blocks list
        if (result.success || result.timeBlocks.length > 0) {
            this.timeBlocks.push(...result.timeBlocks);
            
            // Notify listeners
            this.notifyUpdates();
        }
        
        return result;
    }
    
    /**
     * Get time blocks for a specific time range
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Time blocks within the specified range
     */
    getTimeBlocksInRange(startDate: Date, endDate: Date): TimeBlockInfo[] {
        return this.timeManager.getBlocksInTimeframe(startDate, endDate);
    }
    
    /**
     * Get time blocks for a specific task
     * @param taskId ID of the task
     * @returns Time blocks for the task
     */
    getTimeBlocksForTask(taskId: string): TimeBlockInfo[] {
        return this.timeBlocks.filter(block => block.taskId === taskId);
    }
    
    /**
     * Mark a time block as completed
     * @param blockId ID of the time block
     * @returns Whether the operation was successful
     */
    markTimeBlockCompleted(blockId: string): boolean {
        const success = this.timeManager.markBlockCompleted(blockId);
        
        if (success) {
            // Check if all blocks for a task are completed
            const block = this.timeBlocks.find(b => b.id === blockId);
            if (block) {
                const taskBlocks = this.timeBlocks.filter(b => b.taskId === block.taskId);
                const allCompleted = taskBlocks.every(b => b.isCompleted);
                
                // If all blocks are completed, mark the task as completed
                if (allCompleted) {
                    const task = this.tasks.find(t => t.id === block.taskId);
                    if (task && !task.completed) {
                        this.completeTask(task.id);
                    }
                }
            }
            
            // Notify listeners
            this.notifyUpdates();
        }
        
        return success;
    }
    
    /**
     * Recalculate progress for all OKR elements
     */
    private recalculateProgress(): void {
        // Calculate project progress based on tasks
        for (const project of this.projects) {
            project.progress = calculateProjectProgress(project);
        }
        
        // Calculate key result progress
        for (const keyResult of this.keyResults) {
            keyResult.progress = calculateKeyResultProgress(keyResult);
        }
        
        // Calculate objective progress
        for (const objective of this.objectives) {
            objective.progress = calculateObjectiveProgress(objective);
        }
    }
    
    // CRUD operations for OKR elements
    
    /**
     * Create a new objective
     * @param objective The objective to create
     * @returns The created objective
     */
    async createObjective(objective: Omit<Objective, 'id' | 'creationDate'>): Promise<Objective> {
        // Generate ID if not provided
        const newObjective: Objective = {
            ...objective,
            id: this.generateId('obj'),
            creationDate: new Date(),
            keyResults: []
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveObjective(newObjective);
        newObjective.sourcePath = filePath;
        
        // Add to list
        this.objectives.push(newObjective);
        
        // Notify listeners
        this.notifyUpdates();
        
        return newObjective;
    }
    
    /**
     * Create a new key result
     * @param keyResult The key result to create
     * @returns The created key result
     */
    async createKeyResult(keyResult: Omit<KeyResult, 'id' | 'creationDate'>): Promise<KeyResult> {
        // Generate ID if not provided
        const newKeyResult: KeyResult = {
            ...keyResult,
            id: this.generateId('kr'),
            creationDate: new Date(),
            projects: []
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveKeyResult(newKeyResult);
        newKeyResult.sourcePath = filePath;
        
        // Add to list
        this.keyResults.push(newKeyResult);
        
        // Link to objective
        const objective = this.objectives.find(obj => obj.id === newKeyResult.objectiveId);
        if (objective) {
            if (!objective.keyResults) {
                objective.keyResults = [];
            }
            objective.keyResults.push(newKeyResult);
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return newKeyResult;
    }
    
    /**
     * Create a new project
     * @param project The project to create
     * @returns The created project
     */
    async createProject(project: Omit<Project, 'id' | 'creationDate'>): Promise<Project> {
        // Generate ID if not provided
        const newProject: Project = {
            ...project,
            id: this.generateId('prj'),
            creationDate: new Date(),
            tasks: []
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveProject(newProject);
        newProject.sourcePath = filePath;
        
        // Add to list
        this.projects.push(newProject);
        
        // Link to key result
        const keyResult = this.keyResults.find(kr => kr.id === newProject.keyResultId);
        if (keyResult) {
            if (!keyResult.projects) {
                keyResult.projects = [];
            }
            keyResult.projects.push(newProject);
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return newProject;
    }
    
    /**
     * Create a new sprint
     * @param sprint The sprint to create
     * @returns The created sprint
     */
    async createSprint(sprint: Omit<Sprint, 'id'> & { id?: string }): Promise<Sprint> {
        // Generate ID if not provided
        const newSprint: Sprint = {
            ...sprint,
            id: sprint.id || this.generateSprintId(sprint)
        };
        
        // Save to file
        const filePath = await this.persistenceService.saveSprint(newSprint);
        
        // Add to list
        this.sprints.push(newSprint);
        
        // Notify listeners
        this.notifyUpdates();
        
        return newSprint;
    }
    
    /**
     * Create a new task
     * @param task The task to create
     * @param filePath Optional file path to add the task to
     * @returns The created task
     */
    async createTask(task: Omit<Task, 'id' | 'creationDate'>, filePath?: string): Promise<Task> {
        console.log("Creating new task:", task.title, "Current tasks:", this.tasks.length);
        
        // Sichern der aktuellen Tasks
        const originalTasks = [...this.tasks];
        
        // Generate ID if not provided
        const newTask: Task = {
            ...task,
            id: this.generateId('task'),
            creationDate: new Date()
        };
        
        // Determine file path if not provided
        let targetFilePath = filePath;

        if (!targetFilePath && newTask.projectId) {
            const project = this.projects.find(p => p.id === newTask.projectId);
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
                await this.app.vault.create(targetFilePath, `# Daily Note ${this.formatDateForDisplay(newTask.dueDate || new Date())}\n\n## Tasks\n\n`);
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
        
        // Add to list
        this.tasks.push(newTask);
        
        // Link to project
        if (newTask.projectId) {
            const project = this.projects.find(p => p.id === newTask.projectId);
            if (project) {
                if (!project.tasks) {
                    project.tasks = [];
                }
                project.tasks.push(newTask);
            }
        }
        
        // Schedule if it has estimated duration and due date
        if (newTask.estimatedDuration && newTask.dueDate) {
            this.scheduleTask(newTask);
        }
        
        // Recalculate progress
        this.recalculateProgress();
        
        // Notify listeners
        this.notifyUpdates();

        // Update the project with the new task
        if (newTask.projectId) {
            const project = this.projects.find(p => p.id === newTask.projectId);
            if (project) {
                if (!project.tasks) {
                    project.tasks = [];
                }
                
                // Add only if not already in the array
                if (!project.tasks.some(t => t.id === newTask.id)) {
                    project.tasks.push(newTask);
                    
                    // Recalculate project progress
                    project.progress = calculateProjectProgress(project);
                    
                    // Update parent key result
                    if (project.keyResultId) {
                        const keyResult = this.keyResults.find(kr => kr.id === project.keyResultId);
                        if (keyResult) {
                            keyResult.progress = calculateKeyResultProgress(keyResult);
                            
                            // Update parent objective
                            if (keyResult.objectiveId) {
                                const objective = this.objectives.find(obj => obj.id === keyResult.objectiveId);
                                if (objective) {
                                    objective.progress = calculateObjectiveProgress(objective);
                                }
                            }
                        }
                    }
                }
            }
        }
        if (this.tasks.length < originalTasks.length + 1) {
            console.error("Task list size decreased! Restoring original tasks plus new task.");
            this.tasks = [...originalTasks, newTask];
        }
        console.log("After creating task:", task.title, "Current tasks:", this.tasks.length);

        
        return newTask;
    }
    
    /**
     * Update an objective
     * @param objective The updated objective
     * @returns Whether the update was successful
     */
    async updateObjective(objective: Objective): Promise<boolean> {
        // Find the objective
        const index = this.objectives.findIndex(obj => obj.id === objective.id);
        if (index === -1) return false;
        
        // Update the objective
        this.objectives[index] = objective;
        
        // Save to file
        try {
            await this.persistenceService.saveObjective(objective);
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating objective:', error);
            return false;
        }
    }
    
    /**
     * Update a key result
     * @param keyResult The updated key result
     * @returns Whether the update was successful
     */
    async updateKeyResult(keyResult: KeyResult): Promise<boolean> {
        // Find the key result
        const index = this.keyResults.findIndex(kr => kr.id === keyResult.id);
        if (index === -1) return false;
        
        // Update the key result
        this.keyResults[index] = keyResult;
        
        // Save to file
        try {
            await this.persistenceService.saveKeyResult(keyResult);
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating key result:', error);
            return false;
        }
    }
    
    /**
     * Update a project
     * @param project The updated project
     * @returns Whether the update was successful
     */
    async updateProject(project: Project): Promise<boolean> {
        // Find the project
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index === -1) return false;
        
        // Update the project
        this.projects[index] = project;
        
        // Save to file
        try {
            await this.persistenceService.saveProject(project);
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating project:', error);
            return false;
        }
    }
    
    /**
     * Update a sprint
     * @param sprint The updated sprint
     * @returns Whether the update was successful
     */
    async updateSprint(sprint: Sprint): Promise<boolean> {
        // Find the sprint
        const index = this.sprints.findIndex(s => s.id === sprint.id);
        if (index === -1) return false;
        
        // Update the sprint
        this.sprints[index] = sprint;
        
        // Save to file
        try {
            await this.persistenceService.saveSprint(sprint);
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating sprint:', error);
            return false;
        }
    }
    
    /**
     * Update a task
     * @param task The updated task
     * @returns Whether the update was successful
     */
    async updateTask(task: Task): Promise<boolean> {
        // Find the task
        const index = this.tasks.findIndex(t => t.id === task.id);
        if (index === -1) return false;
        
        // Check if due date changed
        const dueChanged = this.tasks[index].dueDate?.getTime() !== task.dueDate?.getTime();
        const estimatedDurationChanged = this.tasks[index].estimatedDuration !== task.estimatedDuration;
        const completedChanged = this.tasks[index].completed !== task.completed;
        
        // Update the task
        this.tasks[index] = task;
        
        // Save to file
        try {
            await this.persistenceService.updateTaskInFile(task, task.sourcePath);
            
            // If due date or estimated duration changed, reschedule
            if ((dueChanged || estimatedDurationChanged) && task.estimatedDuration && task.dueDate) {
                // Remove existing blocks for this task
                this.timeManager.removeScheduledBlocks(task.id);
                this.timeBlocks = this.timeBlocks.filter(block => block.taskId !== task.id);
                
                // Reschedule
                this.scheduleTask(task);
            }
            
            // If completed changed, update time blocks
            if (completedChanged) {
                const taskBlocks = this.timeBlocks.filter(block => block.taskId === task.id);
                for (const block of taskBlocks) {
                    this.timeManager.markBlockCompleted(block.id);
                }
            }
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating task:', error);
            return false;
        }
    }
    
    /**
     * Delete an objective
     * @param id ID of the objective to delete
     * @returns Whether the deletion was successful
     */
    async deleteObjective(id: string): Promise<boolean> {
        // Find the objective
        const objective = this.objectives.find(obj => obj.id === id);
        if (!objective) return false;
        
        // Delete key results first
        const keyResultIds = objective.keyResults?.map(kr => kr.id) || [];
        for (const krId of keyResultIds) {
            await this.deleteKeyResult(krId);
        }
        
        // Remove the objective from the list
        this.objectives = this.objectives.filter(obj => obj.id !== id);
        
        // Delete the file
        if (objective.sourceFile) {
            try {
                await this.app.vault.delete(objective.sourceFile);
            } catch (error) {
                console.error('Error deleting objective file:', error);
                return false;
            }
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return true;
    }
    
    /**
     * Delete a key result
     * @param id ID of the key result to delete
     * @returns Whether the deletion was successful
     */
    async deleteKeyResult(id: string): Promise<boolean> {
        // Find the key result
        const keyResult = this.keyResults.find(kr => kr.id === id);
        if (!keyResult) return false;
        
        // Delete projects first
        const projectIds = keyResult.projects?.map(p => p.id) || [];
        for (const pId of projectIds) {
            await this.deleteProject(pId);
        }
        
        // Remove the key result from the list
        this.keyResults = this.keyResults.filter(kr => kr.id !== id);
        
        // Remove from objective
        const objective = this.objectives.find(obj => obj.id === keyResult.objectiveId);
        if (objective && objective.keyResults) {
            objective.keyResults = objective.keyResults.filter(kr => kr.id !== id);
            
            // Recalculate progress
            objective.progress = calculateObjectiveProgress(objective);
            
            // Save the objective
            await this.persistenceService.saveObjective(objective);
        }
        
        // Delete the file
        if (keyResult.sourceFile) {
            try {
                await this.app.vault.delete(keyResult.sourceFile);
            } catch (error) {
                console.error('Error deleting key result file:', error);
                return false;
            }
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return true;
    }
    
    /**
     * Delete a project
     * @param id ID of the project to delete
     * @returns Whether the deletion was successful
     */
    async deleteProject(id: string): Promise<boolean> {
        // Find the project
        const project = this.projects.find(p => p.id === id);
        if (!project) return false;
        
        // Delete tasks first
        const taskIds = project.tasks?.map(t => t.id) || [];
        for (const tId of taskIds) {
            await this.deleteTask(tId);
        }
        
        // Remove the project from the list
        this.projects = this.projects.filter(p => p.id !== id);
        
        // Remove from key result
        const keyResult = this.keyResults.find(kr => kr.id === project.keyResultId);
        if (keyResult && keyResult.projects) {
            keyResult.projects = keyResult.projects.filter(p => p.id !== id);
            
            // Recalculate progress
            keyResult.progress = calculateKeyResultProgress(keyResult);
            
            // Save the key result
            await this.persistenceService.saveKeyResult(keyResult);
        }
        
        // Delete the file
        if (project.sourceFile) {
            try {
                await this.app.vault.delete(project.sourceFile);
            } catch (error) {
                console.error('Error deleting project file:', error);
                return false;
            }
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return true;
    }
    
    /**
     * Delete a sprint
     * @param id ID of the sprint to delete
     * @returns Whether the deletion was successful
     */
    async deleteSprint(id: string): Promise<boolean> {
        // Find the sprint
        const sprint = this.sprints.find(s => s.id === id);
        if (!sprint) return false;
        
        // Remove the sprint from the list
        this.sprints = this.sprints.filter(s => s.id !== id);
        
        // Delete the file
        const file = this.app.vault.getAbstractFileByPath(
            `${this.persistenceService.getConfig().sprintsFolder}/${id}.md`
        );
        if (file instanceof TFile) {
            try {
                await this.app.vault.delete(file);
            } catch (error) {
                console.error('Error deleting sprint file:', error);
                return false;
            }
        }
        
        // Notify listeners
        this.notifyUpdates();
        
        return true;
    }
    
    /**
     * Delete a task
     * @param id ID of the task to delete
     * @returns Whether the deletion was successful
     */
    async deleteTask(id: string): Promise<boolean> {
        // Find the task
        const task = this.tasks.find(t => t.id === id);
        if (!task) return false;
        
        // Remove the task from the list
        this.tasks = this.tasks.filter(t => t.id !== id);
        
        // Remove from project
        if (task.projectId) {
            const project = this.projects.find(p => p.id === task.projectId);
            if (project && project.tasks) {
                project.tasks = project.tasks.filter(t => t.id !== id);
                
                // Recalculate progress
                project.progress = calculateProjectProgress(project);
                
                // Save the project
                await this.persistenceService.saveProject(project);
            }
        }
        
        // Remove from sprint
        for (const sprint of this.sprints) {
            if (sprint.tasks) {
                sprint.tasks = sprint.tasks.filter(t => t.id !== id);
                
                // Save the sprint
                await this.persistenceService.saveSprint(sprint);
            }
        }
        
        // Remove from file
        try {
            await this.persistenceService.removeTaskFromFile(id, task.sourcePath);
        } catch (error) {
            console.error('Error removing task from file:', error);
            return false;
        }
        
        // Remove time blocks
        this.timeManager.removeScheduledBlocks(id);
        this.timeBlocks = this.timeBlocks.filter(block => block.taskId !== id);
        
        // Recalculate progress
        this.recalculateProgress();
        
        // Notify listeners
        this.notifyUpdates();
        
        return true;
    }
    
    /**
     * Mark a task as completed
     * @param id ID of the task to complete
     * @returns Whether the operation was successful
     */
    async completeTask(id: string): Promise<boolean> {
        // Find the task
        const task = this.tasks.find(t => t.id === id);
        if (!task) return false;
        
        // Update the task
        task.completed = true;
        task.status = 'completed';
        
        // Update in file
        try {
            await this.persistenceService.updateTaskInFile(task, task.sourcePath);
            
            // Mark time blocks as completed
            const taskBlocks = this.timeBlocks.filter(block => block.taskId === id);
            for (const block of taskBlocks) {
                this.timeManager.markBlockCompleted(block.id);
            }
            
            // Recalculate progress
            this.recalculateProgress();
            
            // Notify listeners
            this.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error completing task:', error);
            return false;
        }
    }
    
    // Getter methods
    
    /**
     * Get all objectives
     * @returns Array of objectives
     */
    getObjectives(): Objective[] {
        return [...this.objectives];
    }
    
    /**
     * Get a specific objective
     * @param id ID of the objective
     * @returns The objective or undefined if not found
     */
    getObjective(id: string): Objective | undefined {
        return this.objectives.find(obj => obj.id === id);
    }
    
    /**
     * Get all key results
     * @returns Array of key results
     */
    getKeyResults(): KeyResult[] {
        return [...this.keyResults];
    }
    
    /**
     * Get key results for a specific objective
     * @param objectiveId ID of the objective
     * @returns Array of key results
     */
    getKeyResultsForObjective(objectiveId: string): KeyResult[] {
        return this.keyResults.filter(kr => kr.objectiveId === objectiveId);
    }
    
    /**
     * Get a specific key result
     * @param id ID of the key result
     * @returns The key result or undefined if not found
     */
    getKeyResult(id: string): KeyResult | undefined {
        return this.keyResults.find(kr => kr.id === id);
    }
    
    /**
     * Get all projects
     * @returns Array of projects
     */
    getProjects(): Project[] {
        return [...this.projects];
    }

    /**
     * Get the time manager
     * @returns The time manager instance
     */
    getTimeManager(): TimeManager {
        return this.timeManager;
    }
    
    /**
     * Get projects for a specific key result
     * @param keyResultId ID of the key result
     * @returns Array of projects
     */
    getProjectsForKeyResult(keyResultId: string): Project[] {
        return this.projects.filter(p => p.keyResultId === keyResultId);
    }
    
    /**
     * Get a specific project
     * @param id ID of the project
     * @returns The project or undefined if not found
     */
    getProject(id: string): Project | undefined {
        return this.projects.find(p => p.id === id);
    }
    
    /**
     * Get all sprints
     * @returns Array of sprints
     */
    getSprints(): Sprint[] {
        return [...this.sprints];
    }
    
    /**
     * Get the current active sprint
     * @returns The current sprint or undefined if none is active
     */
    getCurrentSprint(): Sprint | undefined {
        const now = new Date();
        return this.sprints.find(sprint => 
            sprint.status === 'active' && 
            sprint.startDate <= now && 
            sprint.endDate >= now
        );
    }
    
    /**
     * Get a specific sprint
     * @param id ID of the sprint
     * @returns The sprint or undefined if not found
     */
    getSprint(id: string): Sprint | undefined {
        return this.sprints.find(s => s.id === id);
    }
    
    /**
     * Get all tasks
     * @returns Array of tasks
     */
    getTasks(): Task[] {
        return [...this.tasks];
    }
    
    /**
     * Get tasks for a specific project
     * @param projectId ID of the project
     * @returns Array of tasks
     */
    getTasksForProject(projectId: string): Task[] {
        return this.tasks.filter(t => t.projectId === projectId);
    }
    
    /**
     * Get tasks for a specific sprint
     * @param sprintId ID of the sprint
     * @returns Array of tasks
     */
    getTasksForSprint(sprintId: string): Task[] {
        const sprint = this.sprints.find(s => s.id === sprintId);
        if (!sprint) return [];
        return sprint.tasks || [];
    }
    
    /**
     * Get tasks for a specific date
     * @param date The date
     * @returns Array of tasks with due date on the specified date
     */
    getTasksForDate(date: Date): Task[] {
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        
        return this.tasks.filter(task => 
            task.dueDate && 
            task.dueDate >= dateStart && 
            task.dueDate <= dateEnd
        );
    }
    
    /**
     * Get a specific task
     * @param id ID of the task
     * @returns The task or undefined if not found
     */
    getTask(id: string): Task | undefined {
        return this.tasks.find(t => t.id === id);
    }
    
    // Helper methods
    
    // Statische Zähler für jede ID-Art
    private static objectiveCounter = 1;
    private static keyResultCounter = 1;
    private static projectCounter = 1;
    private static taskCounter = 1;

    /**
     * Generate a unique ID for an OKR element
     * @param prefix Prefix for the ID
     * @returns Generated ID
     */
    private generateId(prefix: string): string {
        let counter = 1;
        
        // Verwende den entsprechenden Zähler für den Präfix
        if (prefix === 'obj') {
            counter = OkrService.objectiveCounter++;
        } else if (prefix === 'kr') {
            counter = OkrService.keyResultCounter++;
        } else if (prefix === 'prj') {
            counter = OkrService.projectCounter++;
        } else if (prefix === 'task') {
            counter = OkrService.taskCounter++;
        }
        
        // Jahr zur ID hinzufügen für zusätzlichen Kontext
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${counter}`;
    }
    
    /**
     * Generate a sprint ID based on sprint properties
     * @param sprint Sprint properties
     * @returns Generated ID
     */
    private generateSprintId(sprint: Partial<Sprint>): string {
        const sprintNumber = sprint.sprintNumber || 1;
        const month = sprint.month || new Date().getMonth() + 1;
        const quarter = sprint.quarter || Math.floor((month - 1) / 3) + 1;
        const year = sprint.year || new Date().getFullYear();
        
        return `SB-${sprintNumber}-${month}M-${quarter}Q-${year}Y`;
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
        return date.toLocaleDateString('de-DE', {
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