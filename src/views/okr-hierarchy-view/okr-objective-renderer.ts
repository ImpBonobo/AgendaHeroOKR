import { App, Notice } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { Objective, getStatusDisplayText } from '../../models/okr-models';
import { OkrKeyResultRenderer } from './okr-key-result-renderer';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Responsible for rendering objectives in the OKR hierarchy
 */
export class OkrObjectiveRenderer {
    private app: App;
    private okrService: OkrService;
    private keyResultRenderer: OkrKeyResultRenderer;
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
        this.keyResultRenderer = new OkrKeyResultRenderer(app, okrService, okrOperations);
    }
    
    /**
     * Render an objective
     * @param container Container element
     * @param objective Objective to render
     */
    renderObjective(container: HTMLElement, objective: Objective): void {
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
        
        // Create content container
        const objectiveContent = objectiveContainer.createEl('div', { 
            cls: 'agenda-hero-okr-objective-content'
        });
        
        // Setup expand/collapse functionality
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
            this.okrOperations.editObjective(objective);
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
            this.okrOperations.createNewKeyResult(objective);
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
                this.keyResultRenderer.renderKeyResult(krContainer, keyResult);
            });
        } else {
            objectiveContent.createEl('p', { 
                text: 'No key results yet. Click "Add KR" to create one.',
                cls: 'agenda-hero-okr-empty-message'
            });
        }
    }
}