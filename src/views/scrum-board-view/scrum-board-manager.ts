import { App, Notice } from 'obsidian';
import AgendaHeroOKRPlugin from '../../../main';

/**
 * Interface for ScrumBoard
 */
export interface ScrumBoard {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    sprintNumber: number;
    month: number;
    quarter: number;
    year: number;
}

/**
 * Interface for ScrumColumn
 */
export interface ScrumColumn {
    id: string;
    title: string;
    status: string;
    visible: boolean;
}

/**
 * Manages Scrum Board creation, loading, and configuration
 */
export class ScrumBoardManager {
    private plugin: AgendaHeroOKRPlugin;
    private app: App;
    private currentBoard: ScrumBoard | null = null;
    private columns: ScrumColumn[] = [
        { id: 'next-up', title: 'Next Up', status: 'next-up', visible: true },
        { id: 'waiting-on', title: 'Waiting On', status: 'waiting-on', visible: true },
        { id: 'validating', title: 'Validating', status: 'validating', visible: true },
        { id: 'completed', title: 'Completed', status: 'completed', visible: true },
        { id: 'canceled', title: 'Canceled', status: 'canceled', visible: true }
    ];
    
    /**
     * Constructor
     * @param plugin The plugin instance
     * @param app The Obsidian app instance
     */
    constructor(plugin: AgendaHeroOKRPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
    }
    
    /**
     * Initialize the current board
     */
    async initializeCurrentBoard(): Promise<void> {
        // Create a new board for the current sprint if none exists
        const today = new Date();
        const startDate = new Date(today);
        const endDate = new Date(today);
        
        // Set start date to the beginning of the current sprint
        // (assuming 2-week sprints starting on the 1st and 15th of each month)
        if (today.getDate() < 15) {
            startDate.setDate(1);
        } else {
            startDate.setDate(15);
        }
        
        // Set end date to the end of the current sprint
        if (today.getDate() < 15) {
            endDate.setDate(14);
        } else {
            // Set to last day of the month
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
        }
        
        // Calculate sprint number (1 or 2 for the month)
        const sprintNumber = today.getDate() < 15 ? 1 : 2;
        
        // Calculate quarter (1-4)
        const quarter = Math.floor(today.getMonth() / 3) + 1;
        
        this.currentBoard = {
            id: `${today.getFullYear()}-${today.getMonth() + 1}-${sprintNumber}`,
            title: `${sprintNumber}SB ${today.getMonth() + 1}M ${quarter}Q ${today.getFullYear()}Y`,
            startDate: startDate,
            endDate: endDate,
            sprintNumber: sprintNumber,
            month: today.getMonth() + 1,
            quarter: quarter,
            year: today.getFullYear()
        };
    }
    
    /**
     * Create a new board for the next sprint
     */
    createNewBoard(): void {
        // This is a placeholder implementation
        new Notice('Creating new sprint board...');
        
        // In a real implementation, you would:
        // 1. Save the current board to a file
        // 2. Create a new board for the next sprint
        // 3. Move incomplete tasks to the new board
        // 4. Update the UI
    }
    
    /**
     * Get the current board
     * @returns The current board or null
     */
    getCurrentBoard(): ScrumBoard | null {
        return this.currentBoard;
    }
    
    /**
     * Get all available columns
     * @returns Array of columns
     */
    getColumns(): ScrumColumn[] {
        return this.columns;
    }
    
    /**
     * Get visible columns
     * @returns Array of visible columns
     */
    getVisibleColumns(): ScrumColumn[] {
        return this.columns.filter(column => column.visible);
    }
    
    /**
     * Set column visibility
     * @param columnId ID of the column
     * @param visible Visibility state
     */
    setColumnVisibility(columnId: string, visible: boolean): void {
        const column = this.columns.find(c => c.id === columnId);
        if (column) {
            column.visible = visible;
        }
    }
    
    /**
     * Get column title by ID
     * @param columnId ID of the column
     * @returns Title of the column or 'Unknown'
     */
    getColumnTitle(columnId: string): string {
        const column = this.columns.find(c => c.id === columnId);
        return column ? column.title : 'Unknown';
    }
    
    /**
     * Get status from column ID
     * @param columnId ID of the column
     * @returns Status string
     */
    getStatusFromColumnId(columnId: string): string {
        switch (columnId) {
            case 'next-up': return 'next-up';
            case 'in-progress': return 'in-progress';
            case 'waiting-on': return 'waiting-on';
            case 'validating': return 'validating';
            case 'completed': return 'completed';
            case 'canceled': return 'canceled';
            default: return 'next-up';
        }
    }
}