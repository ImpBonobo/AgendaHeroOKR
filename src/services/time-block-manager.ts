/**
 * Time Block Manager
 * 
 * This service is responsible for managing time blocks for tasks,
 * including scheduling, splitting, and managing time windows.
 */

import { Task } from '../models/okr-models';
import { TimeBlockInfo, TimeManager, TaskScheduleResult } from '../utils/time-manager';
import { OkrDataManager } from './okr-data-manager';

/**
 * Manages time blocks and scheduling for tasks
 */
export class TimeBlockManager {
    private timeManager: TimeManager;
    private dataManager?: OkrDataManager;
    
    constructor(dataManager?: OkrDataManager) {
        this.timeManager = new TimeManager();
        this.dataManager = dataManager;
        
        console.log('Time Block Manager initialized');
    }
    
    /**
     * Set the data manager (useful for initialization)
     * @param dataManager The OkrDataManager instance
     */
    setDataManager(dataManager: OkrDataManager): void {
        this.dataManager = dataManager;
    }
    
    /**
     * Check if a task has scheduled blocks
     * @param taskId ID of the task
     * @returns Whether the task has scheduled blocks
     */
    hasScheduledBlocks(taskId: string): boolean {
        return this.timeManager.getScheduledBlocks().some(block => block.taskId === taskId);
    }
    
    /**
     * Get all scheduled blocks
     * @returns Array of time blocks
     */
    getScheduledBlocks(): TimeBlockInfo[] {
        return this.timeManager.getScheduledBlocks();
    }
    
    /**
     * Get blocks in a specific timeframe
     * @param startDate Start of the timeframe
     * @param endDate End of the timeframe
     * @returns Time blocks within the timeframe
     */
    getBlocksInTimeframe(startDate: Date, endDate: Date): TimeBlockInfo[] {
        return this.timeManager.getBlocksInTimeframe(startDate, endDate);
    }
    
    /**
     * Schedule a task and create time blocks for it
     * @param task The task to schedule
     * @returns The created time blocks
     */
    scheduleTask(task: Task): TimeBlockInfo[] {
        if (!task.estimatedDuration || !task.dueDate) {
            return [];
        }
        
        // Schedule the task using the time manager
        const result = this.timeManager.scheduleTask(task);
        
        // If the scheduling was successful, return the blocks
        if (result.success || result.timeBlocks.length > 0) {
            return result.timeBlocks;
        }
        
        return [];
    }
    
    /**
     * Mark a time block as completed
     * @param blockId ID of the time block
     * @returns Whether the operation was successful
     */
    markBlockCompleted(blockId: string): boolean {
        return this.timeManager.markBlockCompleted(blockId);
    }
    
    /**
     * Remove scheduled blocks for a task
     * @param taskId ID of the task
     */
    removeScheduledBlocks(taskId: string): void {
        this.timeManager.removeScheduledBlocks(taskId);
    }
    
    /**
     * Update time windows configuration
     * @param config Time windows configuration
     */
    updateTimeWindows(config: any): void {
        // Wir müssen diese Methode implementieren, da sie in TimeManager nicht existiert
        console.log('updateTimeWindows method called with config:', config);
        // Implementierung je nach verfügbaren TimeManager-Methoden
        // Möglicherweise müssen wir die aktualisierten Fenster manuell setzen
        if (this.timeManager.setTimeWindows && typeof config.windows === 'object') {
            this.timeManager.setTimeWindows(config.windows);
        }
    }
    
    /**
     * Add a time window
     * @param name Name of the time window
     * @param startHour Start hour (0-23)
     * @param endHour End hour (0-23)
     * @param days Days of the week (0-6, 0 is Sunday)
     * @param color Color for the time window
     */
    addTimeWindow(
        name: string,
        startHour: number,
        endHour: number,
        days: number[],
        color: string
    ): void {
        // Da diese Methode in TimeManager nicht existiert, implementieren wir sie hier
        console.log(`Adding time window: ${name}`);
        
        // Erstelle ein Zeitfenster entsprechend der TimeWindow-Schnittstelle
        const timeWindow = {
            id: name,
            name: name,
            color: color,
            priority: 10, // Standard-Priorität
            schedule: days.map(day => ({
                day: day,
                ranges: [{
                    start: `${String(startHour).padStart(2, '0')}:00`,
                    end: `${String(endHour).padStart(2, '0')}:00`
                }]
            }))
        };
        
        // Hole aktuelle Zeitfenster, füge das neue hinzu und setze die aktualisierte Liste
        const currentWindows = this.timeManager.getTimeWindows ? 
            this.timeManager.getTimeWindows() : [];
        
        // Entferne zuerst Fenster mit gleicher ID, falls vorhanden
        const filteredWindows = currentWindows.filter(w => w.id !== name);
        
        // Füge das neue Fenster hinzu
        filteredWindows.push(timeWindow);
        
        // Aktualisiere die Fenster im TimeManager
        if (this.timeManager.setTimeWindows) {
            this.timeManager.setTimeWindows(filteredWindows);
        }
    }
    
