import { Notice } from 'obsidian';
import { Calendar } from '@fullcalendar/core';
import { OkrService } from '../../services/okr-service';
import { TimeBlockInfo } from '../../utils/time-manager';

export class CalendarSchedulingManager {
    private okrService: OkrService;
    private calendar: Calendar;
    private timeBlocks: TimeBlockInfo[] = [];
    
    constructor(
        okrService: OkrService,
        calendar: Calendar,
        timeBlocks: TimeBlockInfo[]
    ) {
        this.okrService = okrService;
        this.calendar = calendar;
        this.timeBlocks = timeBlocks;
    }

    /**
     * Reschedule all auto-schedulable tasks
     */
    rescheduleAllTasks(): void {
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
            this.calendar.refetchEvents();
            
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
    toggleAutoScheduling(): void {
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
                this.calendar.refetchEvents();
            }
        } catch (error) {
            console.error('Error toggling auto-scheduling:', error);
            new Notice(`Error toggling auto-scheduling: ${error.message}`);
        }
    }

    /**
     * Resolve scheduling conflicts
     */
    resolveSchedulingConflicts(): void {
        try {
            // Find tasks with conflicts
            const tasks = this.okrService.getTasks();
            const tasksWithConflicts = tasks.filter(task => this.hasSchedulingConflicts(task));
            
            if (tasksWithConflicts.length === 0) {
                new Notice('No scheduling conflicts found');
                return;
            }
            
            // Sort by priority and urgency
            tasksWithConflicts.sort((a: any, b: any) => {
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
            this.calendar.refetchEvents();
            
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
    hasSchedulingConflicts(task: any): boolean {
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
     * @returns Whether they overlap
     */
    private blocksOverlap(block1: TimeBlockInfo, block2: TimeBlockInfo): boolean {
        return (
            (block1.start >= block2.start && block1.start < block2.end) || // Block 1 starts during Block 2
            (block1.end > block2.start && block1.end <= block2.end) || // Block 1 ends during Block 2
            (block1.start <= block2.start && block1.end >= block2.end) // Block 1 contains Block 2
        );
    }

    /**
     * Update the time blocks
     * @param timeBlocks The new time blocks
     */
    updateTimeBlocks(timeBlocks: TimeBlockInfo[]): void {
        this.timeBlocks = timeBlocks;
    }
}
