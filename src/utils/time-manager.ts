/**
 * Time Manager for the OKR-based TaskManager Plugin
 * 
 * This utility provides intelligent time management features:
 * - Splitting tasks into manageable time blocks 
 * - Scheduling blocks based on available time windows
 * - Managing task priorities and deadline-based urgency
 * - Resolving scheduling conflicts
 * 
 * ROADMAP: Future enhancements will include:
 * - More advanced scheduling algorithms
 * - Better conflict resolution
 * - Learning from user behavior
 */

import { Task, TimeWindow } from '../models/okr-models';
import { calculateTaskUrgency as calculateAdvancedUrgency, getIdealBlockSize } from './scheduler-rules';

/**
 * TimeBlockInfo - Information about a scheduled time block
 */
export interface TimeBlockInfo {
    id: string;               // Unique ID for the time block
    taskId: string;           // ID of the associated task
    start: Date;              // Start time of the block
    end: Date;                // End time of the block
    duration: number;         // Duration in minutes
    timeWindowId: string;     // ID of the time window this block belongs to
    isCompleted: boolean;     // Whether this block has been completed
}

/**
 * TaskScheduleResult - Result of scheduling a task
 */
export interface TaskScheduleResult {
    success: boolean;         // Whether scheduling was successful
    message: string;          // Message explaining the result
    timeBlocks: TimeBlockInfo[]; // Scheduled time blocks (if successful)
    overdue: boolean;         // Whether the task is at risk of being overdue
    unscheduledMinutes: number; // Minutes that couldn't be scheduled (if any)
}

/**
 * Time Manager class that handles intelligent scheduling
 * 
 * This class implements intelligent task scheduling with enhanced features:
 * - Task urgency calculation based on multiple factors
 * - Dynamic block size determination
 * - Priority-based scheduling across time windows
 * - Conflict resolution between competing tasks
 */
export class TimeManager {
    // Cache of existing time blocks to prevent conflicts
    private scheduledBlocks: TimeBlockInfo[] = [];
    
    // Time windows configuration
    private timeWindows: TimeWindow[] = [];
    
    constructor(timeWindows: TimeWindow[] = []) {
        this.timeWindows = timeWindows;
        
        // If no time windows provided, create default ones
        if (this.timeWindows.length === 0) {
            this.createDefaultTimeWindows();
        }
    }
    
    /**
     * Create default time windows (work and personal)
     */
    private createDefaultTimeWindows() {
        // Work hours (Monday-Friday, 9am-5pm)
        const workWindow: TimeWindow = {
            id: 'work',
            name: 'Work Hours',
            color: '#3498db', // Blue
            schedule: [
                // Monday through Friday
                ...Array.from({length: 5}, (_, i) => ({
                    day: i + 1, // 1-5 (Monday-Friday)
                    ranges: [{
                        start: '09:00',
                        end: '17:00'
                    }]
                }))
            ],
            priority: 10
        };
        
        // Personal time (all days, 5am-11pm, excluding work hours)
        const personalWindow: TimeWindow = {
            id: 'personal',
            name: 'Personal Time',
            color: '#2ecc71', // Green
            schedule: [
                // Sunday
                {
                    day: 0,
                    ranges: [{
                        start: '05:00',
                        end: '23:00'
                    }]
                },
                // Monday through Friday
                ...Array.from({length: 5}, (_, i) => ({
                    day: i + 1, // 1-5 (Monday-Friday)
                    ranges: [
                        {
                            start: '05:00',
                            end: '09:00'
                        },
                        {
                            start: '17:00',
                            end: '23:00'
                        }
                    ]
                })),
                // Saturday
                {
                    day: 6,
                    ranges: [{
                        start: '05:00',
                        end: '23:00'
                    }]
                }
            ],
            priority: 5
        };
        
        this.timeWindows = [workWindow, personalWindow];
    }
    
    /**
     * Set the currently scheduled blocks (e.g., from existing tasks)
     * @param blocks Array of scheduled time blocks
     */
    setScheduledBlocks(blocks: TimeBlockInfo[]) {
        this.scheduledBlocks = [...blocks];
    }
    