    /**
     * Remove a time window
     * @param name Name of the time window
     */
    removeTimeWindow(name: string): void {
        console.log(`Removing time window: ${name}`);
        
        // Da diese Methode in TimeManager nicht existiert, implementieren wir sie hier
        if (this.timeManager.getTimeWindows && this.timeManager.setTimeWindows) {
            const currentWindows = this.timeManager.getTimeWindows();
            const updatedWindows = currentWindows.filter(window => window.id !== name);
            this.timeManager.setTimeWindows(updatedWindows);
        }
    }
    
    /**
     * Reschedule all tasks
     * This is useful when time windows or scheduling rules change
     */
    rescheduleAllTasks(): void {
        if (!this.dataManager) return;
        
        // Da clearAllBlocks nicht in TimeManager existiert, implementieren wir eine Alternative
        // Wir setzen einfach einen leeren Array als scheduledBlocks
        if (this.timeManager.setScheduledBlocks) {
            this.timeManager.setScheduledBlocks([]);
        } else {
            // Falls auch setScheduledBlocks nicht existiert, müssen wir jeden Block manuell entfernen
            const blocks = this.timeManager.getScheduledBlocks();
            for (const block of blocks) {
                this.timeManager.removeScheduledBlocks(block.taskId);
            }
        }
        
        // Get all tasks that need scheduling
        const tasks = this.dataManager.getTasks().filter(task => 
            task.estimatedDuration && 
            task.dueDate &&
            !task.completed
        );
        
        // Schedule each task
        const newBlocks: TimeBlockInfo[] = [];
        for (const task of tasks) {
            const blocks = this.scheduleTask(task);
            newBlocks.push(...blocks);
        }
        
        // Update the data manager
        if (this.dataManager) {
            this.dataManager.setTimeBlocks(newBlocks);
            this.dataManager.notifyUpdates();
        }
    }
    
