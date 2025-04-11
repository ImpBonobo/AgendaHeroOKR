import { Task } from '../../../main';
import AgendaHeroOKRPlugin from '../../../main';

/**
 * Manages filter UI and filtering logic for the task list
 */
export class TaskListFilterManager {
    plugin: AgendaHeroOKRPlugin;
    filterContainer: HTMLElement;
    projectsCache: Set<string> = new Set();
    
    /**
     * Constructor
     * @param plugin Plugin instance
     * @param filterContainer Container element for filters
     */
    constructor(plugin: AgendaHeroOKRPlugin, filterContainer: HTMLElement) {
        this.plugin = plugin;
        this.filterContainer = filterContainer;
    }
    
    /**
     * Create the filter UI
     */
    createFilterUI() {
        // Heading
        this.filterContainer.createEl('h3', { text: 'Filters' });
        
        // Status filter
        const statusFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-okr-filter-group' });
        statusFilter.createEl('label', { text: 'Status:' });
        
        const statusSelect = statusFilter.createEl('select');
        statusSelect.createEl('option', { text: 'All', value: 'all' });
        statusSelect.createEl('option', { text: 'Open', value: 'open' });
        statusSelect.createEl('option', { text: 'Completed', value: 'completed' });
        
        // Priority filter
        const priorityFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-okr-filter-group' });
        priorityFilter.createEl('label', { text: 'Priority:' });
        
        const prioritySelect = priorityFilter.createEl('select');
        prioritySelect.createEl('option', { text: 'All', value: 'all' });
        prioritySelect.createEl('option', { text: 'High (1)', value: '1' });
        prioritySelect.createEl('option', { text: 'Medium (2)', value: '2' });
        prioritySelect.createEl('option', { text: 'Normal (3)', value: '3' });
        prioritySelect.createEl('option', { text: 'Low (4)', value: '4' });
        
        // Source filter (files/folders)
        const sourceFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-okr-filter-group' });
        sourceFilter.createEl('label', { text: 'Source:' });
        
        const sourceSelect = sourceFilter.createEl('select');
        sourceSelect.createEl('option', { text: 'All', value: 'all' });
        
        // Tag filter
        const tagFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-okr-filter-group' });
        tagFilter.createEl('label', { text: 'Tag:' });
        
        const tagSelect = tagFilter.createEl('select');
        tagSelect.createEl('option', { text: 'All', value: 'all' });
        
        // Add configured tags as options
        this.plugin.settings.taskTags.forEach(tag => {
            tagSelect.createEl('option', { text: tag, value: tag });
        });
        
        // Search field
        const searchFilter = this.filterContainer.createDiv({ cls: 'agenda-hero-okr-filter-group' });
        searchFilter.createEl('label', { text: 'Search:' });
        
        searchFilter.createEl('input', { type: 'text' });
    }
    
    /**
     * Get filtered tasks based on current filter settings
     * @param viewFilter Optional additional view filter (today, upcoming)
     * @returns Filtered tasks array
     */
    getFilteredTasks(viewFilter?: string): Task[] {
        // Get status filter
        const statusSelect = this.filterContainer.querySelector('select:nth-child(2)') as HTMLSelectElement;
        const statusFilter = statusSelect ? statusSelect.value : 'all';
        
        // Get priority filter
        const prioritySelect = this.filterContainer.querySelector('select:nth-child(4)') as HTMLSelectElement;
        const priorityFilter = prioritySelect ? prioritySelect.value : 'all';
        
        // Get source filter
        const sourceSelect = this.filterContainer.querySelector('select:nth-child(6)') as HTMLSelectElement;
        const sourceFilter = sourceSelect ? sourceSelect.value : 'all';
        
        // Get tag filter
        const tagSelect = this.filterContainer.querySelector('.agenda-hero-okr-filter-group:nth-child(4) select') as HTMLSelectElement;
        const tagFilter = tagSelect ? tagSelect.value : 'all';
        
        // Get search filter
        const searchInput = this.filterContainer.querySelector('input') as HTMLInputElement;
        const searchFilter = searchInput ? searchInput.value.toLowerCase() : '';
        
        // Filter tasks
        let filteredTasks = this.plugin.tasks.filter(task => {
            // Status filter
            if (statusFilter === 'open' && task.completed) return false;
            if (statusFilter === 'completed' && !task.completed) return false;
            
            // Priority filter
            if (priorityFilter !== 'all' && task.priority !== parseInt(priorityFilter)) return false;
            
            // Source filter
            if (sourceFilter !== 'all' && !task.sourcePath.includes(sourceFilter)) return false;
            
            // Tag filter
            if (tagFilter !== 'all' && !task.content.includes(tagFilter)) return false;
            
            // Search filter
            if (searchFilter && !task.content.toLowerCase().includes(searchFilter)) return false;
            
            return true;
        });
        
        // Additional filtering based on viewFilter
        if (viewFilter) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);
            
            if (viewFilter === 'today') {
                // Only show tasks for today
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    
                    return taskDate.getTime() === today.getTime();
                });
            } else if (viewFilter === 'upcoming') {
                // Only show upcoming tasks (today + next 7 days)
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    
                    const taskDate = new Date(task.dueDate);
                    taskDate.setHours(0, 0, 0, 0);
                    
                    return taskDate >= today && taskDate < nextWeek;
                });
            }
        }
        
        return filteredTasks;
    }
    
    /**
     * Update the project filter with available projects
     * @param projects Array of project names
     */
    updateProjectFilter(projects: string[]) {
        // Find source filter
        const sourceFilter = this.filterContainer.querySelector('.agenda-hero-okr-filter-group:nth-child(3)');
        if (!sourceFilter) return;
        
        // Find select element
        const sourceSelect = sourceFilter.querySelector('select');
        if (!sourceSelect) return;
        
        // Store currently selected value
        const currentValue = sourceSelect.value;
        
        // Remove all options except "All"
        while (sourceSelect.options.length > 1) {
            sourceSelect.remove(1);
        }
        
        // Sort projects
        projects.sort();
        
        // Add projects as options
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.text = project;
            sourceSelect.add(option);
            
            // If this project was previously selected, select it again
            if (project === currentValue) {
                option.selected = true;
            }
        });
    }
    
    /**
     * Update projects cache
     */
    updateProjectsCache() {
        this.projectsCache.clear();
        this.plugin.tasks.forEach(task => {
            const project = this.getProjectFromPath(task.sourcePath);
            if (project) {
                this.projectsCache.add(project);
            }
        });
    }
    
    /**
     * Extract project name from file path
     * @param path The file path
     * @returns The project name (filename without extension)
     */
    getProjectFromPath(path: string): string | null {
        if (!path) return null;
        
        // Extract filename (without path)
        const fileName = path.split('/').pop();
        if (!fileName) return null;
        
        // Remove extension
        return fileName.replace(/\.[^/.]+$/, '');
    }
}