/**
 * OKR Service
 * 
 * This service acts as a facade for all other OKR services,
 * providing a unified API for the UI components.
 */

import { App, Notice } from 'obsidian';
import { 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    Sprint
} from '../models/okr-models';
import { TimeBlockInfo } from '../utils/time-manager';
import { OkrDataManager } from './okr-data-manager';
import { OkrPersistenceService } from './okr-persistence-service';
import { OkrRelationshipManager } from './okr-relationship-manager';
import { OkrOperationsService } from './okr-operations-service';
import { TaskOperationsService } from './task-operations-service';
import { TimeBlockManager } from './time-block-manager';
import { FileWatcherService } from './file-watcher-service';

/**
 * Handles the integration between all OKR services
 */
export class OkrService {
    private app: App;
    
    // Service instances
    private dataManager: OkrDataManager;
    private persistenceService: OkrPersistenceService;
    private relationshipManager: OkrRelationshipManager;
    private okrOperationsService: OkrOperationsService;
    private taskOperationsService: TaskOperationsService;
    private timeBlockManager: TimeBlockManager;
    private fileWatcherService: FileWatcherService;
    
    constructor(app: App) {
        this.app = app;
        
        // Initialize services
        this.dataManager = new OkrDataManager();
        this.persistenceService = new OkrPersistenceService(app);
        this.timeBlockManager = new TimeBlockManager(this.dataManager);
        this.relationshipManager = new OkrRelationshipManager(this.dataManager);
        this.okrOperationsService = new OkrOperationsService(
            app, 
            this.dataManager, 
            this.persistenceService,
            this.relationshipManager
        );
        this.taskOperationsService = new TaskOperationsService(
            app,
            this.dataManager,
            this.persistenceService,
            this.relationshipManager,
            this.timeBlockManager
        );
        this.fileWatcherService = new FileWatcherService(
            app,
            this.persistenceService,
            this.taskOperationsService,
            this.okrOperationsService
        );
    }
    
    /**
     * Initialize the service by loading data and setting up event handlers
     */
    async initialize(): Promise<void> {
        try {
            // Load OKR data (objectives, key results, projects, sprints)
            await this.okrOperationsService.loadAll();
            
            // Load tasks
            await this.taskOperationsService.loadAllTasks();
            
            // Import tasks from markdown files
            await this.taskOperationsService.importMarkdownTasks();
            
            // Start watching for file changes
            this.fileWatcherService.startWatching();
            
            console.log('OKR Service initialized');
        } catch (error) {
            console.error('Error initializing OKR Service:', error);
            new Notice('Error initializing OKR Service');
        }
    }
    
    /**
     * Register a callback for data updates
     * @param callback Function to call when data changes
     */
    registerUpdateCallback(callback: () => void): void {
        this.dataManager.registerUpdateCallback(callback);
    }
    
    // Delegate methods for Objectives
    
    /**
     * Get all objectives
     * @returns Array of objectives
     */
    getObjectives(): Objective[] {
        return this.dataManager.getObjectives();
    }
    
    /**
     * Get a specific objective
     * @param id ID of the objective
     * @returns The objective or undefined if not found
     */
    getObjective(id: string): Objective | undefined {
        return this.dataManager.getObjective(id);
    }
    
    /**
     * Create a new objective
     * @param objective The objective to create
     * @returns The created objective
     */
    async createObjective(objective: Omit<Objective, 'id' | 'creationDate'>): Promise<Objective> {
        return this.okrOperationsService.createObjective(objective);
    }
    
    /**
     * Update an objective
     * @param objective The updated objective
     * @returns Whether the update was successful
     */
    async updateObjective(objective: Objective): Promise<boolean> {
        return this.okrOperationsService.updateObjective(objective);
    }
    
    /**
     * Delete an objective
     * @param id ID of the objective to delete
     * @returns Whether the deletion was successful
     */
    async deleteObjective(id: string): Promise<boolean> {
        return this.okrOperationsService.deleteObjective(id);
    }
    
    // Delegate methods for Key Results
    
    /**
     * Get all key results
     * @returns Array of key results
     */
    getKeyResults(): KeyResult[] {
        return this.dataManager.getKeyResults();
    }
    
