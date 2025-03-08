/**
 * OKR-basiertes TaskManager Plugin - Data Models
 * 
 * This file contains the interfaces for the OKR structure:
 * - Objective: Strategic goal
 * - KeyResult: Measurable outcome for an objective
 * - Project: Container for related tasks
 * - Task: Individual actionable item
 */

import { TFile } from 'obsidian';

// Basic status types for all OKR elements
export type OkrStatus = 'future' | 'next-up' | 'in-progress' | 'waiting-on' | 'validating' | 'completed' | 'canceled';

// Base interface for all OKR elements
export interface OkrElement {
    id: string;               // Unique identifier
    title: string;            // Title/Name of the element
    description?: string;     // Optional description
    creationDate: Date;       // When the element was created
    status: OkrStatus;        // Current status
    priority: number;         // Priority level (1-4, 1 being highest)
    tags: string[];           // Associated tags
    sourcePath: string;       // Path to the source file in Obsidian vault
    sourceFile?: TFile;       // Optional reference to the actual file object
}

/**
 * Objective - Strategic goal to be achieved
 * 
 * Objectives should be ambitious, qualitative, time-bound, and actionable by the team.
 */
export interface Objective extends OkrElement {
    startDate: Date;          // When work on the objective begins
    endDate: Date;            // Deadline for the objective
    progress: number;         // Progress as percentage (0-100%)
    keyResults: KeyResult[];  // Key Results associated with this objective
    quarter?: string;         // Optional quarterly reference (e.g., "Q1 2023")
}

/**
 * Key Result - Measurable outcome that defines success for an objective
 * 
 * Key Results should be quantifiable, achievable, lead to objective grading and progress can be measured.
 */
export interface KeyResult extends OkrElement {
    objectiveId: string;      // ID of the parent objective
    startDate: Date;          // When work on the key result begins
    endDate: Date;            // Deadline for the key result
    progress: number;         // Progress as percentage (0-100%)
    projects: Project[];      // Projects associated with this key result
    metric?: string;          // What is being measured (e.g., "Customer Satisfaction")
    startValue?: number;      // Starting value
    targetValue?: number;     // Target value to achieve
    currentValue?: number;    // Current value
    format?: string;          // Value format (e.g., "percentage", "currency")
}

/**
 * Project - Container for related tasks
 * 
 * Projects group tasks that contribute to a specific key result.
 */
export interface Project extends OkrElement {
    keyResultId: string;      // ID of the parent key result
    startDate: Date;          // When work on the project begins
    endDate: Date;            // Deadline for the project
    progress: number;         // Progress as percentage (0-100%)
    tasks: Task[];            // Tasks associated with this project
    sprintIds?: string[];     // IDs of sprints this project is part of
}

/**
 * Task - Individual actionable item
 * 
 * Tasks are the smallest unit of work in the OKR hierarchy.
 */
export interface Task extends OkrElement {
    projectId: string;        // ID of the parent project (can be empty for standalone tasks)
    dueDate: Date | null;     // When the task is due
    completed: boolean;       // Whether the task is completed
    recurring: boolean;       // Whether the task is recurring
    recurrenceRule?: string;  // Rule for recurrence (e.g., "every week")
    
    // Time planning properties
    estimatedDuration?: number;   // Estimated duration in minutes
    splitUpBlock?: number;        // Minimum block size in minutes (for time blocking)
    actualDuration?: number;      // Actual time spent (in minutes)
    
    // Time defense properties
    timeDefense?: 'always-busy' | 'always-free';  // How strongly the task defends its time
    
    // Allowed time windows
    allowedTimeWindows?: string[]; // IDs of allowed time windows (e.g., "work", "personal")
    
        // Add to the Task interface in okr-models.ts
    urgency?: number;          // Calculated urgency score (0-100)
    autoSchedule?: boolean;    // Whether to automatically schedule this task
    scheduledBlocks?: string[]; // IDs of time blocks scheduled for this task
    conflictBehavior?: 'reschedule' | 'keep' | 'prompt'; // What to do on time conflicts

