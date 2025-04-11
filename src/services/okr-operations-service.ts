/**
 * OKR Operations Service
 * 
 * This service is responsible for CRUD operations on OKR entities
 * (Objectives, Key Results, Projects, Sprints).
 */

import { App } from 'obsidian';
import { 
    Objective, 
    KeyResult, 
    Project, 
    Sprint
} from '../models/okr-models';
import { OkrDataManager } from './okr-data-manager';
import { OkrPersistenceService } from './okr-persistence-service';
import { OkrRelationshipManager } from './okr-relationship-manager';

/**
 * Handles CRUD operations for Objectives, Key Results, Projects, and Sprints
 */
export class OkrOperationsService {
    private app: App;
    private dataManager: OkrDataManager;
    private persistenceService: OkrPersistenceService;
    private relationshipManager: OkrRelationshipManager;
    
    // Static counters for IDs
    private static objectiveCounter = 1;
    private static keyResultCounter = 1;
    private static projectCounter = 1;
    private static sprintCounter = 1;
    
    constructor(
        app: App, 
        dataManager: OkrDataManager,
        persistenceService: OkrPersistenceService,
        relationshipManager: OkrRelationshipManager
    ) {
        this.app = app;
        this.dataManager = dataManager;
        this.persistenceService = persistenceService;
        this.relationshipManager = relationshipManager;
        
        console.log('OKR Operations Service initialized');
    }
    
    /**
     * Load all OKR data
     */
    async loadAll(): Promise<void> {
        // Load objectives
        const objectives = await this.persistenceService.loadObjectives();
        this.dataManager.setObjectives(objectives);
        
        // Load key results
        const keyResults = await this.persistenceService.loadKeyResults();
        this.dataManager.setKeyResults(keyResults);
        
        // Load projects
        const projects = await this.persistenceService.loadProjects();
        this.dataManager.setProjects(projects);
        
        // Load sprints
        const sprints = await this.persistenceService.loadSprints();
        this.dataManager.setSprints(sprints);
        
        // Establish relationships
        this.relationshipManager.setupRelationships();
        
        // Notify of updates
        this.dataManager.notifyUpdates();
    }
    
    // CRUD operations for Objectives
    
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
        