    /**
     * Get all scheduled blocks
     * @returns Array of scheduled time blocks
     */
    getScheduledBlocks(): TimeBlockInfo[] {
        return [...this.scheduledBlocks];
    }
    
    /**
     * Set available time windows
     * @param windows Array of time windows
     */
    setTimeWindows(windows: TimeWindow[]) {
        this.timeWindows = [...windows];
    }
    
    /**
     * Get available time windows
     * @returns Array of time windows
     */
    getTimeWindows(): TimeWindow[] {
        return [...this.timeWindows];
    }
    
    /**
     * Schedule a task by splitting it into time blocks
     * @param task The task to schedule
     * @returns Result of the scheduling operation
     */
    scheduleTask(task: Task): TaskScheduleResult {
        
        // Validate task has the necessary properties
        if (!task.dueDate) {
            return {
                success: false,
                message: 'Task must have a due date',
                timeBlocks: [],
                overdue: false,
                unscheduledMinutes: 0
            };
        }
        
        if (!task.estimatedDuration || task.estimatedDuration <= 0) {
            return {
                success: false,
                message: 'Task must have a valid estimated duration',
                timeBlocks: [],
                overdue: false,
                unscheduledMinutes: 0
            };
        }
        
        // Determine the minimum block size
        const minBlockSize = this.getIdealBlockSize(task); // Default to 30 minutes
        
        // Calculate the number of blocks needed
        const totalMinutes = task.estimatedDuration;
        const numberOfBlocks = Math.ceil(totalMinutes / minBlockSize);
        
        // Get allowed time windows for this task
        let allowedWindows = this.timeWindows;
        if (task.allowedTimeWindows && task.allowedTimeWindows.length > 0) {
            allowedWindows = this.timeWindows.filter(window => 
                task.allowedTimeWindows?.includes(window.id)
            );
            
            // If no matching windows found, return error
            if (allowedWindows.length === 0) {
                return {
                    success: false,
                    message: 'No matching time windows found for task',
                    timeBlocks: [],
                    overdue: false,
                    unscheduledMinutes: totalMinutes
                };
            }
        }
        
        // Sort windows by priority (highest first)
        allowedWindows.sort((a, b) => b.priority - a.priority);
        
        // Define the scheduling time range
        const now = new Date();
        const startTime = new Date(Math.max(now.getTime(), task.creationDate.getTime()));
        const endTime = new Date(task.dueDate);
        
        // Check if the task is already overdue
        if (endTime < now) {
            return {
                success: false,
                message: 'Task is already overdue',
                timeBlocks: [],
                overdue: true,
                unscheduledMinutes: totalMinutes
            };
        }
        
        // Find available slots
        const availableSlots = this.findAvailableSlots(
            startTime, 
            endTime, 
            minBlockSize, 
            allowedWindows,
            task.timeDefense === 'always-busy'
        );
        
        // If no slots available, return error
        if (availableSlots.length === 0) {
            return {
                success: false,
                message: 'No available time slots found within task deadline',
                timeBlocks: [],
                overdue: true,
                unscheduledMinutes: totalMinutes
            };
        }
        
        // Sort slots by start time
        availableSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
        
        // Create time blocks
        const timeBlocks: TimeBlockInfo[] = [];
        let remainingMinutes = totalMinutes;
        
        for (const slot of availableSlots) {
            if (remainingMinutes <= 0) break;
            
            // Calculate the duration for this block
            const slotDurationMinutes = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
            const blockDuration = Math.min(remainingMinutes, slotDurationMinutes);
            
            // Create a new end time
            const blockEndTime = new Date(slot.start.getTime() + blockDuration * 60 * 1000);
            
            // Create the time block
            const timeBlock: TimeBlockInfo = {
                id: `${task.id}-block-${timeBlocks.length}`,
                taskId: task.id,
                start: slot.start,
                end: blockEndTime,
                duration: blockDuration,
                timeWindowId: slot.timeWindowId,
                isCompleted: false
            };
            
            // Add to the list of time blocks
            timeBlocks.push(timeBlock);
            
            // Update remaining minutes
            remainingMinutes -= blockDuration;
        }
        
        // Check if we couldn't schedule all the time
        const isPartiallyScheduled = remainingMinutes > 0;
        
        // Add the scheduled blocks to the cache
        this.scheduledBlocks.push(...timeBlocks);
        
        // Return the result
        return {
            success: !isPartiallyScheduled,
            message: isPartiallyScheduled 
                ? `Only ${totalMinutes - remainingMinutes} of ${totalMinutes} minutes could be scheduled` 
                : `Task scheduled into ${timeBlocks.length} time blocks`,
            timeBlocks: timeBlocks,
            overdue: isPartiallyScheduled,
            unscheduledMinutes: remainingMinutes
        };
    }
    
