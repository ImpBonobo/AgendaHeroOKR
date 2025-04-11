import { WorkspaceLeaf, ItemView, Notice } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import AgendaHeroOKRPlugin from '../../../main';
import { OkrService } from '../../services/okr-service';
import { CalendarRenderer } from './calendar-renderer';
import { CalendarEventHandler } from './calendar-event-handler';
import { CalendarDragDropManager } from './calendar-drag-drop-manager';
import { CalendarTooltipManager } from './calendar-tooltip-manager';
import { CalendarSchedulingManager } from './calendar-scheduling-manager';

export class CalendarView extends ItemView {
    plugin: AgendaHeroOKRPlugin;
    okrService: OkrService;
    
    // Component managers
    private calendar: Calendar;
    private calendarRenderer: CalendarRenderer;
    private eventHandler: CalendarEventHandler;
    private dragDropManager: CalendarDragDropManager;
    private tooltipManager: CalendarTooltipManager;
    private schedulingManager: CalendarSchedulingManager;

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Get or create the OKR service
        if (plugin.okrService) {
            this.okrService = plugin.okrService;
        } else {
            this.okrService = new OkrService(plugin.app);
            plugin.okrService = this.okrService;
        }
    }

    getViewType(): string {
        return 'agenda-hero-okr-calendar';
    }

    getDisplayText(): string {
        return 'AgendaHeroOKR Calendar';
    }

    async onOpen() {
        // Clear container
        this.containerEl.empty();
        
        // Add header
        const header = this.containerEl.createEl('h2', { text: 'AgendaHeroOKR Calendar' });
        header.style.margin = '10px 20px';
        
        // Add scheduling controls
        const controlsContainer = this.containerEl.createDiv({ 
            cls: 'agenda-hero-okr-scheduling-controls' 
        });
        controlsContainer.style.margin = '10px 20px';

        // Add scheduling control buttons
        this.createSchedulingControls(controlsContainer);
        
        // Add view navigation
        this.createViewNavigation();
        
        // Display status text
        const statusText = this.containerEl.createEl('p', { 
            text: 'Loading calendar...' 
        });
        statusText.style.margin = '10px 20px';
        
        try {
            // Create container for the calendar
            const calendarContainer = this.containerEl.createDiv();
            calendarContainer.style.height = '600px';
            calendarContainer.style.margin = '10px 20px';
            calendarContainer.style.border = '1px solid #ddd';
            
            // Initialize OKR service if not already initialized
            if (!this.plugin.okrServiceInitialized) {
                await this.okrService.initialize();
                this.plugin.okrServiceInitialized = true;
            }
            
            // Create managers
            this.calendarRenderer = new CalendarRenderer(
                calendarContainer,
                this.plugin,
                this.okrService,
                this.app
            );
            
            // Initialize calendar with event handlers
            this.calendar = this.calendarRenderer.initializeCalendar(
                (info) => this.onEventDidMount(info),
                (info) => this.onDateClick(info),
                (info) => this.onEventDrop(info)
            );
            
            // Create managers with initialized calendar
            this.tooltipManager = new CalendarTooltipManager(
                this.okrService,
                this.calendarRenderer.getTimeBlocks()
            );
            
            this.dragDropManager = new CalendarDragDropManager(
                this.plugin,
                this.okrService,
                this.app,
                this.calendar,
                this.calendarRenderer.getTimeBlocks()
            );
            
            this.schedulingManager = new CalendarSchedulingManager(
                this.okrService,
                this.calendar,
                this.calendarRenderer.getTimeBlocks()
            );
            
            // Create event handler
            this.eventHandler = new CalendarEventHandler(
                this.plugin,
                this.okrService,
                this.app,
                this.calendar,
                this.dragDropManager,
                this.tooltipManager
            );
            
            // Set up drag and drop for external elements
            this.dragDropManager.setupExternalDropHandlers(calendarContainer);
            
            // Register for OKR model updates
            this.okrService.registerUpdateCallback(() => {
                this.calendarRenderer.updateEvents();
            });
            
            // Update status
            statusText.setText('Calendar loaded successfully!');
            statusText.style.color = 'green';
            
        } catch (error) {
            console.error('Error loading calendar:', error);
            statusText.setText(`Error loading calendar: ${error.message}`);
            statusText.style.color = 'red';
        }
    }
    
    /**
     * Create scheduling control buttons
     * @param container The container element
     */
    private createSchedulingControls(container: HTMLElement): void {
        // Reschedule All button
        const rescheduleButton = container.createEl('button', {
            text: 'Reschedule All Tasks',
            cls: 'agenda-hero-okr-scheduling-button'
        });
        rescheduleButton.addEventListener('click', () => {
            this.schedulingManager.rescheduleAllTasks();
        });

        // Toggle Auto-scheduling button
        const autoScheduleButton = container.createEl('button', {
            text: 'Toggle Auto-Scheduling',
            cls: 'agenda-hero-okr-scheduling-button'
        });
        autoScheduleButton.addEventListener('click', () => {
            this.schedulingManager.toggleAutoScheduling();
        });

        // Resolve Conflicts button
        const resolveConflictsButton = container.createEl('button', {
            text: 'Resolve Conflicts',
            cls: 'agenda-hero-okr-scheduling-button'
        });
        resolveConflictsButton.addEventListener('click', () => {
            this.schedulingManager.resolveSchedulingConflicts();
        });
    }
    
    /**
     * Create view navigation buttons
     */
    private createViewNavigation(): void {
        const navContainer = this.containerEl.createDiv({ 
            cls: 'agenda-hero-okr-view-navigation' 
        });
        navContainer.style.margin = '10px 20px';

        // Calendar View button (current)
        const calendarButton = navContainer.createEl('button', {
            text: 'Calendar View',
            cls: 'agenda-hero-okr-view-button active'
        });
        calendarButton.style.marginRight = '10px';

        // Tasklist View button
        const tasklistButton = navContainer.createEl('button', {
            text: 'Task List',
            cls: 'agenda-hero-okr-view-button'
        });
        tasklistButton.style.marginRight = '10px';
        tasklistButton.addEventListener('click', () => {
            this.plugin.activateView('agenda-hero-okr-tasklist');
        });

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
     * Event handler for when an event is mounted in the calendar
     * @param info The event info
     */
    private onEventDidMount(info: any): void {
        this.eventHandler.onEventDidMount(info);
    }
    
    /**
     * Event handler for when a date is clicked in the calendar
     * @param info The date click info
     */
    private onDateClick(info: any): void {
        this.eventHandler.onDateClick(info);
    }
    
    /**
     * Event handler for when an event is dropped in the calendar
     * @param info The event drop info
     */
    private onEventDrop(info: any): void {
        this.eventHandler.onEventDrop(info);
    }

    /**
     * Clean up when the view is closed
     */
    async onClose() {
        // Clean-up
        if (this.calendarRenderer) {
            this.calendarRenderer.destroy();
        }
        this.containerEl.empty();
    }
}