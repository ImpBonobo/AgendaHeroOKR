import { App, Modal, Setting, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { 
    Objective, 
    KeyResult, 
    Project, 
    Task, 
    OkrStatus 
} from '../models/okr-models';

/**
 * Base modal class for OKR elements
 */
abstract class OkrModal extends Modal {
    protected okrService: OkrService;
    
    constructor(app: App, okrService: OkrService) {
        super(app);
        this.okrService = okrService;
    }
    
    /**
     * Add a status dropdown to a form
     * @param container Container to add the dropdown to
     * @param currentStatus Current status value
     * @param onChange Callback for status change
     */
    protected addStatusDropdown(
        container: HTMLElement, 
        currentStatus: OkrStatus, 
        onChange: (value: OkrStatus) => void
    ) {
        new Setting(container)
            .setName('Status')
            .setDesc('Current status of this item')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('future', 'Future')
                    .addOption('next-up', 'Next Up')
                    .addOption('in-progress', 'In Progress')
                    .addOption('waiting-on', 'Waiting On')
                    .addOption('validating', 'Validating')
                    .addOption('completed', 'Completed')
                    .addOption('canceled', 'Canceled')
                    .setValue(currentStatus)
                    .onChange(value => onChange(value as OkrStatus));
            });
    }
    
    /**
     * Add priority dropdown to a form
     * @param container Container to add the dropdown to
     * @param currentPriority Current priority value
     * @param onChange Callback for priority change
     */
    protected addPriorityDropdown(
        container: HTMLElement, 
        currentPriority: number, 
        onChange: (value: number) => void
    ) {
        new Setting(container)
            .setName('Priority')
            .setDesc('Priority level (1 is highest)')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('1', 'High (1)')
                    .addOption('2', 'Medium (2)')
                    .addOption('3', 'Normal (3)')
                    .addOption('4', 'Low (4)')
                    .setValue(currentPriority.toString())
                    .onChange(value => onChange(parseInt(value)));
            });
    }
    
    /**
     * Add date fields to a form
     * @param container Container to add the fields to
     * @param startDate Current start date
     * @param endDate Current end date
     * @param onStartChange Callback for start date change
     * @param onEndChange Callback for end date change
     */
    protected addDateFields(
        container: HTMLElement, 
        startDate: Date | null, 
        endDate: Date | null,
        onStartChange: (value: Date) => void,
        onEndChange: (value: Date) => void
    ) {
        // Format dates for input fields
        const formatDate = (date: Date | null): string => {
            if (!date) return '';
            return date.toISOString().split('T')[0];
        };
        
        // Start date
        new Setting(container)
            .setName('Start Date')
            .setDesc('When work begins')
            .addText(text => {
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(formatDate(startDate))
                    .onChange(value => {
                        if (value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                onStartChange(date);
                            }
                        }
                    });
                
                // Change input type to date
                const inputEl = text.inputEl;
                inputEl.type = 'date';
            });
        
        // End date
        new Setting(container)
            .setName('End Date')
            .setDesc('Deadline')
            .addText(text => {
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(formatDate(endDate))
                    .onChange(value => {
                        if (value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                onEndChange(date);
                            }
                        }
                    });
                
                // Change input type to date
                const inputEl = text.inputEl;
                inputEl.type = 'date';
            });
    }
    
    /**
     * Add tags input to a form
     * @param container Container to add the input to
     * @param currentTags Current tags
     * @param onChange Callback for tags change
     */
    protected addTagsInput(
        container: HTMLElement, 
        currentTags: string[], 
        onChange: (value: string[]) => void
    ) {
        new Setting(container)
            .setName('Tags')
            .setDesc('Tags separated by commas')
            .addText(text => {
                text
                    .setPlaceholder('tag1, tag2, tag3')
                    .setValue(currentTags.join(', '))
                    .onChange(value => {
                        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        onChange(tags);
                    });
            });
    }
}

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

/**
 * Modal for creating or editing a task
 */
export class TaskModal extends OkrModal {
    private task: Partial<Task> = {};
    private onSave: (task: Partial<Task>) => void;
    private isNew: boolean;
    private projectId: string;
    
    /**
     * Create a new task modal
     * @param app Obsidian app
     * @param okrService OKR service
     * @param projectId ID of the parent project
     * @param onSave Callback for save
     * @param existingTask Optional existing task for editing
     */
    constructor(
        app: App, 
        okrService: OkrService,
        projectId: string,
        onSave: (task: Partial<Task>) => void,
        existingTask?: Task
    ) {
        super(app, okrService);
        this.onSave = onSave;
        this.projectId = projectId;
        this.isNew = !existingTask;
        
        if (existingTask) {
            // Copy to avoid modifying the original
            this.task = { ...existingTask };
        } else {
            // Get parent project for default dates
            const project = this.okrService.getProject(projectId);
            
            // Default due date (one week from now)
            const today = new Date();
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            
            this.task = {
                title: '',
                description: '',
                projectId: projectId,
                status: 'next-up',
                priority: 3,
                tags: [],
                dueDate: project ? project.endDate : nextWeek,
                completed: false,
                recurring: false
            };
        }
    }
    