    /**
     * Find available time slots based on time windows and existing blocks
     * @param startTime Earliest start time
     * @param endTime Latest end time
     * @param minBlockSize Minimum block size in minutes
     * @param allowedWindows Allowed time windows
     * @param isFixed Whether the task is fixed (true) or can be moved by others (false)
     * @returns Array of available time slots
     */
    private findAvailableSlots(
        startTime: Date, 
        endTime: Date, 
        minBlockSize: number,
        allowedWindows: TimeWindow[],
        isFixed: boolean
    ): Array<{start: Date, end: Date, timeWindowId: string}> {
        const slots: Array<{start: Date, end: Date, timeWindowId: string}> = [];
        
        // Clone start time to avoid modifying the original
        let currentTime = new Date(startTime.getTime());
        
        // Loop until we reach the end time or have found enough slots
        while (currentTime < endTime) {
            // Find the next valid window that contains the current time
            const window = this.findNextValidWindow(currentTime, allowedWindows);
            
            // If no valid window found, move to the next day
            if (!window) {
                // Move to next day at start of day
                currentTime.setDate(currentTime.getDate() + 1);
                currentTime.setHours(0, 0, 0, 0);
                continue;
            }
            
            // Get the window end time
            const windowEnd = this.getWindowEndTime(currentTime, window);
            
            // Find the next busy block that overlaps with this window
            const nextBusyBlock = this.findNextBusyBlock(
                currentTime, 
                windowEnd, 
                isFixed
            );
            
            // If no busy block found, we can use the whole window
            if (!nextBusyBlock) {
                // Make sure the slot is long enough
                const slotDurationMinutes = (windowEnd.getTime() - currentTime.getTime()) / (1000 * 60);
                
                if (slotDurationMinutes >= minBlockSize) {
                    slots.push({
                        start: currentTime,
                        end: windowEnd,
                        timeWindowId: window.id
                    });
                }
                
                // Move to the next window
                currentTime = new Date(windowEnd.getTime());
            } else {
                // Check if we have enough time before the busy block
                const timeBeforeBlock = (nextBusyBlock.start.getTime() - currentTime.getTime()) / (1000 * 60);
                
                if (timeBeforeBlock >= minBlockSize) {
                    slots.push({
                        start: currentTime,
                        end: nextBusyBlock.start,
                        timeWindowId: window.id
                    });
                }
                
                // Move to the end of the busy block
                currentTime = new Date(nextBusyBlock.end.getTime());
            }
        }
        
        return slots;
    }
    
