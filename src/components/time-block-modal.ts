import { App, Modal, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { TimeBlockInfo } from '../utils/time-manager';
import { TaskModal } from './task-modal';

/**
 * Modal for time block actions
 */
export class TimeBlockModal extends Modal {
    private block: TimeBlockInfo;
    private task: any;
    private okrService: OkrService;
    
    constructor(app: App, block: TimeBlockInfo, task: any, okrService: OkrService) {
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
        
        // editTaskButton.addEventListener callback:
        editTaskButton.addEventListener('click', () => {
            this.close();
            
            // Use our new TaskModal instead of TaskEditModal
            const modal = new TaskModal(
                this.app,
                this.okrService,
                this.task.projectId || '',  // Hinzugefügter Default-Wert
                (updatedTask) => {
                    // Update task in the OKR model
                    this.okrService.updateTask(updatedTask as any);
                    
                    // Notification
                    new Notice('Task updated');
                },
                this.task as any  // Explicit type casting
            );
            
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