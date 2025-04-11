import { App, Notice } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import AgendaHeroOKRPlugin from '../../../main';
import { OkrService } from '../../services/okr-service';
import { TaskModal } from '../../components/task-modal';
import { TimeBlockModal } from '../../components/time-block-modal';
import { CalendarDragDropManager } from './calendar-drag-drop-manager';
import { CalendarTooltipManager } from './calendar-tooltip-manager';

export class CalendarEventHandler {
    private plugin: AgendaHeroOKRPlugin;
    private okrService: OkrService;
    private app: App;
    private calendar: Calendar;
    private dragDropManager: CalendarDragDropManager;
    private tooltipManager: CalendarTooltipManager;
    
    constructor(
        plugin: AgendaHeroOKRPlugin,
        okrService: OkrService,
        app: App,
        calendar: Calendar,
        dragDropManager: CalendarDragDropManager,
        tooltipManager: CalendarTooltipManager
    ) {
        this.plugin = plugin;
        this.okrService = okrService;
        this.app = app;
        this.calendar = calendar;
        this.dragDropManager = dragDropManager;
        this.tooltipManager = tooltipManager;
    }

    /**
     * Handle event mounted in the calendar
     * @param info The event info
     */
    onEventDidMount(info: any): void {
        // Store task ID or time block ID as attribute
        const itemId = info.event.id;
        
        // Add custom drag & drop behavior
        this.dragDropManager.setupCustomDragDrop(info.el, itemId);
        
        // Add click handler for editing
        info.el.addEventListener('click', (e: MouseEvent) => {
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
        info.el.addEventListener('mouseenter', (e: MouseEvent) => {
            this.tooltipManager.showEventTooltip(info.event, e);
        });
        
        info.el.addEventListener('mouseleave', () => {
            this.tooltipManager.hideEventTooltip();
        });
    
        // Apply appropriate CSS classes
        this.applyEventStyling(info);
    }
    
    /**
     * Apply styling to calendar events
     * @param info The event info
     */
    private applyEventStyling(info: any): void {
        const itemId = info.event.id;
        const timeBlocks = this.dragDropManager.getTimeBlocks();
        
        // Identify if it's a task or time block
        if (itemId.startsWith('block-')) {
            // It's a time block - add class for styling
            info.el.classList.add('time-block');
            
            // Check if completed
            const block = timeBlocks.find(b => b.id === itemId);
            if (block && block.isCompleted) {
                info.el.classList.add('completed');
            }
        } else {
            // It's a main task - try to find from either OKR service or plugin tasks
            let task;
            try {
                task = this.okrService.getTask(itemId);
            } catch (err) {
                // Try plugin tasks instead
                task = this.plugin.tasks.find(t => t.id === itemId);
            }
            
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
                    
                    // Check for scheduling conflicts (safely)
                    try {
                        const hasConflicts = this.hasSchedulingConflicts(task);
                        if (hasConflicts) {
                            info.el.classList.add('schedule-conflict');
                        }
                    } catch (err) {
                        console.warn("Error checking scheduling conflicts:", err);
                    }
                }
                
                if (task.completed) {
                    info.el.classList.add('completed-task');
                }
            }
        }
    }

    /**
     * Handle date click in the calendar
     * @param info The date click info
     */
    onDateClick(info: any): void {
        this.createNewTask(info.date);
    }

    /**
     * Handle event drop in the calendar
     * @param info The event drop info
     */
    onEventDrop(info: any): void {
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

    /**
     * Edit a task
     * @param taskId The task ID to edit
     */
    editTask(taskId: string): void {
        try {
            // First try to get the task from OKR service
            let task: any;
            
            try {
                task = this.okrService.getTask(taskId);
            } catch (err) {
                console.warn("Error getting task from OKR service:", err);
            }
            
            if (!task) {
                // Try to find in plugin tasks
                task = this.plugin.tasks.find(t => t.id === taskId);
            }
            
            if (task) {
                const modal = new TaskModal(
                    this.app,
                    this.okrService,
                    task.projectId || '',
                    (updatedTask) => {
                        try {
                            // First try to update in OKR service
                            this.okrService.updateTask(updatedTask as any);
                        } catch (err) {
                            console.warn('OKR service could not update task:', err);
                            
                            // Fall back to plugin's task update
                            const pluginTask = this.plugin.tasks.find(t => t.id === taskId);
                            if (pluginTask) {
                                Object.assign(pluginTask, updatedTask);
                                this.plugin.updateTaskInFile(updatedTask as any);
                            }
                        }
                        
                        // Notification
                        new Notice('Task updated');
                        
                        // Refetch calendar events
                        this.calendar.refetchEvents();
                    },
                    task as any // Pass existing task
                );
                
                modal.open();
            } else {
                new Notice('Task not found');
            }
        } catch (error) {
            console.error('Error editing task:', error);
            new Notice(`Error editing task: ${error.message}`);
        }
    }

    /**
     * Edit a time block
     * @param blockId The time block ID to edit
     */
    editTimeBlock(blockId: string): void {
        try {
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
        } catch (error) {
            console.error('Error editing time block:', error);
            new Notice(`Error editing time block: ${error.message}`);
        }
    }

    /**
     * Create a new task
     * @param date The date for the new task
     */
    createNewTask(date: Date): void {
        try {
            // Create new task modal using our new TaskModal
            const modal = new TaskModal(
                this.app,
                this.okrService,
                null, // No project ID yet
                async (newTask: any, filePath?: string) => {
                    try {
                        // Process date and time
                        if (newTask.dueDate) {
                            // Add task to OKR model (try)
                            try {
                                // Convert to compatible format if needed
                                const taskForService: any = { ...newTask };
                                // Ensure required fields
                                if (taskForService.projectId === undefined) {
                                    taskForService.projectId = '';
                                }
                                
                                await this.okrService.createTask(taskForService, filePath);
                            } catch (err) {
                                console.warn('OKR service could not create task:', err);
                                // Fall back to plugin's task creation
                                this.plugin.tasks.push(newTask);
                                this.plugin.notifyTasksUpdated();
                            }
                        }
                        
                        // Notification
                        new Notice(`New task created for ${date.toLocaleDateString()}`);
                        
                        // Refetch calendar events
                        this.calendar.refetchEvents();
                        
                    } catch (err) {
                        console.error('Error creating task:', err);
                        new Notice(`Error creating task: ${err.message}`);
                    }
                },
                undefined, // No existing task
                date // Selected date
            );
            
            modal.open();
        } catch (error) {
            console.error('Error creating new task:', error);
            new Notice(`Error creating task: ${error.message}`);
        }
    }

    /**
     * Check if a task has scheduling conflicts
     * @param task The task to check
     * @returns Whether the task has conflicts
     */
    private hasSchedulingConflicts(task: any): boolean {
        const timeBlocks = this.dragDropManager.getTimeBlocks();
        
        // If task has no time blocks, it can't have conflicts
        if (!task.estimatedDuration || !task.dueDate) {
            return false;
        }
        
        // Get task's time blocks
        const taskBlocks = timeBlocks.filter(block => block.taskId === task.id);
        if (taskBlocks.length === 0) {
            return false;
        }
        
        // Get all other blocks
        const otherBlocks = timeBlocks.filter(block => block.taskId !== task.id);
        
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
    private blocksOverlap(block1: any, block2: any): boolean {
        return (
            (block1.start >= block2.start && block1.start < block2.end) || // Block 1 starts during Block 2
            (block1.end > block2.start && block1.end <= block2.end) || // Block 1 ends during Block 2
            (block1.start <= block2.start && block1.end >= block2.end) // Block 1 contains Block 2
        );
    }
}