    /**
     * Find the next valid time window that contains the given time
     * @param time The time to check
     * @param windows Array of time windows to check
     * @returns The matching time window or null if none found
     */
    private findNextValidWindow(time: Date, windows: TimeWindow[]): TimeWindow | null {
        // Get day of week (0-6, Sunday-Saturday)
        const dayOfWeek = time.getDay();
        
        // Format current time as string (HH:MM)
        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${
            time.getMinutes().toString().padStart(2, '0')}`;
        
        // Check each window to see if it contains the current time
        for (const window of windows) {
            // Find the current day's schedule
            const daySchedule = window.schedule.find(s => s.day === dayOfWeek);
            if (!daySchedule) continue;
            
            // Check each time range
            for (const range of daySchedule.ranges) {
                // If current time is within range, return this window
                if (timeStr >= range.start && timeStr < range.end) {
                    return window;
                }
                
                // If current time is before range start, we found a future window
                if (timeStr < range.start) {
                    // Return a modified time with the future start time
                    const futureTime = new Date(time.getTime());
                    const [hours, minutes] = range.start.split(':').map(Number);
                    futureTime.setHours(hours, minutes, 0, 0);
                    
                    // If future time is today, return this window
                    if (futureTime.getDate() === time.getDate()) {
                        return window;
                    }
                }
            }
        }
        
        // Look for the next day that has a valid window
        for (let nextDay = 1; nextDay <= 7; nextDay++) {
            const checkDate = new Date(time.getTime());
            checkDate.setDate(checkDate.getDate() + nextDay);
            checkDate.setHours(0, 0, 0, 0);
            
            const checkDayOfWeek = checkDate.getDay();
            
            // Find the earliest window on this day
            let earliestWindow: TimeWindow | null = null;
            let earliestTime: Date | null = null;
            
            for (const window of windows) {
                const daySchedule = window.schedule.find(s => s.day === checkDayOfWeek);
                if (!daySchedule || daySchedule.ranges.length === 0) continue;
                
                // Get the earliest range
                const earliestRange = daySchedule.ranges.reduce(
                    (earliest, range) => range.start < earliest.start ? range : earliest,
                    daySchedule.ranges[0]
                );
                
                // Create date for this range
                const rangeStartTime = new Date(checkDate.getTime());
                const [hours, minutes] = earliestRange.start.split(':').map(Number);
                rangeStartTime.setHours(hours, minutes, 0, 0);
                
                // Check if this is earlier than our current earliest
                if (!earliestTime || rangeStartTime < earliestTime) {
                    earliestTime = rangeStartTime;
                    earliestWindow = window;
                }
            }
            
            if (earliestWindow) {
                return earliestWindow;
            }
        }
        
        return null;
    }
    
    /**
     * Get the end time for a window from the given start time
     * @param startTime The start time within the window
     * @param window The time window
     * @returns The end time of the window segment
     */
    private getWindowEndTime(startTime: Date, window: TimeWindow): Date {
        const dayOfWeek = startTime.getDay();
        
        // Get the current day's schedule
        const daySchedule = window.schedule.find(s => s.day === dayOfWeek);
        if (!daySchedule) {
            // If no schedule for this day, default to end of day
            const endOfDay = new Date(startTime.getTime());
            endOfDay.setHours(23, 59, 59, 999);
            return endOfDay;
        }
        
        // Format current time as string (HH:MM)
        const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${
            startTime.getMinutes().toString().padStart(2, '0')}`;
        
        // Find the current range
        for (const range of daySchedule.ranges) {
            if (timeStr >= range.start && timeStr < range.end) {
                // Create date for the end time
                const endTime = new Date(startTime.getTime());
                const [hours, minutes] = range.end.split(':').map(Number);
                endTime.setHours(hours, minutes, 0, 0);
                return endTime;
            }
        }
        
        // Fallback: return end of day
        const endOfDay = new Date(startTime.getTime());
        endOfDay.setHours(23, 59, 59, 999);
        return endOfDay;
    }
    
    /**
     * Find the next busy block that overlaps with the given time range
     * @param startTime Start of the time range
     * @param endTime End of the time range
     * @param onlyCheckFixed Whether to only check fixed blocks
     * @returns The next busy block or null if none found
     */
    private findNextBusyBlock(
        startTime: Date, 
        endTime: Date, 
        onlyCheckFixed: boolean
    ): TimeBlockInfo | null {
        // Filter blocks that overlap with the given range
        const overlappingBlocks = this.scheduledBlocks.filter(block => {
            // Skip blocks that belong to 'always-free' tasks if we're only checking fixed blocks
            if (onlyCheckFixed) {
                const task = this.getTaskById(block.taskId);
                if (task && task.timeDefense === 'always-free') return false;
            }
            
            // Check for overlap
            return (
                (block.start >= startTime && block.start < endTime) || // Block starts within range
                (block.end > startTime && block.end <= endTime) || // Block ends within range
                (block.start <= startTime && block.end >= endTime) // Block contains range
            );
        });
        
        // If no overlapping blocks, return null
        if (overlappingBlocks.length === 0) return null;
        
        // Find the earliest block
        return overlappingBlocks.reduce(
            (earliest, block) => block.start < earliest.start ? block : earliest,
            overlappingBlocks[0]
        );
    }
    
