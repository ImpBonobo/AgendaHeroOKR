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
    
    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.okrService = plugin.okrService;
        
        // Initialize component managers
        this.okrOperations = new OkrHierarchyOperations(this.app, this.okrService);
        this.hierarchyRenderer = new OkrHierarchyRenderer(this.app, this.okrService, this.okrOperations);
    }

    getViewType(): string {
        return 'agenda-hero-okr-hierarchy';
    }

    getDisplayText(): string {
        return 'OKR Hierarchy';
    }

    async onOpen() {
        const containerEl = this.containerEl;
        
        // Leere zuerst den Container, um sicherzustellen, dass keine alten Elemente verbleiben
        containerEl.empty();
        
        // Erstelle den Hauptcontainer
        const container = containerEl.createDiv({ cls: 'agenda-hero-okr-hierarchy-container' });
        
        // Erstelle Header
        const header = container.createEl('div', { cls: 'agenda-hero-okr-header' });
        header.createEl('h2', { text: 'OKR Hierarchy' });
        
        // Erstelle Button-Container
        const buttonContainer = header.createEl('div', { cls: 'agenda-hero-okr-buttons' });
        
        // Füge "New Objective" Button hinzu
        const newObjectiveButton = buttonContainer.createEl('button', { 
            text: 'New Objective',
            cls: 'agenda-hero-okr-button'
        });
        
        newObjectiveButton.addEventListener('click', () => {
            console.log("Creating new objective...");
            this.okrOperations.createNewObjective();
        });
        
        // Erstelle Container für die OKR-Hierarchie
        const hierarchyContainer = container.createEl('div', { cls: 'agenda-hero-okr-hierarchy' });
        
        // Debug-Ausgabe hinzufügen
        console.log("OKR Service:", this.okrService);
        console.log("About to render hierarchy...");
        
        try {
            // Render hierarchy
            await this.hierarchyRenderer.renderHierarchy(hierarchyContainer);
            console.log("Hierarchy rendered successfully!");
        } catch (error) {
            console.error("Error rendering hierarchy:", error);
            
            // Zeige Fehlermeldung im UI
            const errorEl = hierarchyContainer.createEl('div', { 
                cls: 'agenda-okr-hero-error',
                text: 'Error loading OKR data. Please check the console for details.'
            });
        }
        
        // Register for updates
        this.okrService.registerUpdateCallback(() => {
            console.log("Update callback triggered!");
            this.hierarchyRenderer.renderHierarchy(hierarchyContainer);
        });
    }
}