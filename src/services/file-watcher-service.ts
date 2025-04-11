/**
 * File Watcher Service
 * 
 * This service is responsible for watching file changes in the vault
 * and notifying other services about relevant changes.
 */

import { App, TFile } from 'obsidian';
import { OkrPersistenceService } from './okr-persistence-service';
import { TaskOperationsService } from './task-operations-service';
import { OkrOperationsService } from './okr-operations-service';

/**
 * Watches file changes and notifies relevant services
 */
export class FileWatcherService {
    private app: App;
    private persistenceService: OkrPersistenceService;
    private taskOperationsService: TaskOperationsService;
    private okrOperationsService: OkrOperationsService;
    
    constructor(
        app: App,
        persistenceService: OkrPersistenceService,
        taskOperationsService: TaskOperationsService,
        okrOperationsService: OkrOperationsService
    ) {
        this.app = app;
        this.persistenceService = persistenceService;
        this.taskOperationsService = taskOperationsService;
        this.okrOperationsService = okrOperationsService;
        
        console.log('File Watcher Service initialized');
    }
    
    // Store callback references for proper event removal
    private modifyCallback: (file: TFile) => void;
    private deleteCallback: (file: TFile) => void;

    /**
     * Start watching for file changes
     */
    startWatching(): void {
        // Define callbacks and store references to them
        this.modifyCallback = (file: any) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileChange(file);
            }
        };
        
        this.deleteCallback = (file: any) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.handleFileDelete(file);
            }
        };
        
        // Register the event handlers
        this.app.vault.on('modify', this.modifyCallback);
        this.app.vault.on('delete', this.deleteCallback);
        
        console.log('File Watcher started');
    }
    
    /**
     * Stop watching for file changes
     */
    stopWatching(): void {
        // Remove the event handlers using the stored callback references
        this.app.vault.off('modify', this.modifyCallback);
        this.app.vault.off('delete', this.deleteCallback);
        
        console.log('File Watcher stopped');
    }
    
    /**
     * Handle file change event
     * @param file The modified file
     */
    private async handleFileChange(file: TFile): Promise<void> {
        // Check if this file is relevant to our OKR system
        const okrFolders = [
            this.persistenceService.getConfig().objectivesFolder,
            this.persistenceService.getConfig().keyResultsFolder,
            this.persistenceService.getConfig().projectsFolder,
            this.persistenceService.getConfig().sprintsFolder
        ];
        
        // Determine file type
        const isObjectiveFile = file.path.startsWith(this.persistenceService.getConfig().objectivesFolder);
        const isKeyResultFile = file.path.startsWith(this.persistenceService.getConfig().keyResultsFolder);
        const isProjectFile = file.path.startsWith(this.persistenceService.getConfig().projectsFolder);
        const isSprintFile = file.path.startsWith(this.persistenceService.getConfig().sprintsFolder);
        const isOkrFile = isObjectiveFile || isKeyResultFile || isProjectFile || isSprintFile;
        
        if (isOkrFile) {
            // Since it's an OKR file, reload all data
            await this.okrOperationsService.loadAll();
        } else {
            // Check if it might be a task file
            await this.taskOperationsService.handleFileChange(file);
        }
    }
    
    /**
     * Handle file deletion event
     * @param file The deleted file
     */
    private async handleFileDelete(file: TFile): Promise<void> {
        // Determine file type
        const isObjectiveFile = file.path.startsWith(this.persistenceService.getConfig().objectivesFolder);
        const isKeyResultFile = file.path.startsWith(this.persistenceService.getConfig().keyResultsFolder);
        const isProjectFile = file.path.startsWith(this.persistenceService.getConfig().projectsFolder);
        const isSprintFile = file.path.startsWith(this.persistenceService.getConfig().sprintsFolder);
        
        if (isObjectiveFile || isKeyResultFile || isProjectFile || isSprintFile) {
            // Since it's an OKR file, reload all data
            await this.okrOperationsService.loadAll();
        } else {
            // Check if it might be a task file
            await this.taskOperationsService.handleFileDelete(file);
        }
    }
}