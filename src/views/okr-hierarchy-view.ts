import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import AgendaHeroPlugin from '../../main';
import { Objective, KeyResult, Project, Task, getStatusDisplayText } from '../models/okr-models';
import { ObjectiveModal, KeyResultModal, ProjectModal, TaskModal } from '../components/okr-modals';

export class OkrHierarchyView extends ItemView {
    plugin: AgendaHeroPlugin;
    okrService: OkrService;
    
    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.okrService = plugin.okrService;
    }

    getViewType(): string {
        return 'agenda-hero-okr-hierarchy';
    }

    getDisplayText(): string {
        return 'OKR Hierarchy';
    }

    async onOpen() {
        // Create container
        const container = this.containerEl.createDiv({ cls: 'agenda-hero-okr-hierarchy-container' });
        
        // Create header
        const header = container.createEl('div', { cls: 'agenda-hero-okr-header' });
        header.createEl('h2', { text: 'OKR Hierarchy' });
        
        // Create buttons
        const buttonContainer = header.createEl('div', { cls: 'agenda-hero-okr-buttons' });
        
        const newObjectiveButton = buttonContainer.createEl('button', { 
            text: 'New Objective',
            cls: 'agenda-hero-okr-button'
        });
        newObjectiveButton.addEventListener('click', () => this.createNewObjective());
        
        // Create hierarchy container
        const hierarchyContainer = container.createEl('div', { cls: 'agenda-hero-okr-hierarchy' });
        
        // Render hierarchy
        await this.renderHierarchy(hierarchyContainer);
        
        // Register for updates
        this.okrService.registerUpdateCallback(() => {
            this.renderHierarchy(hierarchyContainer);
        });
    }
    
    async renderHierarchy(container: HTMLElement) {
        // Clear container
        container.empty();
        
        // Get objectives
        const objectives = this.okrService.getObjectives();
        
        if (objectives.length === 0) {
            container.createEl('p', { 
                text: 'No objectives found. Click "New Objective" to create one.',
                cls: 'agenda-hero-empty-message'
            });
            return;
        }
        
        // Create hierarchy
        objectives.forEach(objective => {
            this.renderObjective(container, objective);
        });
    }
    
    renderObjective(container: HTMLElement, objective: Objective) {
        // Create objective container
        const objectiveContainer = container.createEl('div', { 
            cls: 'agenda-hero-objective-container' 
        });
        
        // Create header row
        const headerRow = objectiveContainer.createEl('div', { 
            cls: 'agenda-hero-objective-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-expand-button'
        });
        expandButton.innerHTML = '▼';
        expandButton.addEventListener('click', () => {
            objectiveContent.style.display = 
                objectiveContent.style.display === 'none' ? 'block' : 'none';
            expandButton.innerHTML = 
                objectiveContent.style.display === 'none' ? '▶' : '▼';
        });
        
        // Add title
        const title = headerRow.createEl('h3', { 
            text: objective.title,
            cls: 'agenda-hero-objective-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(objective.status),
            cls: `agenda-hero-status-badge agenda-hero-status-${objective.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-progress-bar'
        });
        progressBar.style.width = `${objective.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${objective.progress}%`,
            cls: 'agenda-hero-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editObjective(objective);
        });
        
        const addKrButton = buttonContainer.createEl('button', { 
            text: 'Add KR',
            cls: 'agenda-hero-small-button'
        });
        addKrButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewKeyResult(objective);
        });
        
        // Create content container
        const objectiveContent = objectiveContainer.createEl('div', { 
            cls: 'agenda-hero-objective-content'
        });
        
        // Add description if present
        if (objective.description) {
            objectiveContent.createEl('p', { 
                text: objective.description,
                cls: 'agenda-hero-description'
            });
        }
        
        // Add date range
        objectiveContent.createEl('p', { 
            text: `${objective.startDate.toLocaleDateString()} - ${objective.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-date-range'
        });
        
        // Add key results
        if (objective.keyResults && objective.keyResults.length > 0) {
            const krContainer = objectiveContent.createEl('div', { 
                cls: 'agenda-hero-kr-container'
            });
            
            krContainer.createEl('h4', { text: 'Key Results' });
            
            objective.keyResults.forEach(keyResult => {
                this.renderKeyResult(krContainer, keyResult);
            });
        } else {
            objectiveContent.createEl('p', { 
                text: 'No key results yet. Click "Add KR" to create one.',
                cls: 'agenda-hero-empty-message'
            });
        }
    }
    
    renderKeyResult(container: HTMLElement, keyResult: KeyResult) {
        // Create key result container
        const krContainer = container.createEl('div', { 
            cls: 'agenda-hero-kr-container' 
        });
        
        // Create header row
        const headerRow = krContainer.createEl('div', { 
            cls: 'agenda-hero-kr-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-expand-button'
        });
        expandButton.innerHTML = '▼';
        expandButton.addEventListener('click', () => {
            krContent.style.display = 
                krContent.style.display === 'none' ? 'block' : 'none';
            expandButton.innerHTML = 
                krContent.style.display === 'none' ? '▶' : '▼';
        });
        
        // Add title
        headerRow.createEl('h4', { 
            text: keyResult.title,
            cls: 'agenda-hero-kr-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(keyResult.status),
            cls: `agenda-hero-status-badge agenda-hero-status-${keyResult.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-progress-bar'
        });
        progressBar.style.width = `${keyResult.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${keyResult.progress}%`,
            cls: 'agenda-hero-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editKeyResult(keyResult);
        });
        
        const addProjectButton = buttonContainer.createEl('button', { 
            text: 'Add Project',
            cls: 'agenda-hero-small-button'
        });
        addProjectButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewProject(keyResult);
        });
        
        // Create content container
        const krContent = krContainer.createEl('div', { 
            cls: 'agenda-hero-kr-content'
        });
        
        // Add description if present
        if (keyResult.description) {
            krContent.createEl('p', { 
                text: keyResult.description,
                cls: 'agenda-hero-description'
            });
        }
        
        // Add date range
        krContent.createEl('p', { 
            text: `${keyResult.startDate.toLocaleDateString()} - ${keyResult.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-date-range'
        });
        
        // Add projects
        if (keyResult.projects && keyResult.projects.length > 0) {
            const projectsContainer = krContent.createEl('div', { 
                cls: 'agenda-hero-projects-container'
            });
            
            projectsContainer.createEl('h5', { text: 'Projects' });
            
            keyResult.projects.forEach(project => {
                this.renderProject(projectsContainer, project);
            });
        } else {
            krContent.createEl('p', { 
                text: 'No projects yet. Click "Add Project" to create one.',
                cls: 'agenda-hero-empty-message'
            });
        }
    }
    
    renderProject(container: HTMLElement, project: Project) {
        // Create project container
        const projectContainer = container.createEl('div', { 
            cls: 'agenda-hero-project-container' 
        });
        
        // Create header row
        const headerRow = projectContainer.createEl('div', { 
            cls: 'agenda-hero-project-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-expand-button'
        });
        expandButton.innerHTML = '▼';
        expandButton.addEventListener('click', () => {
            projectContent.style.display = 
                projectContent.style.display === 'none' ? 'block' : 'none';
            expandButton.innerHTML = 
                projectContent.style.display === 'none' ? '▶' : '▼';
        });
        
        // Add title
        headerRow.createEl('h5', { 
            text: project.title,
            cls: 'agenda-hero-project-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(project.status),
            cls: `agenda-hero-status-badge agenda-hero-status-${project.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-progress-bar'
        });
        progressBar.style.width = `${project.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${project.progress}%`,
            cls: 'agenda-hero-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editProject(project);
        });
        
        const addTaskButton = buttonContainer.createEl('button', { 
            text: 'Add Task',
            cls: 'agenda-hero-small-button'
        });
        addTaskButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewTask(project);
        });
        
        // Create content container
        const projectContent = projectContainer.createEl('div', { 
            cls: 'agenda-hero-project-content'
        });
        
        // Add description if present
        if (project.description) {
            projectContent.createEl('p', { 
                text: project.description,
                cls: 'agenda-hero-description'
            });
        }
        
        // Add date range
        projectContent.createEl('p', { 
            text: `${project.startDate.toLocaleDateString()} - ${project.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-date-range'
        });
        
        // Add tasks
        if (project.tasks && project.tasks.length > 0) {
            const tasksContainer = projectContent.createEl('div', { 
                cls: 'agenda-hero-tasks-container'
            });
            
            tasksContainer.createEl('h6', { text: 'Tasks' });
            
            const taskList = tasksContainer.createEl('ul', {
                cls: 'agenda-hero-task-list'
            });
            
            project.tasks.forEach(task => {
                this.renderTask(taskList, task);
            });
        } else {
            projectContent.createEl('p', { 
                text: 'No tasks yet. Click "Add Task" to create one.',
                cls: 'agenda-hero-empty-message'
            });
        }
    }
    
    renderTask(container: HTMLElement, task: Task) {
        // Create task item
        const taskItem = container.createEl('li', { 
            cls: 'agenda-hero-task-item' 
        });
        
        // Add checkbox
        const checkbox = taskItem.createEl('input', {
            type: 'checkbox',
            cls: 'agenda-hero-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.okrService.updateTask(task);
        });
        
        // Add task content
        const contentContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-task-content-container'
        });
        
        // Add title
        const title = contentContainer.createEl('span', {
            text: task.title,
            cls: task.completed ? 'agenda-hero-task-content completed' : 'agenda-hero-task-content'
        });
        
        // Add due date if present
        if (task.dueDate) {
            contentContainer.createEl('div', {
                text: `Due: ${task.dueDate.toLocaleDateString()}`,
                cls: 'agenda-hero-task-due-date'
            });
        }
        
        // Add buttons
        const buttonContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-task-actions'
        });
        
        const editButton = buttonContainer.createEl('button', {
            text: 'Edit',
            cls: 'agenda-hero-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editTask(task);
        });
    }
    
    // CRUD operations for OKR elements

    createNewObjective() {
        const modal = new ObjectiveModal(this.app, this.okrService, async (objective) => {
            try {
                // Ensure required properties are present
                const completeObjective = {
                    title: objective.title || 'Untitled Objective', 
                    description: objective.description,
                    status: objective.status || 'future',
                    priority: objective.priority || 3,
                    tags: objective.tags || [],
                    startDate: objective.startDate || new Date(),
                    endDate: objective.endDate || new Date(),
                    progress: objective.progress ?? 0, // Use nullish coalescing to default to 0
                    quarter: objective.quarter,
                    sourcePath: '', // Add this missing property
                    keyResults: []  // Add this missing property
                };
                
                await this.okrService.createObjective(completeObjective);
                new Notice('Objective created successfully');
            } catch (error) {
                console.error('Error creating objective:', error);
                new Notice('Error creating objective');
            }
        });
        
        modal.open();
    }

    // Example for editObjective:
    editObjective(objective: Objective) {
        const modal = new ObjectiveModal(this.app, this.okrService, async (updatedObjective) => {
            try {
                // Merge the existing and updated objective, then use type assertion
                const merged = { ...objective, ...updatedObjective };
                await this.okrService.updateObjective(merged as Objective);
                new Notice('Objective updated successfully');
            } catch (error) {
                console.error('Error updating objective:', error);
                new Notice('Error updating objective');
            }
        }, objective);
        
        modal.open();
    }

    createNewKeyResult(objective: Objective) {
        const modal = new KeyResultModal(this.app, this.okrService, objective.id, async (keyResult) => {
            try {
                // Ensure required properties are present
                const completeKeyResult = {
                    title: keyResult.title || 'Untitled Key Result',
                    description: keyResult.description,
                    objectiveId: keyResult.objectiveId || objective.id,
                    status: keyResult.status || 'future',
                    priority: keyResult.priority || 3,
                    tags: keyResult.tags || [],
                    startDate: keyResult.startDate || new Date(),
                    endDate: keyResult.endDate || new Date(),
                    progress: keyResult.progress ?? 0,
                    sourcePath: '', // Add this
                    projects: [],   // Add this
                    metric: keyResult.metric,
                    startValue: keyResult.startValue,
                    targetValue: keyResult.targetValue,
                    currentValue: keyResult.currentValue,
                    format: keyResult.format
                };
                
                await this.okrService.createKeyResult(completeKeyResult);
                new Notice('Key Result created successfully');
            } catch (error) {
                console.error('Error creating key result:', error);
                new Notice('Error creating key result');
            }
        });
        
        modal.open();
    }

    editKeyResult(keyResult: KeyResult) {
        const modal = new KeyResultModal(this.app, this.okrService, keyResult.objectiveId, async (updatedKeyResult) => {
            try {
                // Merge the existing and updated key result
                const merged = { ...keyResult, ...updatedKeyResult };
                await this.okrService.updateKeyResult(merged as KeyResult);
                new Notice('Key Result updated successfully');
            } catch (error) {
                console.error('Error updating key result:', error);
                new Notice('Error updating key result');
            }
        }, keyResult);
        
        modal.open();
    }

    createNewProject(keyResult: KeyResult) {
        const modal = new ProjectModal(this.app, this.okrService, keyResult.id, async (project) => {
            try {
                // Ensure required properties are present
                const completeProject = {
                    title: project.title || 'Untitled Project',
                    description: project.description,
                    keyResultId: project.keyResultId || keyResult.id,
                    status: project.status || 'future',
                    priority: project.priority || 3,
                    tags: project.tags || [],
                    startDate: project.startDate || new Date(),
                    endDate: project.endDate || new Date(),
                    progress: project.progress ?? 0,
                    sourcePath: '', // Add this
                    tasks: [],      // Add this
                    sprintIds: project.sprintIds
                };
                
                await this.okrService.createProject(completeProject);
                new Notice('Project created successfully');
            } catch (error) {
                console.error('Error creating project:', error);
                new Notice('Error creating project');
            }
        });
        
        modal.open();
    }

    editProject(project: Project) {
        const modal = new ProjectModal(this.app, this.okrService, project.keyResultId, async (updatedProject) => {
            try {
                // Merge the existing and updated project
                const merged = { ...project, ...updatedProject };
                await this.okrService.updateProject(merged as Project);
                new Notice('Project updated successfully');
            } catch (error) {
                console.error('Error updating project:', error);
                new Notice('Error updating project');
            }
        }, project);
        
        modal.open();
    }

    createNewTask(project: Project) {
        const modal = new TaskModal(this.app, this.okrService, project.id, async (task) => {
            try {
                // Ensure required properties are present
                const completeTask = {
                    title: task.title || 'Untitled Task',
                    description: task.description,
                    projectId: task.projectId || project.id,
                    status: task.status || 'next-up',
                    priority: task.priority || 3,
                    tags: task.tags || [],
                    sourcePath: '', // Add this
                    dueDate: task.dueDate || null, // Add || null to convert undefined to null
                    completed: task.completed || false,
                    recurring: task.recurring || false,
                    recurrenceRule: task.recurrenceRule,
                    estimatedDuration: task.estimatedDuration,
                    splitUpBlock: task.splitUpBlock,
                    timeDefense: task.timeDefense,
                    allowedTimeWindows: task.allowedTimeWindows,
                    autoSchedule: task.autoSchedule,
                    scheduledBlocks: task.scheduledBlocks,
                    conflictBehavior: task.conflictBehavior || 'reschedule'
                };
                
                await this.okrService.createTask(completeTask);
                new Notice('Task created successfully');
            } catch (error) {
                console.error('Error creating task:', error);
                new Notice('Error creating task');
            }
        });
        
        modal.open();
    }

    editTask(task: Task) {
        const modal = new TaskModal(this.app, this.okrService, task.projectId, async (updatedTask) => {
            try {
                // Merge the existing and updated task
                const merged = { ...task, ...updatedTask };
                await this.okrService.updateTask(merged as Task);
                new Notice('Task updated successfully');
            } catch (error) {
                console.error('Error updating task:', error);
                new Notice('Error updating task');
            }
        }, task);
        
        modal.open();
    }
}