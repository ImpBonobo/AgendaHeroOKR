import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { OkrService } from '../services/okr-service';
import AgendaHeroOKRPlugin from '../../main';
import { Objective, KeyResult, Project, Task, getStatusDisplayText } from '../models/okr-models';
import { ObjectiveModal, KeyResultModal, ProjectModal, TaskModal } from '../components/okr-modals';

export class OkrHierarchyView extends ItemView {
    plugin: AgendaHeroOKRPlugin;
    okrService: OkrService;
    
    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
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
        const container = this.containerEl.createDiv({ cls: 'okr-hierarchy-container' });
        
        // Create header
        const header = container.createEl('div', { cls: 'okr-hierarchy-header' });
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
                cls: 'agenda-hero-okr-empty-message'
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
            cls: 'agenda-hero-okr-objective-container' 
        });
        
        // Create header row
        const headerRow = objectiveContainer.createEl('div', { 
            cls: 'agenda-hero-okr-objective-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-okr-expand-button'
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
            cls: 'agenda-hero-okr-objective-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(objective.status),
            cls: `agenda-hero-okr-status-badge agenda-hero-okr-status-${objective.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-okr-progress-bar'
        });
        progressBar.style.width = `${objective.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${objective.progress}%`,
            cls: 'agenda-hero-okr-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-okr-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editObjective(objective);
        });

        // Add delete button for objectives
        const deleteButton = buttonContainer.createEl('button', { 
            text: 'Delete',
            cls: 'agenda-hero-okr-small-button'
        });
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this objective? This will also delete all associated key results and projects.')) {
                this.okrService.deleteObjective(objective.id)
                    .then(() => {
                        new Notice('Objective deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting objective:', error);
                        new Notice('Error deleting objective');
                    });
            }
        });
        
        const addKrButton = buttonContainer.createEl('button', { 
            text: 'Add KR',
            cls: 'agenda-hero-okr-small-button'
        });
        addKrButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewKeyResult(objective);
        });
        
        // Create content container
        const objectiveContent = objectiveContainer.createEl('div', { 
            cls: 'agenda-hero-okr-objective-content'
        });
        
        // Add description if present
        if (objective.description) {
            objectiveContent.createEl('p', { 
                text: objective.description,
                cls: 'agenda-hero-okr-description'
            });
        }
        
        // Add date range
        objectiveContent.createEl('p', { 
            text: `${objective.startDate.toLocaleDateString()} - ${objective.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-okr-date-range'
        });
        
        // Add key results
        if (objective.keyResults && objective.keyResults.length > 0) {
            const krContainer = objectiveContent.createEl('div', { 
                cls: 'agenda-hero-okr-kr-container'
            });
            
            krContainer.createEl('h4', { text: 'Key Results' });
            
            objective.keyResults.forEach(keyResult => {
                this.renderKeyResult(krContainer, keyResult);
            });
        } else {
            objectiveContent.createEl('p', { 
                text: 'No key results yet. Click "Add KR" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
    
    renderKeyResult(container: HTMLElement, keyResult: KeyResult) {
        // Create key result container
        const krContainer = container.createEl('div', { 
            cls: 'agenda-hero-okr-kr-container' 
        });
        
        // Create header row
        const headerRow = krContainer.createEl('div', { 
            cls: 'agenda-hero-okr-kr-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-okr-expand-button'
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
            cls: 'agenda-hero-okr-kr-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(keyResult.status),
            cls: `agenda-hero-okr-status-badge agenda-hero-okr-status-${keyResult.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-okr-progress-bar'
        });
        progressBar.style.width = `${keyResult.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${keyResult.progress}%`,
            cls: 'agenda-hero-okr-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-okr-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editKeyResult(keyResult);
        });

        // Add delete button for key results
        const deleteButton = buttonContainer.createEl('button', { 
            text: 'Delete',
            cls: 'agenda-hero-okr-small-button'
        });
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this key result? This will also delete all associated projects.')) {
                this.okrService.deleteKeyResult(keyResult.id)
                    .then(() => {
                        new Notice('Key Result deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting key result:', error);
                        new Notice('Error deleting key result');
                    });
            }
        });
        
        const addProjectButton = buttonContainer.createEl('button', { 
            text: 'Add Project',
            cls: 'agenda-hero-okr-small-button'
        });
        addProjectButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewProject(keyResult);
        });
        
        // Create content container
        const krContent = krContainer.createEl('div', { 
            cls: 'agenda-hero-okr-kr-content'
        });
        
        // Add description if present
        if (keyResult.description) {
            krContent.createEl('p', { 
                text: keyResult.description,
                cls: 'agenda-hero-okr-description'
            });
        }
        
        // Add date range
        krContent.createEl('p', { 
            text: `${keyResult.startDate.toLocaleDateString()} - ${keyResult.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-okr-date-range'
        });
        
        // Add projects
        if (keyResult.projects && keyResult.projects.length > 0) {
            const projectsContainer = krContent.createEl('div', { 
                cls: 'agenda-hero-okr-projects-container'
            });
            
            projectsContainer.createEl('h5', { text: 'Projects' });
            
            keyResult.projects.forEach(project => {
                this.renderProject(projectsContainer, project);
            });
        } else {
            krContent.createEl('p', { 
                text: 'No projects yet. Click "Add Project" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
    
    renderProject(container: HTMLElement, project: Project) {
        // Create project container
        const projectContainer = container.createEl('div', { 
            cls: 'agenda-hero-okr-project-container' 
        });
        
        // Create header row
        const headerRow = projectContainer.createEl('div', { 
            cls: 'agenda-hero-okr-project-header'
        });
        
        // Add expand/collapse button
        const expandButton = headerRow.createEl('span', { 
            cls: 'agenda-hero-okr-expand-button'
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
            cls: 'agenda-hero-okr-project-title'
        });
        
        // Add status badge
        headerRow.createEl('span', {
            text: getStatusDisplayText(project.status),
            cls: `agenda-hero-status-badge agenda-hero-okr-status-${project.status}`
        });
        
        // Add progress
        const progressContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-progress-container'
        });
        
        const progressBar = progressContainer.createEl('div', { 
            cls: 'agenda-hero-okr-progress-bar'
        });
        progressBar.style.width = `${project.progress}%`;
        
        progressContainer.createEl('span', { 
            text: `${project.progress}%`,
            cls: 'agenda-hero-okr-progress-text'
        });
        
        // Add buttons
        const buttonContainer = headerRow.createEl('div', { 
            cls: 'agenda-hero-okr-button-container'
        });
        
        const editButton = buttonContainer.createEl('button', { 
            text: 'Edit',
            cls: 'agenda-hero-okr-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editProject(project);
        });

        // Add delete button for projects
        const deleteButton = buttonContainer.createEl('button', { 
            text: 'Delete',
            cls: 'agenda-hero-okr-small-button'
        });
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this project? This will also delete all associated tasks.')) {
                this.okrService.deleteProject(project.id)
                    .then(() => {
                        new Notice('Project deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting project:', error);
                        new Notice('Error deleting project');
                    });
            }
        });
        
        const addTaskButton = buttonContainer.createEl('button', { 
            text: 'Add Task',
            cls: 'agenda-hero-okr-small-button'
        });
        addTaskButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.createNewTask(project);
        });
        
        // Create content container
        const projectContent = projectContainer.createEl('div', { 
            cls: 'agenda-hero-okr-project-content'
        });
        
        // Add description if present
        if (project.description) {
            projectContent.createEl('p', { 
                text: project.description,
                cls: 'agenda-hero-okr-description'
            });
        }
        
        // Add date range
        projectContent.createEl('p', { 
            text: `${project.startDate.toLocaleDateString()} - ${project.endDate.toLocaleDateString()}`,
            cls: 'agenda-hero-okr-date-range'
        });
        
        // Add tasks
        if (project.tasks && project.tasks.length > 0) {
            const tasksContainer = projectContent.createEl('div', { 
                cls: 'agenda-hero-okr-tasks-container'
            });
            
            tasksContainer.createEl('h6', { text: 'Tasks' });
            
            const taskList = tasksContainer.createEl('ul', {
                cls: 'agenda-hero-okr-task-list'
            });
            
            project.tasks.forEach(task => {
                this.renderTask(taskList, task);
            });
        } else {
            projectContent.createEl('p', { 
                text: 'No tasks yet. Click "Add Task" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
    
    renderTask(container: HTMLElement, task: Task) {
        // Create task item
        const taskItem = container.createEl('li', { 
            cls: 'agenda-hero-okr-task-item' 
        });
        
        // Add checkbox
        const checkbox = taskItem.createEl('input', {
            type: 'checkbox',
            cls: 'agenda-hero-okr-task-checkbox'
        });
        checkbox.checked = task.completed;
        
        checkbox.addEventListener('change', () => {
            task.completed = checkbox.checked;
            this.okrService.updateTask(task);
        });
        
        // Add task content
        const contentContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-okr-task-content-container'
        });
        
        // Add title
        const title = contentContainer.createEl('span', {
            text: task.title,
            cls: task.completed ? 'agenda-hero-okr-task-content completed' : 'agenda-hero-okr-task-content'
        });
        
        // Add due date if present
        if (task.dueDate) {
            contentContainer.createEl('div', {
                text: `Due: ${task.dueDate.toLocaleDateString()}`,
                cls: 'agenda-hero-okr-task-due-date'
            });
        }
        
        // Add buttons
        const buttonContainer = taskItem.createEl('div', {
            cls: 'agenda-hero-okr-task-actions'
        });
        
        const editButton = buttonContainer.createEl('button', {
            text: 'Edit',
            cls: 'agenda-hero-okr-small-button'
        });
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editTask(task);
        });
        // Add delete button for tasks
        const deleteButton = buttonContainer.createEl('button', {
            text: 'Delete',
            cls: 'agenda-hero-okr-small-button'
        });
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this task?')) {
                this.okrService.deleteTask(task.id)
                    .then(() => {
                        new Notice('Task deleted successfully');
                    })
                    .catch(error => {
                        console.error('Error deleting task:', error);
                        new Notice('Error deleting task');
                    });
            }
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