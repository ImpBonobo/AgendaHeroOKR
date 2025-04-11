import { WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../../main';
import { TaskListFilterManager } from './task-list-filter-manager';
import { TaskListPreviewRenderer, TaskListPreviewOptions } from './task-list-preview-renderer';
import { TaskListDragDropManager } from './task-list-drag-drop-manager';
import { TaskListEditModal } from '../../components/task-list-edit-modal';

/**
 * Task List View for managing and displaying tasks
 */
export class TaskListView extends MarkdownView {
    plugin: AgendaHeroOKRPlugin;
    container: HTMLElement;
    filterContainer: HTMLElement;
    taskListContainer: HTMLElement;
    headerContainer: HTMLElement;
    
    // Components
    filterManager: TaskListFilterManager;
    previewRenderer: TaskListPreviewRenderer;
    dragDropManager: TaskListDragDropManager;
    
    /**
     * Constructor
     * @param leaf Workspace leaf
     * @param plugin Plugin instance
     */
    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
    }
    
    /**
     * Get view type
     * @returns View type string
     */
    getViewType(): string {
        return 'agenda-hero-okr-tasklist';
    }
    
    /**
     * Get display text
     * @returns Display text string
     */
    getDisplayText(): string {
        return 'AgendaHero-okr Task List';
    }
    
    /**
     * Handle view open event
     */
    async onOpen() {
        // Create container for the task list
        this.container = this.contentEl.createDiv({ cls: 'agenda-hero-okr-tasklist-container' });
        
        // Create header container
        this.headerContainer = this.container.createDiv({ cls: 'agenda-hero-okr-tasklist-header' });
        this.headerContainer.createEl('h3', { text: 'Tasks' });
        
        // Create navigation buttons
        this.createNavigationButtons();
        
        // Create view buttons
        this.createViewButtons();
        
        // Create filter container
        this.filterContainer = this.container.createDiv({ cls: 'agenda-hero-okr-filters' });
        
        // Initialize filter manager
        this.filterManager = new TaskListFilterManager(this.plugin, this.filterContainer);
        this.filterManager.createFilterUI();
        
        // Create container for task list
        this.taskListContainer = this.container.createDiv({ cls: 'agenda-hero-okr-tasks' });
        
        // Initialize preview renderer
        this.previewRenderer = new TaskListPreviewRenderer(this.plugin);
        
        // Initialize drag & drop manager
        this.dragDropManager = new TaskListDragDropManager(this.plugin, this.app, this.taskListContainer);
        this.dragDropManager.initDragAndDrop();
        
        // Render tasks
        this.renderTasks();
        
        // Event listener for task updates
        this.registerEvent(
            // @ts-ignore - Obsidian API allows custom events
            this.app.workspace.on('agenda-hero-okr:tasks-updated', () => {
                this.renderTasks();
                this.filterManager.updateProjectsCache();
            })
        );
    }
    
    /**
     * Create navigation buttons for switching between views
     */
    private createNavigationButtons() {
        // Add view navigation
        const navContainer = this.headerContainer.createDiv({ 
            cls: 'agenda-hero-okr-view-navigation' 
        });

        // Calendar View button
        const calendarButton = navContainer.createEl('button', {
            text: 'Calendar View',
            cls: 'agenda-hero-okr-view-button'
        });
        calendarButton.style.marginRight = '10px';
        calendarButton.addEventListener('click', () => {
            this.plugin.activateView('agenda-hero-okr-calendar');
        });

        // Tasklist View button (current)
        const tasklistButton = navContainer.createEl('button', {
            text: 'Task List',
            cls: 'agenda-hero-okr-view-button active'
        });
        tasklistButton.style.marginRight = '10px';

        // Scrumboard View button
        const scrumboardButton = navContainer.createEl('button', {
            text: 'Scrum Board',
            cls: 'agenda-hero-okr-view-button'
        });
        scrumboardButton.addEventListener('click', () => {
            this.plugin.activateView('agenda-hero-okr-scrumboard');
        });
    }
    
    /**
     * Create view buttons for different task filters
     */
    private createViewButtons() {
        // Buttons for different views
        const viewButtons = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-view-buttons' });
        
        const allButton = viewButtons.createEl('button', { 
            text: 'All',
            cls: 'agenda-hero-okr-view-button active'
        });
        allButton.addEventListener('click', () => {
            this.setActiveButton(allButton);
            this.renderTasks();
        });
        
        const todayButton = viewButtons.createEl('button', { 
            text: 'Today',
            cls: 'agenda-hero-okr-view-button'
        });
        todayButton.addEventListener('click', () => {
            this.setActiveButton(todayButton);
            this.renderTasks('today');
        });
        
        const upcomingButton = viewButtons.createEl('button', { 
            text: 'Upcoming',
            cls: 'agenda-hero-okr-view-button'
        });
        upcomingButton.addEventListener('click', () => {
            this.setActiveButton(upcomingButton);
            this.renderTasks('upcoming');
        });
    }
    
    /**
     * Helper method to set active button
     * @param activeButton Button to set as active
     */
    setActiveButton(activeButton: HTMLElement) {
        this.headerContainer.querySelectorAll('.agenda-hero-okr-view-button').forEach(button => {
            button.removeClass('active');
        });
        activeButton.addClass('active');
    }
    
    /**
     * Render tasks with optional view filter
     * @param viewFilter Optional view filter (today, upcoming)
     */
    renderTasks(viewFilter?: string) {
        // Clear task list
        this.taskListContainer.empty();
        
        // Get filtered tasks
        let filteredTasks = this.filterManager.getFilteredTasks(viewFilter);
        
        // No tasks available?
        if (filteredTasks.length === 0) {
            this.taskListContainer.createEl('p', { text: 'No tasks found.' });
            return;
        }
        
        // Create task list
        const taskList = this.taskListContainer.createEl('ul', { cls: 'agenda-hero-okr-task-list' });
        
        // Collect projects (source files) for filtering
        const projects = new Set<string>();
        
        // Add tasks
        filteredTasks.forEach(task => {
            // Extract project (source file) and add to set
            const project = this.filterManager.getProjectFromPath(task.sourcePath);
            if (project) {
                projects.add(project);
            }
            
            // Create task item
            const taskItem = taskList.createEl('li', { cls: 'agenda-hero-okr-task-item' });
            
            // Add task ID as attribute for drag & drop
            taskItem.setAttribute('data-task-id', task.id);
            
            // Create task preview (compact view)
            this.previewRenderer.createTaskPreview(
                taskItem,
                task,
                { showDetails: false, showActions: true },
                (task) => this.editTask(task),
                (task) => this.deleteTask(task)
            );
            
            // Add click event for preview
            taskItem.addEventListener('click', (e) => {
                // Only react if not clicked on checkbox or button
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON') {
                    // Remove existing preview
                    taskItem.empty();
                    
                    // Show detailed preview
                    this.previewRenderer.createTaskPreview(
                        taskItem, 
                        task, 
                        { showDetails: true, showActions: true },
                        (task) => this.editTask(task),
                        (task) => this.deleteTask(task)
                    );
                }
            });
        });
        
        // Update project filter
        this.filterManager.updateProjectFilter(Array.from(projects));
    }
    
    /**
     * Edit a task
     * @param task Task to edit
     */
    editTask(task: Task) {
        // Open task edit modal
        const modal = new TaskListEditModal(this.app, task, (updatedTask) => {
            // Update task
            Object.assign(task, updatedTask);
            
            // Update task in file
            this.plugin.updateTaskInFile(task);
            
            // Update task list
            this.renderTasks();
        });
        
        modal.open();
    }
    
    /**
     * Delete a task
     * @param task Task to delete
     */
    deleteTask(task: Task) {
        // Show confirmation dialog
        const confirmDelete = confirm(`Are you sure you want to delete task "${task.content}"?`);
        
        if (confirmDelete) {
            // Remove task from list
            this.plugin.tasks = this.plugin.tasks.filter(t => t.id !== task.id);
            
            // Remove task from file
            // A method would need to be implemented to remove the task
            // from the source file - for the prototype, we'll skip this for now
            
            // Update task list
            this.renderTasks();
        }
    }
    
    /**
     * Handle view close event
     */
    async onClose() {
        // Clean-up drag and drop
        this.dragDropManager.destroy();
    }
}