        // Add to data manager
        this.dataManager.addObjective(newObjective);
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return newObjective;
    }
    
    /**
     * Update an objective
     * @param objective The updated objective
     * @returns Whether the update was successful
     */
    async updateObjective(objective: Objective): Promise<boolean> {
        // Update in data manager
        const success = this.dataManager.updateObjective(objective);
        if (!success) return false;
        
        // Save to file
        try {
            await this.persistenceService.saveObjective(objective);
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating objective:', error);
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
        const objective = this.dataManager.getObjective(id);
        if (!objective) return false;
        
        // Delete key results first
        const keyResultIds = objective.keyResults?.map(kr => kr.id) || [];
        for (const krId of keyResultIds) {
            await this.deleteKeyResult(krId);
        }
        
        // Remove from data manager
        this.dataManager.removeObjective(id);
        
        // Delete the file
        if (objective.sourceFile) {
            try {
                await this.app.vault.delete(objective.sourceFile);
            } catch (error) {
                console.error('Error deleting objective file:', error);
                return false;
            }
        }
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return true;
    }
    
    // CRUD operations for Key Results
    
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
        
        // Add to data manager
        this.dataManager.addKeyResult(newKeyResult);
        
        // Link to objective
        const objective = this.dataManager.getObjective(newKeyResult.objectiveId);
        if (objective) {
            this.relationshipManager.addKeyResultToObjective(newKeyResult, objective.id);
        }
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return newKeyResult;
    }
    
    /**
     * Update a key result
     * @param keyResult The updated key result
     * @returns Whether the update was successful
     */
    async updateKeyResult(keyResult: KeyResult): Promise<boolean> {
        // Update in data manager
        const success = this.dataManager.updateKeyResult(keyResult);
        if (!success) return false;
        
        // Save to file
        try {
            await this.persistenceService.saveKeyResult(keyResult);
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating key result:', error);
            return false;
        }
    }
    
    /**
     * Delete a key result
     * @param id ID of the key result to delete
     * @returns Whether the deletion was successful
     */
    async deleteKeyResult(id: string): Promise<boolean> {
        // Find the key result
        const keyResult = this.dataManager.getKeyResult(id);
        if (!keyResult) return false;
        
        // Delete projects first
        const projectIds = keyResult.projects?.map(p => p.id) || [];
        for (const pId of projectIds) {
            await this.deleteProject(pId);
        }
        
        // Remove from data manager
        this.dataManager.removeKeyResult(id);
        
        // Remove from objective
        const objective = this.dataManager.getObjective(keyResult.objectiveId);
        if (objective && objective.keyResults) {
            this.relationshipManager.removeKeyResultFromObjective(id, objective.id);
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
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return true;
    }
    
    // CRUD operations for Projects
    
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
        
        // Add to data manager
        this.dataManager.addProject(newProject);
        
        // Link to key result
        const keyResult = this.dataManager.getKeyResult(newProject.keyResultId);
        if (keyResult) {
            this.relationshipManager.addProjectToKeyResult(newProject, keyResult.id);
        }
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return newProject;
    }
    
    /**
     * Update a project
     * @param project The updated project
     * @returns Whether the update was successful
     */
    async updateProject(project: Project): Promise<boolean> {
        // Update in data manager
        const success = this.dataManager.updateProject(project);
        if (!success) return false;
        
        // Save to file
        try {
            await this.persistenceService.saveProject(project);
            
            // Recalculate progress
            this.relationshipManager.recalculateProgress();
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating project:', error);
            return false;
        }
    }
    
    /**
     * Delete a project
     * @param id ID of the project to delete
     * @returns Whether the deletion was successful
     */
    async deleteProject(id: string): Promise<boolean> {
        // Find the project
        const project = this.dataManager.getProject(id);
        if (!project) return false;
        
        // Get the task IDs to delete
        const taskIds = project.tasks?.map(t => t.id) || [];
        
        // Remove from data manager
        this.dataManager.removeProject(id);
        
        // Remove from key result
        const keyResult = this.dataManager.getKeyResult(project.keyResultId);
        if (keyResult && keyResult.projects) {
            this.relationshipManager.removeProjectFromKeyResult(id, keyResult.id);
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
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return true;
    }
    
    // CRUD operations for Sprints
    
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
        
        // Add to data manager
        this.dataManager.addSprint(newSprint);
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return newSprint;
    }
    
    /**
     * Update a sprint
     * @param sprint The updated sprint
     * @returns Whether the update was successful
     */
    async updateSprint(sprint: Sprint): Promise<boolean> {
        // Update in data manager
        const success = this.dataManager.updateSprint(sprint);
        if (!success) return false;
        
        // Save to file
        try {
            await this.persistenceService.saveSprint(sprint);
            
            // Notify of updates
            this.dataManager.notifyUpdates();
            
            return true;
        } catch (error) {
            console.error('Error updating sprint:', error);
            return false;
        }
    }
    
    /**
     * Delete a sprint
     * @param id ID of the sprint to delete
     * @returns Whether the deletion was successful
     */
    async deleteSprint(id: string): Promise<boolean> {
        // Find the sprint
        const sprint = this.dataManager.getSprint(id);
        if (!sprint) return false;
        
        // Remove from data manager
        this.dataManager.removeSprint(id);
        
        // Delete the file
        const file = this.app.vault.getAbstractFileByPath(
            `${this.persistenceService.getConfig().sprintsFolder}/${id}.md`
        );
        if (file) {
            try {
                await this.app.vault.delete(file);
            } catch (error) {
                console.error('Error deleting sprint file:', error);
                return false;
            }
        }
        
        // Notify of updates
        this.dataManager.notifyUpdates();
        
        return true;
    }
    
    // Helper methods
    
    /**
     * Generate a unique ID for an OKR element
     * @param prefix Prefix for the ID
     * @returns Generated ID
     */
    private generateId(prefix: string): string {
        let counter = 1;
        
        // Use the appropriate counter for the prefix
        if (prefix === 'obj') {
            counter = OkrOperationsService.objectiveCounter++;
        } else if (prefix === 'kr') {
            counter = OkrOperationsService.keyResultCounter++;
        } else if (prefix === 'prj') {
            counter = OkrOperationsService.projectCounter++;
        }
        
        // Add year to ID for additional context
        const year = new Date().getFullYear();
        return `${prefix}-${year}-${counter}`;
    }
    
    /**
     * Generate a sprint ID based on sprint properties
     * @param sprint Sprint properties
     * @returns Generated ID
     */
    private generateSprintId(sprint: Partial<Sprint>): string {
        const sprintNumber = sprint.sprintNumber || OkrOperationsService.sprintCounter++;
        const month = sprint.month || new Date().getMonth() + 1;
        const quarter = sprint.quarter || Math.floor((month - 1) / 3) + 1;
        const year = sprint.year || new Date().getFullYear();
        
        return `SB-${sprintNumber}-${month}M-${quarter}Q-${year}Y`;
    }
}