    onOpen() {
        const { contentEl } = this;
        
        // Set title
        contentEl.createEl('h2', { text: this.isNew ? 'Create New Task' : 'Edit Task' });
        
        // Parent project info
        const project = this.okrService.getProject(this.projectId);
        if (project) {
            const projectInfo = contentEl.createDiv({ cls: 'agenda-hero-parent-info' });
            projectInfo.createEl('p', { 
                text: `Parent Project: ${project.title}`,
                cls: 'agenda-hero-parent-title'
            });
        }
        
        // Create form
        const form = contentEl.createDiv({ cls: 'agenda-hero-form' });
        
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
        
        // Recurring settings
        const recurringSection = form.createEl('div', { cls: 'agenda-hero-recurring-section' });
        
        // Recurring checkbox
        new Setting(recurringSection)
            .setName('Recurring')
            .setDesc('This task repeats on a schedule')
            .addToggle(toggle => {
                toggle
                    .setValue(this.task.recurring || false)
                    .onChange(value => {
                        this.task.recurring = value;
                        
                        // Show/hide recurrence rule field
                        recurrenceRuleSetting.settingEl.style.display = value ? 'flex' : 'none';
                    });
            });
        
        // Recurrence rule
        const recurrenceRuleSetting = new Setting(recurringSection)
            .setName('Recurrence Rule')
            .setDesc('How often the task repeats (e.g., "every week", "every month")')
            .addText(text => {
                text
                    .setPlaceholder('every week')
                    .setValue(this.task.recurrenceRule || '')
                    .onChange(value => {
                        this.task.recurrenceRule = value;
                    });
            });
        
        // Hide recurrence rule if not recurring
        recurrenceRuleSetting.settingEl.style.display = this.task.recurring ? 'flex' : 'none';
        
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
                    .setValue(this.task.estimatedDuration?.toString() || '')
                    .onChange(value => {
                        this.task.estimatedDuration = value ? parseInt(value) : undefined;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.inputEl.step = '1';
            });
        
        // Split up block size
        new Setting(planningSection)
            .setName('Split Up Block Size')
            .setDesc('Minimum time block size when scheduling (in minutes)')
            .addText(text => {
                text
                    .setPlaceholder('30')
                    .setValue(this.task.splitUpBlock?.toString() || '')
                    .onChange(value => {
                        this.task.splitUpBlock = value ? parseInt(value) : undefined;
                    });
                
                // Set input type to number
                text.inputEl.type = 'number';
                text.inputEl.min = '1';
                text.inputEl.step = '1';
            });
        
        // Time defense
        new Setting(planningSection)
            .setName('Time Defense')
            .setDesc('How to handle time conflicts with other tasks')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('', 'Normal (default)')
                    .addOption('always-busy', 'Always Busy (blocks other tasks)')
                    .addOption('always-free', 'Always Free (can be rescheduled)')
                    .setValue(this.task.timeDefense || '')
                    .onChange(value => {
                        this.task.timeDefense = value ? (value as 'always-busy' | 'always-free') : undefined;
                    });
            });
        
        // Allowed time windows
        const timeWindows = this.okrService.getTimeManager().getTimeWindows();
        if (timeWindows.length > 0) {
            const windowsContainer = planningSection.createEl('div', { cls: 'agenda-hero-windows-container' });
            
            new Setting(windowsContainer)
                .setName('Allowed Time Windows')
                .setDesc('When this task can be scheduled (leave empty for any time)');
            
            const allowedWindows = this.task.allowedTimeWindows || [];
            
            timeWindows.forEach(window => {
                new Setting(windowsContainer)
                    .setName(window.name)
                    .setDesc(`Priority: ${window.priority}`)
                    .addToggle(toggle => {
                        toggle
                            .setValue(allowedWindows.includes(window.id))
                            .onChange(value => {
                                const windows = this.task.allowedTimeWindows || [];
                                
                                if (value) {
                                    // Add window ID if not already in the array
                                    if (!windows.includes(window.id)) {
                                        this.task.allowedTimeWindows = [...windows, window.id];
                                    }
                                } else {
                                    // Remove window ID
                                    this.task.allowedTimeWindows = windows.filter(id => id !== window.id);
                                }
                            });
                    });
            });
        }
        
        // Auto-schedule setting
        new Setting(planningSection)
            .setName('Auto-Schedule')
            .setDesc('Let the system automatically schedule this task')
            .addToggle(toggle => {
                toggle
                    .setValue(this.task.autoSchedule === undefined ? true : this.task.autoSchedule)
                    .onChange(value => {
                        this.task.autoSchedule = value;
                    });
            });
        
        // Conflict behavior
        new Setting(planningSection)
            .setName('Conflict Behavior')
            .setDesc('What to do when time conflicts occur')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('reschedule', 'Reschedule (move to available time)')
                    .addOption('keep', 'Keep (maintain original time)')
                    .addOption('prompt', 'Prompt (ask what to do)')
                    .setValue(this.task.conflictBehavior || 'reschedule')
                    .onChange(value => {
                        this.task.conflictBehavior = value as 'reschedule' | 'keep' | 'prompt';
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
            
            // Validate recurring settings
            if (this.task.recurring && !this.task.recurrenceRule) {
                new Notice('Recurrence rule is required for recurring tasks');
                return;
            }
            
            // Close modal
            this.close();
            
            // Call save callback
            this.onSave(this.task);
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