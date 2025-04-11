import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView } from 'src/views/calendar-view/calendar-view';
import { TaskListView } from 'src/views/task-list-view/task-list-view';
import { ScrumBoardView } from './src/views/scrum-board-view/scrum-board-view';
import { TestView } from './src/views/test-view/test-view';
import { OkrService } from './src/services/okr-service';
import { TimeWindow } from './src/models/okr-models';
import { OkrHierarchyView } from './src/views/okr-hierarchy-view/okr-hierarchy-view';
import * as path from 'path';

 
// Import the Anthropic Batch API
const { sendBatchRequests } = require('./src/utils/anthropic-batch');

// Interfaces
export interface AgendaHeroOKRSettings {
    taskSources: string[];
    defaultView: string;
    showWeekNumbers: boolean;
    workingHours: {
        start: number;
        end: number;
    };
    use24HourFormat: boolean; // Time format setting
    defaultTaskTime: number; // Default hour for tasks without time specification
    defaultTaskMinute: number; // Default minute for tasks without time specification
    customDateFormats: string[]; // Custom regex patterns for date formats
    taskTags: string[]; // Tags that identify a task
    templateStartKeyword: string; // Keyword at the beginning of title (e.g., "New")
    templateEndKeyword: string; // Keyword at the end of title (e.g., "Template")
    includeTemplates: boolean; // Option to include templates
    enableAnthropicIntegration: boolean; // Option to enable/disable Anthropic integration
    anthropicApiKeyPath: string; // Path to API key file
    
    // OKR specific settings
    objectivesFolder: string;
    keyResultsFolder: string;
    projectsFolder: string;
    sprintsFolder: string;
    timeWindows: TimeWindow[];
    showCompletedObjectives: boolean;
    showCompletedKeyResults: boolean;
    autoLinkTasks: boolean;
    autoCalculateProgress: boolean;
    useSmartScheduling: boolean;
    defaultSprintDuration: number; // In days
    sprintStartDay: number; // 0-6, where 0 is Sunday
}

const DEFAULT_SETTINGS: AgendaHeroOKRSettings = {
    taskSources: ["Markdown Checkboxes"],
    defaultView: "dayGridMonth", // Changed from "week" to "dayGridMonth" as default
    showWeekNumbers: true,
    workingHours: {
        start: 9,
        end: 18
    },
    use24HourFormat: true, // Default: 24-hour format
    defaultTaskTime: 9, // Default: 9 AM
    defaultTaskMinute: 0, // Default: 0 minutes
    customDateFormats: [], // No custom formats by default
    taskTags: ["#task", "#todo"], // Default task tags
    templateStartKeyword: "New", // Default start keyword for templates
    templateEndKeyword: "Template", // Default end keyword for templates
    includeTemplates: false, // Exclude templates by default
    enableAnthropicIntegration: false, // Anthropic integration disabled by default
    anthropicApiKeyPath: '/Users/bob/Documents/API-Keys/Anthropic/privateAPIKey.txt', // Default path
    
    // OKR specific settings
    objectivesFolder: 'OKRs/Objectives',
    keyResultsFolder: 'OKRs/KeyResults',
    projectsFolder: 'OKRs/Projects',
    sprintsFolder: 'OKRs/Sprints',
    timeWindows: [
        {
            id: 'work',
            name: 'Work Hours',
            color: '#3498db',
            schedule: [
                // Monday through Friday
                ...Array.from({length: 5}, (_, i) => ({
                    day: i + 1, // 1-5 (Monday-Friday)
                    ranges: [{
                        start: '09:00',
                        end: '17:00'
                    }]
                }))
            ],
            priority: 10
        },
        {
            id: 'personal',
            name: 'Personal Time',
            color: '#2ecc71',
            schedule: [
                // Every day
                ...Array.from({length: 7}, (_, i) => ({
                    day: i, // 0-6 (Sunday-Saturday)
                    ranges: [{
                        start: '05:00',
                        end: '23:00'
                    }]
                }))
            ],
            priority: 5
        }
    ],
    showCompletedObjectives: true,
    showCompletedKeyResults: true,
    autoLinkTasks: true,
    autoCalculateProgress: true,
    useSmartScheduling: true,
    defaultSprintDuration: 14, // 2 weeks
    sprintStartDay: 1 // Monday
}

