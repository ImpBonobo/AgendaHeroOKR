import { App, Notice } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import { EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import AgendaHeroOKRPlugin from '../../../main';
import { TimeBlockInfo } from '../../utils/time-manager';
import { OkrService } from '../../services/okr-service';

export class CalendarRenderer {
    private calendar: Calendar;
    private plugin: AgendaHeroOKRPlugin;
    private okrService: OkrService;
    private app: App;
    private timeBlocks: TimeBlockInfo[] = [];
    private container: HTMLElement;
    
    constructor(
        container: HTMLElement,
        plugin: AgendaHeroOKRPlugin,
        okrService: OkrService,
        app: App
    ) {
        this.container = container;
        this.plugin = plugin;
        this.okrService = okrService;
        this.app = app;
    }

    /**
     * Initialize and render the calendar
     * @param onEventDidMount Function to call when an event is mounted
     * @param onDateClick Function to call when a date is clicked
     * @param onEventDrop Function to call when an event is dropped
     * @returns The created calendar instance
     */
    initializeCalendar(
        onEventDidMount: (info: any) => void,
        onDateClick: (info: any) => void,
        onEventDrop: (info: any) => void
    ): Calendar {
        try {
            // Initialize calendar with options
            this.calendar = new Calendar(this.container, {
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
                
                // Event handlers
                eventDidMount: onEventDidMount,
                dateClick: onDateClick,
                eventDrop: onEventDrop
            });
            
            // Render calendar
            this.calendar.render();
            
            return this.calendar;
        } catch (error) {
            console.error('Error initializing calendar:', error);
            throw error;
        }
    }

    /**
     * Get events from the OKR model
     * @returns Array of event inputs for the calendar
     */
    getEventsFromOkrModel(): EventInput[] {
        // Format events from the OKR model
        const events: EventInput[] = [];
        
        try {
            // First try to get tasks from OKR service
            let okrTasks = this.okrService.getTasks();
            let tasks: any[] = [];
            
            // If no tasks from OKR service, fall back to plugin tasks
            if (!okrTasks || okrTasks.length === 0) {
                console.log("No tasks from OKR service, using plugin tasks");
                tasks = this.plugin.tasks;
            } else {
                tasks = okrTasks;
            }
            
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
            try {
                const projects = this.okrService.getProjects();
                projects.forEach((project, index) => {
                    const colorIndex = index % colorPalette.length;
                    projectColors.set(project.id, colorPalette[colorIndex]);
                });
            } catch (err) {
                console.log("Error getting projects:", err);
            }
            
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
                        const priorityIndex = Math.min(Math.max((task.priority || 3) - 1, 0), 3);
                        backgroundColor = priorityColors[priorityIndex];
                        borderColor = backgroundColor;
                    }
                    
                    // Create event and add to array
                    events.push({
                        id: task.id,
                        title: task.title || task.content || "Untitled Task",
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
            
            // Add time blocks as events (if available)
            try {
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
            } catch (blockError) {
                console.error("Error loading time blocks:", blockError);
            }
            
            console.log(`${events.length} events created`);
            return events;
        } catch (error) {
            console.error("Error creating events from OKR model:", error);
            return [];
        }
    }

    /**
     * Update calendar events
     */
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

    /**
     * Get the calendar instance
     * @returns The calendar instance
     */
    getCalendar(): Calendar {
        return this.calendar;
    }

    /**
     * Get the time blocks
     * @returns The time blocks
     */
    getTimeBlocks(): TimeBlockInfo[] {
        return this.timeBlocks;
    }

    /**
     * Set the time blocks
     * @param timeBlocks The time blocks to set
     */
    setTimeBlocks(timeBlocks: TimeBlockInfo[]) {
        this.timeBlocks = timeBlocks;
    }

    /**
     * Helper method to get color from priority
     * @param priority The priority value
     * @returns The color for the priority
     */
    getPriorityColor(priority: number): string {
        const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
        return priorityColors[Math.min(priority - 1, priorityColors.length - 1)];
    }

    /**
     * Destroy the calendar
     */
    destroy() {
        if (this.calendar) {
            this.calendar.destroy();
        }
    }
}