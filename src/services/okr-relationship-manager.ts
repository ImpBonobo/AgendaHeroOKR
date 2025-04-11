/**
 * OKR Relationship Manager
 * 
 * This service is responsible for managing the relationships between OKR entities
 * and calculating progress values based on these relationships.
 */

import { 
    Objective, 
    KeyResult, 
    Project, 
    Task,
    calculateObjectiveProgress,
    calculateKeyResultProgress,
    calculateProjectProgress
} from '../models/okr-models';
import { OkrDataManager } from './okr-data-manager';

/**
 * Manages relationships between OKR entities and calculates progress values
 */
export class OkrRelationshipManager {
    private dataManager: OkrDataManager;
    
    constructor(dataManager: OkrDataManager) {
        this.dataManager = dataManager;
        console.log('OKR Relationship Manager initialized');
    }
    
    /**
     * Set up relationships between OKR elements
     */
    setupRelationships(): void {
        const objectives = this.dataManager.getObjectives();
        const keyResults = this.dataManager.getKeyResults();
        const projects = this.dataManager.getProjects();
        const tasks = this.dataManager.getTasks();
        
        // Link key results to objectives
        for (const keyResult of keyResults) {
            const objective = objectives.find(obj => obj.id === keyResult.objectiveId);
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
        for (const project of projects) {
            const keyResult = keyResults.find(kr => kr.id === project.keyResultId);
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
        for (const task of tasks) {
            if (task.projectId) {
                const project = projects.find(p => p.id === task.projectId);
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
     * Recalculate progress for all OKR elements
     */
    recalculateProgress(): void {
        const objectives = this.dataManager.getObjectives();
        const keyResults = this.dataManager.getKeyResults();
        const projects = this.dataManager.getProjects();
        
        // Calculate project progress based on tasks
        for (const project of projects) {
            const updatedProgress = calculateProjectProgress(project);
            project.progress = updatedProgress;
            this.dataManager.updateProject(project);
        }
        
        // Calculate key result progress
        for (const keyResult of keyResults) {
            const updatedProgress = calculateKeyResultProgress(keyResult);
            keyResult.progress = updatedProgress;
            this.dataManager.updateKeyResult(keyResult);
        }
        
        // Calculate objective progress
        for (const objective of objectives) {
            const updatedProgress = calculateObjectiveProgress(objective);
            objective.progress = updatedProgress;
            this.dataManager.updateObjective(objective);
        }
    }
    
    /**
     * Add a task to a project
     * @param task The task to add
     * @param projectId ID of the project
     */
    addTaskToProject(task: Task, projectId: string): void {
        const project = this.dataManager.getProject(projectId);
        if (!project) return;
        
        if (!project.tasks) {
            project.tasks = [];
        }
        
        // Add only if not already in the array
        if (!project.tasks.some(t => t.id === task.id)) {
            project.tasks.push(task);
            
            // Update the task's project ID
            task.projectId = projectId;
            this.dataManager.updateTask(task);
            
            // Update the project
            this.dataManager.updateProject(project);
            
            // Recalculate progress
            this.recalculateProgress();
        }
    }
    
    /**
     * Remove a task from a project
     * @param taskId ID of the task to remove
     * @param projectId ID of the project
     */
    removeTaskFromProject(taskId: string, projectId: string): void {
        const project = this.dataManager.getProject(projectId);
        if (!project || !project.tasks) return;
        
        // Remove the task from the project
        project.tasks = project.tasks.filter(t => t.id !== taskId);
        
        // Update the project
        this.dataManager.updateProject(project);
        
        // Recalculate progress
        this.recalculateProgress();
    }
    
    /**
     * Add a project to a key result
     * @param project The project to add
     * @param keyResultId ID of the key result
     */
    addProjectToKeyResult(project: Project, keyResultId: string): void {
        const keyResult = this.dataManager.getKeyResult(keyResultId);
        if (!keyResult) return;
        
        if (!keyResult.projects) {
            keyResult.projects = [];
        }
        
        // Add only if not already in the array
        if (!keyResult.projects.some(p => p.id === project.id)) {
            keyResult.projects.push(project);
            
            // Update the project's key result ID
            project.keyResultId = keyResultId;
            this.dataManager.updateProject(project);
            
            // Update the key result
            this.dataManager.updateKeyResult(keyResult);
            
            // Recalculate progress
            this.recalculateProgress();
        }
    }
    
    /**
     * Remove a project from a key result
     * @param projectId ID of the project to remove
     * @param keyResultId ID of the key result
     */
    removeProjectFromKeyResult(projectId: string, keyResultId: string): void {
        const keyResult = this.dataManager.getKeyResult(keyResultId);
        if (!keyResult || !keyResult.projects) return;
        
        // Remove the project from the key result
        keyResult.projects = keyResult.projects.filter(p => p.id !== projectId);
        
        // Update the key result
        this.dataManager.updateKeyResult(keyResult);
        
        // Recalculate progress
        this.recalculateProgress();
    }
    
    /**
     * Add a key result to an objective
     * @param keyResult The key result to add
     * @param objectiveId ID of the objective
     */
    addKeyResultToObjective(keyResult: KeyResult, objectiveId: string): void {
        const objective = this.dataManager.getObjective(objectiveId);
        if (!objective) return;
        
        if (!objective.keyResults) {
            objective.keyResults = [];
        }
        
        // Add only if not already in the array
        if (!objective.keyResults.some(kr => kr.id === keyResult.id)) {
            objective.keyResults.push(keyResult);
            
            // Update the key result's objective ID
            keyResult.objectiveId = objectiveId;
            this.dataManager.updateKeyResult(keyResult);
            
            // Update the objective
            this.dataManager.updateObjective(objective);
            
            // Recalculate progress
            this.recalculateProgress();
        }
    }
    
    /**
     * Remove a key result from an objective
     * @param keyResultId ID of the key result to remove
     * @param objectiveId ID of the objective
     */
    removeKeyResultFromObjective(keyResultId: string, objectiveId: string): void {
        const objective = this.dataManager.getObjective(objectiveId);
        if (!objective || !objective.keyResults) return;
        
        // Remove the key result from the objective
        objective.keyResults = objective.keyResults.filter(kr => kr.id !== keyResultId);
        
        // Update the objective
        this.dataManager.updateObjective(objective);
        
        // Recalculate progress
        this.recalculateProgress();
    }
}