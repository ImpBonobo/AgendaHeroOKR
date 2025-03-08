import { WorkspaceLeaf, MarkdownView, Modal, App, Notice } from 'obsidian';
import AgendaHeroPlugin, { Task } from '../../main';
import * as dragulaModule from 'dragula';
// @ts-ignore
const dragula = dragulaModule.default || dragulaModule;

// Interface for task preview
interface TaskPreviewOptions {
    showDetails: boolean;
    showActions: boolean;
}

export class TaskListView extends MarkdownView {
    plugin: AgendaHeroPlugin;
    container: HTMLElement;
    filterContainer: HTMLElement;
    taskListContainer: HTMLElement;
    headerContainer: HTMLElement;
    projectsCache: Set<string> = new Set();
    drake: any; // Dragula instance

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'agenda-hero-tasklist';
    }

    getDisplayText(): string {
        return 'AgendaHero Task List';
    }

    async onOpen() {
        // Create container for the task list
        this.container = this.contentEl.createDiv({ cls: 'agenda-hero-tasklist-container' });
        
        // Create header container
        this.headerContainer = this.container.createDiv({ cls: 'agenda-hero-tasklist-header' });
        this.headerContainer.createEl('h3', { text: 'Tasks' });
        
        // Buttons for different views
        const viewButtons = this.headerContainer.createDiv({ cls: 'agenda-hero-view-buttons' });
        
        const allButton = viewButtons.createEl('button', { 
            text: 'All',
            cls: 'agenda-hero-view-button active'
        });
        allButton.addEventListener('click', () => {
            this.setActiveButton(allButton);
            this.renderTasks();
        });
        
        const todayButton = viewButtons.createEl('button', { 
            text: 'Today',
            cls: 'agenda-hero-view-button'
        });
        todayButton.addEventListener('click', () => {
            this.setActiveButton(todayButton);
            this.renderTasks('today');
        });
        
        const upcomingButton = viewButtons.createEl('button', { 
            text: 'Upcoming',
            cls: 'agenda-hero-view-button'
        });
        upcomingButton.addEventListener('click', () => {
            this.setActiveButton(upcomingButton);
            this.renderTasks('upcoming');
        });
        
        // Create filter container
        this.filterContainer = this.container.createDiv({ cls: 'agenda-hero-filters' });
        this.createFilterUI();
        
        // Create container for task list
        this.taskListContainer = this.container.createDiv({ cls: 'agenda-hero-tasks' });
        
        // Render tasks
        this.renderTasks();
        
        // Initialize drag & drop
        this.initDragAndDrop();
        
        // Event listener for task updates
        this.registerEvent(
            // @ts-ignore - Obsidian API allows custom events
            this.app.workspace.on('agenda-hero:tasks-updated', () => {
                this.renderTasks();
                this.updateProjectsCache();
            })
        );
    }
    
    // Helper method to set active button
    setActiveButton(activeButton: HTMLElement) {
        this.headerContainer.querySelectorAll('.agenda-hero-view-button').forEach(button => {
            button.removeClass('active');
        });
        activeButton.addClass('active');
    }
    
    // Update projects cache
    updateProjectsCache() {
        this.projectsCache.clear();
        this.plugin.tasks.forEach(task => {
            const project = this.getProjectFromPath(task.sourcePath);
            if (project) {
                this.projectsCache.add(project);
            }
        });
    }

    createFilterUI() {
        // Heading
        this.filterContainer.createEl('h3', { text: 'Filters' });
        
        // Status filter
        const statusFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-filter-group' });
        statusFilter.createEl('label', { text: 'Status:' });
        
        const statusSelect = statusFilter.createEl('select');
        statusSelect.createEl('option', { text: 'All', value: 'all' });
        statusSelect.createEl('option', { text: 'Open', value: 'open' });
        statusSelect.createEl('option', { text: 'Completed', value: 'completed' });
        
        statusSelect.addEventListener('change', () => {
            this.renderTasks();
        });
        
        // Priority filter
        const priorityFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-filter-group' });
        priorityFilter.createEl('label', { text: 'Priority:' });
        
        const prioritySelect = priorityFilter.createEl('select');
        prioritySelect.createEl('option', { text: 'All', value: 'all' });
        prioritySelect.createEl('option', { text: 'High (1)', value: '1' });
        prioritySelect.createEl('option', { text: 'Medium (2)', value: '2' });
        prioritySelect.createEl('option', { text: 'Normal (3)', value: '3' });
        prioritySelect.createEl('option', { text: 'Low (4)', value: '4' });
        
        prioritySelect.addEventListener('change', () => {
            this.renderTasks();
        });
        
        // Source filter (files/folders)
        const sourceFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-filter-group' });
        sourceFilter.createEl('label', { text: 'Source:' });
        
        const sourceSelect = sourceFilter.createEl('select');
        sourceSelect.createEl('option', { text: 'All', value: 'all' });
        
        // Here we would dynamically add all available sources
        // based on existing tasks
        
        sourceSelect.addEventListener('change', () => {
            this.renderTasks();
        });
        
        // Tag filter
        const tagFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-filter-group' });
        tagFilter.createEl('label', { text: 'Tag:' });
        
        const tagSelect = tagFilter.createEl('select');
        tagSelect.createEl('option', { text: 'All', value: 'all' });
        
        // Add configured tags as options
        this.plugin.settings.taskTags.forEach(tag => {
            tagSelect.createEl('option', { text: tag, value: tag });
        });
        
        tagSelect.addEventListener('change', () => {
            this.renderTasks();
        });
        
        // Search field
        const searchFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-filter-group' });
        searchFilter.createEl('label', { text: 'Search:' });
        
        const searchInput = searchFilter.createEl('input', { type: 'text' });
        
        searchInput.addEventListener('input', () => {
            this.renderTasks();
        });
    }

    getFilteredTasks() {
        // Get status filter
        const statusSelect = this.filterContainer.querySelector('select:nth-child(2)') as HTMLSelectElement;
        const statusFilter = statusSelect ? statusSelect.value : 'all';
        
        // Get priority filter
        const prioritySelect = this.filterContainer.querySelector('select:nth-child(4)') as HTMLSelectElement;
        const priorityFilter = prioritySelect ? prioritySelect.value : 'all';
        
        // Get source filter
        const sourceSelect = this.filterContainer.querySelector('select:nth-child(6)') as HTMLSelectElement;
        const sourceFilter = sourceSelect ? sourceSelect.value : 'all';
        
        // Get tag filter
        const tagSelect = this.filterContainer.querySelector('.agenda-hero-filter-group:nth-child(4) select') as HTMLSelectElement;
        const tagFilter = tagSelect ? tagSelect.value : 'all';
        
        // Get search filter
        const searchInput = this.filterContainer.querySelector('input') as HTMLInputElement;
        const searchFilter = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Filter tasks
        return this.plugin.tasks.filter(task => {
            // Status filter
            if (statusFilter === 'open' && task.completed) return false;
            if (statusFilter === 'completed' && !task.completed) return false;
            
            // Priority filter
            if (priorityFilter !== 'all' && task.priority !== parseInt(priorityFilter)) return false;
            
            // Source filter
            if (sourceFilter !== 'all' && !task.sourcePath.includes(sourceFilter)) return false;
            
            // Tag filter
            if (tagFilter !== 'all' && !task.content.includes(tagFilter)) return false;
            
            // Search filter
            if (searchFilter && !task.content.toLowerCase().includes(searchFilter)) return false;
            
            return true;
        });
    }

    renderTasks(viewFilter?: string) {
        // Clear task list
        this.taskListContainer.empty();
        
        // Get filtered tasks
        let filteredTasks = this.getFilteredTasks();
        
        // Additional filtering based on viewFilter
        if (viewFilter) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            
            if (viewFilter === 'today') {
                // Only show tasks for today
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    
                    return taskDate.getTime() === today.getTime();
                });
            } else if (viewFilter === 'upcoming') {
                // Only show upcoming tasks (today + next 7 days)
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    
                    return taskDate >= today && taskDate < nextWeek;
                });
            }
        }
        
        // No tasks available?
        if (filteredTasks.length === 0) {
            this.taskListContainer.createEl('p', { text: 'No tasks found.' });
            return;
        }
        
        // Create task list
        const taskList = this.taskListContainer.createEl('ul', { cls: 'agenda-hero-task-list' });
        
        // Collect projects (source files) for filtering
        const projects = new Set<string>();
        
        // Add tasks
        filteredTasks.forEach(task => {
            // Extract project (source file) and add to set
            const project = this.getProjectFromPath(task.sourcePath);
            if (project) {
                projects.add(project);
            }
            
            // Create task item
            const taskItem = taskList.createEl('li', { cls: 'agenda-hero-task-item' });
            
            // Add task ID as attribute for drag & drop
            taskItem.setAttribute('data-task-id', task.id);
            
            // Create task preview (compact view)
            this.createTaskPreview(taskItem, task, {
                showDetails: false,
                showActions: true
            });
            
            // Add click event for preview
            taskItem.addEventListener('click', (e) => {
                // Only react if not clicked on checkbox or button
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'BUTTON') {
                    // Remove existing preview
                    taskItem.empty();
                    
                    // Show detailed preview
                    this.createTaskPreview(taskItem, task, {
                        showDetails: true,
                        showActions: true
                    });
                }
            });
        });
        
        // Update project filter
        this.updateProjectFilter(Array.from(projects));
    }
    
    /**
     * Creates a preview for a task
     * @param container The container element
     * @param task The task to display
     * @param options Options for display
     */
    createTaskPreview(container: HTMLElement, task: Task, options: TaskPreviewOptions) {
        // Checkbox for status
        const checkbox = container.createEl('input', { 
            type: 'checkbox',
            cls: 'agenda-hero-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.plugin.updateTaskInFile(task);
        });
        
        // Priority indicator
        const priorityColors = ['#ff5252', '#ff9800', '#4caf50', '#2196f3'];
        const priorityIndicator = container.createEl('span', { 
            cls: 'agenda-hero-priority',
            attr: { style: `background-color: ${priorityColors[task.priority - 1]};` }
        });
        
        // Task content
        const contentContainer = container.createEl('div', { cls: 'agenda-hero-task-content-container' });
        
        // Task title
        const content = contentContainer.createEl('span', { 
            text: task.content,
            cls: 'agenda-hero-task-content'
        });
        
        if (task.completed) {
            content.addClass('agenda-hero-completed');
        }
        
        // Detailed view
        if (options.showDetails) {
            // Project (source file)
            const project = this.getProjectFromPath(task.sourcePath);
            if (project) {
                contentContainer.createEl('div', {
                    text: `Project: ${project}`,
                    cls: 'agenda-hero-task-project'
                });
            }
            
            // Due date
            if (task.dueDate) {
                contentContainer.createEl('div', {
                    text: `Due: ${task.dueDate.toLocaleString()}`,
                    cls: 'agenda-hero-task-due-date'
                });
            }
            
            // Priority as text
            const priorityTexts = ['High', 'Medium', 'Normal', 'Low'];
            contentContainer.createEl('div', {
                text: `Priority: ${priorityTexts[task.priority - 1]}`,
                cls: 'agenda-hero-task-priority-text'
            });
            
            // Recurring?
            if (task.recurring) {
                contentContainer.createEl('div', {
                    text: `Recurring: ${task.recurrenceRule || 'Yes'}`,
                    cls: 'agenda-hero-task-recurring'
                });
            }
            
            // Extract and display tags
            const tags = this.extractTags(task.content);
            if (tags.length > 0) {
                const tagsContainer = contentContainer.createEl('div', { cls: 'agenda-hero-task-tags' });
                tagsContainer.createEl('span', { text: 'Tags: ' });
                
                tags.forEach((tag, index) => {
                    tagsContainer.createEl('span', {
                        text: tag,
                        cls: 'agenda-hero-task-tag'
                    });
                    
                    if (index < tags.length - 1) {
                        tagsContainer.createEl('span', { text: ', ' });
                    }
                });
            }
        } else {
            // Compact view: Only show due date
            if (task.dueDate) {
                const dueDate = contentContainer.createEl('span', {
                    text: task.dueDate.toLocaleDateString(),
                    cls: 'agenda-hero-due-date'
                });
            }
        }
        
        // Action buttons
        if (options.showActions) {
            const actions = container.createEl('div', { cls: 'agenda-hero-task-actions' });
            
            if (options.showDetails) {
                // Edit button
                const editButton = actions.createEl('button', { text: 'Edit' });
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    this.editTask(task);
                });
                
                // Delete button
                const deleteButton = actions.createEl('button', { text: 'Delete' });
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    this.deleteTask(task);
                });
                
                // Close button (back to compact view)
                const closeButton = actions.createEl('button', { text: 'Close' });
                closeButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    
                    // Return to compact view
                    container.empty();
                    this.createTaskPreview(container, task, {
                        showDetails: false,
                        showActions: true
                    });
                });
            } else {
                // Details button
                const detailsButton = actions.createEl('button', { text: 'Details' });
                detailsButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering task item event
                    
                    // Remove existing preview
                    container.empty();
                    
                    // Show detailed preview
                    this.createTaskPreview(container, task, {
                        showDetails: true,
                        showActions: true
                    });
                });
            }
        }
    }
    
    /**
     * Extract project name from file path
     * @param path The file path
     * @returns The project name (filename without extension)
     */
    getProjectFromPath(path: string): string | null {
        if (!path) return null;
        
        // Extract filename (without path)
        const fileName = path.split('/').pop();
        if (!fileName) return null;
        
        // Remove extension
        return fileName.replace(/\.[^/.]+$/, '');
    }
    
    /**
     * Extract tags from task content based on configured tags
     * @param content The task content
     * @returns Array of found tags
     */
    extractTags(content: string): string[] {
        if (!content) return [];
        
        const foundTags: string[] = [];
        
        // Search for configured tags
        for (const tag of this.plugin.settings.taskTags) {
            if (content.includes(tag)) {
                foundTags.push(tag);
            }
        }
        
        return foundTags;
    }
    
    /**
     * Update project filter with available projects
     * @param projects Array of project names
     */
    updateProjectFilter(projects: string[]) {
        // Find source filter
        const sourceFilter = this.filterContainer.querySelector('.agenda-hero-filter-group:nth-child(3)');
        if (!sourceFilter) return;
        
        // Find select element
        const sourceSelect = sourceFilter.querySelector('select');
        if (!sourceSelect) return;
        
        // Store currently selected value
        const currentValue = sourceSelect.value;
        
        // Remove all options except "All"
        while (sourceSelect.options.length > 1) {
            sourceSelect.remove(1);
        }
        
        // Sort projects
        projects.sort();
        
        // Add projects as options
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.text = project;
            sourceSelect.add(option);
            
            // If this project was previously selected, select it again
            if (project === currentValue) {
                option.selected = true;
            }
        });
    }

    initDragAndDrop() {
        // Initialize Dragula
        this.drake = dragula([this.taskListContainer], {
            moves: (el: HTMLElement, container: HTMLElement, handle: HTMLElement) => {
                // Only task items can be moved
                return el.classList.contains('agenda-hero-task-item');
            },
            copy: true, // Create a copy, so the original stays in the list
            accepts: (el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement) => {
                // Elements cannot be dropped within the task list
                return false;
            }
        });
        
        // Event handler for dragging tasks
        this.drake.on('drag', (el: HTMLElement) => {
            // Extract task ID from element
            const taskId = el.getAttribute('data-task-id');
            if (!taskId) return;
            
            // Find task
            const task = this.plugin.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Add class to indicate a task is being dragged
            document.body.classList.add('agenda-hero-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero:task-drag-start', { taskId, task });
        });
        
        // Event handler for drag end
        this.drake.on('dragend', (el: HTMLElement) => {
            // Remove class
            document.body.classList.remove('agenda-hero-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero:task-drag-end');
        });
        
        // Event handler for dropping tasks
        this.drake.on('drop', (el: HTMLElement, target: HTMLElement, source: HTMLElement, sibling: HTMLElement) => {
            // If no target, the task was not dropped
            if (!target) return;
            
            // Extract task ID from element
            const taskId = el.getAttribute('data-task-id');
            if (!taskId) return;
            
            // Find task
            const task = this.plugin.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero:task-dropped', { taskId, task, target });
        });
        
        // Event handler for cancel
        this.drake.on('cancel', () => {
            // Remove class
            document.body.classList.remove('agenda-hero-dragging-task');
            
            // Trigger event to notify calendar
            this.app.workspace.trigger('agenda-hero:task-drag-cancel');
        });
    }

    editTask(task: Task) {
        // Open task edit modal
        const modal = new TaskEditModal(this.app, task, (updatedTask) => {
            // Update task
            Object.assign(task, updatedTask);
            
            // Update task in file
            this.plugin.updateTaskInFile(task);
            
            // Update task list
            this.renderTasks();
        });
        
        modal.open();
    }

    deleteTask(task: Task) {
        // Show confirmation dialog
        const confirmDelete = confirm(`Are you sure you want to delete task "${task.content}"?`);
        
        if (confirmDelete) {
            // Remove task from list
            this.plugin.tasks = this.plugin.tasks.filter(t => t.id !== task.id);
            
            // Remove task from file
            // A method would need to be implemented to remove the task
            // from the source file - for the prototype, we'll skip this for now
            
            // Update task list
            this.renderTasks();
        }
    }

    async onClose() {
        // Clean-up
        if (this.drake) {
            this.drake.destroy();
        }
    }
}

/**
 * Modal for editing a task
 */
class TaskEditModal extends Modal {
    task: Task;
    onSubmit: (task: Task) => void;
    plugin: AgendaHeroPlugin;
    
    constructor(app: App, task: Task, onSubmit: (task: Task) => void) {
        super(app);
        this.task = task;
        this.onSubmit = onSubmit;
        
        // Get plugin instance from app
        // @ts-ignore - We know the plugin exists
        this.plugin = app.plugins.plugins['agenda-hero'];
    }
    
    onOpen() {
        const {contentEl} = this;
        
        // Heading
        contentEl.createEl('h2', {text: 'Edit Task'});
        
        // Create form
        const form = contentEl.createEl('form', { cls: 'agenda-hero-edit-form' });
        
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
    
    onClose() {
        // Cleanup
        const {contentEl} = this;
        contentEl.empty();
    }
}