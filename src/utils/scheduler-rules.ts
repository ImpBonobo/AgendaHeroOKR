/**
 * Scheduler Rules - Advanced rules for intelligent task scheduling
 * 
 * This utility provides rule-based scheduling logic to enhance the Time Manager's
 * capabilities with more sophisticated scheduling decisions.
 * 
 * This is part of the intelligent scheduling system described in the project
 * requirements that can automatically distribute tasks in time blocks
 * based on priority, deadline, and available time windows.
 */

import { Task } from '../models/okr-models';
import { TimeBlockInfo } from './time-manager';

/**
 * Scheduling context containing all data needed for making decisions
 */
export interface SchedulingContext {
    task: Task;                   // The task being scheduled
    availableSlots: TimeSlot[];   // Available time slots
    existingBlocks: TimeBlockInfo[]; // Existing scheduled blocks
    deadlineDate: Date;           // The deadline (may be task due date or earlier)
    currentDate: Date;            // Current date/time
    minBlockSize: number;         // Minimum block size in minutes
}

/**
 * A time slot that's available for scheduling
 */
export interface TimeSlot {
    start: Date;              // Start time
    end: Date;                // End time
    duration: number;         // Duration in minutes
    timeWindowId: string;     // ID of the time window
    quality: number;          // Quality score (0-100, higher is better)
}

/**
 * Result of applying scheduling rules
 */
export interface RuleResult {
    selectedSlots: TimeSlot[];    // Selected slots for scheduling
    message: string;              // Explanation of the decision
    remainingDuration: number;    // Unscheduled minutes remaining
}

/**
 * Calculate the optimal scheduling solution based on various factors
 * 
 * @param context The scheduling context
 * @returns The scheduling result with selected time slots
 */
export function applySchedulingRules(context: SchedulingContext): RuleResult {
    // Clone and sort slots by various criteria
    const sortedSlots = [...context.availableSlots];
    
    // Apply different sorting strategies based on task properties
    if (isUrgent(context.task)) {
        // For urgent tasks, prioritize earlier slots
        sortedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
    } else if (isLongTask(context.task)) {
        // For long tasks, prioritize larger blocks first
        sortedSlots.sort((a, b) => b.duration - a.duration);
    } else {
        // Default: balance between time quality and proximity to deadline
        sortedSlots.sort((a, b) => {
            // Score based on quality and timing
            const scoreA = a.quality + getProximityScore(a.start, context.deadlineDate);
            const scoreB = b.quality + getProximityScore(b.start, context.deadlineDate);
            return scoreB - scoreA;
        });
    }
    
    // Apply preferred time windows if specified
    if (context.task.allowedTimeWindows && context.task.allowedTimeWindows.length > 0) {
        const preferredWindows = new Set(context.task.allowedTimeWindows);
        // Move preferred windows to the front
        sortedSlots.sort((a, b) => {
            const aPreferred = preferredWindows.has(a.timeWindowId) ? 1 : 0;
            const bPreferred = preferredWindows.has(b.timeWindowId) ? 1 : 0;
            return bPreferred - aPreferred;
        });
    }
    
    // Select slots until we've scheduled the full duration
    const selectedSlots: TimeSlot[] = [];
    let remainingDuration = context.task.estimatedDuration || 0;
    
    for (const slot of sortedSlots) {
        if (remainingDuration <= 0) break;
        
        // Calculate how much time to use from this slot
        const durationToUse = Math.min(remainingDuration, slot.duration);
        
        // Only use the slot if it meets minimum block size
        if (durationToUse >= context.minBlockSize) {
            // Create a new slot with adjusted duration
            const adjustedSlot = {
                ...slot,
                end: new Date(slot.start.getTime() + durationToUse * 60 * 1000),
                duration: durationToUse
            };
            
            selectedSlots.push(adjustedSlot);
            remainingDuration -= durationToUse;
        }
    }
    
    // Generate explanation message
    let message = '';
    if (selectedSlots.length === 0) {
        message = 'No suitable time slots found.';
    } else if (remainingDuration > 0) {
        message = `Partially scheduled: ${context.task.estimatedDuration! - remainingDuration} of ${context.task.estimatedDuration} minutes scheduled across ${selectedSlots.length} time block(s).`;
    } else {
        message = `Fully scheduled: ${context.task.estimatedDuration} minutes across ${selectedSlots.length} time block(s).`;
    }
    
    return {
        selectedSlots,
        message,
        remainingDuration
    };
}

/**
 * Calculate a score based on how close a date is to the deadline
 * Higher score for dates closer to (but before) the deadline
 * 
 * @param date The date to check
 * @param deadline The deadline
 * @returns A score between 0-100
 */
function getProximityScore(date: Date, deadline: Date): number {
    const now = new Date();
    const totalTimespan = deadline.getTime() - now.getTime();
    const timeUntilSlot = date.getTime() - now.getTime();
    
    // If the slot is after the deadline, score 0
    if (timeUntilSlot > totalTimespan) return 0;
    
    // If totalTimespan is 0 or negative, return max score for anything before deadline
    if (totalTimespan <= 0) return 100;
    
    // Calculate what percentage through the available time this slot occurs
    const percentageThrough = (timeUntilSlot / totalTimespan) * 100;
    
    // Ideal time is around 70-80% through the available time (not too early, not too late)
    // This creates a bell curve with the peak at 75%
    return 100 - Math.abs(percentageThrough - 75);
}

