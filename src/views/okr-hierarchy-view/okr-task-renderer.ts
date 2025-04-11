import { App, Notice } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { Task } from '../../models/okr-models';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Responsible for rendering tasks in the OKR hierarchy
 */
export class OkrTaskRenderer {
    private app: App;
    private okrService: OkrService;
    private okrOperations: OkrHierarchyOperations;
    
    /**
     * Constructor
     * @param app Obsidian app instance
     * @param okrService OKR service instance
     * @param okrOperations OKR hierarchy operations
     */
    constructor(
        app: App, 
        okrService: OkrService,
        okrOperations: OkrHierarchyOperations
    ) {
        this.app = app;
        this.okrService = okrService;
        this.okrOperations = okrOperations;
    }
    
    /**
     * Render a task
     * @param container Container element
     * @param task Task to render
     */
    renderTask(container: HTMLElement, task: Task): void {
        // Create task item
        const taskItem = container.createEl('li', { 
            cls: 'agenda-hero-okr-task-item' 
        });
        
        // Add checkbox
        const checkbox = taskItem.createEl('input', {
            type: 'checkbox',
            cls: 'agenda-hero-okr-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.okrService.updateTask(task);
        });
        
        // Add task content
        const contentContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-okr-task-content-container'
        });
        
        // Add title
        const title = contentContainer.createEl('span', {
            text: task.title,
            cls: task.completed ? 'agenda-hero-okr-task-content completed' : 'agenda-hero-okr-task-content'
        });
        
        // Add due date if present
        if (task.dueDate) {
            contentContainer.createEl('div', {
                text: `Due: ${task.dueDate.toLocaleDateString()}`,
                cls: 'agenda-hero-okr-task-due-date'
            });
        }
        
        // Add estimated duration if present
        if (task.estimatedDuration) {
            contentContainer.createEl('div', {
                text: `Est. Duration: ${task.estimatedDuration} minutes`,
                cls: 'agenda-hero-okr-task-duration'
            });
        }
        
        // Add scheduling info
        const schedulingInfo: string[] = []; // Explizit als String-Array typisieren
        if (task.autoSchedule !== undefined) {
            schedulingInfo.push(`Auto-Schedule: ${task.autoSchedule ? 'Yes' : 'No'}`);
        }
        if (task.recurring) {
            schedulingInfo.push(`Recurring: ${task.recurrenceRule || 'Yes'}`);
        }
        
        if (schedulingInfo.length > 0) {
            contentContainer.createEl('div', {
                text: schedulingInfo.join(' | '),
                cls: 'agenda-hero-okr-task-scheduling'
            });
        }
        
        // Add buttons
        const buttonContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-okr-task-actions'
        });
        
        const editButton = buttonContainer.createEl('button', {
            text: 'Edit',
            cls: 'agenda-hero-okr-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.okrOperations.editTask(task);
        });
        
        // Add delete button for tasks
        const deleteButton = buttonContainer.createEl('button', {
            text: 'Delete',
            cls: 'agenda-hero-okr-small-button'
        });
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this task?')) {
                this.okrService.deleteTask(task.id)
                    .then(() => {
                        new Notice('Task deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting task:', error);
                        new Notice('Error deleting task');
                    });
            }
        });
    }
}