// Task Interface
export interface Task {
    id: string;
    title: string;
    description?: string;
    content: string;
    completed: boolean;
    dueDate: Date | null;
    creationDate: Date;
    priority: number; // 1-4, with 1 being the highest priority
    tags?: string[];
    sourcePath: string; // File path in the vault
    recurring: boolean;
    recurrenceRule?: string; // RRULE format for recurring tasks
    status?: string;
    projectId?: string;
    estimatedDuration?: number; // Duration in minutes
    timeDefense?: 'always-busy' | 'always-free';
    allowedTimeWindows?: string[];
    splitUpBlock?: number;
}

export default class AgendaHeroOKRPlugin extends Plugin {
    settings: AgendaHeroOKRSettings;
    tasks: Task[] = [];
    okrService: OkrService;
    okrServiceInitialized: boolean = false;

    async onload() {
        await this.loadSettings();
        
        // Initialize OKR service
        this.okrService = new OkrService(this.app);

        // Test view registration (for easy diagnosis)
        this.registerView(
            'agenda-hero-okr-test',
            (leaf) => new TestView(leaf, this)
        );

        // Main view (Calendar view) registration
        this.registerView(
            'agenda-hero-okr-calendar',
            (leaf) => new CalendarView(leaf, this)
        );

        // Sidebar for tasks registration
        this.registerView(
            'agenda-hero-okr-tasklist',
            (leaf) => new TaskListView(leaf, this)
        );
        
        // Scrum board view registration
        this.registerView(
            'agenda-hero-okr-scrumboard',
            (leaf) => new ScrumBoardView(leaf, this)
        );

        // Ribbon icon to open test view
        this.addRibbonIcon('bug', 'Open AgendaHeroOKR Test', () => {
            try {
                this.activateView('agenda-hero-okr-test');
                new Notice('Opening AgendaHeroOKR Test view...');
            } catch (error) {
                new Notice(`Error opening Test view: ${error.message}`);
                console.error('Error opening Test view:', error);
            }
        });

        // Ribbon icon to open calendar view
        this.addRibbonIcon('calendar-with-checkmark', 'Open AgendaHeroOKR Calendar', () => {
            try {
                // Open calendar and task list side by side
                this.openCalendarWithTasklist();
                new Notice('Opening AgendaHeroOKR Calendar...');
            } catch (error) {
                new Notice(`Error opening Calendar view: ${error.message}`);
                console.error('Error opening Calendar view:', error);
            }
        });

        // Command to open calendar view
        this.addCommand({
            id: 'open-agenda-hero-okr-calendar',
            name: 'Open AgendaHeroOKR Calendar',
            callback: () => {
                this.activateView('agenda-hero-okr-calendar');
            }
        });

        // Command to open task list
        this.addCommand({
            id: 'open-agenda-hero-okr-tasklist',
            name: 'Open AgendaHeroOKR Task List',
            callback: () => {
                this.activateView('agenda-hero-okr-tasklist');
            }
        });
        
        // Command to open scrum board
        this.addCommand({
            id: 'open-agenda-hero-okr-scrumboard',
            name: 'Open AgendaHeroOKR Scrum Board',
            callback: () => {
                this.activateView('agenda-hero-okr-scrumboard');
            }
        });

        // Command to open calendar and task list side by side
        this.addCommand({
            id: 'open-agenda-hero-okr-combined',
            name: 'Open AgendaHeroOKR Calendar with Task List',
            callback: () => {
                this.openCalendarWithTasklist();
            }
        });

        // Command to open test view
        this.addCommand({
            id: 'open-agenda-hero-okr-test',
            name: 'Open AgendaHero-okr Test View',
            callback: () => {
                this.activateView('agenda-hero-okr-test');
            }
        });

        // Command to generate task suggestions
        this.addCommand({
            id: 'generate-task-suggestions',
            name: 'Generate Task Suggestions with Anthropic API',
            callback: () => {
                this.generateTaskSuggestions(this.tasks);
            }
        });

        // Add settings
        this.addSettingTab(new AgendaHeroOKRSettingTab(this.app, this));

        // Initial task loading
        await this.loadTasks();

        // Event listener for file changes to keep tasks current
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.updateTasksFromFile(file);
                }
            })
        );

        // Event listener for new files
        this.registerEvent(
            this.app.vault.on('create', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.extractTasksFromFile(file);
                    this.notifyTasksUpdated();
                }
            })
        );

        // Event listener for deleted files
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    // Remove all tasks from this file
                    this.tasks = this.tasks.filter(task => task.sourcePath !== file.path);
                    this.notifyTasksUpdated();
                }
            })
        );

        // OKR Hierarchy view registration
        this.registerView(
            'agenda-hero-okr-hierarchy',
            (leaf) => new OkrHierarchyView(leaf, this)
        );

        // Command to open OKR Hierarchy view
        this.addCommand({
            id: 'open-agenda-hero-okr-hierarchy',
            name: 'Open OKR Hierarchy',
            callback: () => {
                this.activateView('agenda-hero-okr-hierarchy');
            }
        });

        // Ribbon icon for OKR Hierarchy
        this.addRibbonIcon('target', 'Open OKR Hierarchy', () => {
            this.activateView('agenda-hero-okr-hierarchy');
        });

        this.okrService.importMarkdownTasks();

        // Success message
        new Notice('AgendaHeroOKR has been loaded!');
    }
    
    /**
     * Opens the calendar and task list side by side
     */
    /**
 * Opens the calendar and task list side by side
 */
