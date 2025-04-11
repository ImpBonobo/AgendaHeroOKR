import { App, Notice } from 'obsidian';
import AgendaHeroOKRPlugin from '../../../main';
import { ScrumBoardManager } from './scrum-board-manager';
import * as dragulaModule from 'dragula';
// @ts-ignore
const dragula = dragulaModule.default || dragulaModule;

/**
 * Manages drag and drop functionality for the Scrum board
 */
export class ScrumBoardDragDropManager {
    private plugin: AgendaHeroOKRPlugin;
    private app: App;
    private boardManager: ScrumBoardManager;
    private drake: any; // Dragula instance
    
    /**
     * Constructor
     * @param plugin The plugin instance
     * @param app The Obsidian app instance
     * @param boardManager The board manager instance
     */
    constructor(
        plugin: AgendaHeroOKRPlugin,
        app: App,
        boardManager: ScrumBoardManager
    ) {
        this.plugin = plugin;
        this.app = app;
        this.boardManager = boardManager;
    }
    
    /**
     * Initialize drag and drop functionality
     * @param columnsContainer Container element with columns
     */
    initDragAndDrop(columnsContainer: HTMLElement): void {
        // Clean up any existing drake instance
        if (this.drake) {
            this.drake.destroy();
        }
        
        // Get all column task containers
        const containers = Array.from(
            columnsContainer.querySelectorAll('.agenda-hero-okr-column-tasks')
        );
        
        if (containers.length === 0) {
            console.log('No containers found for drag and drop');
            return;
        }
        
        // Initialize Dragula
        try {
            this.drake = dragula(containers as any, {
                moves: (el, container, handle, sibling) => {
                    // Only allow dragging task items
                    return el ? el.classList.contains('agenda-hero-okr-task-item') : false;
                },
                accepts: (el, target, source, sibling) => {
                    // Allow dropping in any column
                    return el && target ? true : false;
                },
                revertOnSpill: true // Return to original position if dropped outside
            });
            
            // Handle drop events
            this.drake.on('drop', (el, target, source, sibling) => {
                this.handleDrop(el, target, source, sibling);
            });
            
            console.log('Drag and drop initialized successfully');
        } catch (error) {
            console.error('Error initializing drag and drop:', error);
        }
    }
    
    /**
     * Handle drop event
     * @param el Element being dropped
     * @param target Target container
     * @param source Source container
     * @param sibling Next sibling element
     */
    private handleDrop(el: Element, target: Element, source: Element, sibling: Element): void {
        if (!el || !target) return;
        
        // Get task ID and column ID
        const taskId = el.getAttribute('data-task-id');
        const columnId = target.getAttribute('data-column-id');
        
        if (!taskId || !columnId) {
            console.log('Missing task or column ID for drag and drop');
            return;
        }
        
        // Find task
        const task = this.plugin.okrService.getTask(taskId);
        if (!task) {
            console.log('Task not found:', taskId);
            return;
        }
        
        // Update task status based on column
        const newStatus = this.boardManager.getStatusFromColumnId(columnId);
        if (task.status !== newStatus) {
            task.status = newStatus as any; // Type assertion to bypass type checking
            
            // Update completed status
            task.completed = (newStatus === 'completed' || newStatus === 'canceled');
            
            // Update task
            this.plugin.okrService.updateTask(task)
                .then(() => {
                    new Notice(`Task moved to ${this.boardManager.getColumnTitle(columnId)}`);
                })
                .catch(error => {
                    console.error('Error updating task:', error);
                    new Notice('Error updating task status');
                    
                    // Notify parent to re-render
                    // @ts-ignore - Obsidian API allows custom events
                    this.app.workspace.trigger('agenda-hero-okr:tasks-updated');
                });
        }
    }
    
    /**
     * Destroy the drag and drop instance
     */
    destroy(): void {
        if (this.drake) {
            this.drake.destroy();
            this.drake = null;
        }
    }
}