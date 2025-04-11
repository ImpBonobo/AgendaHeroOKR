/**
 * OKR Data Manager
 * 
 * This service is responsible for managing the in-memory data structures
 * for all OKR entities (Objectives, Key Results, Projects, Tasks, Sprints).
 */

import { 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    Sprint
} from '../models/okr-models';
import { TimeBlockInfo } from '../utils/time-manager';

/**
 * Manages in-memory data for all OKR entities
 */
export class OkrDataManager {
    // Data stores
    private objectives: Objective[] = [];
    private keyResults: KeyResult[] = [];
    private projects: Project[] = [];
    private tasks: Task[] = [];
    private sprints: Sprint[] = [];
    private timeBlocks: TimeBlockInfo[] = [];
    
    // Event callbacks for data updates
    private updateCallbacks: Array<() => void> = [];
    
    constructor() {
        console.log('OKR Data Manager initialized');
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
    notifyUpdates(): void {
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
    
    // Getter methods for objectives
    
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
     * Set the objectives array
     * @param objectives Array of objectives
     */
    setObjectives(objectives: Objective[]): void {
        this.objectives = objectives;
    }
    
    /**
     * Add an objective to the data store
     * @param objective The objective to add
     */
    addObjective(objective: Objective): void {
        this.objectives.push(objective);
    }
    
    /**
     * Update an objective in the data store
     * @param objective The updated objective
     * @returns Whether the update was successful
     */
    updateObjective(objective: Objective): boolean {
        const index = this.objectives.findIndex(obj => obj.id === objective.id);
        if (index === -1) return false;
        
        this.objectives[index] = objective;
        return true;
    }
    
    /**
     * Remove an objective from the data store
     * @param id ID of the objective to remove
     * @returns Whether the removal was successful
     */
    removeObjective(id: string): boolean {
        const initialLength = this.objectives.length;
        this.objectives = this.objectives.filter(obj => obj.id !== id);
        return this.objectives.length < initialLength;
    }
    
    // Getter methods for key results
    
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
     * Set the key results array
     * @param keyResults Array of key results
     */
    setKeyResults(keyResults: KeyResult[]): void {
        this.keyResults = keyResults;
    }
    
    /**
     * Add a key result to the data store
     * @param keyResult The key result to add
     */
    addKeyResult(keyResult: KeyResult): void {
        this.keyResults.push(keyResult);
    }
    
    /**
     * Update a key result in the data store
     * @param keyResult The updated key result
     * @returns Whether the update was successful
     */
    updateKeyResult(keyResult: KeyResult): boolean {
        const index = this.keyResults.findIndex(kr => kr.id === keyResult.id);
        if (index === -1) return false;
        
        this.keyResults[index] = keyResult;
        return true;
    }
    
    /**
     * Remove a key result from the data store
     * @param id ID of the key result to remove
     * @returns Whether the removal was successful
     */
    removeKeyResult(id: string): boolean {
        const initialLength = this.keyResults.length;
        this.keyResults = this.keyResults.filter(kr => kr.id !== id);
        return this.keyResults.length < initialLength;
    }
    
    // Getter methods for projects
    
    /**
     * Get all projects
     * @returns Array of projects
     */
    getProjects(): Project[] {
        return [...this.projects];
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
     * Set the projects array
     * @param projects Array of projects
     */
    setProjects(projects: Project[]): void {
        this.projects = projects;
    }
    
    /**
     * Add a project to the data store
     * @param project The project to add
     */
    addProject(project: Project): void {
        this.projects.push(project);
    }
    
    /**
     * Update a project in the data store
     * @param project The updated project
     * @returns Whether the update was successful
     */
    updateProject(project: Project): boolean {
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index === -1) return false;
        
        this.projects[index] = project;
        return true;
    }
    
    /**
     * Remove a project from the data store
     * @param id ID of the project to remove
     * @returns Whether the removal was successful
     */
    removeProject(id: string): boolean {
        const initialLength = this.projects.length;
        this.projects = this.projects.filter(p => p.id !== id);
        return this.projects.length < initialLength;
    }
    
    // Getter methods for tasks
    
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
    
    /**
     * Set the tasks array
     * @param tasks Array of tasks
     */
    setTasks(tasks: Task[]): void {
        this.tasks = tasks;
    }
    
    /**
     * Add a task to the data store
     * @param task The task to add
     */
    addTask(task: Task): void {
        this.tasks.push(task);
    }
    
    /**
     * Update a task in the data store
     * @param task The updated task
     * @returns Whether the update was successful
     */
    updateTask(task: Task): boolean {
        const index = this.tasks.findIndex(t => t.id === task.id);
        if (index === -1) return false;
        
        this.tasks[index] = task;
        return true;
    }
    
    /**
     * Remove a task from the data store
     * @param id ID of the task to remove
     * @returns Whether the removal was successful
     */
    removeTask(id: string): boolean {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(t => t.id !== id);
        return this.tasks.length < initialLength;
    }
    
    // Getter methods for sprints
    
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
     * Set the sprints array
     * @param sprints Array of sprints
     */
    setSprints(sprints: Sprint[]): void {
        this.sprints = sprints;
    }
    
    /**
     * Add a sprint to the data store
     * @param sprint The sprint to add
     */
    addSprint(sprint: Sprint): void {
        this.sprints.push(sprint);
    }
    
    /**
     * Update a sprint in the data store
     * @param sprint The updated sprint
     * @returns Whether the update was successful
     */
    updateSprint(sprint: Sprint): boolean {
        const index = this.sprints.findIndex(s => s.id === sprint.id);
        if (index === -1) return false;
        
        this.sprints[index] = sprint;
        return true;
    }
    
    /**
     * Remove a sprint from the data store
     * @param id ID of the sprint to remove
     * @returns Whether the removal was successful
     */
    removeSprint(id: string): boolean {
        const initialLength = this.sprints.length;
        this.sprints = this.sprints.filter(s => s.id !== id);
        return this.sprints.length < initialLength;
    }
    
    // Methods for time blocks
    
    /**
     * Get all time blocks
     * @returns Array of time blocks
     */
    getTimeBlocks(): TimeBlockInfo[] {
        return [...this.timeBlocks];
    }
    
    /**
     * Set the time blocks array
     * @param timeBlocks Array of time blocks
     */
    setTimeBlocks(timeBlocks: TimeBlockInfo[]): void {
        this.timeBlocks = timeBlocks;
    }
    
    /**
     * Add time blocks to the data store
     * @param blocks The time blocks to add
     */
    addTimeBlocks(blocks: TimeBlockInfo[]): void {
        this.timeBlocks.push(...blocks);
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
     * Get time blocks for a specific time range
     * @param startDate Start of the time range
     * @param endDate End of the time range
     * @returns Time blocks within the specified range
     */
    getTimeBlocksInRange(startDate: Date, endDate: Date): TimeBlockInfo[] {
        return this.timeBlocks.filter(block => 
            (block.start >= startDate && block.start < endDate) ||
            (block.end > startDate && block.end <= endDate) ||
            (block.start <= startDate && block.end >= endDate)
        );
    }
    
    /**
     * Remove time blocks for a specific task
     * @param taskId ID of the task
     */
    removeTimeBlocksForTask(taskId: string): void {
        this.timeBlocks = this.timeBlocks.filter(block => block.taskId !== taskId);
    }
}