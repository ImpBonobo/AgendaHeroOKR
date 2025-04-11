import { WorkspaceLeaf, ItemView, Notice } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../../main';
import { ScrumBoardManager } from './scrum-board-manager';
import { ScrumColumnRenderer } from './scrum-column-renderer';
import { ScrumTaskRenderer } from './scrum-task-renderer';
import { ScrumBoardDragDropManager } from './scrum-board-drag-drop-manager';

export class ScrumBoardView extends ItemView {
    plugin: AgendaHeroOKRPlugin;
    container: HTMLElement;
    headerContainer: HTMLElement;
    boardContainer: HTMLElement;
    columnsContainer: HTMLElement;
    
    // Component managers
    private boardManager: ScrumBoardManager;
    private columnRenderer: ScrumColumnRenderer;
    private taskRenderer: ScrumTaskRenderer;
    private dragDropManager: ScrumBoardDragDropManager;

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Initialize component managers
        this.boardManager = new ScrumBoardManager(plugin, this.app);
        this.taskRenderer = new ScrumTaskRenderer(plugin, this.app, (task) => this.editTask(task));
        this.columnRenderer = new ScrumColumnRenderer(plugin, this.app, this.taskRenderer);
        this.dragDropManager = new ScrumBoardDragDropManager(plugin, this.app, this.boardManager);
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
        
        // Initialize current board
        await this.boardManager.initializeCurrentBoard();
        
        // Create UI components
        this.createHeader();
        this.createBoardContainer();
        
        // Render the board
        this.renderBoard();
        
        // Initialize drag and drop
        this.dragDropManager.initDragAndDrop(this.columnsContainer);
        
        // Register event listeners
        this.registerEventListeners();
    }
    
    /**
     * Create header with controls
     */
    private createHeader() {
        // Create header container
        this.headerContainer = this.container.createDiv({ cls: 'agenda-hero-okr-scrumboard-header' });
        
        // Create board title
        const titleContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-scrumboard-title-container' });
        titleContainer.createEl('h3', { text: 'Scrum Board' });
        
        // Sprint info
        const currentBoard = this.boardManager.getCurrentBoard();
        if (currentBoard) {
            const sprintInfo = titleContainer.createEl('div', { 
                cls: 'agenda-hero-okr-sprint-info',
                text: `Sprint: ${currentBoard.title} (${currentBoard.startDate.toLocaleDateString()} - ${currentBoard.endDate.toLocaleDateString()})`
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
            this.boardManager.createNewBoard();
        });
        
        // Create column visibility controls
        const columnVisibilityContainer = this.headerContainer.createDiv({ cls: 'agenda-hero-okr-column-visibility' });
        columnVisibilityContainer.createEl('span', { text: 'Show columns: ' });
        
        // Create checkbox for each column
        const columns = this.boardManager.getColumns();
        columns.forEach(column => {
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
                this.boardManager.setColumnVisibility(column.id, checkbox.checked);
                this.renderBoard();
            });
        });
    }
    
    /**
     * Create board container
     */
    private createBoardContainer() {
        // Create board container
        this.boardContainer = this.container.createDiv({ cls: 'agenda-hero-okr-scrumboard-board' });
        
        // Create columns container
        this.columnsContainer = this.boardContainer.createDiv({ cls: 'agenda-hero-okr-scrumboard-columns' });
    }
    
    /**
     * Render the board with columns and tasks
     */
    renderBoard() {
        // Get visible columns
        const visibleColumns = this.boardManager.getVisibleColumns();
        
        // Render columns
        this.columnRenderer.renderColumns(this.columnsContainer, visibleColumns);
        
        // Update drag and drop
        this.dragDropManager.initDragAndDrop(this.columnsContainer);
    }
    
    /**
     * Edit a task
     * @param task Task to edit
     */
    editTask(task: Task) {
        // Open task edit modal
        // This would be similar to the one in TaskListView
        // For now, just show a notice
        new Notice(`Editing task: ${task.content}`);
    }
    
    /**
     * Register event listeners
     */
    private registerEventListeners() {
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
        this.dragDropManager.destroy();
    }
}