async openCalendarWithTasklist() {
    try {
        // First, load tasks to ensure they're available
        await this.loadTasks();
        
        // Find current leaf
        const leaf = this.app.workspace.getLeaf();
        
        // Open calendar in this leaf
        await leaf.setViewState({
            type: 'agenda-hero-okr-calendar',
            active: true,
        });
        
        // Create new leaf for task list (to the right of calendar)
        const taskLeaf = this.app.workspace.splitActiveLeaf('vertical');
        
        // Open task list in this leaf
        await taskLeaf.setViewState({
            type: 'agenda-hero-okr-tasklist',
            active: false,
        });
        
        // Force tasks to be updated in views
        this.notifyTasksUpdated();
        
        // Adjust width of task list (make it narrower)
        // Wait a moment for the DOM to update
        setTimeout(() => {
            // Find the DOM element of the leaf
            const taskLeafEl = document.querySelector(`.workspace-leaf[data-type="agenda-hero-okr-tasklist"]`) as HTMLElement;
            if (taskLeafEl) {
                taskLeafEl.style.width = '300px';
                taskLeafEl.style.minWidth = '250px';
                taskLeafEl.style.maxWidth = '350px';
                taskLeafEl.style.flexGrow = '0';
                taskLeafEl.style.flexShrink = '0';
            }
        }, 100);
        
        // Switch back to calendar
        this.app.workspace.setActiveLeaf(leaf);
        
        console.log('Calendar and task list opened successfully side by side');
    } catch (error) {
        console.error('Error opening calendar and task list:', error);
        new Notice(`Error opening calendar and task list: ${error.message}`);
    }
}

    onunload() {
        // Clean up when plugin is deactivated
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(viewType: string) {
        try {
            // Check if the view is already open
            const existingLeaves = this.app.workspace.getLeavesOfType(viewType);
            if (existingLeaves.length > 0) {
                // If so, activate it
                this.app.workspace.revealLeaf(existingLeaves[0]);
                console.log(`Existing view ${viewType} activated`);
                return;
            }

            // Open new view
            const leaf = this.app.workspace.getLeaf(true); // true for new view in split
            if (leaf) {
                await leaf.setViewState({
                    type: viewType,
                    active: true,
                });
                console.log(`New view ${viewType} opened`);
            } else {
                console.error('Could not find a leaf to open the view');
                new Notice('Could not find a leaf to open the view');
            }
        } catch (error) {
            console.error(`Error activating view ${viewType}:`, error);
            new Notice(`Error: ${error.message}`);
        }
    }

    // Task management methods
    async loadTasks() {
        try {
            console.log("Starting task loading...");
            this.tasks = []; // Reset tasks
            
            // Loop through all markdown files, filter out templates
            const files = this.app.vault.getMarkdownFiles()
                .filter(file => {
                    // If templates should be included, process all files
                    if (this.settings.includeTemplates) return true;
                    
                    // Check if the file is a template
                    const startKeyword = this.settings.templateStartKeyword.trim();
                    const endKeyword = this.settings.templateEndKeyword.trim();
                    
                    // If both keywords are empty, don't filter
                    if (!startKeyword && !endKeyword) return true;
                    
                    // Check if filename starts with start keyword (if present)
                    const startsWithKeyword = !startKeyword || file.basename.startsWith(startKeyword);
                    
                    // Check if filename ends with end keyword (if present)
                    const endsWithKeyword = !endKeyword || file.basename.endsWith(endKeyword);
                    
                    // Only include files that are NOT templates
                    return !(startsWithKeyword && endsWithKeyword);
                });
            
            console.log(`${files.length} Markdown files found (after template filtering)`);
            
            for (const file of files) {
                try {
                    await this.extractTasksFromFile(file);
                } catch (fileError) {
                    console.error(`Error extracting tasks from ${file.path}:`, fileError);
                }
            }
            
            console.log(`Total of ${this.tasks.length} tasks loaded`);
            
            // Notify views of update
            this.notifyTasksUpdated();
        } catch (error) {
            console.error("Error loading tasks:", error);
            new Notice(`Error loading tasks: ${error.message}`);
        }
    }

    async extractTasksFromFile(file: TFile) {
        try {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            console.log(`Analyzing file: ${file.path} (${lines.length} lines)`);
            
            // Simple regex for Markdown checkboxes
            const taskRegex = /- \[([ xX])\] (.*)/g;
            
            // Predefined regex patterns for date formats
            const datePatterns = [
                // @due format
                { regex: /@due\((\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?\)/, timeGroup: 2, name: "due" },
                // Emoji format with optional priority
                { regex: /(?:[⏫🔽][ ]?)?[📅⏳🛫][ ]?(\d{4}-\d{2}-\d{2})/, timeGroup: null, name: "emoji" },
                // Property format (due::, start::, scheduled::)
                { regex: /(?:due|start|scheduled)::[ ]?(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?/, timeGroup: 2, name: "property" }
            ];
            
            // Add custom patterns
            for (const pattern of this.settings.customDateFormats) {
                try {
                    datePatterns.push({ 
                        regex: new RegExp(pattern), 
                        timeGroup: null, 
                        name: "custom" 
                    });
                } catch (e) {
                    console.error(`Invalid regex pattern: ${pattern}`, e);
                }
            }
            
            // Check if a task has relevant tags
            const hasRelevantTag = (content: string): boolean => {
                for (const tag of this.settings.taskTags) {
                    if (content.includes(tag)) return true;
                }
                return false;
            };
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Reset lastIndex for the regex
                taskRegex.lastIndex = 0;
                
                let match;
                while ((match = taskRegex.exec(line)) !== null) {
                    const completed = match[1].toLowerCase() === 'x';
                    const content = match[2];
                    
                    console.log(`Task found: "${content}" in ${file.path}`);
                    
                    // Date parsing with all patterns
                    let dueDate: Date | null = null;
                    let recurring = false;
                    let recurrenceRule = '';
                    let dateFormatFound = '';
                    
                    // Check all date formats
                    for (const pattern of datePatterns) {
                        const dateMatch = content.match(pattern.regex);
                        if (dateMatch) {
                            dueDate = new Date(dateMatch[1]);
                            
                            // Add time if present
                            if (pattern.timeGroup && dateMatch[pattern.timeGroup]) {
                                const [hours, minutes] = dateMatch[pattern.timeGroup].split(':').map(Number);
                                dueDate.setHours(hours, minutes, 0, 0);
                            } else {
                                // Use default time
                                dueDate.setHours(this.settings.defaultTaskTime, this.settings.defaultTaskMinute, 0, 0);
                            }
                            
                            dateFormatFound = pattern.name;
                            console.log(`Due date found (${pattern.name}): ${dueDate.toLocaleString()}`);
                            break;
                        }
                    }
                    
                    // Check for recurrence pattern
                    const recurrenceMatch = content.match(/🔁 (every .*?)(?:\s|$)/);
                    if (recurrenceMatch) {
                        recurring = true;
                        recurrenceRule = recurrenceMatch[1];
                        console.log(`Recurrence pattern found: ${recurrenceRule}`);
                    }
                    
                    // Check if task is relevant (has date, priority, or specific tags)
                    const hasPriority = this.extractPriority(content) < 4; // Priority 1-3 is relevant
                    const isRelevant = dueDate !== null || hasPriority || hasRelevantTag(content) || recurring;
                    
                    // Only add relevant tasks
                    if (isRelevant) {
                        // Create task
                        const task: Task = {
                            id: `${file.path}-${i}`,
                            title: content,
                            content: content,
                            completed: completed,
                            dueDate: dueDate,
                            creationDate: new Date(),
                            priority: this.extractPriority(content),
                            sourcePath: file.path,
                            recurring: recurring || content.includes('@recurring'),
                            recurrenceRule: recurring ? recurrenceRule : undefined
                        };
                        
                        this.tasks.push(task);
                    } else {
                        console.log(`Task skipped (not relevant): "${content}"`);
                    }
                }
            }
            
            console.log(`${this.tasks.length} tasks found in ${file.path}`);
        } catch (error) {
            console.error(`Error reading file ${file.path}:`, error);
            throw error; // Pass error on for higher-level error handling
        }
    }
    

    extractPriority(content: string): number {
        // Extract priority from task content
        // Example: !1 for priority 1
        const priorityMatch = content.match(/!([1-4])/);
        return priorityMatch ? parseInt(priorityMatch[1]) : 4; // Default: lowest priority
    }

    async updateTasksFromFile(file: TFile) {
        // Remove all tasks from this file
        this.tasks = this.tasks.filter(task => task.sourcePath !== file.path);
        
        // Extract tasks again
        await this.extractTasksFromFile(file);
        
        // Notify views
        this.notifyTasksUpdated();
    }

    notifyTasksUpdated() {
        // Trigger an event so views update
        this.app.workspace.trigger('agenda-hero-okr:tasks-updated');
    }

    async updateTaskInFile(task: Task) {
        // Update a task in the source file
        const file = this.app.vault.getAbstractFileByPath(task.sourcePath);
        
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            // Find the line with the task
            const taskIdParts = task.id.split('-');
            const lineIndex = parseInt(taskIdParts[taskIdParts.length - 1]);
            
            if (lineIndex < lines.length) {
                // Replace the old task with the updated task
                const completedMark = task.completed ? 'x' : ' ';
                
                // Format date with time if present
                let dueDateStr = '';
                if (task.dueDate) {
                    const hasTime = task.dueDate.getHours() !== 0 || task.dueDate.getMinutes() !== 0;
                    if (hasTime) {
                        const dateStr = task.dueDate.toISOString().split('T')[0];
                        const timeStr = task.dueDate.toTimeString().substr(0, 5); // Format HH:MM
                        dueDateStr = `@due(${dateStr} ${timeStr})`;
                    } else {
                        dueDateStr = `@due(${task.dueDate.toISOString().split('T')[0]})`;
                    }
                }
                
                const priorityStr = task.priority < 4 ? `!${task.priority}` : '';
                const recurringStr = task.recurring ? '@recurring' : '';
                
                // Extract main content of task (without metadata)
                let mainContent = task.content;
                mainContent = mainContent.replace(/@due\(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\)/, '');
                mainContent = mainContent.replace(/![1-4]/, '');
                mainContent = mainContent.replace(/@recurring/, '');
                mainContent = mainContent.trim();
                
                // New task with updated metadata
                lines[lineIndex] = `- [${completedMark}] ${mainContent} ${dueDateStr} ${priorityStr} ${recurringStr}`.trim();
                
                // Write the update back
                await this.app.vault.modify(file, lines.join('\n'));
            }
        }
    }

    /**
     * Generates suggestions for tasks using the Anthropic Batch API
     * @param tasks The tasks to generate suggestions for
     * @returns The results of the batch request
     */
    async generateTaskSuggestions(tasks: Task[]) {
        // Check if Anthropic integration is enabled
        if (!this.settings.enableAnthropicIntegration) {
            new Notice('Anthropic integration is disabled. Please enable it in settings.');
            return;
        }
        
        // Example: Generate descriptions for tasks without description
        const tasksWithoutDescription = tasks.filter(task => 
            task.content.trim().length < 20 || task.content.includes('TODO')
        );
        
        if (tasksWithoutDescription.length === 0) {
            new Notice('No tasks found for suggestions');
            return;
        }
        
        // Prepare batch requests
        const requests = tasksWithoutDescription.map(task => ({
            customId: task.id,
            model: "claude-3-5-haiku-20241022",
            maxTokens: 100,
            prompt: `Create a detailed description for a task with the title: "${task.content}"`
        }));
        
        try {
            // Output path in temporary directory
            const outputPath = require('os').tmpdir() + '/task-suggestions.json';
            
            // Send batch requests and pass settings
            const results = await sendBatchRequests(requests, outputPath, this.settings);
            
            // Process results
            new Notice(`${results.responses?.length || 0} task suggestions generated`);
            
            // Here you could process the results further, e.g., display in UI
            // or automatically update the tasks
            
            return results;
        } catch (error) {
            console.error('Error in batch processing:', error);
            new Notice(`Error generating task suggestions: ${error.message}`);
        }
    }
}

