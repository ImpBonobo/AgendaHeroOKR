import { ItemView, WorkspaceLeaf } from 'obsidian';
import { OkrService } from '../../services/okr-service';
import AgendaHeroOKRPlugin from '../../../main';
import { OkrHierarchyRenderer } from './okr-hierarchy-renderer';
import { OkrHierarchyOperations } from './okr-hierarchy-operations';

/**
 * Main view class for the OKR hierarchy
 */
export class OkrHierarchyView extends ItemView {
    plugin: AgendaHeroOKRPlugin;
    okrService: OkrService;
    private hierarchyRenderer: OkrHierarchyRenderer;
    private okrOperations: OkrHierarchyOperations;
    
    /**
     * Constructor
     * @param leaf Obsidian workspace leaf
     * @param plugin Plugin instance
     */
    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.okrService = plugin.okrService;
        
        // Initialize component managers
        this.okrOperations = new OkrHierarchyOperations(this.app, this.okrService);
        this.hierarchyRenderer = new OkrHierarchyRenderer(this.app, this.okrService, this.okrOperations);
    }

    /**
     * Get view type
     * @returns View type string
     */
    getViewType(): string {
        return 'agenda-hero-okr-hierarchy';
    }

    /**
     * Get display text
     * @returns Display text for the view
     */
    getDisplayText(): string {
        return 'OKR Hierarchy';
    }

    /**
     * Handle view open event
     */
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
        newObjectiveButton.addEventListener('click', () => this.okrOperations.createNewObjective());
        
        // Create hierarchy container
        const hierarchyContainer = container.createEl('div', { cls: 'agenda-hero-okr-hierarchy' });
        
        // Render hierarchy
        await this.hierarchyRenderer.renderHierarchy(hierarchyContainer);
        
        // Register for updates
        this.okrService.registerUpdateCallback(() => {
            this.hierarchyRenderer.renderHierarchy(hierarchyContainer);
        });
    }
}