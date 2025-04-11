import { Task } from '../../../main';
import AgendaHeroOKRPlugin from '../../../main';

/**
 * Interface for task preview rendering options
 */
export interface TaskListPreviewOptions {
    showDetails: boolean;
    showActions: boolean;
}

/**
 * Handles rendering task previews and details in the task list view
 */
export class TaskListPreviewRenderer {
    plugin: AgendaHeroOKRPlugin;
    
    /**
     * Constructor
     * @param plugin Plugin instance
     */
    constructor(plugin: AgendaHeroOKRPlugin) {
        this.plugin = plugin;
    }
    
    /**
     * Creates a preview for a task
     * @param container The container element
     * @param task The task to display
     * @param options Options for display
     * @param onEdit Callback for edit action
     * @param onDelete Callback for delete action
     */
    createTaskPreview(
        container: HTMLElement, 
        task: Task, 
        options: TaskListPreviewOptions,
        onEdit?: (task: Task) => void,
        onDelete?: (task: Task) => void
    ) {
        // Checkbox for status
        const checkbox = container.createEl('input', { 
            type: 'checkbox',
            cls: 'agenda-hero-okr-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.plugin.updateTaskInFile(task);
        });
        
        // Priority indicator
        const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
        const priorityIndicator = container.createEl('span', { 
            cls: 'agenda-hero-okr-priority',
            attr: { style: `background-color: ${priorityColors[task.priority - 1]};` }
        });
        
        // Task content
        const contentContainer = container.createEl('div', { cls: 'agenda-hero-okr-task-content-container' });
        
        // Task title
        const content = contentContainer.createEl('span', { 
            text: task.content,
            cls: 'agenda-hero-okr-task-content'
        });
        
        if (task.completed) {
            content.addClass('agenda-hero-okr-completed');
        }
        
        // Detailed view
        if (options.showDetails) {
            this.renderDetailedView(contentContainer, task);
        } else {
            // Compact view: Only show due date
            if (task.dueDate) {
                contentContainer.createEl('span', {
                    text: task.dueDate.toLocaleDateString(),
                    cls: 'agenda-hero-okr-due-date'
                });
            }
        }
        
        // Action buttons
        if (options.showActions) {
            const actions = container.createEl('div', { cls: 'agenda-hero-okr-task-actions' });
            
            if (options.showDetails) {
                // Edit button
                const editButton = actions.createEl('button', { text: 'Edit' });
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    if (onEdit) onEdit(task);
                });
                
                // Delete button
                const deleteButton = actions.createEl('button', { text: 'Delete' });
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    if (onDelete) onDelete(task);
                });
                
                // Close button (back to compact view)
                const closeButton = actions.createEl('button', { text: 'Close' });
                closeButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    
                    // Return to compact view
                    container.empty();
                    this.createTaskPreview(container, task, {
                        showDetails: false,
                        showActions: true
                    }, onEdit, onDelete);
                });
            } else {
                // Details button
                const detailsButton = actions.createEl('button', { text: 'Details' });
                detailsButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    
                    // Remove existing preview
                    container.empty();
                    
                    // Show detailed preview
                    this.createTaskPreview(container, task, {
                        showDetails: true,
                        showActions: true
                    }, onEdit, onDelete);
                });
            }
        }
    }
    
    /**
     * Renders the detailed view of a task
     * @param container The container element
     * @param task The task to display
     */
    private renderDetailedView(container: HTMLElement, task: Task) {
        // Project (source file)
        const project = this.getProjectFromPath(task.sourcePath);
        if (project) {
            container.createEl('div', {
                text: `Project: ${project}`,
                cls: 'agenda-hero-okr-task-project'
            });
        }
        
        // Due date
        if (task.dueDate) {
            container.createEl('div', {
                text: `Due: ${task.dueDate.toLocaleString()}`,
                cls: 'agenda-hero-okr-task-due-date'
            });
        }
        
        // Priority as text
        const priorityTexts = ['High', 'Medium', 'Normal', 'Low'];
        container.createEl('div', {
            text: `Priority: ${priorityTexts[task.priority - 1]}`,
            cls: 'agenda-hero-okr-task-priority-text'
        });
        
        // Recurring?
        if (task.recurring) {
            container.createEl('div', {
                text: `Recurring: ${task.recurrenceRule || 'Yes'}`,
                cls: 'agenda-hero-okr-task-recurring'
            });
        }
        
        // Extract and display tags
        const tags = this.extractTags(task.content);
        if (tags.length > 0) {
            const tagsContainer = container.createEl('div', { cls: 'agenda-hero-okr-task-tags' });
            tagsContainer.createEl('span', { text: 'Tags: ' });
            
            tags.forEach((tag, index) => {
                tagsContainer.createEl('span', {
                    text: tag,
                    cls: 'agenda-hero-okr-task-tag'
                });
                
                if (index < tags.length - 1) {
                    tagsContainer.createEl('span', { text: ', ' });
                }
            });
        }
    }
    
    /**
     * Extract project name from file path
     * @param path The file path
     * @returns The project name (filename without extension)
     */
    getProjectFromPath(path: string): string | null {
        if (!path) return null;
        
        // Extract filename (without path)
        const fileName = path.split('/').pop();
        if (!fileName) return null;
        
        // Remove extension
        return fileName.replace(/\.[^/.]+$/, '');
    }
    
    /**
     * Extract tags from task content based on configured tags
     * @param content The task content
     * @returns Array of found tags
     */
    extractTags(content: string): string[] {
        if (!content) return [];
        
        const foundTags: string[] = [];
        
        // Search for configured tags
        for (const tag of this.plugin.settings.taskTags) {
            if (content.includes(tag)) {
                foundTags.push(tag);
            }
        }
        
        return foundTags;
    }
}