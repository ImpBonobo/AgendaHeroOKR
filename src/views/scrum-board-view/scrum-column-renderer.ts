import { App } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../../main';
import { ScrumColumn } from './scrum-board-manager';
import { ScrumTaskRenderer } from './scrum-task-renderer';

/**
 * Responsible for rendering columns and their content in the Scrum board
 */
export class ScrumColumnRenderer {
    private plugin: AgendaHeroOKRPlugin;
    private app: App;
    private taskRenderer: ScrumTaskRenderer;
    
    /**
     * Constructor
     * @param plugin The plugin instance
     * @param app The Obsidian app instance
     * @param taskRenderer The task renderer instance
     */
    constructor(plugin: AgendaHeroOKRPlugin, app: App, taskRenderer: ScrumTaskRenderer) {
        this.plugin = plugin;
        this.app = app;
        this.taskRenderer = taskRenderer;
    }
    
    /**
     * Render columns in the container
     * @param columnsContainer Container element for columns
     * @param columns Array of columns to render
     */
    renderColumns(columnsContainer: HTMLElement, columns: ScrumColumn[]): void {
        // Clear columns container
        columnsContainer.empty();
        
        // Add flex container style
        columnsContainer.style.display = "flex";
        columnsContainer.style.flexDirection = "row";
        columnsContainer.style.gap = "15px";
        columnsContainer.style.height = "100%";
        columnsContainer.style.overflowX = "auto";
        
        // Render each visible column
        columns.forEach(column => {
            if (column.visible) {
                this.renderColumn(columnsContainer, column);
            }
        });
    }
    
    /**
     * Render a single column
     * @param container Container element
     * @param column Column to render
     */
    private renderColumn(container: HTMLElement, column: ScrumColumn): void {
        // Create column container
        const columnContainer = container.createDiv({ 
            cls: 'agenda-hero-okr-scrumboard-column',
            attr: { 'data-column-id': column.id }
        });
        
        // Add column styles
        columnContainer.style.width = "250px";
        columnContainer.style.minWidth = "250px";
        columnContainer.style.display = "flex";
        columnContainer.style.flexDirection = "column";
        columnContainer.style.backgroundColor = "var(--background-secondary-alt)";
        columnContainer.style.borderRadius = "4px";
        columnContainer.style.height = "100%";
        
        // Create column header
        const columnHeader = columnContainer.createDiv({ cls: 'agenda-hero-okr-column-header' });
        columnHeader.createEl('h4', { text: column.title });
        
        // Create task list container
        const taskListContainer = columnContainer.createDiv({ 
            cls: 'agenda-hero-okr-column-tasks',
            attr: { 'data-column-id': column.id }
        });
        
        // Add styles to make it scrollable
        taskListContainer.style.flexGrow = "1";
        taskListContainer.style.overflowY = "auto";
        taskListContainer.style.padding = "10px";
        
        // Filter tasks for this column
        const columnTasks = this.getTasksForColumn(column);
        
        // Create task items
        if (columnTasks.length === 0) {
            taskListContainer.createEl('p', { 
                text: 'No tasks',
                cls: 'agenda-hero-okr-empty-column'
            });
        } else {
            const taskList = taskListContainer.createEl('ul', { cls: 'agenda-hero-okr-task-list' });
            
            columnTasks.forEach(task => {
                const taskItem = taskList.createEl('li', { cls: 'agenda-hero-okr-task-item' });
                
                // Add task ID as data attribute for drag and drop
                taskItem.setAttribute('data-task-id', task.id);
                
                // Create task preview using the task renderer
                this.taskRenderer.renderTask(taskItem, task);
            });
        }
    }
    
    /**
     * Get tasks for a specific column
     * @param column The column
     * @returns Array of tasks for the column
     */
    private getTasksForColumn(column: ScrumColumn): Task[] {
        // Filter tasks based on column status
        return this.plugin.tasks.filter(task => {
            // For now, just distribute tasks across columns based on some criteria
            if (column.id === 'completed' && task.completed) {
                return true;
            }
            
            if (column.id === 'next-up' && !task.completed && task.dueDate && task.dueDate > new Date()) {
                return true;
            }
            
            // Add more conditions for other columns
            
            return false;
        });
    }
}