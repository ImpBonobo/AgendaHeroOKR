import { App, Setting, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { Task } from '../models/okr-models';
import { OkrModal } from './base-modal';

/**
 * Modal for creating or editing a task
 */
export class TaskModal extends OkrModal {
    private task: Partial<Task> = {};
    private onSave: (task: Partial<Task>, filePath?: string) => void;
    private isNew: boolean;
    private projectId: string | null;
    private selectedDate: Date | undefined;
    
    /**
     * Create a new task modal
    * @param app Obsidian app
    * @param okrService OKR service
    * @param projectId ID of the parent project (or null if created from calendar)
    * @param onSave Callback for save
    * @param existingTask Optional existing task for editing
    * @param selectedDate Optional date selected in calendar
    */
    constructor(
        app: App, 
        okrService: OkrService,
        projectId: string | null,
        onSave: (task: Partial<Task>, filePath?: string) => void,
        existingTask?: Partial<Task>,
        selectedDate?: Date
    ) {
        super(app, okrService);
        this.onSave = onSave;
        this.projectId = projectId || '';
        this.isNew = !existingTask;
        this.selectedDate = selectedDate;
        
        if (existingTask) {
            // Copy to avoid modifying the original
            this.task = { ...existingTask };
        } else {
            // Default due date (one week from now or selected date from calendar)
            const today = new Date();
            const dueDate = selectedDate || new Date(today);
            if (!selectedDate) {
                dueDate.setDate(today.getDate() + 7);
            }
            
            // Default values for new task
            this.task = {
                title: '',
                description: '',
                projectId: projectId || '',
                status: 'next-up',
                priority: 3,
                tags: [],
                dueDate: dueDate,
                completed: false,
                recurring: false,
                autoSchedule: true,
                estimatedDuration: 60 // Default 60 minutes
            };
        }
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Set title
        contentEl.createEl('h2', { text: this.isNew ? 'Create New Task' : 'Edit Task' });
        
        // Parent project info (only if project is specified)
        if (this.projectId) {
            const project = this.okrService.getProject(this.projectId);
            if (project) {
                const projectInfo = contentEl.createDiv({ cls: 'agenda-hero-parent-info' });
                projectInfo.createEl('p', { 
                    text: `Parent Project: ${project.title}`,
                    cls: 'agenda-hero-parent-title'
                });
            }
        }
        
        // Create form
        const form = contentEl.createDiv({ cls: 'agenda-hero-form' });
        
        // Project selection (only for new tasks without assigned project)
        if (this.isNew && !this.projectId) {
            // Project selection
            const projectSetting = new Setting(form)
                .setName('Project')
                .setDesc('Select a project for this task');
            
            // Get all projects
            const projects = this.okrService.getProjects();
            
            // Add dropdown for project selection
            projectSetting.addDropdown(dropdown => {
                dropdown.addOption('', '-- No Project --');
                
                // Add option for daily note
                dropdown.addOption('daily', 'Daily Note');
                
                // Add all projects
                projects.forEach(project => {
                    dropdown.addOption(project.id, project.title);
                });
                
                dropdown.setValue(this.task.projectId || '')
                    .onChange(value => {
                        this.task.projectId = value === 'daily' ? '' : value;
                    });
            });
        }
        
        // Title
        new Setting(form)
            .setName('Title')
            .setDesc('Task title')
            .addText(text => {
                text
                    .setPlaceholder('Enter task title')
                    .setValue(this.task.title || '')
                    .onChange(value => {
                        this.task.title = value;
                    });
            });
        
        // Description
        new Setting(form)
            .setName('Description')
            .setDesc('Task description (optional)')
            .addTextArea(textarea => {
                textarea
                    .setPlaceholder('Enter task description')
                    .setValue(this.task.description || '')
                    .onChange(value => {
                        this.task.description = value;
                    });
                
                // Make textarea taller
                textarea.inputEl.rows = 4;
            });
        
        // Status
        this.addStatusDropdown(form, this.task.status || 'next-up', value => {
            this.task.status = value;
            
            // Update completed status based on status
            this.task.completed = value === 'completed';
        });
        
        // Priority
        this.addPriorityDropdown(form, this.task.priority || 3, value => {
            this.task.priority = value;
        });
        
        // Due date
        new Setting(form)
            .setName('Due Date')
            .setDesc('When the task is due')
            .addText(text => {
                // Format date for input field
                const formatDate = (date: Date | null): string => {
                    if (!date) return '';
                    return date.toISOString().split('T')[0];
                };
                
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(formatDate(this.task.dueDate || null))
                    .onChange(value => {
                        if (value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                this.task.dueDate = date;
                            }
                        } else {
                            this.task.dueDate = null;
                        }
                    });
                
                // Change input type to date
                const inputEl = text.inputEl;
                inputEl.type = 'date';
            });
        
        // Due time (if due date is set)
        if (this.task.dueDate) {
            new Setting(form)
                .setName('Due Time')
                .setDesc('Time of day when the task is due (optional)')
                .addText(text => {
                    // Format time for input field
                    const formatTime = (date: Date | null): string => {
                        if (!date) return '';
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        return `${hours}:${minutes}`;
                    };
                    
                    text
                        .setPlaceholder('HH:MM')
                        .setValue(formatTime(this.task.dueDate || null))
                        .onChange(value => {
                            if (value && this.task.dueDate) {
                                const [hours, minutes] = value.split(':').map(Number);
                                const date = new Date(this.task.dueDate);
                                date.setHours(hours, minutes, 0, 0);
                                this.task.dueDate = date;
                            }
                        });
                    
                    // Change input type to time
                    const inputEl = text.inputEl;
                    inputEl.type = 'time';
                });
        }
        
        // Completed checkbox
        new Setting(form)
            .setName('Completed')
            .setDesc('Mark as completed')
            .addToggle(toggle => {
                toggle
                    .setValue(this.task.completed || false)
                    .onChange(value => {
                        this.task.completed = value;
                        
                        // Update status based on completed state
                        if (value) {
                            this.task.status = 'completed';
                        } else if (this.task.status === 'completed') {
                            this.task.status = 'next-up';
                        }
                    });
            });
        
        // Time planning section
        const planningSection = form.createEl('div', { cls: 'agenda-hero-planning-section' });
        planningSection.createEl('h3', { text: 'Time Planning (Optional)' });
        
        // Estimated duration
        new Setting(planningSection)
            .setName('Estimated Duration')
            .setDesc('How long this task will take (in minutes)')
            .addText(text => {
                text
                    .setPlaceholder('60')
                    .setValue(this.task.estimatedDuration?.toString() || '60')
                    .onChange(value => {
                        this.task.estimatedDuration = value ? parseInt(value) : 60;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.inputEl.step = '1';
            });
        
        // Auto-schedule setting
        new Setting(planningSection)
            .setName('Auto-Schedule')
            .setDesc('Let the system automatically schedule this task')
            .addToggle(toggle => {
                toggle
                    .setValue(this.task.autoSchedule === undefined ? true : !!this.task.autoSchedule)
                    .onChange(value => {
                        this.task.autoSchedule = value;
                    });
            });
        
        // Tags
        this.addTagsInput(form, this.task.tags || [], value => {
            this.task.tags = value;
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
            if (!this.task.title) {
                new Notice('Title is required');
                return;
            }
            
            // Determine where to save the task
            let filePath: string | undefined;
            
            // For 'Daily Note' option or when task was created from calendar
            if (this.task.projectId === 'daily' || (this.task.dueDate && !this.task.projectId)) {
                // Use daily note
                const date = this.task.dueDate || new Date();
                const formattedDate = this.formatDateForFile(date);
                filePath = `Daily/${formattedDate}.md`;
            } else if (this.task.projectId) {
                // Use project
                const project = this.okrService.getProject(this.task.projectId);
                if (project) {
                    filePath = project.sourcePath;
                }
            }
            
            // Close modal
            this.close();
            
            // Call save callback with file path
            this.onSave(this.task, filePath);
            
            // Show success message
            let locationInfo = filePath ? `in ${filePath}` : '';
            if (this.task.projectId) {
                const project = this.okrService.getProject(this.task.projectId);
                if (project) {
                    locationInfo = `in project "${project.title}"`;
                }
            } else if (this.task.dueDate) {
                locationInfo = `in Daily Note for ${this.task.dueDate.toLocaleDateString()}`;
            }
            
            new Notice(`Task "${this.task.title}" created ${locationInfo}`);
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
    
    /**
     * Format date for daily note filename
     * @param date The date to format
     * @returns Formatted date string (YYYY-MM-DD)
     */
    private formatDateForFile(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}