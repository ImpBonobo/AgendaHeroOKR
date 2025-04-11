import { App, Notice } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import AgendaHeroOKRPlugin from '../../../main';
import { OkrService } from '../../services/okr-service';
import { TimeBlockInfo } from '../../utils/time-manager';

export class CalendarDragDropManager {
    private plugin: AgendaHeroOKRPlugin;
    private okrService: OkrService;
    private app: App;
    private calendar: Calendar;
    private timeBlocks: TimeBlockInfo[] = [];
    
    constructor(
        plugin: AgendaHeroOKRPlugin,
        okrService: OkrService,
        app: App,
        calendar: Calendar,
        timeBlocks: TimeBlockInfo[]
    ) {
        this.plugin = plugin;
        this.okrService = okrService;
        this.app = app;
        this.calendar = calendar;
        this.timeBlocks = timeBlocks;
    }

    /**
     * Set up external element drop handlers
     * @param calendarContainer The calendar container element
     */
    setupExternalDropHandlers(calendarContainer: HTMLElement): void {
        // Event listener for task drag start
        // @ts-ignore - Obsidian API allows custom events
        this.app.workspace.on('agenda-hero-okr:task-drag-start', (data: any) => {
            // Highlight calendar container
            calendarContainer.addClass('agenda-hero-okr-calendar-drop-target');
        });
        
        // Event listener for task drag end
        // @ts-ignore - Obsidian API allows custom events
        this.app.workspace.on('agenda-hero-okr:task-drag-end', () => {
            // Remove highlight
            calendarContainer.removeClass('agenda-hero-okr-calendar-drop-target');
        });
        
        // Event listener for task drag cancel
        // @ts-ignore - Obsidian API allows custom events
        this.app.workspace.on('agenda-hero-okr:task-drag-cancel', () => {
            // Remove highlight
            calendarContainer.removeClass('agenda-hero-okr-calendar-drop-target');
        });
        
        // Event listener for task dropped
        // @ts-ignore - Obsidian API allows custom events
        this.app.workspace.on('agenda-hero-okr:task-dropped', (data: any) => {
            // Remove highlight
            calendarContainer.removeClass('agenda-hero-okr-calendar-drop-target');
            
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
        });
    }

    /**
     * Set up custom drag and drop behavior for calendar events
     * @param element The event element
     * @param itemId The item ID
     */
    setupCustomDragDrop(element: HTMLElement, itemId: string): void {
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
            document.body.classList.add('agenda-hero-okr-dragging');
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
            document.body.classList.remove('agenda-hero-okr-dragging');
            
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

    /**
     * Move ghost element to follow cursor
     * @param element Ghost element
     * @param clientX Mouse X position
     * @param clientY Mouse Y position
     * @param offsetX X offset
     * @param offsetY Y offset
     */
    private moveGhostElement(element: HTMLElement, clientX: number, clientY: number, offsetX: number, offsetY: number): void {
        element.style.left = (clientX - offsetX) + 'px';
        element.style.top = (clientY - offsetY) + 'px';
    }

    /**
     * Highlight the day under the cursor
     * @param clientX Mouse X position
     * @param clientY Mouse Y position
     */
    private highlightDayUnderCursor(clientX: number, clientY: number): void {
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

    /**
     * Remove all day highlights
     */
    private removeAllHighlights(): void {
        document.querySelectorAll('.drag-target-highlight').forEach(el => {
            el.classList.remove('drag-target-highlight');
        });
    }

    /**
     * Get date from position in the calendar
     * @param clientX Mouse X position
     * @param clientY Mouse Y position
     * @returns Date at that position or null
     */
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
    
    /**
     * Find the column element in a time grid view
     * @param element Element to start from
     * @returns Column element or null
     */
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
    
    /**
     * Find date from a time grid column
     * @param column Column element
     * @param timeAttr Time attribute
     * @returns Date or null
     */
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
    
    /**
     * Create a date object from date string and time string
     * @param dateStr Date string
     * @param timeStr Time string
     * @returns Date object or null
     */
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
    
    /**
     * Get date from calendar view and time string
     * @param timeStr Time string
     * @param clientX Mouse X position to determine day in week view
     * @returns Date object or null
     */
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
     * Get time blocks
     * @returns Array of time blocks
     */
    getTimeBlocks(): TimeBlockInfo[] {
        return this.timeBlocks;
    }

    /**
     * Set time blocks
     * @param timeBlocks Array of time blocks
     */
    setTimeBlocks(timeBlocks: TimeBlockInfo[]): void {
        this.timeBlocks = timeBlocks;
    }
}