    /**
     * Get a task by its ID (placeholder - actual implementation would depend on storage mechanism)
     * @param taskId The ID of the task to retrieve
     * @returns The task or null if not found
     */
    private getTaskById(taskId: string): Task | null {
        // This would need to be implemented based on how tasks are stored
        // For now, return a dummy implementation
        return {
            id: taskId,
            title: 'Dummy task',
            creationDate: new Date(),
            status: 'in-progress',
            priority: 3,
            tags: [],
            sourcePath: '',
            projectId: '',
            dueDate: null,
            completed: false,
            recurring: false,
            timeDefense: 'always-free'
        };
    }
    
    /**
     * Mark a time block as completed
     * @param blockId ID of the time block
     * @returns Whether the operation was successful
     */
    markBlockCompleted(blockId: string): boolean {
        const blockIndex = this.scheduledBlocks.findIndex(block => block.id === blockId);
        if (blockIndex === -1) return false;
        
        this.scheduledBlocks[blockIndex].isCompleted = true;
        return true;
    }
    
    /**
     * Remove scheduled blocks for a task
     * @param taskId ID of the task
     * @returns Number of blocks removed
     */
    removeScheduledBlocks(taskId: string): number {
        const initialCount = this.scheduledBlocks.length;
        this.scheduledBlocks = this.scheduledBlocks.filter(block => block.taskId !== taskId);
        return initialCount - this.scheduledBlocks.length;
    }
    
    /**
     * Get all time blocks for a task
     * @param taskId ID of the task
     * @returns Array of time blocks for the task
     */
    getBlocksForTask(taskId: string): TimeBlockInfo[] {
        return this.scheduledBlocks.filter(block => block.taskId === taskId);
    }
    
    /**
     * Get scheduled tasks for a specific time frame
     * @param startDate Start of the time frame
     * @param endDate End of the time frame
     * @returns Time blocks within the specified time frame
     */
    getBlocksInTimeframe(startDate: Date, endDate: Date): TimeBlockInfo[] {
        return this.scheduledBlocks.filter(block =>
            (block.start >= startDate && block.start < endDate) ||
            (block.end > startDate && block.end <= endDate) ||
            (block.start <= startDate && block.end >= endDate)
        );
    }
    
    /**
     * Get the ideal block size for a task
     * Default to 30 minutes or the task's splitUpBlock if specified
     * @param task The task to evaluate
     * @returns The ideal block size in minutes
     */
    getIdealBlockSize(task: Task): number {
        // If task specifies a split block size, use that
        if (task.splitUpBlock) return task.splitUpBlock;
        
        // Default to 30 minutes or the task's duration if shorter
        return Math.min(30, task.estimatedDuration || 30);
    }
    /**
     * Calculate the urgency of a task based on due date and estimated duration
     * Uses the enhanced algorithm from scheduler-rules if available
     * @param task The task to evaluate
     * @returns Urgency score (higher means more urgent)
     */
    calculateTaskUrgency(task: Task): number {
        try {
            // Try to use the enhanced version first
            return calculateAdvancedUrgency(task);
        } catch (error) {
            // Fall back to original implementation
            if (!task.dueDate || !task.estimatedDuration) return 0;
            
            const now = new Date();
            const dueDate = new Date(task.dueDate);
            
            // Time remaining until due date (in minutes)
            const minutesRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60);
            
            // If already overdue, maximum urgency
            if (minutesRemaining <= 0) return 100;
            
            // Calculate ratio of estimated duration to remaining time
            const durationRatio = task.estimatedDuration / minutesRemaining;
            
            // Adjust by priority (higher priority = higher urgency)
            const priorityFactor = 1 + (5 - task.priority) * 0.5; // Priority 1 = 3x, Priority 4 = 1.5x
            
            // Base urgency is the percentage of remaining time needed
            let urgency = durationRatio * 100 * priorityFactor;
            
            // Cap at 100
            return Math.min(100, urgency);
        }
    }
}