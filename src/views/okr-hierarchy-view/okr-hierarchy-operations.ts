import { App, Notice } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { 
    Objective, 
    KeyResult, 
    Project, 
    Task 
} from '../../models/okr-models';
import { 
    ObjectiveModal, 
    KeyResultModal, 
    ProjectModal, 
    TaskModal 
} from '../../components/okr-modals';

/**
 * Handles CRUD operations for all OKR elements
 */
export class OkrHierarchyOperations {
    private app: App;
    private okrService: OkrService;
    
    /**
     * Constructor
     * @param app Obsidian app instance
     * @param okrService OKR service instance
     */
    constructor(app: App, okrService: OkrService) {
        this.app = app;
        this.okrService = okrService;
    }
    
    /**
     * Create a new objective
     */
    createNewObjective(): void {
        const modal = new ObjectiveModal(this.app, this.okrService, async (objective) => {
            try {
                // Ensure required properties are present
                const completeObjective = {
                    title: objective.title || 'Untitled Objective', 
                    description: objective.description,
                    status: objective.status || 'future',
                    priority: objective.priority || 3,
                    tags: objective.tags || [],
                    startDate: objective.startDate || new Date(),
                    endDate: objective.endDate || new Date(),
                    progress: objective.progress ?? 0, // Use nullish coalescing to default to 0
                    quarter: objective.quarter,
                    sourcePath: '', // Add this missing property
                    keyResults: []  // Add this missing property
                };
                
                await this.okrService.createObjective(completeObjective);
                new Notice('Objective created successfully');
            } catch (error) {
                console.error('Error creating objective:', error);
                new Notice('Error creating objective');
            }
        });
        
        modal.open();
    }
    
    /**
     * Edit an existing objective
     * @param objective Objective to edit
     */
    editObjective(objective: Objective): void {
        const modal = new ObjectiveModal(this.app, this.okrService, async (updatedObjective) => {
            try {
                // Merge the existing and updated objective, then use type assertion
                const merged = { ...objective, ...updatedObjective };
                await this.okrService.updateObjective(merged as Objective);
                new Notice('Objective updated successfully');
            } catch (error) {
                console.error('Error updating objective:', error);
                new Notice('Error updating objective');
            }
        }, objective);
        
        modal.open();
    }
    
    /**
     * Create a new key result for an objective
     * @param objective Parent objective
     */
    createNewKeyResult(objective: Objective): void {
        const modal = new KeyResultModal(this.app, this.okrService, objective.id, async (keyResult) => {
            try {
                // Ensure required properties are present
                const completeKeyResult = {
                    title: keyResult.title || 'Untitled Key Result',
                    description: keyResult.description,
                    objectiveId: keyResult.objectiveId || objective.id,
                    status: keyResult.status || 'future',
                    priority: keyResult.priority || 3,
                    tags: keyResult.tags || [],
                    startDate: keyResult.startDate || new Date(),
                    endDate: keyResult.endDate || new Date(),
                    progress: keyResult.progress ?? 0,
                    sourcePath: '', // Add this
                    projects: [],   // Add this
                    metric: keyResult.metric,
                    startValue: keyResult.startValue,
                    targetValue: keyResult.targetValue,
                    currentValue: keyResult.currentValue,
                    format: keyResult.format
                };
                
                await this.okrService.createKeyResult(completeKeyResult);
                new Notice('Key Result created successfully');
            } catch (error) {
                console.error('Error creating key result:', error);
                new Notice('Error creating key result');
            }
        });
        
        modal.open();
    }
    
    /**
     * Edit an existing key result
     * @param keyResult Key result to edit
     */
    editKeyResult(keyResult: KeyResult): void {
        const modal = new KeyResultModal(this.app, this.okrService, keyResult.objectiveId, async (updatedKeyResult) => {
            try {
                // Merge the existing and updated key result
                const merged = { ...keyResult, ...updatedKeyResult };
                await this.okrService.updateKeyResult(merged as KeyResult);
                new Notice('Key Result updated successfully');
            } catch (error) {
                console.error('Error updating key result:', error);
                new Notice('Error updating key result');
            }
        }, keyResult);
        
        modal.open();
    }
    
    /**
     * Create a new project for a key result
     * @param keyResult Parent key result
     */
    createNewProject(keyResult: KeyResult): void {
        const modal = new ProjectModal(this.app, this.okrService, keyResult.id, async (project) => {
            try {
                // Ensure required properties are present
                const completeProject = {
                    title: project.title || 'Untitled Project',
                    description: project.description,
                    keyResultId: project.keyResultId || keyResult.id,
                    status: project.status || 'future',
                    priority: project.priority || 3,
                    tags: project.tags || [],
                    startDate: project.startDate || new Date(),
                    endDate: project.endDate || new Date(),
                    progress: project.progress ?? 0,
                    sourcePath: '', // Add this
                    tasks: [],      // Add this
                    sprintIds: project.sprintIds
                };
                
                await this.okrService.createProject(completeProject);
                new Notice('Project created successfully');
            } catch (error) {
                console.error('Error creating project:', error);
                new Notice('Error creating project');
            }
        });
        
        modal.open();
    }
    
    /**
     * Edit an existing project
     * @param project Project to edit
     */
    editProject(project: Project): void {
        const modal = new ProjectModal(this.app, this.okrService, project.keyResultId, async (updatedProject) => {
            try {
                // Merge the existing and updated project
                const merged = { ...project, ...updatedProject };
                await this.okrService.updateProject(merged as Project);
                new Notice('Project updated successfully');
            } catch (error) {
                console.error('Error updating project:', error);
                new Notice('Error updating project');
            }
        }, project);
        
        modal.open();
    }
    
    /**
     * Create a new task for a project
     * @param project Parent project
     */
    createNewTask(project: Project): void {
        const modal = new TaskModal(this.app, this.okrService, project.id, async (task) => {
            try {
                // Ensure required properties are present
                const completeTask = {
                    title: task.title || 'Untitled Task',
                    description: task.description,
                    projectId: task.projectId || project.id,
                    status: task.status || 'next-up',
                    priority: task.priority || 3,
                    tags: task.tags || [],
                    sourcePath: '', // Add this
                    dueDate: task.dueDate || null, // Add || null to convert undefined to null
                    completed: task.completed || false,
                    recurring: task.recurring || false,
                    recurrenceRule: task.recurrenceRule,
                    estimatedDuration: task.estimatedDuration,
                    splitUpBlock: task.splitUpBlock,
                    timeDefense: task.timeDefense,
                    allowedTimeWindows: task.allowedTimeWindows,
                    autoSchedule: task.autoSchedule,
                    scheduledBlocks: task.scheduledBlocks,
                    conflictBehavior: task.conflictBehavior || 'reschedule'
                };
                
                await this.okrService.createTask(completeTask);
                new Notice('Task created successfully');
            } catch (error) {
                console.error('Error creating task:', error);
                new Notice('Error creating task');
            }
        });
        
        modal.open();
    }
    
    /**
     * Edit an existing task
     * @param task Task to edit
     */
    editTask(task: Task): void {
        const modal = new TaskModal(this.app, this.okrService, task.projectId, async (updatedTask) => {
            try {
                // Merge the existing and updated task
                const merged = { ...task, ...updatedTask };
                await this.okrService.updateTask(merged as Task);
                new Notice('Task updated successfully');
            } catch (error) {
                console.error('Error updating task:', error);
                new Notice('Error updating task');
            }
        }, task);
        
        modal.open();
    }
}