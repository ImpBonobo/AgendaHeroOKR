import { Modal, App } from 'obsidian';
import AgendaHeroOKRPlugin, { Task } from '../../main';

/**
 * Modal for editing a task in the task list view
 */
export class TaskListEditModal extends Modal {
    task: Task;
    onSubmit: (task: Task) => void;
    plugin: AgendaHeroOKRPlugin;
    
    /**
     * Constructor
     * @param app Obsidian app instance
     * @param task Task to edit
     * @param onSubmit Callback for submission
     */
    constructor(app: App, task: Task, onSubmit: (task: Task) => void) {
        super(app);
        this.task = task;
        this.onSubmit = onSubmit;
        
        // Get plugin instance from app
        // @ts-ignore - We know the plugin exists
        this.plugin = app.plugins.plugins['agenda-hero-okr'];
    }
    
    /**
     * Handle modal open event
     */
    onOpen() {
        const {contentEl} = this;
        
        // Heading
        contentEl.createEl('h2', {text: 'Edit Task'});
        
        // Create form
        const form = contentEl.createEl('form', { cls: 'agenda-hero-okr-edit-form' });
        
        // Description
        const descriptionGroup = form.createDiv({ cls: 'form-group' });
        descriptionGroup.createEl('label', { text: 'Description:' });
        const descriptionInput = descriptionGroup.createEl('input', {
            type: 'text',
            value: this.task.content
        });
        descriptionInput.style.width = '100%';
        
        // Date and time
        const dateTimeGroup = form.createDiv({ cls: 'form-group' });
        dateTimeGroup.createEl('label', { text: 'Due date:' });
        
        const dateTimeContainer = dateTimeGroup.createDiv({ cls: 'date-time-container' });
        
        // Date
        const dateInput = dateTimeContainer.createEl('input', {
            type: 'date',
            value: this.task.dueDate ? this.task.dueDate.toISOString().split('T')[0] : ''
        });
        
        // Time
        const timeInput = dateTimeContainer.createEl('input', {
            type: 'time',
            value: this.task.dueDate ? 
                `${String(this.task.dueDate.getHours()).padStart(2, '0')}:${String(this.task.dueDate.getMinutes()).padStart(2, '0')}` : 
                ''
        });
        
        // Priority
        const priorityGroup = form.createDiv({ cls: 'form-group' });
        priorityGroup.createEl('label', { text: 'Priority:' });
        const prioritySelect = priorityGroup.createEl('select');
        
        const priorities = [
            { value: 1, text: 'High' },
            { value: 2, text: 'Medium' },
            { value: 3, text: 'Normal' },
            { value: 4, text: 'Low' }
        ];
        
        priorities.forEach(priority => {
            const option = prioritySelect.createEl('option', {
                text: priority.text,
                value: priority.value.toString()
            });
            
            if (priority.value === this.task.priority) {
                option.selected = true;
            }
        });
        
        // Status
        const statusGroup = form.createDiv({ cls: 'form-group' });
        const statusContainer = statusGroup.createDiv({ cls: 'checkbox-container' });
        const statusCheckbox = statusContainer.createEl('input', {
            type: 'checkbox',
            attr: { id: 'task-status' }
        });
        statusCheckbox.checked = this.task.completed;
        
        statusContainer.createEl('label', {
            text: 'Completed',
            attr: { for: 'task-status' }
        });
        
        // Recurring
        const recurringGroup = form.createDiv({ cls: 'form-group' });
        const recurringContainer = recurringGroup.createDiv({ cls: 'checkbox-container' });
        const recurringCheckbox = recurringContainer.createEl('input', {
            type: 'checkbox',
            attr: { id: 'task-recurring' }
        });
        recurringCheckbox.checked = this.task.recurring;
        
        recurringContainer.createEl('label', {
            text: 'Recurring',
            attr: { for: 'task-recurring' }
        });
        
        // Recurrence rule (only show if recurring)
        const recurrenceRuleGroup = form.createDiv({ cls: 'form-group recurrence-rule-group' });
        recurrenceRuleGroup.style.display = this.task.recurring ? 'block' : 'none';
        
        recurrenceRuleGroup.createEl('label', { text: 'Recurrence rule:' });
        const recurrenceRuleInput = recurrenceRuleGroup.createEl('input', {
            type: 'text',
            value: this.task.recurrenceRule || 'every week',
            placeholder: 'e.g., every week, every month, every 2 days'
        });
        
        // Show/hide recurrence rule when checkbox changes
        recurringCheckbox.addEventListener('change', () => {
            recurrenceRuleGroup.style.display = recurringCheckbox.checked ? 'block' : 'none';
        });
        
        // Tags
        const tagsGroup = form.createDiv({ cls: 'form-group' });
        tagsGroup.createEl('label', { text: 'Tags:' });
        
        // Show available tags
        const tagsContainer = tagsGroup.createDiv({ cls: 'tags-container' });
        
        // Create checkbox for each configured tag
        this.plugin.settings.taskTags.forEach(tag => {
            const tagContainer = tagsContainer.createDiv({ cls: 'tag-checkbox-container' });
            
            const tagCheckbox = tagContainer.createEl('input', {
                type: 'checkbox',
                attr: { id: `tag-${tag.replace(/[^a-zA-Z0-9]/g, '-')}` }
            });
            
            // Enable checkbox if task contains this tag
            tagCheckbox.checked = this.task.content.includes(tag);
            
            tagContainer.createEl('label', {
                text: tag,
                attr: { for: `tag-${tag.replace(/[^a-zA-Z0-9]/g, '-')}` }
            });
        });
        
        // Preview
        const previewGroup = form.createDiv({ cls: 'form-group' });
        previewGroup.createEl('label', { text: 'Preview:' });
        const previewContainer = previewGroup.createDiv({ cls: 'preview-container' });
        
        // Function to update preview
        const updatePreview = () => {
            // Clear preview
            previewContainer.empty();
            
            // Create markdown preview
            let markdown = `- [${statusCheckbox.checked ? 'x' : ' '}] ${descriptionInput.value}`;
            
            // Add date
            if (dateInput.value) {
                markdown += ` @due(${dateInput.value}${timeInput.value ? ' ' + timeInput.value : ''})`;
            }
            
            // Add priority
            const priority = parseInt(prioritySelect.value);
            if (priority < 4) {
                markdown += ` !${priority}`;
            }
            
            // Add recurring
            if (recurringCheckbox.checked) {
                markdown += ` 🔁 ${recurrenceRuleInput.value}`;
            }
            
            // Add tags
            this.plugin.settings.taskTags.forEach(tag => {
                const tagCheckbox = tagsContainer.querySelector(`#tag-${tag.replace(/[^a-zA-Z0-9]/g, '-')}`) as HTMLInputElement;
                if (tagCheckbox && tagCheckbox.checked) {
                    markdown += ` ${tag}`;
                }
            });
            
            // Show preview
            previewContainer.createEl('code', { text: markdown });
        };
        
        // Add event listeners for all inputs
        [descriptionInput, dateInput, timeInput, prioritySelect, statusCheckbox, recurringCheckbox, recurrenceRuleInput].forEach(input => {
            input.addEventListener('input', updatePreview);
            input.addEventListener('change', updatePreview);
        });
        
        // For all tag checkboxes
        tagsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', updatePreview);
        });
        
        // Initial preview
        updatePreview();
        
        // Buttons
        const buttonContainer = form.createDiv({ cls: 'button-container' });
        
        // Save button
        const submitButton = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'submit-button',
            type: 'button' // Prevent form submission
        });
        
        submitButton.addEventListener('click', () => {
            // Create updated task object
            const updatedTask = {...this.task};
            
            // Update description (without tags)
            updatedTask.content = descriptionInput.value;
            
            // Update date and time
            if (dateInput.value) {
                const date = new Date(dateInput.value);
                
                // Add time if present
                if (timeInput.value) {
                    const [hours, minutes] = timeInput.value.split(':').map(Number);
                    date.setHours(hours, minutes, 0, 0);
                } else {
                    // Use default time
                    date.setHours(0, 0, 0, 0);
                }
                
                updatedTask.dueDate = date;
            } else {
                updatedTask.dueDate = null;
            }
            
            // Update priority
            updatedTask.priority = parseInt(prioritySelect.value);
            
            // Update status
            updatedTask.completed = statusCheckbox.checked;
            
            // Update recurring
            updatedTask.recurring = recurringCheckbox.checked;
            updatedTask.recurrenceRule = recurringCheckbox.checked ? recurrenceRuleInput.value : undefined;
            
            // Update tags
            // Remove tags from content and then add selected ones
            let content = updatedTask.content;
            
            // Remove all configured tags from content
            this.plugin.settings.taskTags.forEach(tag => {
                content = content.replace(tag, '');
            });
            
            // Clean up content (remove double spaces)
            content = content.replace(/\s+/g, ' ').trim();
            
            // Add selected tags
            this.plugin.settings.taskTags.forEach(tag => {
                const tagCheckbox = tagsContainer.querySelector(`#tag-${tag.replace(/[^a-zA-Z0-9]/g, '-')}`) as HTMLInputElement;
                if (tagCheckbox && tagCheckbox.checked) {
                    content += ` ${tag}`;
                }
            });
            
            // Updated content
            updatedTask.content = content;
            
            // Call callback with updated task
            this.onSubmit(updatedTask);
            
            // Close modal
            this.close();
        });
        
        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'cancel-button',
            type: 'button'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }
    
    /**
     * Handle modal close event
     */
    onClose() {
        // Cleanup
        const {contentEl} = this;
        contentEl.empty();
    }
}