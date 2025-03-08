import { WorkspaceLeaf, ItemView, Notice, Modal, App } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import { DateInput, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import AgendaHeroPlugin from '../../main';
import { Task, OkrStatus } from '../models/okr-models';
import { OkrService } from '../services/okr-service';
import { TimeBlockInfo } from '../utils/time-manager';

export class CalendarView extends ItemView {
    plugin: AgendaHeroPlugin;
    calendar: Calendar;
    okrService: OkrService;

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroPlugin) {
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
        return 'agenda-hero-calendar';
    }

    getDisplayText(): string {
        return 'AgendaHero Calendar';
    }

    async onOpen() {
        // Clear container
        this.containerEl.empty();
        
        // Add header
        const header = this.containerEl.createEl('h2', { text: 'AgendaHero Calendar' });
        header.style.margin = '10px 20px';
        
        // Add scheduling controls
    const controlsContainer = this.containerEl.createDiv({ 
        cls: 'agenda-hero-scheduling-controls' 
    });
    controlsContainer.style.margin = '10px 20px';

    // Reschedule All button
    const rescheduleButton = controlsContainer.createEl('button', {
        text: 'Reschedule All Tasks',
        cls: 'agenda-hero-scheduling-button'
    });
    rescheduleButton.addEventListener('click', () => {
        this.rescheduleAllTasks();
    });

    // Toggle Auto-scheduling button
    const autoScheduleButton = controlsContainer.createEl('button', {
        text: 'Toggle Auto-Scheduling',
        cls: 'agenda-hero-scheduling-button'
    });
    autoScheduleButton.addEventListener('click', () => {
        this.toggleAutoScheduling();
    });

    // Resolve Conflicts button
    const resolveConflictsButton = controlsContainer.createEl('button', {
        text: 'Resolve Conflicts',
        cls: 'agenda-hero-scheduling-button'
    });
    resolveConflictsButton.addEventListener('click', () => {
        this.resolveSchedulingConflicts();
    });

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
            
            // Initialize calendar with minimal options
            this.calendar = new Calendar(calendarContainer, {
                plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
                initialView: this.plugin.settings.defaultView || 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                events: this.getEventsFromOkrModel(),
                editable: true, // Allows drag & drop within the calendar
                selectable: true, // Allows selection of time ranges
                droppable: true, // Allows dropping external elements
                
                // Format options
                slotLabelFormat: {
                    hour: this.plugin.settings.use24HourFormat ? '2-digit' : 'numeric',
                    minute: '2-digit',
                    hour12: !this.plugin.settings.use24HourFormat
                },
                
                // Customize event rendering
                eventDidMount: (info) => {
                    // Store task ID or time block ID as attribute
                    const itemId = info.event.id;
                    
                    // Add custom drag & drop behavior
                    this.setupCustomDragDrop(info.el, itemId);
                    
                    // Add click handler for editing
                    info.el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Determine if it's a task or time block
                        if (itemId.startsWith('block-')) {
                            // It's a time block
                            this.editTimeBlock(itemId);
                        } else {
                            // It's a task
                            this.editTask(itemId);
                        }
                    });

                    // Add hover behavior for tooltips
                    info.el.addEventListener('mouseenter', (e) => {
                        this.showEventTooltip(info.event, e);
                    });
                    
                    info.el.addEventListener('mouseleave', () => {
                        this.hideEventTooltip();
                    });

                    // Identify if it's a task or time block
                    if (itemId.startsWith('block-')) {
                        // It's a time block - add class for styling
                        info.el.classList.add('time-block');
                        
                        // Check if completed
                        const block = this.timeBlocks.find(b => b.id === itemId);
                        if (block && block.isCompleted) {
                            info.el.classList.add('completed');
                        }
                    } else {
                        // It's a main task
                        const task = this.okrService.getTask(itemId);
                        if (task) {
                            // Add styling based on urgency
                            if (task.urgency !== undefined) {
                                // Add urgency class
                                if (task.urgency > 80) {
                                    info.el.classList.add('urgency-high');
                                } else if (task.urgency > 50) {
                                    info.el.classList.add('urgency-medium');
                                } else {
                                    info.el.classList.add('urgency-low');
                                }
                                
                                // Add scheduling indicator
                                if (task.autoSchedule) {
                                    info.el.classList.add('auto-scheduled');
                                } else {
                                    info.el.classList.add('manually-scheduled');
                                }
                                
                                // Check for scheduling conflicts
                                const hasConflicts = this.hasSchedulingConflicts(task);
                                if (hasConflicts) {
                                    info.el.classList.add('schedule-conflict');
                                }
                            }
                            
                            if (task.completed) {
                                info.el.classList.add('completed-task');
                            }
                        }
                    }
                },
                
                // Create new task on click in empty area
                dateClick: (info) => {
                    this.createNewTask(info.date);
                },
                
                // Event handler for moving events
                eventDrop: (info) => {
                    const itemId = info.event.id;
                    
                    // Determine if it's a task or time block
                    if (itemId.startsWith('block-')) {
                        // It's a time block - not directly movable
                        // Reset the calendar (the time block will be rescheduled properly)
                        this.calendar.refetchEvents();
                        
                        new Notice('Time blocks cannot be moved directly. Please update the task instead.');
                    } else {
                        // It's a task
                        const task = this.okrService.getTask(itemId);
                        
                        if (task) {
                            // Clone the task to avoid modifying the original
                            const updatedTask = {...task};
                            
                            // Update date
                            updatedTask.dueDate = info.event.start;
                            
                            // Update task in OKR model
                            this.okrService.updateTask(updatedTask);
                            
                            // Success notification
                            new Notice(`Task moved to: ${info.event.start?.toLocaleDateString()}`);
                        }
                    }
                }
            });
            
            // Render calendar
            this.calendar.render();
            
            // Update status
            statusText.setText('Calendar loaded successfully!');
            statusText.style.color = 'green';
            
            // Register for OKR model updates
            this.okrService.registerUpdateCallback(() => {
                this.updateEvents();
            });
            
            // Event listener for task drag start
            this.registerEvent(
                // @ts-ignore - Obsidian API allows custom events
                this.app.workspace.on('agenda-hero:task-drag-start', (data: any) => {
                    // Highlight calendar container
                    calendarContainer.addClass('agenda-hero-calendar-drop-target');
                })
            );
            
            // Event listener for task drag end
            this.registerEvent(
                // @ts-ignore - Obsidian API allows custom events
                this.app.workspace.on('agenda-hero:task-drag-end', () => {
                    // Remove highlight
                    calendarContainer.removeClass('agenda-hero-calendar-drop-target');
                })
            );
            
            // Event listener for task drag cancel
            this.registerEvent(
                // @ts-ignore - Obsidian API allows custom events
                this.app.workspace.on('agenda-hero:task-drag-cancel', () => {
                    // Remove highlight
                    calendarContainer.removeClass('agenda-hero-calendar-drop-target');
                })
            );
            
            // Event listener for task dropped
            this.registerEvent(
                // @ts-ignore - Obsidian API allows custom events
                this.app.workspace.on('agenda-hero:task-dropped', (data: any) => {
                    // Remove highlight
                    calendarContainer.removeClass('agenda-hero-calendar-drop-target');
                    
                    // Check if task was dropped in the calendar
                    if (calendarContainer.contains(data.target)) {
                        // Determine position of the drop
                        const rect = calendarContainer.getBoundingClientRect();
                        const x = data.event.clientX - rect.left;
                        const y = data.event.clientY - rect.top;
                        
                        // Determine date and time from position
                        const date = this.getDateFromPosition(x, y);
                        
                        if (date) {
                            // Update task in OKR model
                            const task = this.okrService.getTask(data.task.id);
                            if (task) {
                                // Clone the task to avoid modifying the original
                                const updatedTask = {...task};
                                
                                // Update date
                                updatedTask.dueDate = date;
                                
                                // Update task in OKR model
                                this.okrService.updateTask(updatedTask);
                                
                                // Success notification
                                new Notice(`Task "${task.title}" added to ${date.toLocaleString()}`);
                            }
                        } else {
                            new Notice('Could not determine a valid date');
                        }
                    }
                })
            );
            
        } catch (error) {
            console.error('Error loading calendar:', error);
            statusText.setText(`Error loading calendar: ${error.message}`);
            statusText.style.color = 'red';
        }
    }
    
    getEventsFromOkrModel(): EventInput[] {
        // Format events from the OKR model
        const events: EventInput[] = [];
        
        try {
            // Get tasks from OKR service
            const tasks = this.okrService.getTasks();
            console.log(`Creating events from ${tasks.length} tasks`);
            
            // Projects and their colors
            const projectColors = new Map<string, string>();
            const colorPalette = [
                '#3498db', // Blue
                '#2ecc71', // Green
                '#e74c3c', // Red
                '#9b59b6', // Purple
                '#f39c12', // Orange
                '#1abc9c', // Turquoise
                '#d35400', // Dark orange
                '#8e44ad', // Dark purple
                '#27ae60', // Dark green
                '#2980b9', // Dark blue
                '#c0392b', // Dark red
                '#16a085'  // Dark turquoise
            ];
            
            // Collect all projects and assign colors
            const projects = this.okrService.getProjects();
            projects.forEach((project, index) => {
                const colorIndex = index % colorPalette.length;
                projectColors.set(project.id, colorPalette[colorIndex]);
            });
            
            // Add tasks as events
            tasks.forEach(task => {
                // Only add tasks with valid dates
                if (task.dueDate) {
                    // Priority colors
                    const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
                    
                    // Check if the task has a time (not 00:00)
                    const hasTime = task.dueDate.getHours() !== 0 || task.dueDate.getMinutes() !== 0;
                    
                    // Color based on project or priority
                    let backgroundColor, borderColor;
                    if (task.projectId && projectColors.has(task.projectId)) {
                        backgroundColor = projectColors.get(task.projectId);
                        borderColor = backgroundColor;
                    } else {
                        backgroundColor = priorityColors[task.priority - 1];
                        borderColor = backgroundColor;
                    }
                    
                    // Create event and add to array
                    events.push({
                        id: task.id,
                        title: task.title,
                        start: task.dueDate.toISOString(), // ISO string format for compatibility
                        allDay: !hasTime, // Only all day if no time specified
                        backgroundColor: backgroundColor,
                        borderColor: borderColor,
                        textColor: '#ffffff',
                        className: task.completed ? 'completed-task' : '',
                        extendedProps: {
                            type: 'task',
                            projectId: task.projectId,
                            priority: task.priority,
                            status: task.status
                        }
                    });
                }
            });
            
            // Add time blocks as events
            const now = new Date();
            const calendarStart = this.calendar ? new Date(this.calendar.view.activeStart) : new Date(now.getFullYear(), now.getMonth(), 1);
            const calendarEnd = this.calendar ? new Date(this.calendar.view.activeEnd) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            // Get time blocks for the visible range
            const timeBlocks = this.okrService.getTimeBlocksInRange(calendarStart, calendarEnd);
            
            // Save time blocks for later use
            this.timeBlocks = timeBlocks;
            
            timeBlocks.forEach(block => {
                // Find associated task
                const task = this.okrService.getTask(block.taskId);
                if (!task) return; // Skip if task not found
                
                // Color based on time window
                let blockColor = '#7986cb'; // Default color
                
                // Create event for time block
                events.push({
                    id: block.id,
                    title: `${task.title} (${block.duration}m)`,
                    start: block.start.toISOString(),
                    end: block.end.toISOString(),
                    backgroundColor: blockColor,
                    borderColor: blockColor,
                    textColor: '#ffffff',
                    className: block.isCompleted ? 'completed-task' : '',
                    extendedProps: {
                        type: 'timeBlock',
                        taskId: block.taskId,
                        timeWindowId: block.timeWindowId
                    }
                });
            });
            
            console.log(`${events.length} events created`);
            return events;
        } catch (error) {
            console.error("Error creating events from OKR model:", error);
            return [];
        }
    }
    
    updateEvents() {
        if (this.calendar) {
            // Remove all events
            this.calendar.removeAllEvents();
            
            // Add new events
            const events = this.getEventsFromOkrModel();
            
            // Add events in a batch
            this.calendar.batchRendering(() => {
                events.forEach(event => {
                    if (event.start) {
                        this.calendar.addEvent(event);
                    }
                });
            });
            
            console.log("Calendar events updated");
        }
    }
    
    // Method to edit a task
    editTask(taskId: string) {
        const task = this.okrService.getTask(taskId);
        
        if (task) {
            const modal = new TaskEditModal(this.app, task, (updatedTask) => {
                // Update task in the OKR model
                this.okrService.updateTask(updatedTask);
                
                // Notification
                new Notice('Task updated');
            });
            
            modal.open();
        } else {
            new Notice('Task not found');
        }
    }
    
    // Method to edit a time block
    editTimeBlock(blockId: string) {
        // Find the time block
        const blocks = this.okrService.getTimeBlocksInRange(
            new Date(0), // Start of time
            new Date(8640000000000000) // End of time
        );
        
        const block = blocks.find(b => b.id === blockId);
        
        if (block) {
            // Find associated task
            const task = this.okrService.getTask(block.taskId);
            
            if (task) {
                // Show options for the time block
                const modal = new TimeBlockModal(this.app, block, task, this.okrService);
                modal.open();
            } else {
                new Notice('Associated task not found');
            }
        } else {
            new Notice('Time block not found');
        }
    }
    
    // Method to create a new task
    createNewTask(date: Date) {
        // Get the current sprint if any
        const currentSprint = this.okrService.getCurrentSprint();
        
        // Create new task modal
        const modal = new TaskCreateModal(this.app, date, (newTask) => {
            // Add to OKR model
            this.okrService.createTask(newTask);
            
            // Add to current sprint if available
            if (currentSprint && newTask.projectId) {
                currentSprint.tasks.push(newTask);
                this.okrService.updateSprint(currentSprint);
            }
            
            // Notification
            new Notice(`New task created for ${date.toLocaleDateString()}`);
        }, this.okrService);
        
        modal.open();
    }
    
    // Custom drag & drop behavior
    setupCustomDragDrop(element: HTMLElement, itemId: string) {
        // Position for the drag ghost element
        let offsetX = 0;
        let offsetY = 0;
        
        // Ghost element for dragging
        let ghostElement: HTMLElement | null = null;
        
        // Date when dragging started (for cancel logic)
        let originalDate: Date | null = null;
        
        // Mousedown event to start drag & drop
        element.addEventListener('mousedown', (e) => {
            // Only with left mouse button
            if (e.button !== 0) return;
            
            // Prevent normal click events from firing
            e.preventDefault();
            e.stopPropagation();
            
            // Determine if it's a task or time block
            if (itemId.startsWith('block-')) {
                // Time blocks are not draggable directly
                return;
            }
            
            // Find original task and date
            const task = this.okrService.getTask(itemId);
            if (!task || !task.dueDate) return;
            
            originalDate = new Date(task.dueDate);
            
            // Calculate position for the ghost element
            const rect = element.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            // Create ghost element
            ghostElement = element.cloneNode(true) as HTMLElement;
            ghostElement.style.position = 'fixed';
            ghostElement.style.zIndex = '9999';
            ghostElement.style.width = rect.width + 'px';
            ghostElement.style.height = rect.height + 'px';
            ghostElement.style.opacity = '0.7';
            ghostElement.style.pointerEvents = 'none'; // So it doesn't interfere with mouse events
            
            document.body.appendChild(ghostElement);
            
            // Position ghost element
            this.moveGhostElement(ghostElement, e.clientX, e.clientY, offsetX, offsetY);
            
            // Add event listeners for mousemove and mouseup
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            // Add a class to the body to indicate that a drag is in progress
            document.body.classList.add('agenda-hero-dragging');
        });
        
        // Mousemove handler
        const handleMouseMove = (e: MouseEvent) => {
            if (!ghostElement) return;
            
            // Move ghost element with the mouse
            this.moveGhostElement(ghostElement, e.clientX, e.clientY, offsetX, offsetY);
            
            // Highlight calendar day under cursor
            this.highlightDayUnderCursor(e.clientX, e.clientY);
        };
        
        // Mouseup handler
        const handleMouseUp = (e: MouseEvent) => {
            // Remove drag class
            document.body.classList.remove('agenda-hero-dragging');
            
            // Remove event listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Remove ghost element
            if (ghostElement) {
                document.body.removeChild(ghostElement);
                ghostElement = null;
            }
            
            // Remove highlights
            this.removeAllHighlights();
            
            // Find day under cursor
            const targetDate = this.getDateFromPosition(e.clientX, e.clientY);
            
            // Update task if a valid date was found
            if (targetDate && originalDate && !itemId.startsWith('block-')) {
                // Compare if the date or time has changed
                if (targetDate.getTime() !== originalDate.getTime()) {
                    // Find the task
                    const task = this.okrService.getTask(itemId);
                    
                    if (task) {
                        // Clone the task to avoid modifying the original
                        const updatedTask = {...task};
                        
                        // Update date
                        updatedTask.dueDate = targetDate;
                        
                        // Update task in OKR model
                        this.okrService.updateTask(updatedTask);
                        
                        // Notification
                        new Notice(`Task moved to ${targetDate.toLocaleString()}`);
                    }
                }
            }
        };
    }

    // Helper method to position the ghost element
    moveGhostElement(element: HTMLElement, clientX: number, clientY: number, offsetX: number, offsetY: number) {
        element.style.left = (clientX - offsetX) + 'px';
        element.style.top = (clientY - offsetY) + 'px';
    }

    // Helper method to find and highlight the day under cursor
    highlightDayUnderCursor(clientX: number, clientY: number) {
        // Remove all existing highlights
        this.removeAllHighlights();
        
        // Find element under cursor
        const elementUnderCursor = document.elementFromPoint(clientX, clientY);
        if (!elementUnderCursor) return;
        
        // Find the calendar day (or cell) containing the element
        let dayCell: Element | null = elementUnderCursor;
        
        // Look for the nearest dayGrid or timeGrid element
        while (dayCell && 
               !dayCell.classList.contains('fc-daygrid-day') && 
               !dayCell.classList.contains('fc-timegrid-slot') &&
               dayCell !== document.body) {
            dayCell = dayCell.parentElement;
        }
        
        // Highlight the found day
        if (dayCell) {
            // For dayGrid (month view)
            if (dayCell.classList.contains('fc-daygrid-day')) {
                dayCell.classList.add('drag-target-highlight');
            }
            
            // For timeGrid (week and day views)
            if (dayCell.classList.contains('fc-timegrid-slot')) {
                dayCell.classList.add('drag-target-highlight');
            }
        }
    }

    // Helper method to remove all highlights
    removeAllHighlights() {
        document.querySelectorAll('.drag-target-highlight').forEach(el => {
            el.classList.remove('drag-target-highlight');
        });
    }

    // Improved method to find the date from a position
    getDateFromPosition(clientX: number, clientY: number): Date | null {
        try {
            // Find element under cursor
            const elementUnderCursor = document.elementFromPoint(clientX, clientY);
            if (!elementUnderCursor) return null;
            
            // Find the calendar day (or cell) containing the element
            let dayCell: Element | null = elementUnderCursor;
            while (dayCell && 
                   !dayCell.classList.contains('fc-daygrid-day') && 
                   !dayCell.classList.contains('fc-timegrid-slot') &&
                   dayCell !== document.body) {
                dayCell = dayCell.parentElement;
            }
            
            // Extract date from the day element
            if (dayCell) {
                // For dayGrid (month view)
                if (dayCell.classList.contains('fc-daygrid-day')) {
                    const dateAttr = (dayCell as HTMLElement).getAttribute('data-date');
                    if (dateAttr) {
                        return new Date(dateAttr);
                    }
                }
                
                // For timeGrid (week and day views)
                if (dayCell.classList.contains('fc-timegrid-slot')) {
                    // Extract time from attribute
                    const timeAttr = (dayCell as HTMLElement).getAttribute('data-time');
                    if (!timeAttr) return null;
                    
                    // Find the column (day) containing the cell
                    const column = this.findTimeGridColumn(dayCell);
                    
                    if (column) {
                        // Try to determine the date from various sources
                        const date = this.findDateFromTimeGridColumn(column, timeAttr);
                        if (date) return date;
                    }
                    
                    // Fallback: Use the current date of the calendar view
                    return this.getDateFromCalendarAndTime(timeAttr, clientX);
                }
            }
            
            return null;
        } catch (error) {
            console.error("Error determining date:", error);
            return null;
        }
    }
    
    // Helper method to find the column in the timeGrid view
    private findTimeGridColumn(element: Element): Element | null {
        // Look for the column containing the cell
        let column: Element | null = element;
        while (column) {
            // Check various possible classes for columns
            if (column.classList.contains('fc-timegrid-col') || 
                column.classList.contains('fc-col') ||
                column.classList.contains('fc-timegrid-col-frame')) {
                return column;
            }
            
            // If we reach the body, break
            if (column === document.body) break;
            
            // Go to parent element, with null check
            const parent = column.parentElement;
            if (!parent) break;
            column = parent;
        }
        
        // Alternative method: Look for the nearest element with one of these classes
        const closestCol = element.closest('.fc-timegrid-col, .fc-col, .fc-timegrid-col-frame');
        // Only return if an element was found (not null)
        if (closestCol) {
            return closestCol as Element;
        }
        
        return null;
    }
    
    // Helper method to find the date from a timeGrid column
    private findDateFromTimeGridColumn(column: Element, timeAttr: string): Date | null {
        // Attempt 1: Look for data-date directly in the column
        const dateAttrColumn = (column as HTMLElement).getAttribute('data-date');
        if (dateAttrColumn) {
            return this.createDateWithTime(dateAttrColumn, timeAttr);
        }
        
        // Attempt 2: Look for the header of the column
        const possibleHeaderSelectors = [
            '.fc-timegrid-col-head', 
            '.fc-col-header-cell',
            '.fc-timegrid-axis',
            'th[data-date]',
            '[data-date]'
        ];
        
        for (const selector of possibleHeaderSelectors) {
            const headerCell = column.querySelector(selector);
            if (headerCell) {
                const dateAttrHeader = (headerCell as HTMLElement).getAttribute('data-date');
                if (dateAttrHeader) {
                    return this.createDateWithTime(dateAttrHeader, timeAttr);
                }
                
                // Look in the parents of the header
                let parent = headerCell.parentElement;
                while (parent && parent !== document.body) {
                    const dateAttrParent = (parent as HTMLElement).getAttribute('data-date');
                    if (dateAttrParent) {
                        return this.createDateWithTime(dateAttrParent, timeAttr);
                    }
                    parent = parent.parentElement;
                }
            }
        }
        
        // Attempt 3: Look for all elements with data-date in the column
        const elementsWithDate = column.querySelectorAll('[data-date]');
        if (elementsWithDate.length > 0) {
            const dateAttrElement = (elementsWithDate[0] as HTMLElement).getAttribute('data-date');
            if (dateAttrElement) {
                return this.createDateWithTime(dateAttrElement, timeAttr);
            }
        }
        
        return null;
    }
    
    // Helper method to create a date with time
    private createDateWithTime(dateStr: string, timeStr: string): Date | null {
        try {
            const date = new Date(dateStr);
            const timeParts = timeStr.split(':').map(Number);
            
            if (timeParts.length >= 2) {
                date.setHours(timeParts[0], timeParts[1], 0, 0);
                return date;
            }
            
            return date;
        } catch (error) {
            console.error("Error creating date:", error);
            return null;
        }
    }
    
    // Improved fallback method: Use the current date of the calendar view
    private getDateFromCalendarAndTime(timeStr: string, clientX: number): Date | null {
        try {
            // Determine current view
            const currentView = this.calendar.view;
            if (!currentView) return null;
            
            // Get start date of current view
            const viewStart = new Date(currentView.currentStart);
            
            // Create a copy of the start date
            const date = new Date(viewStart);
            
            // Determine the day based on X position
            if (currentView.type.includes('timeGrid')) {
                // Determine number of visible days (7 for week, 1 for day)
                const daysVisible = currentView.type === 'timeGridWeek' ? 7 : 1;
                
                if (daysVisible > 1) {
                    // Determine width of visible area
                    const calendarEl = this.calendar.el;
                    const calendarRect = calendarEl.getBoundingClientRect();
                    const calendarWidth = calendarRect.width;
                    
                    // Relative X position within the calendar
                    const relativeX = clientX - calendarRect.left;
                    
                    // Calculate day based on relative position
                    // Consider the time axis area on the left edge
                    const timeAxisWidth = 60; // Adjusted value based on FullCalendar layout
                    const contentWidth = calendarWidth - timeAxisWidth;
                    
                    if (relativeX > timeAxisWidth) {
                        const dayWidth = contentWidth / daysVisible;
                        const dayIndex = Math.floor((relativeX - timeAxisWidth) / dayWidth);
                        
                        // Adjust date based on the determined day
                        date.setDate(viewStart.getDate() + dayIndex);
                    }
                }
            }
            
            // Extract time from timeStr and add to date
            const timeParts = timeStr.split(':').map(Number);
            if (timeParts.length >= 2) {
                date.setHours(timeParts[0], timeParts[1], 0, 0);
            }
            
            return date;
        } catch (error) {
            console.error("Error determining fallback date:", error);
            return null;
        }
    }

    /**
 * Reschedule all auto-schedulable tasks
 */
    private rescheduleAllTasks() {
        try {
            // Get all auto-schedulable tasks with due dates and estimated durations
            const tasks = this.okrService.getTasks().filter(task => 
                !task.completed && 
                task.dueDate && 
                task.estimatedDuration && 
                (task.autoSchedule === undefined || task.autoSchedule)
            );
            
            if (tasks.length === 0) {
                new Notice('No tasks found to reschedule');
                return;
            }
            
            // Remove existing time blocks for these tasks
            tasks.forEach(task => {
                this.okrService.getTimeManager().removeScheduledBlocks(task.id);
            });
            
            // Clear time blocks data
            this.timeBlocks = this.timeBlocks.filter(block => 
                !tasks.some(task => task.id === block.taskId)
            );
            
            // Reschedule tasks one by one
            let successCount = 0;
            let partialCount = 0;
            let failCount = 0;
            
            tasks.forEach(task => {
                const result = this.okrService.scheduleTask(task);
                
                if (result.success) {
                    successCount++;
                } else if (result.timeBlocks.length > 0) {
                    partialCount++;
                } else {
                    failCount++;
                }
            });
            
            // Update calendar
            this.updateEvents();
            
            // Show summary
            new Notice(`Rescheduled tasks: ${successCount} successful, ${partialCount} partial, ${failCount} failed`);
        } catch (error) {
            console.error('Error rescheduling tasks:', error);
            new Notice(`Error rescheduling tasks: ${error.message}`);
        }
    }

    /**
     * Toggle auto-scheduling for visible tasks
     */
    private toggleAutoScheduling() {
        try {
            // Get visible date range
            const view = this.calendar.view;
            const startDate = new Date(view.activeStart);
            const endDate = new Date(view.activeEnd);
            
            // Get tasks in range
            const tasks = this.okrService.getTasks().filter(task => 
                task.dueDate && 
                task.dueDate >= startDate && 
                task.dueDate <= endDate
            );
            
            if (tasks.length === 0) {
                new Notice('No tasks found in the current view');
                return;
            }
            
            // Count current auto-scheduled
            const autoScheduledCount = tasks.filter(task => 
                task.autoSchedule === true
            ).length;
            
            // Determine operation (toggle all on or off)
            const setAutoSchedule = autoScheduledCount < tasks.length / 2;
            
            // Update tasks
            let updateCount = 0;
            
            for (const task of tasks) {
                if (task.autoSchedule !== setAutoSchedule) {
                    const updatedTask = {...task, autoSchedule: setAutoSchedule};
                    this.okrService.updateTask(updatedTask);
                    updateCount++;
                }
            }
            
            // Show summary
            new Notice(`${setAutoSchedule ? 'Enabled' : 'Disabled'} auto-scheduling for ${updateCount} tasks`);
            
            // Refresh calendar
            if (updateCount > 0) {
                this.updateEvents();
            }
        } catch (error) {
            console.error('Error toggling auto-scheduling:', error);
            new Notice(`Error toggling auto-scheduling: ${error.message}`);
        }
    }

    /**
     * Resolve scheduling conflicts
     */
    private resolveSchedulingConflicts() {
        try {
            // Find tasks with conflicts
            const tasks = this.okrService.getTasks();
            const tasksWithConflicts = tasks.filter(task => this.hasSchedulingConflicts(task));
            
            if (tasksWithConflicts.length === 0) {
                new Notice('No scheduling conflicts found');
                return;
            }
            
            // Sort by priority and urgency
            tasksWithConflicts.sort((a, b) => {
                // First by priority (lower number = higher priority)
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                
                // Then by urgency (higher = more urgent)
                const urgencyA = a.urgency || 0;
                const urgencyB = b.urgency || 0;
                return urgencyB - urgencyA;
            });
            
            // Process tasks one by one
            let resolvedCount = 0;
            
            for (const task of tasksWithConflicts) {
                // Handle based on conflict behavior
                if (task.conflictBehavior === 'reschedule' || !task.conflictBehavior) {
                    // Remove existing blocks
                    this.okrService.getTimeManager().removeScheduledBlocks(task.id);
                    
                    // Reschedule
                    const result = this.okrService.scheduleTask(task);
                    if (result.success || result.timeBlocks.length > 0) {
                        resolvedCount++;
                    }
                } else if (task.conflictBehavior === 'prompt') {
                    // For prompt, we'll just count it as handled for now
                    // In a real implementation, we'd show a modal to let the user decide
                    resolvedCount++;
                }
                // For 'keep', we do nothing
            }
            
            // Update calendar
            this.updateEvents();
            
            // Show summary
            new Notice(`Resolved ${resolvedCount} of ${tasksWithConflicts.length} conflicts`);
        } catch (error) {
            console.error('Error resolving conflicts:', error);
            new Notice(`Error resolving conflicts: ${error.message}`);
        }
    }

    /**
     * Check if a task has scheduling conflicts
     * @param task The task to check
     * @returns Whether the task has conflicts
     */
    private hasSchedulingConflicts(task: Task): boolean {
        // If task has no time blocks, it can't have conflicts
        if (!task.estimatedDuration || !task.dueDate) {
            return false;
        }
        
        // Get task's time blocks
        const taskBlocks = this.timeBlocks.filter(block => block.taskId === task.id);
        if (taskBlocks.length === 0) {
            return false;
        }
        
        // Get all other blocks
        const otherBlocks = this.timeBlocks.filter(block => block.taskId !== task.id);
        
        // Check each task block for conflicts
        for (const block of taskBlocks) {
            for (const otherBlock of otherBlocks) {
                // Check for overlap
                if (this.blocksOverlap(block, otherBlock)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Check if two time blocks overlap
     * @param block1 First time block
     * @param block2 Second time block
     * @returns Whether the blocks overlap
     */
    private blocksOverlap(block1: TimeBlockInfo, block2: TimeBlockInfo): boolean {
        return (
            (block1.start >= block2.start && block1.start < block2.end) || // Block 1 starts during Block 2
            (block1.end > block2.start && block1.end <= block2.end) || // Block 1 ends during Block 2
            (block1.start <= block2.start && block1.end >= block2.end) // Block 1 contains Block 2
        );
    }

    /**
     * Track time blocks for the service
     */
    private timeBlocks: TimeBlockInfo[] = [];

    /**
     * Current tooltip element
     */
    private tooltipEl: HTMLElement | null = null;

    /**
     * Show tooltip for an event
     * @param event The calendar event
     * @param e The mouse event
     */
    private showEventTooltip(event: any, e: MouseEvent) {
        // Remove any existing tooltip
        this.hideEventTooltip();
        
        // Create tooltip content
        let content = '';
        
        // Determine if it's a task or time block
        if (event.id.startsWith('block-')) {
            // It's a time block - find the associated task
            const block = this.timeBlocks.find(b => b.id === event.id);
            
            if (block) {
                const task = this.okrService.getTask(block.taskId);
                
                if (task) {
                    content = `
                        <div>
                            <strong>${task.title}</strong>
                            <p>Time Block: ${block.start.toLocaleTimeString()} - ${block.end.toLocaleTimeString()}</p>
                            <p>Duration: ${block.duration} minutes</p>
                            <p>Status: ${block.isCompleted ? 'Completed' : 'Pending'}</p>
                        </div>
                    `;
                }
            }
        } else {
            // It's a task
            const task = this.okrService.getTask(event.id);
            
            if (task) {
                const urgency = task.urgency !== undefined ? `${task.urgency}/100` : 'N/A';
                const blocks = this.timeBlocks.filter(b => b.taskId === task.id);
                const scheduledMinutes = blocks.reduce((total, block) => total + block.duration, 0);
                const remainingMinutes = (task.estimatedDuration || 0) - scheduledMinutes;
                
                content = `
                    <div>
                        <strong>${task.title}</strong>
                        <p>Priority: ${task.priority}</p>
                        <p>Urgency: ${urgency}</p>
                        <p>Status: ${task.status}</p>
                        ${task.estimatedDuration ? `<p>Duration: ${task.estimatedDuration} minutes</p>` : ''}
                        ${scheduledMinutes > 0 ? `<p>Scheduled: ${scheduledMinutes} minutes</p>` : ''}
                        ${remainingMinutes > 0 ? `<p>Remaining: ${remainingMinutes} minutes</p>` : ''}
                        <p>Auto-Schedule: ${task.autoSchedule === false ? 'No' : 'Yes'}</p>
                    </div>
                `;
            }
        }
        
        if (content) {
            // Create tooltip element
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.className = 'agenda-hero-scheduling-tooltip';
            this.tooltipEl.innerHTML = content;
            
            // Position tooltip
            this.tooltipEl.style.left = e.pageX + 10 + 'px';
            this.tooltipEl.style.top = e.pageY + 10 + 'px';
            
            // Add to DOM
            document.body.appendChild(this.tooltipEl);
        }
    }

    /**
     * Hide the current tooltip
     */
    private hideEventTooltip() {
        if (this.tooltipEl) {
            document.body.removeChild(this.tooltipEl);
            this.tooltipEl = null;
        }
    }

    async onClose() {
        // Clean-up
        if (this.calendar) {
            this.calendar.destroy();
        }
        this.containerEl.empty();
    }
}

// Modal class for editing tasks
class TaskEditModal extends Modal {
    task: Task;
    onSubmit: (task: Task) => void;
    
    constructor(app: App, task: Task, onSubmit: (task: Task) => void) {
        super(app);
        this.task = task;
        this.onSubmit = onSubmit;
    }
    
    onOpen() {
        const {contentEl} = this;
    
        // Heading
        contentEl.createEl('h2', {text: 'Edit Task'});
        
        // Container for content with scrollbar
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        
        // Title field
        const titleGroup = modalContent.createDiv({ cls: 'form-group' });
        titleGroup.createEl('label', {text: 'Title:'});
        const titleInput = titleGroup.createEl('input', {
            type: 'text',
            value: this.task.title
        });
        
        // Description field (if any)
        const descriptionGroup = modalContent.createDiv({ cls: 'form-group' });
        descriptionGroup.createEl('label', {text: 'Description (optional):'});
        const descriptionInput = descriptionGroup.createEl('textarea', {
            value: this.task.description || ''
        });
        descriptionInput.style.width = '100%';
        descriptionInput.style.minHeight = '80px';
        
        // Date and time
        const dateTimeGroup = modalContent.createDiv({ cls: 'form-group' });
        dateTimeGroup.createEl('label', {text: 'Due date:'});
        
        const dateTimeContainer = dateTimeGroup.createDiv({ cls: 'date-time-container' });
        
        // Date
        const dateInput = dateTimeContainer.createEl('input', {
            type: 'date',
            value: this.task.dueDate ? this.task.dueDate.toISOString().split('T')[0] : ''
        });
        
        // Time
        const timeInput = dateTimeContainer.createEl('input', {
            type: 'time',
            value: this.task.dueDate && (this.task.dueDate.getHours() !== 0 || this.task.dueDate.getMinutes() !== 0) ? 
                `${String(this.task.dueDate.getHours()).padStart(2, '0')}:${String(this.task.dueDate.getMinutes()).padStart(2, '0')}` : 
                ''
        });
        
        // Estimated duration
        const durationGroup = modalContent.createDiv({ cls: 'form-group' });
        durationGroup.createEl('label', {text: 'Estimated duration (minutes):'});
        const durationInput = durationGroup.createEl('input', {
            type: 'number',
            value: this.task.estimatedDuration?.toString() || '',
            attr: { min: '1', step: '1' }
        });
        
        // Status
        const statusGroup = modalContent.createDiv({ cls: 'form-group' });
        statusGroup.createEl('label', {text: 'Status:'});
        const statusSelect = statusGroup.createEl('select');
        
        // Status options
        const statuses: Array<{value: OkrStatus, text: string}> = [
            { value: 'next-up', text: 'Next Up' },
            { value: 'in-progress', text: 'In Progress' },
            { value: 'waiting-on', text: 'Waiting On' },
            { value: 'validating', text: 'Validating' },
            { value: 'completed', text: 'Completed' },
            { value: 'canceled', text: 'Canceled' }
        ];
        
        statuses.forEach(status => {
            const option = statusSelect.createEl('option', {
                text: status.text,
                value: status.value
            });
            
            if (status.value === this.task.status) {
                option.selected = true;
            }
        });
        
        // Completed checkbox
        const completedGroup = modalContent.createDiv({ cls: 'form-group' });
        const completedContainer = completedGroup.createDiv({ cls: 'checkbox-container' });
        const completedCheckbox = completedContainer.createEl('input', {
            type: 'checkbox',
            attr: { id: 'task-completed' }
        });
        completedCheckbox.checked = this.task.completed;
        
        completedContainer.createEl('label', {
            text: 'Mark as completed',
            attr: { for: 'task-completed' }
        });
        
        // Link completed status and status dropdown
        completedCheckbox.addEventListener('change', () => {
            if (completedCheckbox.checked) {
                // Set status to completed
                statusSelect.value = 'completed';
            } else if (statusSelect.value === 'completed') {
                // If unchecking and status is completed, set to in-progress
                statusSelect.value = 'in-progress';
            }
        });
        
        statusSelect.addEventListener('change', () => {
            // Update completed checkbox when status changes
            completedCheckbox.checked = statusSelect.value === 'completed';
        });
        
        // Priority
        const priorityGroup = modalContent.createDiv({ cls: 'form-group' });
        priorityGroup.createEl('label', {text: 'Priority:'});
        const prioritySelect = priorityGroup.createEl('select');
        
        // Priority options
        const priorities = [
            { value: 1, text: 'High' },
            { value: 2, text: 'Medium' },
            { value: 3, text: 'Normal' },
            { value: 4, text: 'Low' }
        ];
        
        priorities.forEach(priority => {
            const option = prioritySelect.createEl('option', {
                text: priority.text,
                value: priority.value.toString()
            });
            
            if (priority.value === this.task.priority) {
                option.selected = true;
            }
        });
        
        // Tags
        const tagsGroup = modalContent.createDiv({ cls: 'form-group' });
        tagsGroup.createEl('label', {text: 'Tags (comma separated):'});
        const tagsInput = tagsGroup.createEl('input', {
            type: 'text',
            value: this.task.tags.join(', ')
        });
        
        // Buttons in a footer
        const buttonContainer = contentEl.createDiv({ cls: 'modal-footer' });
        
        // Save button
        const saveButton = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'submit-button'
        });
        
        saveButton.addEventListener('click', () => {
            // Prepare updated task
            const updatedTask: Task = {
                ...this.task,
                title: titleInput.value,
                description: descriptionInput.value || undefined,
                status: statusSelect.value as OkrStatus,
                priority: parseInt(prioritySelect.value),
                completed: completedCheckbox.checked,
                estimatedDuration: durationInput.value ? parseInt(durationInput.value) : undefined,
                tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            };
            
            // Process date and time
            if (dateInput.value) {
                const date = new Date(dateInput.value);
                
                // Add time if present
                if (timeInput.value) {
                    const [hours, minutes] = timeInput.value.split(':').map(Number);
                    date.setHours(hours, minutes, 0, 0);
                } else {
                    // If no time specified, set to midnight
                    date.setHours(0, 0, 0, 0);
                }
                
                updatedTask.dueDate = date;
            } else {
                updatedTask.dueDate = null;
            }
            
            // Call callback with updated task
            this.onSubmit(updatedTask);
            
            // Close modal
            this.close();
        });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'cancel-button'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

// Modal class for creating tasks
class TaskCreateModal extends Modal {
    date: Date;
    onSubmit: (task: Task) => void;
    okrService: OkrService;
    
    constructor(app: App, date: Date, onSubmit: (task: Task) => void, okrService: OkrService) {
        super(app);
        this.date = date;
        this.onSubmit = onSubmit;
        this.okrService = okrService;
    }
    
    onOpen() {
        const {contentEl} = this;
        
        // Heading
        contentEl.createEl('h2', {text: 'Create New Task'});
        
        // Container for content with scrollbar
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        
        // Title field
        const titleGroup = modalContent.createDiv({ cls: 'form-group' });
        titleGroup.createEl('label', {text: 'Title:'});
        const titleInput = titleGroup.createEl('input', {
            type: 'text',
            placeholder: 'Enter task title'
        });
        
        // Description field
        const descriptionGroup = modalContent.createDiv({ cls: 'form-group' });
        descriptionGroup.createEl('label', {text: 'Description (optional):'});
        const descriptionInput = descriptionGroup.createEl('textarea', {
            placeholder: 'Enter task description'
        });
        descriptionInput.style.width = '100%';
        descriptionInput.style.minHeight = '80px';
        
        // Project selection
        const projectGroup = modalContent.createDiv({ cls: 'form-group' });
        projectGroup.createEl('label', {text: 'Project (optional):'});
        const projectSelect = projectGroup.createEl('select');
        
        // Default "None" option
        projectSelect.createEl('option', { text: 'None', value: '' });
        
        // Add projects from OKR model
        const projects = this.okrService.getProjects();
        projects.forEach(project => {
            projectSelect.createEl('option', { 
                text: project.title, 
                value: project.id 
            });
        });
        
        // Date and time
        const dateTimeGroup = modalContent.createDiv({ cls: 'form-group' });
        dateTimeGroup.createEl('label', {text: 'Due date:'});
        
        const dateTimeContainer = dateTimeGroup.createDiv({ cls: 'date-time-container' });
        
        // Date
        const dateInput = dateTimeContainer.createEl('input', {
            type: 'date',
            value: this.date.toISOString().split('T')[0]
        });
        
        // Time
        const timeInput = dateTimeContainer.createEl('input', {
            type: 'time',
            value: ''
        });
        
        // Estimated duration
        const durationGroup = modalContent.createDiv({ cls: 'form-group' });
        durationGroup.createEl('label', {text: 'Estimated duration (minutes):'});
        const durationInput = durationGroup.createEl('input', {
            type: 'number',
            value: '',
            attr: { min: '1', step: '1' }
        });
        
        // Status
        const statusGroup = modalContent.createDiv({ cls: 'form-group' });
        statusGroup.createEl('label', {text: 'Status:'});
        const statusSelect = statusGroup.createEl('select');
        
        // Status options
        const statuses: Array<{value: OkrStatus, text: string}> = [
            { value: 'next-up', text: 'Next Up' },
            { value: 'in-progress', text: 'In Progress' },
            { value: 'waiting-on', text: 'Waiting On' },
            { value: 'validating', text: 'Validating' },
            { value: 'completed', text: 'Completed' },
            { value: 'canceled', text: 'Canceled' }
        ];
        
        statuses.forEach(status => {
            const option = statusSelect.createEl('option', {
                text: status.text,
                value: status.value
            });
            
            // Default to 'next-up'
            if (status.value === 'next-up') {
                option.selected = true;
            }
        });
        
        // Priority
        const priorityGroup = modalContent.createDiv({ cls: 'form-group' });
        priorityGroup.createEl('label', {text: 'Priority:'});
        const prioritySelect = priorityGroup.createEl('select');
        
        // Priority options
        const priorities = [
            { value: 1, text: 'High' },
            { value: 2, text: 'Medium' },
            { value: 3, text: 'Normal' },
            { value: 4, text: 'Low' }
        ];
        
        priorities.forEach(priority => {
            const option = prioritySelect.createEl('option', {
                text: priority.text,
                value: priority.value.toString()
            });
            
            // Default: Normal (3)
            if (priority.value === 3) {
                option.selected = true;
            }
        });
        
        // Tags
        const tagsGroup = modalContent.createDiv({ cls: 'form-group' });
        tagsGroup.createEl('label', {text: 'Tags (comma separated):'});
        const tagsInput = tagsGroup.createEl('input', {
            type: 'text',
            value: ''
        });
        
        // Buttons in a footer
        const buttonContainer = contentEl.createDiv({ cls: 'modal-footer' });
        
        // Create button
        const createButton = buttonContainer.createEl('button', {
            text: 'Create',
            cls: 'submit-button'
        });
        
        createButton.addEventListener('click', () => {
            // Validation
            if (!titleInput.value.trim()) {
                new Notice('Please enter a title');
                return;
            }
            
            // Create new task
            const newTask: Task = {
                id: '', // Will be set by the service
                title: titleInput.value,
                description: descriptionInput.value || undefined,
                creationDate: new Date(),
                status: statusSelect.value as OkrStatus,
                priority: parseInt(prioritySelect.value),
                tags: tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
                sourcePath: '',
                projectId: projectSelect.value || '',
                dueDate: null,
                completed: statusSelect.value === 'completed',
                recurring: false,
                estimatedDuration: durationInput.value ? parseInt(durationInput.value) : undefined
            };
            
            // Process date and time
            if (dateInput.value) {
                const date = new Date(dateInput.value);
                
                // Add time if present
                if (timeInput.value) {
                    const [hours, minutes] = timeInput.value.split(':').map(Number);
                    date.setHours(hours, minutes, 0, 0);
                } else {
                    // If no time specified, set to midnight
                    date.setHours(0, 0, 0, 0);
                }
                
                newTask.dueDate = date;
            }
            
            // Call callback with new task
            this.onSubmit(newTask);
            
            // Close modal
            this.close();
        });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'cancel-button'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

// Modal for time block actions
class TimeBlockModal extends Modal {
    block: TimeBlockInfo;
    task: Task;
    okrService: OkrService;
    
    constructor(app: App, block: TimeBlockInfo, task: Task, okrService: OkrService) {
        super(app);
        this.block = block;
        this.task = task;
        this.okrService = okrService;
    }
    
    onOpen() {
        const {contentEl} = this;
        
        // Heading
        contentEl.createEl('h2', {text: 'Time Block Actions'});
        
        // Container for content
        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        
        // Block info
        const infoGroup = modalContent.createDiv({ cls: 'form-group' });
        infoGroup.createEl('h3', {text: 'Block Information'});
        
        // Task title
        infoGroup.createEl('p', {text: `Task: ${this.task.title}`});
        
        // Time range
        infoGroup.createEl('p', {text: `Time: ${this.block.start.toLocaleString()} - ${this.block.end.toLocaleString()}`});
        
        // Duration
        infoGroup.createEl('p', {text: `Duration: ${this.block.duration} minutes`});
        
        // Status
        infoGroup.createEl('p', {text: `Status: ${this.block.isCompleted ? 'Completed' : 'Not completed'}`});
        
        // Actions
        const actionsGroup = modalContent.createDiv({ cls: 'form-group' });
        actionsGroup.createEl('h3', {text: 'Actions'});
        
        // Mark as completed button
        if (!this.block.isCompleted) {
            const completeButton = actionsGroup.createEl('button', {
                text: 'Mark as completed',
                cls: 'submit-button'
            });
            
            completeButton.style.marginBottom = '10px';
            completeButton.style.width = '100%';
            
            completeButton.addEventListener('click', () => {
                this.okrService.markTimeBlockCompleted(this.block.id);
                this.close();
                new Notice('Time block marked as completed');
            });
        }
        
        // Edit task button
        const editTaskButton = actionsGroup.createEl('button', {
            text: 'Edit task',
            cls: 'submit-button'
        });
        
        editTaskButton.style.marginBottom = '10px';
        editTaskButton.style.width = '100%';
        
        editTaskButton.addEventListener('click', () => {
            this.close();
            
            // Open task edit modal
            const modal = new TaskEditModal(this.app, this.task, (updatedTask) => {
                // Update task in the OKR model
                this.okrService.updateTask(updatedTask);
                
                // Notification
                new Notice('Task updated');
            });
            
            modal.open();
        });
        
        // Close button
        const closeButton = actionsGroup.createEl('button', {
            text: 'Close',
            cls: 'cancel-button'
        });
        
        closeButton.style.width = '100%';
        
        closeButton.addEventListener('click', () => {
            this.close();
        });
    }
    
    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}