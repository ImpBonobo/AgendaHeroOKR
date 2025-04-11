/**
 * OKR Persistence Service
 * 
 * This service handles saving and loading OKR elements to/from Markdown files.
 * It acts as a facade for specialized persistence managers that handle specific entity types.
 */

import { App, TFile, MetadataCache } from 'obsidian';
import { 
    OkrElement, 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    Sprint, 
    OkrStatus
} from '../models/okr-models';

import { OkrPersistenceConfig, DEFAULT_CONFIG } from './persistence/persistence-config';
import { FileSystemHelper } from './persistence/file-system-helper';
import { MarkdownParser } from './persistence/markdown-parser';
import { ObjectivePersistenceManager } from './persistence/objective-persistence-manager';
import { KeyResultPersistenceManager } from './persistence/key-result-persistence-manager';
import { TaskPersistenceManager } from './persistence/task-persistence-manager';
import { ProjectPersistenceManager } from './persistence/project-persistence-manager';
import { SprintPersistenceManager } from './persistence/sprint-persistence-manager';

/**
 * Facade service for persisting OKR elements
 */
export class OkrPersistenceService {
    private app: App;
    private config: OkrPersistenceConfig;
    
    // Helper classes
    private fileSystemHelper: FileSystemHelper;
    private markdownParser: MarkdownParser;
    
    // Specialized managers
    private objectiveManager: ObjectivePersistenceManager;
    private keyResultManager: KeyResultPersistenceManager;
    private taskManager: TaskPersistenceManager;
    private projectManager: ProjectPersistenceManager;
    private sprintManager: SprintPersistenceManager;
    
    constructor(app: App, config: Partial<OkrPersistenceConfig> = {}) {
        this.app = app;
        
        // Merge default config with provided config
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            metadataFields: {
                ...DEFAULT_CONFIG.metadataFields,
                ...(config.metadataFields || {})
            }
        };
        
        // Initialize helper classes
        this.fileSystemHelper = new FileSystemHelper(app);
        this.markdownParser = new MarkdownParser(this.config);
        
        // Initialize specialized managers
        this.taskManager = new TaskPersistenceManager(app, this.config, this.fileSystemHelper, this.markdownParser);
        this.objectiveManager = new ObjectivePersistenceManager(app, this.config, this.fileSystemHelper, this.markdownParser);
        this.keyResultManager = new KeyResultPersistenceManager(app, this.config, this.fileSystemHelper, this.markdownParser);
        this.projectManager = new ProjectPersistenceManager(app, this.config, this.fileSystemHelper, this.markdownParser, this.taskManager);
        this.sprintManager = new SprintPersistenceManager(app, this.config, this.fileSystemHelper, this.markdownParser, this.taskManager);
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
        
        // Update config in all managers
        this.markdownParser.updateConfig(this.config);
        this.objectiveManager.updateConfig(config);
        this.keyResultManager.updateConfig(config);
        this.taskManager.updateConfig(config);
        this.projectManager.updateConfig(config);
        this.sprintManager.updateConfig(config);
    }
    
    /**
     * Get the configuration
     * @returns Current configuration
     */
    getConfig(): OkrPersistenceConfig {
        return {...this.config};
    }
    
    // --------- Objective Methods ---------
    
    /**
     * Save an objective to a file
     * @param objective The objective to save
     * @returns The file path where the objective was saved
     */
    async saveObjective(objective: Objective): Promise<string> {
        return this.objectiveManager.saveObjective(objective);
    }
    
    /**
     * Load objectives from files
     * @returns Array of loaded objectives
     */
    async loadObjectives(): Promise<Objective[]> {
        return this.objectiveManager.loadObjectives();
    }
    
    // --------- Key Result Methods ---------
    
    /**
     * Save a key result to a file
     * @param keyResult The key result to save
     * @returns The file path where the key result was saved
     */
    async saveKeyResult(keyResult: KeyResult): Promise<string> {
        return this.keyResultManager.saveKeyResult(keyResult);
    }
    
    /**
     * Load key results from files
     * @returns Array of loaded key results
     */
    async loadKeyResults(): Promise<KeyResult[]> {
        return this.keyResultManager.loadKeyResults();
    }
    
    // --------- Project Methods ---------
    
    /**
     * Save a project to a file
     * @param project The project to save
     * @returns The file path where the project was saved
     */
    async saveProject(project: Project): Promise<string> {
        return this.projectManager.saveProject(project);
    }
    
    /**
     * Load projects from files
     * @returns Array of loaded projects
     */
    async loadProjects(): Promise<Project[]> {
        return this.projectManager.loadProjects();
    }
    
    // --------- Sprint Methods ---------
    
    /**
     * Save a sprint to a file
     * @param sprint The sprint to save
     * @returns The file path where the sprint was saved
     */
    async saveSprint(sprint: Sprint): Promise<string> {
        return this.sprintManager.saveSprint(sprint);
    }
    
    /**
     * Load sprints from files
     * @returns Array of loaded sprints
     */
    async loadSprints(): Promise<Sprint[]> {
        return this.sprintManager.loadSprints();
    }
    
    // --------- Task Methods ---------
    
    /**
     * Add a task to a markdown file
     * @param task The task to add
     * @param filePath The file path to add the task to
     * @returns Whether the operation was successful
     */
    async addTaskToFile(task: Task, filePath: string): Promise<boolean> {
        return this.taskManager.addTaskToFile(task, filePath);
    }
    
    /**
     * Update a task in a markdown file
     * @param task The updated task
     * @param filePath The file path containing the task
     * @returns Whether the operation was successful
     */
    async updateTaskInFile(task: Task, filePath: string): Promise<boolean> {
        return this.taskManager.updateTaskInFile(task, filePath);
    }
    
    /**
     * Remove a task from a markdown file
     * @param taskId The ID of the task to remove
     * @param filePath The file path containing the task
     * @returns Whether the operation was successful
     */
    async removeTaskFromFile(taskId: string, filePath: string): Promise<boolean> {
        return this.taskManager.removeTaskFromFile(taskId, filePath);
    }
    
    /**
     * Load tasks from a specific file
     * @param filePath Path to the file containing tasks
     * @returns Array of loaded tasks
     */
    async loadTasksFromFile(filePath: string): Promise<Task[]> {
        return this.taskManager.loadTasksFromFile(filePath);
    }
    
    /**
     * Load all tasks from all files in a folder
     * @param folderPath Path to the folder
     * @returns Array of loaded tasks
     */
    async loadTasksFromFolder(folderPath: string): Promise<Task[]> {
        return this.taskManager.loadTasksFromFolder(folderPath);
    }
}