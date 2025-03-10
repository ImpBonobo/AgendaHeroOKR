import { App, Setting, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { Project } from '../models/okr-models';
import { OkrModal } from './base-modal';

/**
 * Modal for creating or editing a project
 */
export class ProjectModal extends OkrModal {
    private project: Partial<Project> = {};
    private onSave: (project: Partial<Project>) => void;
    private isNew: boolean;
    private keyResultId: string;
    
    /**
     * Create a new project modal
     * @param app Obsidian app
     * @param okrService OKR service
     * @param keyResultId ID of the parent key result
     * @param onSave Callback for save
     * @param existingProject Optional existing project for editing
     */
    constructor(
        app: App, 
        okrService: OkrService,
        keyResultId: string,
        onSave: (project: Partial<Project>) => void,
        existingProject?: Project
    ) {
        super(app, okrService);
        this.onSave = onSave;
        this.keyResultId = keyResultId;
        this.isNew = !existingProject;
        
        if (existingProject) {
            // Copy to avoid modifying the original
            this.project = { ...existingProject };
        } else {
            // Get parent key result for default dates
            const keyResult = this.okrService.getKeyResult(keyResultId);
            
            if (keyResult) {
                this.project = {
                    title: '',
                    description: '',
                    keyResultId: keyResultId,
                    status: 'future',
                    priority: 3,
                    tags: [],
                    startDate: keyResult.startDate,
                    endDate: keyResult.endDate,
                    progress: 0
                };
            } else {
                // Fallback if key result not found
                const today = new Date();
                const inTwoMonths = new Date(today);
                inTwoMonths.setMonth(today.getMonth() + 2);
                
                this.project = {
                    title: '',
                    description: '',
                    keyResultId: keyResultId,
                    status: 'future',
                    priority: 3,
                    tags: [],
                    startDate: today,
                    endDate: inTwoMonths,
                    progress: 0
                };
            }
        }
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Set title
        contentEl.createEl('h2', { text: this.isNew ? 'Create New Project' : 'Edit Project' });
        
        // Parent key result info
        const keyResult = this.okrService.getKeyResult(this.keyResultId);
        if (keyResult) {
            const keyResultInfo = contentEl.createDiv({ cls: 'agenda-hero-parent-info' });
            keyResultInfo.createEl('p', { 
                text: `Parent Key Result: ${keyResult.title}`,
                cls: 'agenda-hero-parent-title'
            });
        }
        
        // Create form
        const form = contentEl.createDiv({ cls: 'agenda-hero-form' });
        
        // Title
        new Setting(form)
            .setName('Title')
            .setDesc('Project title')
            .addText(text => {
                text
                    .setPlaceholder('Enter project title')
                    .setValue(this.project.title || '')
                    .onChange(value => {
                        this.project.title = value;
                    });
            });
        
        // Description
        new Setting(form)
            .setName('Description')
            .setDesc('Project description')
            .addTextArea(textarea => {
                textarea
                    .setPlaceholder('Enter project description')
                    .setValue(this.project.description || '')
                    .onChange(value => {
                        this.project.description = value;
                    });
                
                // Make textarea taller
                textarea.inputEl.rows = 4;
            });
        
        // Status
        this.addStatusDropdown(form, this.project.status || 'future', value => {
            this.project.status = value;
        });
        
        // Priority
        this.addPriorityDropdown(form, this.project.priority || 3, value => {
            this.project.priority = value;
        });
        
        // Dates
        this.addDateFields(
            form,
            this.project.startDate || null,
            this.project.endDate || null,
            value => { this.project.startDate = value; },
            value => { this.project.endDate = value; }
        );
        
        // Sprints (if any)
        const sprints = this.okrService.getSprints();
        if (sprints.length > 0) {
            // Create a sprint selector
            const sprintSection = form.createEl('div', { cls: 'agenda-hero-sprint-section' });
            sprintSection.createEl('h3', { text: 'Assign to Sprint (Optional)' });
            
            const currentSprintIds = this.project.sprintIds || [];
            
            sprints.forEach(sprint => {
                const isActive = sprint.status === 'active';
                const dateRange = `${sprint.startDate.toLocaleDateString()} - ${sprint.endDate.toLocaleDateString()}`;
                
                new Setting(sprintSection)
                    .setName(sprint.title + (isActive ? ' (Active)' : ''))
                    .setDesc(dateRange)
                    .addToggle(toggle => {
                        toggle
                            .setValue(currentSprintIds.includes(sprint.id))
                            .onChange(value => {
                                const sprintIds = this.project.sprintIds || [];
                                
                                if (value) {
                                    // Add sprint ID if not already in the array
                                    if (!sprintIds.includes(sprint.id)) {
                                        this.project.sprintIds = [...sprintIds, sprint.id];
                                    }
                                } else {
                                    // Remove sprint ID
                                    this.project.sprintIds = sprintIds.filter(id => id !== sprint.id);
                                }
                            });
                    });
            });
        }
        
        // Tags
        this.addTagsInput(form, this.project.tags || [], value => {
            this.project.tags = value;
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
            if (!this.project.title) {
                new Notice('Title is required');
                return;
            }
            
            if (!this.project.startDate || !this.project.endDate) {
                new Notice('Start and end dates are required');
                return;
            }
            
            // Close modal
            this.close();
            
            // Call save callback
            this.onSave(this.project);
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