import { WorkspaceLeaf, ItemView, Notice, Modal, App } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../main';
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
    plugin: AgendaHeroOKRPlugin;
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

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'agenda-hero-okr-scrumboard';
    }

    getDisplayText(): string {
        return 'AgendaHeroOKR Scrum Board';
    }

    async onOpen() {
        // Create main container
        this.container = this.contentEl.createDiv({ cls: 'agenda-hero-okr-scrumboard-container' });
        
        // Create header container
        this.headerContainer = this.container.createDiv({ cls: 'agenda-hero-okr-scrumboard-header' });
        
        // Create board title
        const titleContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-scrumboard-title-container' });
        titleContainer.createEl('h3', { text: 'Scrum Board' });
        
        // sprint info
        if (this.currentBoard) {
            const sprintInfo = titleContainer.createEl('div', { 
                cls: 'agenda-hero-okr-sprint-info',
                text: `Sprint: ${this.currentBoard.title} (${this.currentBoard.startDate.toLocaleDateString()} - ${this.currentBoard.endDate.toLocaleDateString()})`
            });
            sprintInfo.style.fontSize = "0.9em";
            sprintInfo.style.color = "var(--text-muted)";
        }

        // Create back button
        const backButton = titleContainer.createEl('button', {
            text: 'Back to Calendar',
            cls: 'agenda-hero-okr-back-button'
        });
        backButton.style.marginLeft = "10px";
        backButton.addEventListener('click', () => {
            // Open calendar view
            this.plugin.activateView('agenda-hero-okr-calendar');
        });

        // Create board controls
        const controlsContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-scrumboard-controls' });
        
        // Create board selector dropdown
        const boardSelector = controlsContainer.createEl('select', { cls: 'agenda-hero-okr-board-selector' });
        boardSelector.createEl('option', { text: 'Current Sprint', value: 'current' });
        
        // Create new board button
        const newBoardButton = controlsContainer.createEl('button', { 
            text: 'New Sprint',
            cls: 'agenda-hero-okr-new-board-button'
        });
        newBoardButton.addEventListener('click', () => {
            this.createNewBoard();
        });
        
        // Create column visibility controls
        const columnVisibilityContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-column-visibility' });
        columnVisibilityContainer.createEl('span', { text: 'Show columns: ' });
        
        // Create checkbox for each column
        this.columns.forEach(column => {
            const checkboxContainer = columnVisibilityContainer.createDiv({ cls: 'agenda-hero-okr-column-checkbox-container' });
            
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
        this.boardContainer = this.container.createDiv({ cls: 'agenda-hero-okr-scrumboard-board' });
        
        // Create columns container
        this.columnsContainer = this.boardContainer.createDiv({ cls: 'agenda-hero-okr-scrumboard-columns' });
        
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
        
        // Add flex container style
        this.columnsContainer.style.display = "flex";
        this.columnsContainer.style.flexDirection = "row";
        this.columnsContainer.style.gap = "15px";
        this.columnsContainer.style.height = "100%";
        this.columnsContainer.style.overflowX = "auto";
        
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
            cls: 'agenda-hero-okr-task-checkbox'
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
        // Clean up any existing drake instance
        if (this.drake) {
            this.drake.destroy();
        }
        
        // Get all column task containers
        const containers = Array.from(
            this.columnsContainer.querySelectorAll('.agenda-hero-okr-column-tasks')
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
                const newStatus = this.getStatusFromColumnId(columnId);
                if (task.status !== newStatus) {
                    task.status = newStatus as any; // Type assertion to bypass type checking
                    
                    // Update completed status
                    task.completed = (newStatus === 'completed' || newStatus === 'canceled');
                    
                    // Update task
                    this.plugin.okrService.updateTask(task)
                        .then(() => {
                            new Notice(`Task moved to ${this.getColumnTitle(columnId)}`);
                        })
                        .catch(error => {
                            console.error('Error updating task:', error);
                            new Notice('Error updating task status');
                            this.renderBoard(); // Re-render to reset position
                        });
                }
            });
            
            console.log('Drag and drop initialized successfully');
        } catch (error) {
            console.error('Error initializing drag and drop:', error);
        }
    }

    // Helper method to map column IDs to task statuses
    getStatusFromColumnId(columnId: string): string {
        switch (columnId) {
            case 'next-up': return 'next-up';
            case 'in-progress': return 'in-progress';
            case 'waiting-on': return 'waiting-on';
            case 'validating': return 'validating';
            case 'completed': return 'completed';
            case 'canceled': return 'canceled';
            default: return 'next-up';
        }
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
            this.app.workspace.on('agenda-hero-okr:tasks-updated', () => {
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