    /**
     * Get key results for a specific objective
     * @param objectiveId ID of the objective
     * @returns Array of key results
     */
    getKeyResultsForObjective(objectiveId: string): KeyResult[] {
        return this.dataManager.getKeyResultsForObjective(objectiveId);
    }
    
    /**
     * Get a specific key result
     * @param id ID of the key result
     * @returns The key result or undefined if not found
     */
    getKeyResult(id: string): KeyResult | undefined {
        return this.dataManager.getKeyResult(id);
    }
    
    /**
     * Create a new key result
     * @param keyResult The key result to create
     * @returns The created key result
     */
    async createKeyResult(keyResult: Omit<KeyResult, 'id' | 'creationDate'>): Promise<KeyResult> {
        return this.okrOperationsService.createKeyResult(keyResult);
    }
    
    /**
     * Update a key result
     * @param keyResult The updated key result
     * @returns Whether the update was successful
     */
    async updateKeyResult(keyResult: KeyResult): Promise<boolean> {
        return this.okrOperationsService.updateKeyResult(keyResult);
    }
    
    /**
     * Delete a key result
     * @param id ID of the key result to delete
     * @returns Whether the deletion was successful
     */
    async deleteKeyResult(id: string): Promise<boolean> {
        return this.okrOperationsService.deleteKeyResult(id);
    }
    
    // Delegate methods for Projects
    
    /**
     * Get all projects
     * @returns Array of projects
     */
    getProjects(): Project[] {
        return this.dataManager.getProjects();
    }
    
    /**
     * Get projects for a specific key result
     * @param keyResultId ID of the key result
     * @returns Array of projects
     */
    getProjectsForKeyResult(keyResultId: string): Project[] {
        return this.dataManager.getProjectsForKeyResult(keyResultId);
    }
    
    /**
     * Get a specific project
     * @param id ID of the project
     * @returns The project or undefined if not found
     */
    getProject(id: string): Project | undefined {
        return this.dataManager.getProject(id);
    }
    
    /**
     * Create a new project
     * @param project The project to create
     * @returns The created project
     */
    async createProject(project: Omit<Project, 'id' | 'creationDate'>): Promise<Project> {
        return this.okrOperationsService.createProject(project);
    }
    
    /**
     * Update a project
     * @param project The updated project
     * @returns Whether the update was successful
     */
    async updateProject(project: Project): Promise<boolean> {
        return this.okrOperationsService.updateProject(project);
    }
    
    /**
     * Delete a project
     * @param id ID of the project to delete
     * @returns Whether the deletion was successful
     */
    async deleteProject(id: string): Promise<boolean> {
        return this.okrOperationsService.deleteProject(id);
    }
    
    // Delegate methods for Sprints
    
    /**
     * Get all sprints
     * @returns Array of sprints
     */
    getSprints(): Sprint[] {
        return this.dataManager.getSprints();
    }
    
    /**
     * Get the current active sprint
     * @returns The current sprint or undefined if none is active
     */
    getCurrentSprint(): Sprint | undefined {
        return this.dataManager.getCurrentSprint();
    }
    
    /**
     * Get a specific sprint
     * @param id ID of the sprint
     * @returns The sprint or undefined if not found
     */
    getSprint(id: string): Sprint | undefined {
        return this.dataManager.getSprint(id);
    }
    
    /**
     * Create a new sprint
     * @param sprint The sprint to create
     * @returns The created sprint
     */
    async createSprint(sprint: Omit<Sprint, 'id'> & { id?: string }): Promise<Sprint> {
        return this.okrOperationsService.createSprint(sprint);
    }
    
    /**
     * Update a sprint
     * @param sprint The updated sprint
     * @returns Whether the update was successful
     */
    async updateSprint(sprint: Sprint): Promise<boolean> {
        return this.okrOperationsService.updateSprint(sprint);
    }
    
    /**
     * Delete a sprint
     * @param id ID of the sprint to delete
     * @returns Whether the deletion was successful
     */
    async deleteSprint(id: string): Promise<boolean> {
        return this.okrOperationsService.deleteSprint(id);
    }
    