/**
 * Check if a task should be considered urgent
 * 
 * @param task The task to check
 * @returns Whether the task is urgent
 */
function isUrgent(task: Task): boolean {
    // Consider high priority tasks (1) as urgent
    if (task.priority === 1) return true;
    
    // Consider tasks with high urgency as urgent
    if (task.urgency && task.urgency > 80) return true;
    
    // Check due date if available
    if (task.dueDate) {
        const now = new Date();
        const hoursUntilDue = (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        // If due within 24 hours, consider urgent
        if (hoursUntilDue < 24) return true;
        
        // If due soon relative to estimated duration, consider urgent
        if (task.estimatedDuration) {
            const hoursNeeded = task.estimatedDuration / 60;
            // If we have less than 2x the time needed, it's urgent
            if (hoursUntilDue < hoursNeeded * 2) return true;
        }
    }
    
    return false;
}

/**
 * Check if a task should be considered a long task
 * 
 * @param task The task to check
 * @returns Whether the task is a long task
 */
function isLongTask(task: Task): boolean {
    // If estimated duration is more than 2 hours, consider it a long task
    return !!task.estimatedDuration && task.estimatedDuration > 120;
}

/**
 * Recalculate urgency for a task based on various factors
 * 
 * @param task The task to evaluate
 * @returns Updated urgency score (0-100, higher is more urgent)
 */
export function calculateTaskUrgency(task: Task): number {
    if (!task.dueDate) return 0;
    
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    
    // Base score: Time remaining until due date
    // Convert to hours for more granular scoring
    const hoursRemaining = Math.max(0, (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    // If already overdue, maximum urgency
    if (hoursRemaining <= 0) return 100;
    
    // Base urgency is inversely proportional to hours remaining
    // The closer to the deadline, the higher the urgency
    // Use a logarithmic scale to give more weight to imminent deadlines
    // 24 hours = ~70, 48 hours = ~60, 72 hours = ~50, 1 week = ~30
    let urgency = 100 - (Math.log(hoursRemaining + 1) / Math.log(168)) * 100; // 168 = hours in a week
    
    // Adjust for priority (higher priority = higher urgency)
    // Priority 1 (highest) adds 20, Priority 4 (lowest) adds 0
    const priorityBonus = (5 - task.priority) * 6.67; // Maps priority 1-4 to ~20-0
    urgency += priorityBonus;
    
    // Adjust for estimated duration if available
    if (task.estimatedDuration) {
        const hoursNeeded = task.estimatedDuration / 60;
        
        // If we have barely enough time to complete the task, increase urgency
        const timeRatio = hoursNeeded / hoursRemaining;
        
        if (timeRatio > 0.5) { // If task takes more than half the remaining time
            // More duration relative to remaining time = higher urgency
            // This adds up to 15 points for tasks that need almost all the remaining time
            const durationBonus = Math.min(15, timeRatio * 15);
            urgency += durationBonus;
        }
    }
    
    // Consider split up configuration
    if (task.splitUpBlock && task.estimatedDuration) {
        // More blocks needed = higher urgency (up to 5 points)
        const blocksNeeded = Math.ceil(task.estimatedDuration / task.splitUpBlock);
        const splitBonus = Math.min(5, blocksNeeded);
        urgency += splitBonus;
    }
    
    // Cap at 100
    return Math.min(100, Math.round(urgency));
}

/**
 * Determine if a task can be scheduled
 * 
 * @param task The task to check
 * @returns Whether the task can be scheduled
 */
export function isTaskSchedulable(task: Task): boolean {
    // Task must have a due date and estimated duration
    if (!task.dueDate || !task.estimatedDuration) return false;
    
    // Task must not be completed
    if (task.completed) return false;
    
    // If task has autoSchedule property, respect it
    if (task.autoSchedule !== undefined) return task.autoSchedule;
    
    // Default to schedulable
    return true;
}

/**
 * Get the ideal block size for a task
 * 
 * @param task The task
 * @returns The ideal block size in minutes
 */
export function getIdealBlockSize(task: Task): number {
    // If task specifies a split block size, use that
    if (task.splitUpBlock) return task.splitUpBlock;
    
    // Otherwise, determine based on task size and urgency
    const urgency = task.urgency || calculateTaskUrgency(task);
    const duration = task.estimatedDuration || 0;
    
    if (urgency > 80) {
        // Urgent tasks: smaller blocks for flexibility
        return Math.min(30, duration);
    } else if (duration > 240) {
        // Very long tasks (>4h): 1-2 hour blocks
        return 60;
    } else if (duration > 120) {
        // Long tasks (2-4h): 45 minute blocks
        return 45;
    } else {
        // Default: 30 minute blocks
        return Math.min(30, duration);
    }
}