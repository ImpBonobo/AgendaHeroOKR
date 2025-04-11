import { App } from 'obsidian';

/**
 * Configuration for the OKR persistence service
 */
export interface OkrPersistenceConfig {
    objectivesFolder: string;   // Folder for objectives
    keyResultsFolder: string;   // Folder for key results
    projectsFolder: string;     // Folder for projects
    sprintsFolder: string;      // Folder for sprints
    
    // File naming templates
    objectiveTemplate: string;  // Template for objective filenames
    keyResultTemplate: string;  // Template for key result filenames
    projectTemplate: string;    // Template for project filenames
    sprintTemplate: string;     // Template for sprint filenames
    
    // Metadata field names
    metadataFields: {
        id: string;
        status: string;
        priority: string;
        progress: string;
        startDate: string;
        endDate: string;
        dueDate: string;
        parent: string;         // For linking to parent element
        tags: string;
        estimatedDuration: string;
        timeDefense: string;
        allowedTimeWindows: string;
        splitUpBlock: string;
    };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: OkrPersistenceConfig = {
    objectivesFolder: 'OKRs/Objectives',
    keyResultsFolder: 'OKRs/KeyResults',
    projectsFolder: 'OKRs/Projects',
    sprintsFolder: 'OKRs/Sprints',
    
    objectiveTemplate: '${year}-${title}-${id}',
    keyResultTemplate: '${year}-${objectiveTitle}-${title}-${id}',
    projectTemplate: '${year}-${keyResultTitle}-${title}-${id}',
    sprintTemplate: 'SB-${sprintNumber}-${month}M-${quarter}Q-${year}Y',
    
    metadataFields: {
        id: 'id',
        status: 'status',
        priority: 'priority',
        progress: 'progress',
        startDate: 'start_date',
        endDate: 'end_date',
        dueDate: 'due_date',
        parent: 'parent',
        tags: 'tags',
        estimatedDuration: 'estimated_duration',
        timeDefense: 'time_defense',
        allowedTimeWindows: 'allowed_time_windows',
        splitUpBlock: 'split_up_block'
    }
};

/**
 * Base class for all persistence managers
 */
export abstract class BasePersistenceManager {
    protected app: App;
    protected config: OkrPersistenceConfig;
    
    constructor(app: App, config: OkrPersistenceConfig) {
        this.app = app;
        this.config = config;
    }
    
    /**
     * Update the manager configuration
     * @param config New configuration options
     */
    updateConfig(config: Partial<OkrPersistenceConfig>) {
        this.config = {
            ...this.config,
            ...config,
            metadataFields: {
                ...this.config.metadataFields,
                ...(config.metadataFields || {})
            }
        };
    }
}