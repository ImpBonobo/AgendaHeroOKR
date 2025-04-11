import { OkrService } from '../../services/okr-service';
import { TimeBlockInfo } from '../../utils/time-manager';

export class CalendarTooltipManager {
    private okrService: OkrService;
    private timeBlocks: TimeBlockInfo[] = [];
    private tooltipEl: HTMLElement | null = null;
    
    constructor(
        okrService: OkrService,
        timeBlocks: TimeBlockInfo[]
    ) {
        this.okrService = okrService;
        this.timeBlocks = timeBlocks;
    }

    /**
     * Show tooltip for a calendar event
     * @param event The calendar event
     * @param e The mouse event
     */
    showEventTooltip(event: any, e: MouseEvent): void {
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
            this.tooltipEl.className = 'agenda-hero-okr-scheduling-tooltip';
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
    hideEventTooltip(): void {
        if (this.tooltipEl) {
            document.body.removeChild(this.tooltipEl);
            this.tooltipEl = null;
        }
    }

    /**
     * Update the time blocks
     * @param timeBlocks The new time blocks
     */
    updateTimeBlocks(timeBlocks: TimeBlockInfo[]): void {
        this.timeBlocks = timeBlocks;
    }
}