    // Delegate methods for Tasks
    
    /**
     * Get all tasks
     * @returns Array of tasks
     */
    getTasks(): Task[] {
        return this.dataManager.getTasks();
    }
    
    /**
     * Get tasks for a specific project
     * @param projectId ID of the project
     * @returns Array of tasks
     */
    getTasksForProject(projectId: string): Task[] {
        return this.dataManager.getTasksForProject(projectId);
    }
    
    /**
     * Get tasks for a specific sprint
     * @param sprintId ID of the sprint
     * @returns Array of tasks
     */
    getTasksForSprint(sprintId: string): Task[] {
        const sprint = this.dataManager.getSprint(sprintId);
        if (!sprint) return [];
        return sprint.tasks || [];
    }
    
    /**
     * Get tasks for a specific date
     * @param date The date
     * @returns Array of tasks with due date on the specified date
     */
    getTasksForDate(date: Date): Task[] {
        return this.dataManager.getTasksForDate(date);
    }
    
    /**
     * Get a specific task
     * @param id ID of the task
     * @returns The task or undefined if not found
     */
    getTask(id: string): Task | undefined {
        return this.dataManager.getTask(id);
    }
    
    /**
     * Create a new task
     * @param task The task to create
     * @param filePath Optional file path to add the task to
     * @returns The created task
     */
    async createTask(task: Omit<Task, 'id' | 'creationDate'>, filePath?: string): Promise<Task> {
        return this.taskOperationsService.createTask(task, filePath);
    }
    
    /**
     * Update a task
     * @param task The updated task
     * @returns Whether the update was successful
     */
    async updateTask(task: Task): Promise<boolean> {
        return this.taskOperationsService.updateTask(task);
    }
    
    /**
     * Delete a task
     * @param id ID of the task to delete
     * @returns Whether the deletion was successful
     */
    async deleteTask(id: string): Promise<boolean> {
        return this.taskOperationsService.deleteTask(id);
    }
    
    /**
     * Mark a task as completed
     * @param id ID of the task to complete
     * @returns Whether the operation was successful
     */
    async completeTask(id: string): Promise<boolean> {
        return this.taskOperationsService.completeTask(id);
    }
    
    // Delegate methods for Time Blocks
    
    /**
     * Get time blocks for a specific task
     * @param taskId ID of the task
     * @returns Time blocks for the task
     */
    getTimeBlocksForTask(taskId: string): TimeBlockInfo[] {
        return this.dataManager.getTimeBlocksForTask(taskId);
    }
    
    /**
     * Get time blocks for a specific time range
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Time blocks within the specified range
     */
    getTimeBlocksInRange(startDate: Date, endDate: Date): TimeBlockInfo[] {
        return this.dataManager.getTimeBlocksInRange(startDate, endDate);
    }
    
    /**
     * Schedule a task using the time block manager
     * @param task The task to schedule
     * @returns Result object with success status and scheduled time blocks
     */
    scheduleTask(task: Task): { success: boolean, timeBlocks: TimeBlockInfo[] } {
        // TaskOperationsService now returns an object, not a boolean
        const result = this.taskOperationsService.scheduleTask(task);
        return result; // Just return the result directly
    }
    
    /**
     * Mark a time block as completed
     * @param blockId ID of the time block
     * @returns Whether the operation was successful
     */
    markTimeBlockCompleted(blockId: string): boolean {
        return this.timeBlockManager.markBlockCompleted(blockId);
    }
    
    /**
     * Get the time block manager for advanced operations
     * @returns The time block manager instance
     */
    getTimeBlockManager(): TimeBlockManager {
        return this.timeBlockManager;
    }
    /**
     * Alias for getTimeBlockManager() for compatibility
     * @returns The time block manager instance
     */
    getTimeManager(): TimeBlockManager {
        return this.timeBlockManager;
    }

    /**
     * Import tasks from markdown files
     * Scans the vault for markdown files with task syntax
     */
    async importMarkdownTasks(): Promise<void> {
        await this.taskOperationsService.importMarkdownTasks();
    }
}