import { App, Notice } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../../main';

/**
 * Responsible for rendering and handling tasks in the Scrum board
 */
export class ScrumTaskRenderer {
    private plugin: AgendaHeroOKRPlugin;
    private app: App;
    private onEditTask: (task: Task) => void;
    
    /**
     * Constructor
     * @param plugin The plugin instance
     * @param app The Obsidian app instance
     * @param onEditTask Callback when a task is edited
     */
    constructor(
        plugin: AgendaHeroOKRPlugin, 
        app: App,
        onEditTask: (task: Task) => void
    ) {
        this.plugin = plugin;
        this.app = app;
        this.onEditTask = onEditTask;
    }
    
    /**
     * Render a task in the container
     * @param container Container element
     * @param task Task to render
     */
    renderTask(container: HTMLElement, task: Task): void {
        // Create checkbox for status
        const checkbox = container.createEl('input', { 
            type: 'checkbox',
            cls: 'agenda-hero-okr-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.plugin.updateTaskInFile(task);
            
            // Notify parent component to re-render
            // @ts-ignore - Obsidian API allows custom events
            this.app.workspace.trigger('agenda-hero-okr:tasks-updated');
        });
        
        // Create priority indicator
        const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
        const priorityIndicator = container.createEl('span', { 
            cls: 'agenda-hero-okr-priority',
            attr: { style: `background-color: ${priorityColors[task.priority - 1]};` }
        });
        
        // Create task content container
        const contentContainer = container.createEl('div', { cls: 'agenda-hero-okr-task-content-container' });
        
        // Create task title
        const content = contentContainer.createEl('span', { 
            text: task.content,
            cls: 'agenda-hero-okr-task-content'
        });
        
        if (task.completed) {
            content.addClass('agenda-hero-okr-completed');
        }
        
        // Create project name
        const project = this.getProjectFromPath(task.sourcePath);
        if (project) {
            contentContainer.createEl('div', {
                text: project,
                cls: 'agenda-hero-okr-task-project'
            });
        }
        
        // Create due date
        if (task.dueDate) {
            contentContainer.createEl('div', {
                text: task.dueDate.toLocaleDateString(),
                cls: 'agenda-hero-okr-task-due-date'
            });
        }
        
        // Create action buttons
        const actions = container.createEl('div', { cls: 'agenda-hero-okr-task-actions' });
        
        // Edit button
        const editButton = actions.createEl('button', { text: 'Edit' });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onEditTask(task);
        });
    }
    
    /**
     * Extract project name from file path
     * @param path File path
     * @returns Project name or null
     */
    private getProjectFromPath(path: string): string | null {
        if (!path) return null;
        
        // Extract filename (without path)
        const fileName = path.split('/').pop();
        if (!fileName) return null;
        
        // Remove extension
        return fileName.replace(/\.[^/.]+$/, '');
    }
    
    /**
     * Update task status
     * @param task Task to update
     * @param columnId Column ID
     */
    updateTaskStatus(task: Task, columnId: string): void {
        // Update task status based on column
        if (columnId === 'completed') {
            task.completed = true;
        } else if (columnId === 'canceled') {
            task.completed = true; // Mark as completed for canceled tasks too
        } else {
            task.completed = false;
        }
        
        // Update task in file
        this.plugin.updateTaskInFile(task);
    }
}