import { App } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import { Objective } from '../../models/okr-models';
import { OkrObjectiveRenderer } from './okr-objective-renderer';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Responsible for rendering the entire OKR hierarchy
 */
export class OkrHierarchyRenderer {
    private app: App;
    private okrService: OkrService;
    private objectiveRenderer: OkrObjectiveRenderer;
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
        this.objectiveRenderer = new OkrObjectiveRenderer(app, okrService, okrOperations);
    }
    
    /**
     * Render the OKR hierarchy
     * @param container Container element for the hierarchy
     */
    async renderHierarchy(container: HTMLElement): Promise<void> {
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
    
    /**
     * Render an objective
     * @param container Container element
     * @param objective Objective to render
     */
    private renderObjective(container: HTMLElement, objective: Objective): void {
        this.objectiveRenderer.renderObjective(container, objective);
    }
}