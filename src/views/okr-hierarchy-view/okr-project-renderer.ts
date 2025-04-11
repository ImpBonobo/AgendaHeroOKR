import { App, Notice } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { Project, getStatusDisplayText } from '../../models/okr-models';
import { OkrTaskRenderer } from './okr-task-renderer';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Responsible for rendering projects in the OKR hierarchy
 */
export class OkrProjectRenderer {
    private app: App;
    private okrService: OkrService;
    private taskRenderer: OkrTaskRenderer;
    private okrOperations: OkrHierarchyOperations;
    
    /**
     * Constructor
     * @param app Obsidian app instance
     * @param okrService OKR service instance
     * @param okrOperations OKR hierarchy operations
     */
    constructor(
        app: App, 
        okrService: OkrService,
        okrOperations: OkrHierarchyOperations
    ) {
        this.app = app;
        this.okrService = okrService;
        this.okrOperations = okrOperations;
        this.taskRenderer = new OkrTaskRenderer(app, okrService, okrOperations);
    }
    
    /**
     * Render a project
     * @param container Container element
     * @param project Project to render
     */
    renderProject(container: HTMLElement, project: Project): void {
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
        
        // Create content container
        const projectContent = projectContainer.createEl('div', { 
            cls: 'agenda-hero-okr-project-content'
        });
        
        // Setup expand/collapse functionality
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
            this.okrOperations.editProject(project);
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
            this.okrOperations.createNewTask(project);
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
        
        // Add sprint info if present
        if (project.sprintIds && project.sprintIds.length > 0) {
            projectContent.createEl('p', {
                text: `Sprints: ${project.sprintIds.join(', ')}`,
                cls: 'agenda-hero-okr-sprint-info'
            });
        }
        
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
                this.taskRenderer.renderTask(taskList, task);
            });
        } else {
            projectContent.createEl('p', { 
                text: 'No tasks yet. Click "Add Task" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
}