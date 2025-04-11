import { App } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../../main';
import * as dragulaModule from 'dragula';
// @ts-ignore
const dragula = dragulaModule.default || dragulaModule;

/**
 * Manages drag and drop functionality for the task list
 */
export class TaskListDragDropManager {
    plugin: AgendaHeroOKRPlugin;
    container: HTMLElement;
    app: App;
    drake: any; // Dragula instance
    
    /**
     * Constructor 
     * @param plugin Plugin instance
     * @param app Obsidian app instance
     * @param container Container element for tasks
     */
    constructor(plugin: AgendaHeroOKRPlugin, app: App, container: HTMLElement) {
        this.plugin = plugin;
        this.app = app;
        this.container = container;
    }
    
    /**
     * Initialize drag and drop functionality
     */
    initDragAndDrop() {
        // Initialize Dragula
        this.drake = dragula([this.container], {
            moves: (el: HTMLElement, container: HTMLElement, handle: HTMLElement) => {
                // Only task items can be moved
                return el.classList.contains('agenda-hero-okr-task-item');
            },
            copy: true, // Create a copy, so the original stays in the list
            accepts: (el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement) => {
                // Elements cannot be dropped within the task list
                return false;
            }
        });
        
        // Event handler for dragging tasks
        this.drake.on('drag', (el: HTMLElement) => {
            // Extract task ID from element
            const taskId = el.getAttribute('data-task-id');
            if (!taskId) return;
            
            // Find task
            const task = this.plugin.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Add class to indicate a task is being dragged
            document.body.classList.add('agenda-hero-okr-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero-okr:task-drag-start', { taskId, task });
        });
        
        // Event handler for drag end
        this.drake.on('dragend', (el: HTMLElement) => {
            // Remove class
            document.body.classList.remove('agenda-hero-okr-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero-okr:task-drag-end');
        });
        
        // Event handler for dropping tasks
        this.drake.on('drop', (el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement) => {
            // If no target, the task was not dropped
            if (!target) return;
            
            // Extract task ID from element
            const taskId = el.getAttribute('data-task-id');
            if (!taskId) return;
            
            // Find task
            const task = this.plugin.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero-okr:task-dropped', { taskId, task, target });
        });
        
        // Event handler for cancel
        this.drake.on('cancel', () => {
            // Remove class
            document.body.classList.remove('agenda-hero-okr-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero-okr:task-drag-cancel');
        });
    }
    
    /**
     * Cleanup drag and drop functionality
     */
    destroy() {
        if (this.drake) {
            this.drake.destroy();
        }
    }
}