    // Subtasks for split-up tasks
    subtasks?: Task[];        // Subtasks when a task is split up into time blocks
    parentTaskId?: string;    // ID of the parent task if this is a subtask
}

/**
 * TimeWindow - Defines when tasks can be scheduled
 */
export interface TimeWindow {
    id: string;               // Unique identifier
    name: string;             // Display name (e.g., "Work Hours", "Personal Time")
    color: string;            // Color for visual representation
    
    // Weekday/time constraints (array of day-specific time ranges)
    schedule: Array<{
        day: number;          // 0-6 (0 = Sunday, 1 = Monday, etc.)
        ranges: Array<{
            start: string;    // Format: "HH:MM" (24-hour format)
            end: string;      // Format: "HH:MM" (24-hour format)
        }>
    }>;
    
    priority: number;         // Priority when multiple windows overlap (higher wins)
}

/**
 * Sprint - Time-boxed period for task execution
 */
export interface Sprint {
    id: string;               // Unique identifier
    title: string;            // Display name (e.g., "Sprint 12")
    startDate: Date;          // When the sprint begins
    endDate: Date;            // When the sprint ends
    status: 'planned' | 'active' | 'completed' | 'canceled';
    tasks: Task[];            // Tasks planned for this sprint
    
    // Sprint metadata
    sprintNumber: number;     // Sequential sprint number
    month: number;            // Month (1-12)
    quarter: number;          // Quarter (1-4)
    year: number;             // Year
}

/**
 * Helper functions for working with OKR elements
 */

/**
 * Calculate progress for an objective based on its key results
 * @param objective The objective to calculate progress for
 * @returns Progress as percentage (0-100%)
 */
export function calculateObjectiveProgress(objective: Objective): number {
    if (!objective.keyResults || objective.keyResults.length === 0) {
        return 0;
    }
    
    const totalProgress = objective.keyResults.reduce(
        (sum, kr) => sum + kr.progress,
        0
    );
    
    return Math.round(totalProgress / objective.keyResults.length);
}

/**
 * Calculate progress for a key result based on its current value
 * @param keyResult The key result to calculate progress for
 * @returns Progress as percentage (0-100%)
 */
export function calculateKeyResultProgress(keyResult: KeyResult): number {
    // If we don't have the necessary values, calculate from projects
    if (keyResult.startValue === undefined || 
        keyResult.targetValue === undefined || 
        keyResult.currentValue === undefined) {
        
        if (!keyResult.projects || keyResult.projects.length === 0) {
            return 0;
        }
        
        const totalProgress = keyResult.projects.reduce(
            (sum, project) => sum + project.progress,
            0
        );
        
        return Math.round(totalProgress / keyResult.projects.length);
    }
    
    // Calculate based on start/current/target values
    const range = keyResult.targetValue - keyResult.startValue;
    if (range === 0) return 100; // Avoid division by zero
    
    const progressValue = keyResult.currentValue - keyResult.startValue;
    const progressPercent = (progressValue / range) * 100;
    
    // Ensure progress is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(progressPercent)));
}

/**
 * Calculate progress for a project based on its tasks
 * @param project The project to calculate progress for
 * @returns Progress as percentage (0-100%)
 */
export function calculateProjectProgress(project: Project): number {
    if (!project.tasks || project.tasks.length === 0) {
        return 0;
    }
    
    const completedTasks = project.tasks.filter(task => task.completed).length;
    return Math.round((completedTasks / project.tasks.length) * 100);
}

/**
 * Convert an OKR status to a user-friendly display string
 * @param status The OKR status
 * @returns User-friendly status text
 */
export function getStatusDisplayText(status: OkrStatus): string {
    switch (status) {
        case 'future': return 'Future';
        case 'next-up': return 'Next Up';
        case 'in-progress': return 'In Progress';
        case 'waiting-on': return 'Waiting On';
        case 'validating': return 'Validating';
        case 'completed': return 'Completed';
        case 'canceled': return 'Canceled';
        default: return 'Unknown';
    }
}