    /**
     * Manually create a time block for a task
     * @param task The task
     * @param startTime Start time for the block
     * @param endTime End time for the block
     * @returns The created time block
     */
    createTimeBlock(task: Task, startTime: Date, endTime: Date): TimeBlockInfo | null {
        if (!task.id) return null;
        
        // Da createTimeBlock nicht in TimeManager existiert, implementieren wir es selbst
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));
        
        // Erstelle ein neues TimeBlockInfo Objekt
        const block: TimeBlockInfo = {
            id: `${task.id}-block-${Date.now()}`,
            taskId: task.id,
            start: startTime,
            end: endTime,
            duration: durationMinutes,
            timeWindowId: 'manual', // Standard für manuell erstellte Blöcke
            isCompleted: false
        };
        
        // Füge den Block zu den geplanten Blöcken hinzu
        const blocks = this.timeManager.getScheduledBlocks();
        blocks.push(block);
        
        // Aktualisiere die geplanten Blöcke im TimeManager
        if (this.timeManager.setScheduledBlocks) {
            this.timeManager.setScheduledBlocks(blocks);
        }
        
        // Wenn der Datenmanager existiert, füge den Block hinzu und benachrichtige
        if (this.dataManager) {
            this.dataManager.addTimeBlocks([block]);
            this.dataManager.notifyUpdates();
        }
        
        return block;
    }
    
    /**
     * Update a time block
     * @param blockId ID of the block
     * @param startTime New start time
     * @param endTime New end time
     * @returns Whether the operation was successful
     */
    updateTimeBlock(blockId: string, startTime: Date, endTime: Date): boolean {
        // Da updateTimeBlock nicht in TimeManager existiert, implementieren wir es selbst
        const blocks = this.timeManager.getScheduledBlocks();
        const blockIndex = blocks.findIndex(block => block.id === blockId);
        
        if (blockIndex === -1) return false;
        
        // Aktualisiere den Block
        const block = blocks[blockIndex];
        block.start = startTime;
        block.end = endTime;
        block.duration = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));
        
        // Aktualisiere die Blöcke im TimeManager
        if (this.timeManager.setScheduledBlocks) {
            this.timeManager.setScheduledBlocks(blocks);
        }
        
        // Wenn ein Datenmanager existiert, benachrichtige über Updates
        if (this.dataManager) {
            this.dataManager.notifyUpdates();
        }
        
        return true;
    }
    
    /**
     * Delete a time block
     * @param blockId ID of the block
     * @returns Whether the operation was successful
     */
    deleteTimeBlock(blockId: string): boolean {
        // Da deleteTimeBlock nicht in TimeManager existiert, implementieren wir es selbst
        const blocks = this.timeManager.getScheduledBlocks();
        const blockIndex = blocks.findIndex(block => block.id === blockId);
        
        if (blockIndex === -1) return false;
        
        // Entferne den Block
        blocks.splice(blockIndex, 1);
        
        // Aktualisiere die Blöcke im TimeManager
        if (this.timeManager.setScheduledBlocks) {
            this.timeManager.setScheduledBlocks(blocks);
        }
        
        // Wenn ein Datenmanager existiert, benachrichtige über Updates
        if (this.dataManager) {
            this.dataManager.notifyUpdates();
        }
        
        return true;
    }
    
    /**
     * Get available time slots for a specific day
     * @param date The day to check
     * @param durationMinutes Required duration in minutes
     * @returns Array of available time slots as [startTime, endTime] pairs
     */
    getAvailableTimeSlots(date: Date, durationMinutes: number): [Date, Date][] {
        // Da getAvailableTimeSlots nicht in TimeManager existiert, implementieren wir es selbst
        const result: [Date, Date][] = [];
        
        // Setze den Anfang und das Ende des Tages
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        // Hole alle Zeitfenster für diesen Tag
        const timeWindows = this.timeManager.getTimeWindows ? this.timeManager.getTimeWindows() : [];
        
        // Hole alle bereits geplanten Blöcke für diesen Tag
        const existingBlocks = this.timeManager.getBlocksInTimeframe(startDate, endDate);
        
        // Für jeden Zeitfenstertyp
        for (const window of timeWindows) {
            // Finde die Zeitbereiche für diesen Tag
            const dayOfWeek = date.getDay(); // 0 = Sonntag, 1 = Montag, ...
            const daySchedule = window.schedule.find(s => s.day === dayOfWeek);
            
            if (!daySchedule) continue;
            
            // Für jeden Zeitbereich in diesem Fenster
            for (const range of daySchedule.ranges) {
                // Erstelle Datum-Objekte für Start und Ende des Bereichs
                const [startHour, startMinute] = range.start.split(':').map(Number);
                const [endHour, endMinute] = range.end.split(':').map(Number);
                
                const rangeStart = new Date(date);
                rangeStart.setHours(startHour, startMinute, 0, 0);
                
                const rangeEnd = new Date(date);
                rangeEnd.setHours(endHour, endMinute, 0, 0);
                
                // Finde freie Zeiten innerhalb dieses Bereichs
                const freeSlots = this.findFreeSlotsInRange(rangeStart, rangeEnd, existingBlocks, durationMinutes);
                result.push(...freeSlots);
            }
        }
        
        return result;
    }
    
    /**
     * Helper method to find free slots in a time range
     * @param start Start of the range
     * @param end End of the range
     * @param existingBlocks Existing time blocks
     * @param minDuration Minimum duration in minutes
     * @returns Array of free slots as [startTime, endTime] pairs
     */
    private findFreeSlotsInRange(
        start: Date, 
        end: Date, 
        existingBlocks: TimeBlockInfo[],
        minDuration: number
    ): [Date, Date][] {
        const result: [Date, Date][] = [];
        
        // Sortiere Blöcke nach Startzeit
        const sortedBlocks = [...existingBlocks].filter(block => 
            (block.start >= start && block.start < end) ||
            (block.end > start && block.end <= end) ||
            (block.start <= start && block.end >= end)
        ).sort((a, b) => a.start.getTime() - b.start.getTime());
        
        // Wenn keine Blöcke im Bereich, füge den gesamten Bereich hinzu
        if (sortedBlocks.length === 0) {
            const durationMs = end.getTime() - start.getTime();
            const durationMin = durationMs / (60 * 1000);
            
            if (durationMin >= minDuration) {
                result.push([start, end]);
            }
            return result;
        }
        
        // Prüfe Lücke vor dem ersten Block
        if (sortedBlocks[0].start > start) {
            const gapDurationMs = sortedBlocks[0].start.getTime() - start.getTime();
            const gapDurationMin = gapDurationMs / (60 * 1000);
            
            if (gapDurationMin >= minDuration) {
                result.push([start, sortedBlocks[0].start]);
            }
        }
        
        // Prüfe Lücken zwischen Blöcken
        for (let i = 0; i < sortedBlocks.length - 1; i++) {
            const currentEnd = sortedBlocks[i].end;
            const nextStart = sortedBlocks[i + 1].start;
            
            if (nextStart > currentEnd) {
                const gapDurationMs = nextStart.getTime() - currentEnd.getTime();
                const gapDurationMin = gapDurationMs / (60 * 1000);
                
                if (gapDurationMin >= minDuration) {
                    result.push([currentEnd, nextStart]);
                }
            }
        }
        
        // Prüfe Lücke nach dem letzten Block
        const lastBlock = sortedBlocks[sortedBlocks.length - 1];
        if (lastBlock.end < end) {
            const gapDurationMs = end.getTime() - lastBlock.end.getTime();
            const gapDurationMin = gapDurationMs / (60 * 1000);
            
            if (gapDurationMin >= minDuration) {
                result.push([lastBlock.end, end]);
            }
        }
        
        return result;
    }
}