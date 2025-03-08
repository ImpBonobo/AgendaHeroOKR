import { WorkspaceLeaf, ItemView, Notice, Modal, App } from 'obsidian';
import AgendaHeroPlugin, { Task } from '../../main';
import * as dragulaModule from 'dragula';
// @ts-ignore
const dragula = dragulaModule.default || dragulaModule;

// Interface for ScrumBoard
interface ScrumBoard {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    sprintNumber: number;
    month: number;
    quarter: number;
    year: number;
}

// Interface for ScrumColumn
interface ScrumColumn {
    id: string;
    title: string;
    status: string;
    visible: boolean;
}

export class ScrumBoardView extends ItemView {
    plugin: AgendaHeroPlugin;
    container: HTMLElement;
    headerContainer: HTMLElement;
    boardContainer: HTMLElement;
    columnsContainer: HTMLElement;
    drake: any; // Dragula instance
    
    // Scrum board data
    currentBoard: ScrumBoard | null = null;
    columns: ScrumColumn[] = [
        { id: 'next-up', title: 'Next Up', status: 'next-up', visible: true },
        { id: 'waiting-on', title: 'Waiting On', status: 'waiting-on', visible: true },
        { id: 'validating', title: 'Validating', status: 'validating', visible: true },
        { id: 'completed', title: 'Completed', status: 'completed', visible: true },
        { id: 'canceled', title: 'Canceled', status: 'canceled', visible: true }
    ];

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'agenda-hero-scrumboard';
    }

    getDisplayText(): string {
        return 'AgendaHero Scrum Board';
    }

    async onOpen() {
        // Create main container
        this.container = this.contentEl.createDiv({ cls: 'agenda-hero-scrumboard-container' });
        
        // Create header container
        this.headerContainer = this.container.createDiv({ cls: 'agenda-hero-scrumboard-header' });
        
        // Create board title
        const titleContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-scrumboard-title-container' });
        titleContainer.createEl('h3', { text: 'Scrum Board' });
        
        // Create board controls
        const controlsContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-scrumboard-controls' });
        
        // Create board selector dropdown
        const boardSelector = controlsContainer.createEl('select', { cls: 'agenda-hero-board-selector' });
        boardSelector.createEl('option', { text: 'Current Sprint', value: 'current' });
        
        // Create new board button
        const newBoardButton = controlsContainer.createEl('button', { 
            text: 'New Sprint',
            cls: 'agenda-hero-new-board-button'
        });
        newBoardButton.addEventListener('click', () => {
            this.createNewBoard();
        });
        
        // Create column visibility controls
        const columnVisibilityContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-column-visibility' });
        columnVisibilityContainer.createEl('span', { text: 'Show columns: ' });
        
        // Create checkbox for each column
        this.columns.forEach(column => {
            const checkboxContainer = columnVisibilityContainer.createDiv({ cls: 'agenda-hero-column-checkbox-container' });
            
            const checkbox = checkboxContainer.createEl('input', {
                type: 'checkbox',
                attr: { id: `column-${column.id}` }
            });
            checkbox.checked = column.visible;
            
            checkboxContainer.createEl('label', {
                text: column.title,
                attr: { for: `column-${column.id}` }
            });
            
            checkbox.addEventListener('change', () => {
                column.visible = checkbox.checked;
                this.renderBoard();
            });
        });
        
        // Create board container
        this.boardContainer = this.container.createDiv({ cls: 'agenda-hero-scrumboard-board' });
        
        // Create columns container
        this.columnsContainer = this.boardContainer.createDiv({ cls: 'agenda-hero-scrumboard-columns' });
        
        // Initialize current board
        await this.initializeCurrentBoard();
        
        // Render the board
        this.renderBoard();
        
        // Initialize drag and drop
        this.initDragAndDrop();
        
        // Register event listeners
        this.registerEventListeners();
    }
    
    async initializeCurrentBoard() {
        // Create a new board for the current sprint if none exists
        const today = new Date();
        const startDate = new Date(today);
        const endDate = new Date(today);
        
        // Set start date to the beginning of the current sprint
        // (assuming 2-week sprints starting on the 1st and 15th of each month)
        if (today.getDate() < 15) {
            startDate.setDate(1);
        } else {
            startDate.setDate(15);
        }
        
        // Set end date to the end of the current sprint
        if (today.getDate() < 15) {
            endDate.setDate(14);
        } else {
            // Set to last day of the month
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
        }
        
        // Calculate sprint number (1 or 2 for the month)
        const sprintNumber = today.getDate() < 15 ? 1 : 2;
        
        // Calculate quarter (1-4)
        const quarter = Math.floor(today.getMonth() / 3) + 1;
        
        this.currentBoard = {
            id: `${today.getFullYear()}-${today.getMonth() + 1}-${sprintNumber}`,
            title: `${sprintNumber}SB ${today.getMonth() + 1}M ${quarter}Q ${today.getFullYear()}Y`,
            startDate: startDate,
            endDate: endDate,
            sprintNumber: sprintNumber,
            month: today.getMonth() + 1,
            quarter: quarter,
            year: today.getFullYear()
        };
    }
    
    renderBoard() {
        // Clear columns container
        this.columnsContainer.empty();
        
        // Render each visible column
        this.columns.forEach(column => {
            if (column.visible) {
                this.renderColumn(column);
            }
        });
    }
    
    renderColumn(column: ScrumColumn) {
        // Create column container
        const columnContainer = this.columnsContainer.createDiv({ 
            cls: 'agenda-hero-scrumboard-column',
            attr: { 'data-column-id': column.id }
        });
        
        // Create column header
        const columnHeader = columnContainer.createDiv({ cls: 'agenda-hero-column-header' });
        columnHeader.createEl('h4', { text: column.title });
        
        // Create task list container
        const taskListContainer = columnContainer.createDiv({ 
            cls: 'agenda-hero-column-tasks',
            attr: { 'data-column-id': column.id }
        });
        
        // Filter tasks for this column
        const columnTasks = this.getTasksForColumn(column);
        
        // Create task items
        if (columnTasks.length === 0) {
            taskListContainer.createEl('p', { 
                text: 'No tasks',
                cls: 'agenda-hero-empty-column'
            });
        } else {
            const taskList = taskListContainer.createEl('ul', { cls: 'agenda-hero-task-list' });
            
            columnTasks.forEach(task => {
                const taskItem = taskList.createEl('li', { cls: 'agenda-hero-task-item' });
                
                // Add task ID as data attribute for drag and drop
                taskItem.setAttribute('data-task-id', task.id);
                
                // Create task preview
                this.createTaskPreview(taskItem, task);
            });
        }
    }
    
    getTasksForColumn(column: ScrumColumn): Task[] {
        // Filter tasks based on column status
        // This is a placeholder implementation
        // In a real implementation, you would need to add a status field to the Task interface
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
    
    createTaskPreview(container: HTMLElement, task: Task) {
        // Create checkbox for status
        const checkbox = container.createEl('input', { 
            type: 'checkbox',
            cls: 'agenda-hero-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.plugin.updateTaskInFile(task);
            
            // Re-render the board to move the task to the appropriate column
            this.renderBoard();
        });
        
        // Create priority indicator
        const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
        const priorityIndicator = container.createEl('span', { 
            cls: 'agenda-hero-priority',
            attr: { style: `background-color: ${priorityColors[task.priority - 1]};` }
        });
        
        // Create task content container
        const contentContainer = container.createEl('div', { cls: 'agenda-hero-task-content-container' });
        
        // Create task title
        const content = contentContainer.createEl('span', { 
            text: task.content,
            cls: 'agenda-hero-task-content'
        });
        
        if (task.completed) {
            content.addClass('agenda-hero-completed');
        }
        
        // Create project name
        const project = this.getProjectFromPath(task.sourcePath);
        if (project) {
            contentContainer.createEl('div', {
                text: project,
                cls: 'agenda-hero-task-project'
            });
        }
        
        // Create due date
        if (task.dueDate) {
            contentContainer.createEl('div', {
                text: task.dueDate.toLocaleDateString(),
                cls: 'agenda-hero-task-due-date'
            });
        }
        
        // Create action buttons
        const actions = container.createEl('div', { cls: 'agenda-hero-task-actions' });
        
        // Edit button
        const editButton = actions.createEl('button', { text: 'Edit' });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editTask(task);
        });
    }
    
    getProjectFromPath(path: string): string | null {
        if (!path) return null;
        
        // Extract filename (without path)
        const fileName = path.split('/').pop();
        if (!fileName) return null;
        
        // Remove extension
        return fileName.replace(/\.[^/.]+$/, '');
    }
    
    editTask(task: Task) {
        // Open task edit modal
        // This would be similar to the one in TaskListView
        // For now, just show a notice
        new Notice(`Editing task: ${task.content}`);
    }
    
    initDragAndDrop() {
        // Get all column task containers
        const containers = Array.from(
            this.columnsContainer.querySelectorAll('.agenda-hero-column-tasks')
        );
        
        // Initialize Dragula
        this.drake = dragula(containers, {
            moves: (el: HTMLElement) => {
                return el.classList.contains('agenda-hero-task-item');
            },
            accepts: (el: HTMLElement, target: HTMLElement) => {
                return true; // Accept drops in any column
            }
        });
        
        // Handle drop events
        this.drake.on('drop', (el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement) => {
            // Get task ID and column ID
            const taskId = el.getAttribute('data-task-id');
            const columnId = target.getAttribute('data-column-id');
            
            if (!taskId || !columnId) return;
            
            // Find task
            const task = this.plugin.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Update task status based on column
            this.updateTaskStatus(task, columnId);
            
            // Update task in file
            this.plugin.updateTaskInFile(task);
            
            // Show notification
            new Notice(`Task moved to ${this.getColumnTitle(columnId)}`);
        });
    }
    
    updateTaskStatus(task: Task, columnId: string) {
        // Update task status based on column
        // This is a placeholder implementation
        // In a real implementation, you would need to add a status field to the Task interface
        
        // For now, just update the completed status
        if (columnId === 'completed') {
            task.completed = true;
        } else if (columnId === 'canceled') {
            task.completed = true; // Mark as completed for canceled tasks too
        } else {
            task.completed = false;
        }
    }
    
    getColumnTitle(columnId: string): string {
        const column = this.columns.find(c => c.id === columnId);
        return column ? column.title : 'Unknown';
    }
    
    createNewBoard() {
        // Create a new board for the next sprint
        // This is a placeholder implementation
        new Notice('Creating new sprint board...');
        
        // In a real implementation, you would:
        // 1. Save the current board to a file
        // 2. Create a new board for the next sprint
        // 3. Move incomplete tasks to the new board
        // 4. Update the UI
    }
    
    registerEventListeners() {
        // Listen for task updates
        this.registerEvent(
            // @ts-ignore - Obsidian API allows custom events
            this.app.workspace.on('agenda-hero:tasks-updated', () => {
                this.renderBoard();
            })
        );
    }

    async onClose() {
        // Clean up
        if (this.drake) {
            this.drake.destroy();
        }
    }
}
