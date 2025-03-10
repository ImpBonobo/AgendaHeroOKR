import { App, Setting, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { Objective } from '../models/okr-models';
import { OkrModal } from './base-modal';

/**
 * Modal for creating or editing an objective
 */
export class ObjectiveModal extends OkrModal {
    private objective: Partial<Objective> = {};
    private onSave: (objective: Partial<Objective>) => void;
    private isNew: boolean;
    
    /**
     * Create a new objective modal
     * @param app Obsidian app
     * @param okrService OKR service
     * @param onSave Callback for save
     * @param existingObjective Optional existing objective for editing
     */
    constructor(
        app: App, 
        okrService: OkrService, 
        onSave: (objective: Partial<Objective>) => void,
        existingObjective?: Objective
    ) {
        super(app, okrService);
        this.onSave = onSave;
        this.isNew = !existingObjective;
        
        if (existingObjective) {
            // Copy to avoid modifying the original
            this.objective = { ...existingObjective };
        } else {
            // Default values for new objective
            const today = new Date();
            const endOfQuarter = new Date(today);
            
            // Calculate end of quarter
            const month = today.getMonth();
            const quarter = Math.floor(month / 3);
            endOfQuarter.setMonth((quarter + 1) * 3, 0); // Last day of the quarter
            
            this.objective = {
                title: '',
                description: '',
                status: 'future',
                priority: 3,
                tags: [],
                startDate: today,
                endDate: endOfQuarter,
                progress: 0
            };
        }
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Set title
        contentEl.createEl('h2', { text: this.isNew ? 'Create New Objective' : 'Edit Objective' });
        
        // Create form
        const form = contentEl.createDiv({ cls: 'agenda-hero-form' });
        
        // Title
        new Setting(form)
            .setName('Title')
            .setDesc('Objective title')
            .addText(text => {
                text
                    .setPlaceholder('Enter objective title')
                    .setValue(this.objective.title || '')
                    .onChange(value => {
                        this.objective.title = value;
                    });
            });
        
        // Description
        new Setting(form)
            .setName('Description')
            .setDesc('Objective description')
            .addTextArea(textarea => {
                textarea
                    .setPlaceholder('Enter objective description')
                    .setValue(this.objective.description || '')
                    .onChange(value => {
                        this.objective.description = value;
                    });
                
                // Make textarea taller
                textarea.inputEl.rows = 4;
            });
        
        // Status
        this.addStatusDropdown(form, this.objective.status || 'future', value => {
            this.objective.status = value;
        });
        
        // Priority
        this.addPriorityDropdown(form, this.objective.priority || 3, value => {
            this.objective.priority = value;
        });
        
        // Dates
        this.addDateFields(
            form,
            this.objective.startDate || null,
            this.objective.endDate || null,
            value => { this.objective.startDate = value; },
            value => { this.objective.endDate = value; }
        );
        
        // Quarter (optional)
        new Setting(form)
            .setName('Quarter')
            .setDesc('Optional quarter reference (e.g., "Q1 2023")')
            .addText(text => {
                text
                    .setPlaceholder('Q1 2023')
                    .setValue(this.objective.quarter || '')
                    .onChange(value => {
                        this.objective.quarter = value;
                    });
            });
        
        // Tags
        this.addTagsInput(form, this.objective.tags || [], value => {
            this.objective.tags = value;
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
            if (!this.objective.title) {
                new Notice('Title is required');
                return;
            }
            
            if (!this.objective.startDate || !this.objective.endDate) {
                new Notice('Start and end dates are required');
                return;
            }
            
            // Close modal
            this.close();
            
            // Call save callback
            this.onSave(this.objective);
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