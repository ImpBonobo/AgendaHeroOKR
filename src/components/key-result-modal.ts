import { App, Setting, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { KeyResult } from '../models/okr-models';
import { OkrModal } from './base-modal';

/**
 * Modal for creating or editing a key result
 */
export class KeyResultModal extends OkrModal {
    private keyResult: Partial<KeyResult> = {};
    private onSave: (keyResult: Partial<KeyResult>) => void;
    private isNew: boolean;
    private objectiveId: string;
    
    /**
     * Create a new key result modal
     * @param app Obsidian app
     * @param okrService OKR service
     * @param objectiveId ID of the parent objective
     * @param onSave Callback for save
     * @param existingKeyResult Optional existing key result for editing
     */
    constructor(
        app: App, 
        okrService: OkrService,
        objectiveId: string,
        onSave: (keyResult: Partial<KeyResult>) => void,
        existingKeyResult?: KeyResult
    ) {
        super(app, okrService);
        this.onSave = onSave;
        this.objectiveId = objectiveId;
        this.isNew = !existingKeyResult;
        
        if (existingKeyResult) {
            // Copy to avoid modifying the original
            this.keyResult = { ...existingKeyResult };
        } else {
            // Get parent objective for default dates
            const objective = this.okrService.getObjective(objectiveId);
            
            if (objective) {
                this.keyResult = {
                    title: '',
                    description: '',
                    objectiveId: objectiveId,
                    status: 'future',
                    priority: 3,
                    tags: [],
                    startDate: objective.startDate,
                    endDate: objective.endDate,
                    progress: 0
                };
            } else {
                // Fallback if objective not found
                const today = new Date();
                const inThreeMonths = new Date(today);
                inThreeMonths.setMonth(today.getMonth() + 3);
                
                this.keyResult = {
                    title: '',
                    description: '',
                    objectiveId: objectiveId,
                    status: 'future',
                    priority: 3,
                    tags: [],
                    startDate: today,
                    endDate: inThreeMonths,
                    progress: 0
                };
            }
        }
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Set title
        contentEl.createEl('h2', { text: this.isNew ? 'Create New Key Result' : 'Edit Key Result' });
        
        // Parent objective info
        const objective = this.okrService.getObjective(this.objectiveId);
        if (objective) {
            const objectiveInfo = contentEl.createDiv({ cls: 'agenda-hero-parent-info' });
            objectiveInfo.createEl('p', { 
                text: `Parent Objective: ${objective.title}`,
                cls: 'agenda-hero-parent-title'
            });
        }
        
        // Create form
        const form = contentEl.createDiv({ cls: 'agenda-hero-form' });
        
        // Title
        new Setting(form)
            .setName('Title')
            .setDesc('Key Result title')
            .addText(text => {
                text
                    .setPlaceholder('Enter key result title')
                    .setValue(this.keyResult.title || '')
                    .onChange(value => {
                        this.keyResult.title = value;
                    });
            });
        
        // Description
        new Setting(form)
            .setName('Description')
            .setDesc('Key Result description')
            .addTextArea(textarea => {
                textarea
                    .setPlaceholder('Enter key result description')
                    .setValue(this.keyResult.description || '')
                    .onChange(value => {
                        this.keyResult.description = value;
                    });
                
                // Make textarea taller
                textarea.inputEl.rows = 4;
            });
        
        // Status
        this.addStatusDropdown(form, this.keyResult.status || 'future', value => {
            this.keyResult.status = value;
        });
        
        // Priority
        this.addPriorityDropdown(form, this.keyResult.priority || 3, value => {
            this.keyResult.priority = value;
        });
        
        // Dates
        this.addDateFields(
            form,
            this.keyResult.startDate || null,
            this.keyResult.endDate || null,
            value => { this.keyResult.startDate = value; },
            value => { this.keyResult.endDate = value; }
        );
        
        // Metric settings (optional)
        const metricSection = form.createEl('div', { cls: 'agenda-hero-metric-section' });
        metricSection.createEl('h3', { text: 'Metric Information (Optional)' });
        
        // Metric name
        new Setting(metricSection)
            .setName('Metric')
            .setDesc('What is being measured (e.g., "Customer Satisfaction")')
            .addText(text => {
                text
                    .setPlaceholder('Enter metric name')
                    .setValue(this.keyResult.metric || '')
                    .onChange(value => {
                        this.keyResult.metric = value;
                    });
            });
        
        // Start value
        new Setting(metricSection)
            .setName('Start Value')
            .setDesc('Initial value')
            .addText(text => {
                text
                    .setPlaceholder('0')
                    .setValue(this.keyResult.startValue?.toString() || '')
                    .onChange(value => {
                        this.keyResult.startValue = value ? parseFloat(value) : undefined;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.step = 'any';
            });
        
        // Target value
        new Setting(metricSection)
            .setName('Target Value')
            .setDesc('Goal value')
            .addText(text => {
                text
                    .setPlaceholder('100')
                    .setValue(this.keyResult.targetValue?.toString() || '')
                    .onChange(value => {
                        this.keyResult.targetValue = value ? parseFloat(value) : undefined;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.step = 'any';
            });
        
        // Current value
        new Setting(metricSection)
            .setName('Current Value')
            .setDesc('Current progress')
            .addText(text => {
                text
                    .setPlaceholder('0')
                    .setValue(this.keyResult.currentValue?.toString() || '')
                    .onChange(value => {
                        this.keyResult.currentValue = value ? parseFloat(value) : undefined;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.step = 'any';
            });
        
        // Format
        new Setting(metricSection)
            .setName('Format')
            .setDesc('How to display the value (e.g., "percentage", "currency")')
            .addText(text => {
                text
                    .setPlaceholder('percentage')
                    .setValue(this.keyResult.format || '')
                    .onChange(value => {
                        this.keyResult.format = value;
                    });
            });
        
        // Tags
        this.addTagsInput(form, this.keyResult.tags || [], value => {
            this.keyResult.tags = value;
        });
        
        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'agenda-hero-modal-buttons' });
        
        // Save button
        const saveButton = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
        });
        
        saveButton.addEventListener('click', async () => {
            // Validate required fields
            if (!this.keyResult.title) {
                new Notice('Title is required');
                return;
            }
            
            if (!this.keyResult.startDate || !this.keyResult.endDate) {
                new Notice('Start and end dates are required');
                return;
            }
            
            // Close modal
            this.close();
            
            // Call save callback
            this.onSave(this.keyResult);
        });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }
    
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}