// Settings Tab
class AgendaHeroOKRSettingTab extends PluginSettingTab {
    plugin: AgendaHeroOKRPlugin;

    constructor(app: App, plugin: AgendaHeroOKRPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'AgendaHeroOKR Settings'});
        
        // Tab buttons for different setting sections
        const tabContainer = containerEl.createDiv({ cls: 'agenda-hero-okr-settings-tabs' });
        tabContainer.style.display = 'flex';
        tabContainer.style.marginBottom = '20px';
        tabContainer.style.borderBottom = '1px solid var(--background-modifier-border)';
        
        const tabs = [
            { id: 'general', name: 'General' },
            { id: 'calendar', name: 'Calendar' },
            { id: 'tasks', name: 'Tasks' },
            { id: 'okr', name: 'OKR' },
            { id: 'timeWindows', name: 'Time Windows' },
            { id: 'advanced', name: 'Advanced' }
        ];
        
        // Create tab buttons
        const tabButtons: Record<string, HTMLElement> = {};
        tabs.forEach(tab => {
            const button = tabContainer.createEl('button', { 
                text: tab.name,
                cls: 'agenda-hero-okr-settings-tab'
            });
            button.style.padding = '8px 16px';
            button.style.marginRight = '8px';
            button.style.cursor = 'pointer';
            button.style.border = 'none';
            button.style.borderRadius = '4px 4px 0 0';
            button.style.backgroundColor = 'transparent';
            
            tabButtons[tab.id] = button;
        });
        
        // Create content containers
        const contentContainers: Record<string, HTMLElement> = {};
        tabs.forEach(tab => {
            const container = containerEl.createDiv({ cls: 'agenda-hero-okr-settings-content' });
            container.style.display = 'none'; // Hide initially
            contentContainers[tab.id] = container;
        });
        
        // Function to show a tab
        const showTab = (tabId: string) => {
            // Hide all content containers
            Object.values(contentContainers).forEach(container => {
                container.style.display = 'none';
            });
            
            // Deactivate all tab buttons
            Object.values(tabButtons).forEach(button => {
                button.style.backgroundColor = 'transparent';
                button.style.fontWeight = 'normal';
            });
            
            // Show selected content container
            contentContainers[tabId].style.display = 'block';
            
            // Activate selected tab button
            tabButtons[tabId].style.backgroundColor = 'var(--background-secondary)';
            tabButtons[tabId].style.fontWeight = 'bold';
        };
        
        // Add click handlers to tab buttons
        tabs.forEach(tab => {
            tabButtons[tab.id].addEventListener('click', () => {
                showTab(tab.id);
            });
        });
        
        // Show general tab by default
        showTab('general');
        
        // GENERAL SETTINGS
        const generalContainer = contentContainers['general'];
        generalContainer.createEl('h3', {text: 'General Settings'});
        
        new Setting(generalContainer)
            .setName('Default View')
            .setDesc('Choose the default view for the calendar')
            .addDropdown(dropdown => dropdown
                .addOption('timeGridDay', 'Day')
                .addOption('timeGridWeek', 'Week')
                .addOption('dayGridMonth', 'Month')
                .setValue(this.plugin.settings.defaultView)
                .onChange(async (value) => {
                    this.plugin.settings.defaultView = value;
                    await this.plugin.saveSettings();
                }));
        
        // CALENDAR SETTINGS
        const calendarContainer = contentContainers['calendar'];
        calendarContainer.createEl('h3', {text: 'Calendar Settings'});
                
        new Setting(calendarContainer)
            .setName('24-Hour Format')
            .setDesc('Use 24-hour format instead of 12-hour format (AM/PM)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use24HourFormat)
                .onChange(async (value) => {
                    this.plugin.settings.use24HourFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(calendarContainer)
            .setName('Show Week Numbers')
            .setDesc('Show week numbers in week and month views')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showWeekNumbers)
                .onChange(async (value) => {
                    this.plugin.settings.showWeekNumbers = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(calendarContainer)
            .setName('Work Start Time')
            .setDesc('Start time of the work day')
            .addSlider(slider => slider
                .setLimits(0, 23, 1)
                .setValue(this.plugin.settings.workingHours.start)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.workingHours.start = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(calendarContainer)
            .setName('Work End Time')
            .setDesc('End time of the work day')
            .addSlider(slider => slider
                .setLimits(0, 23, 1)
                .setValue(this.plugin.settings.workingHours.end)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.workingHours.end = value;
                    await this.plugin.saveSettings();
                }));

        // TASK SETTINGS
        const tasksContainer = contentContainers['tasks'];
        tasksContainer.createEl('h3', {text: 'Task Settings'});

        new Setting(tasksContainer)
            .setName('Default Task Hour')
            .setDesc('Default hour for tasks without time specification')
            .addSlider(slider => slider
                .setLimits(0, 23, 1)
                .setValue(this.plugin.settings.defaultTaskTime)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.defaultTaskTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(tasksContainer)
            .setName('Default Task Minute')
            .setDesc('Default minute for tasks without time specification')
            .addSlider(slider => slider
                .setLimits(0, 59, 5)
                .setValue(this.plugin.settings.defaultTaskMinute)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.defaultTaskMinute = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(tasksContainer)
            .setName('Task Tags')
            .setDesc('Tags that identify a task (one per line)')
            .addTextArea(text => text
                .setValue(this.plugin.settings.taskTags.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.taskTags = value
                        .split('\n')
                        .filter(line => line.trim().length > 0);
                    await this.plugin.saveSettings();
                }));

        // TEMPLATE SETTINGS
        tasksContainer.createEl('h4', {text: 'Template Settings'});

        new Setting(tasksContainer)
            .setName('Template Start Keyword')
            .setDesc('Keyword at the beginning of title (e.g., "New" or an emoji). Leave empty to check only the end keyword.')
            .addText(text => text
                .setValue(this.plugin.settings.templateStartKeyword)
                .onChange(async (value) => {
                    this.plugin.settings.templateStartKeyword = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(tasksContainer)
            .setName('Template End Keyword')
            .setDesc('Keyword at the end of title (e.g., "Template" or a special character). Leave empty to check only the start keyword.')
            .addText(text => text
                .setValue(this.plugin.settings.templateEndKeyword)
                .onChange(async (value) => {
                    this.plugin.settings.templateEndKeyword = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(tasksContainer)
            .setName('Include Templates')
            .setDesc('Also consider tasks in template files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeTemplates)
                .onChange(async (value) => {
                    this.plugin.settings.includeTemplates = value;
                    await this.plugin.saveSettings();
                }));
                
        // OKR SETTINGS
        const okrContainer = contentContainers['okr'];
        okrContainer.createEl('h3', {text: 'OKR System Settings'});
        
        // Folder paths
        okrContainer.createEl('h4', {text: 'File Organization'});
        
        new Setting(okrContainer)
            .setName('Objectives Folder')
            .setDesc('Path to the folder for storing objectives')
            .addText(text => text
                .setValue(this.plugin.settings.objectivesFolder)
                .onChange(async (value) => {
                    this.plugin.settings.objectivesFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(okrContainer)
            .setName('Key Results Folder')
            .setDesc('Path to the folder for storing key results')
            .addText(text => text
                .setValue(this.plugin.settings.keyResultsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.keyResultsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(okrContainer)
            .setName('Projects Folder')
            .setDesc('Path to the folder for storing projects')
            .addText(text => text
                .setValue(this.plugin.settings.projectsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.projectsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(okrContainer)
            .setName('Sprints Folder')
            .setDesc('Path to the folder for storing sprints')
            .addText(text => text
                .setValue(this.plugin.settings.sprintsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.sprintsFolder = value;
                    await this.plugin.saveSettings();
                }));
        
        // Behavior options
        okrContainer.createEl('h4', {text: 'Behavior'});
        
        new Setting(okrContainer)
            .setName('Auto-link Tasks')
            .setDesc('Automatically link tasks to projects when created')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoLinkTasks)
                .onChange(async (value) => {
                    this.plugin.settings.autoLinkTasks = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(okrContainer)
            .setName('Auto-calculate Progress')
            .setDesc('Automatically calculate progress based on completed tasks')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoCalculateProgress)
                .onChange(async (value) => {
                    this.plugin.settings.autoCalculateProgress = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(okrContainer)
            .setName('Use Smart Scheduling')
            .setDesc('Use smart scheduling for tasks')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useSmartScheduling)
                .onChange(async (value) => {
                    this.plugin.settings.useSmartScheduling = value;
                    await this.plugin.saveSettings();
                }));
        
        // Sprint configuration
        okrContainer.createEl('h4', {text: 'Sprint Configuration'});
        
        new Setting(okrContainer)
            .setName('Sprint Duration')
            .setDesc('Default duration of sprints in days')
            .addText(text => text
                .setValue(this.plugin.settings.defaultSprintDuration.toString())
                .onChange(async (value) => {
                    const intValue = parseInt(value);
                    if (!isNaN(intValue) && intValue > 0) {
                        this.plugin.settings.defaultSprintDuration = intValue;
                        await this.plugin.saveSettings();
                    }
                }));
        
        new Setting(okrContainer)
            .setName('Sprint Start Day')
            .setDesc('Day of the week when sprints start')
            .addDropdown(dropdown => dropdown
                .addOption('0', 'Sunday')
                .addOption('1', 'Monday')
                .addOption('2', 'Tuesday')
                .addOption('3', 'Wednesday')
                .addOption('4', 'Thursday')
                .addOption('5', 'Friday')
                .addOption('6', 'Saturday')
                .setValue(this.plugin.settings.sprintStartDay.toString())
                .onChange(async (value) => {
                    this.plugin.settings.sprintStartDay = parseInt(value);
                    await this.plugin.saveSettings();
                }));
        
        // TIME WINDOWS SETTINGS
        const timeWindowsContainer = contentContainers['timeWindows'];
        timeWindowsContainer.createEl('h3', {text: 'Time Windows'});
        
        // Simple version for now - just show text area for time windows
        // In a more complete version, we would have a UI for editing time windows
        const timeWindowsTextarea = timeWindowsContainer.createEl('textarea', {
            attr: {
                rows: 20,
                placeholder: 'Advanced time windows configuration - edit with caution'
            }
        });
        timeWindowsTextarea.style.width = '100%';
        timeWindowsTextarea.value = JSON.stringify(this.plugin.settings.timeWindows, null, 2);
        
        const saveTimeWindowsButton = timeWindowsContainer.createEl('button', {
            text: 'Save Time Windows'
        });
        saveTimeWindowsButton.style.marginTop = '10px';
        
        saveTimeWindowsButton.addEventListener('click', async () => {
            try {
                const timeWindows = JSON.parse(timeWindowsTextarea.value);
                this.plugin.settings.timeWindows = timeWindows;
                await this.plugin.saveSettings();
                new Notice('Time windows saved successfully');
            } catch (error) {
                new Notice(`Error saving time windows: ${error.message}`);
            }
        });
        
        // ADVANCED SETTINGS
        const advancedContainer = contentContainers['advanced'];
        advancedContainer.createEl('h3', {text: 'Advanced Settings'});

        advancedContainer.createEl('h4', {text: 'Date Formats'});
        
        new Setting(advancedContainer)
            .setName('Custom Date Formats')
            .setDesc('Add your own regex patterns for date formats (one per line). The first capture group must contain the date in YYYY-MM-DD format.')
            .addTextArea(text => text
                .setValue(this.plugin.settings.customDateFormats.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.customDateFormats = value
                        .split('\n')
                        .filter(line => line.trim().length > 0);
                    await this.plugin.saveSettings();
                }));
                
        advancedContainer.createEl('h4', {text: 'Anthropic Integration'});
        
        new Setting(advancedContainer)
            .setName('Enable Anthropic Integration')
            .setDesc('Enable integration with Anthropic API for AI-powered task suggestions')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAnthropicIntegration)
                .onChange(async (value) => {
                    this.plugin.settings.enableAnthropicIntegration = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(advancedContainer)
            .setName('API Key Path')
            .setDesc('Path to the file containing the Anthropic API key')
            .addText(text => text
                .setValue(this.plugin.settings.anthropicApiKeyPath)
                .onChange(async (value) => {
                    this.plugin.settings.anthropicApiKeyPath = value;
                    await this.plugin.saveSettings();
                }));
    }
}