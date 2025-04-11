import { App, Notice } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { KeyResult, getStatusDisplayText } from '../../models/okr-models';
import { OkrProjectRenderer } from './okr-project-renderer';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Responsible for rendering key results in the OKR hierarchy
 */
export class OkrKeyResultRenderer {
    private app: App;
    private okrService: OkrService;
    private projectRenderer: OkrProjectRenderer;
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
        this.projectRenderer = new OkrProjectRenderer(app, okrService, okrOperations);
    }
    
    /**
     * Render a key result
     * @param container Container element
     * @param keyResult Key result to render
     */
    renderKeyResult(container: HTMLElement, keyResult: KeyResult): void {
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
        
        // Create content container
        const krContent = krContainer.createEl('div', { 
            cls: 'agenda-hero-okr-kr-content'
        });
        
        // Setup expand/collapse functionality
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
            this.okrOperations.editKeyResult(keyResult);
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
            this.okrOperations.createNewProject(keyResult);
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
        
        // Add metric information if present
        if (keyResult.metric) {
            const metricInfo = krContent.createEl('div', {
                cls: 'agenda-hero-okr-metric-info'
            });
            
            metricInfo.createEl('p', {
                text: `Metric: ${keyResult.metric}`,
                cls: 'agenda-hero-okr-metric'
            });
            
            if (keyResult.startValue !== undefined && keyResult.targetValue !== undefined) {
                metricInfo.createEl('p', {
                    text: `Target: ${keyResult.startValue} → ${keyResult.targetValue}`,
                    cls: 'agenda-hero-okr-target'
                });
            }
            
            if (keyResult.currentValue !== undefined) {
                metricInfo.createEl('p', {
                    text: `Current: ${keyResult.currentValue}`,
                    cls: 'agenda-hero-okr-current-value'
                });
            }
        }
        
        // Add projects
        if (keyResult.projects && keyResult.projects.length > 0) {
            const projectsContainer = krContent.createEl('div', { 
                cls: 'agenda-hero-okr-projects-container'
            });
            
            projectsContainer.createEl('h5', { text: 'Projects' });
            
            keyResult.projects.forEach(project => {
                this.projectRenderer.renderProject(projectsContainer, project);
            });
        } else {
            krContent.createEl('p', { 
                text: 'No projects yet. Click "Add Project" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
}