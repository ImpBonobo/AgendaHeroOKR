import { App, Modal, Setting } from 'obsidian';
import { OkrService } from '../services/okr-service';
import { OkrStatus } from '../models/okr-models';

/**
 * Base modal class for OKR elements
 */
export abstract class OkrModal extends Modal {
    protected okrService: OkrService;
    
    constructor(app: App, okrService: OkrService) {
        super(app);
        this.okrService = okrService;
    }
    
    /**
     * Add a status dropdown to a form
     * @param container Container to add the dropdown to
     * @param currentStatus Current status value
     * @param onChange Callback for status change
     */
    protected addStatusDropdown(
        container: HTMLElement, 
        currentStatus: OkrStatus, 
        onChange: (value: OkrStatus) => void
    ) {
        new Setting(container)
            .setName('Status')
            .setDesc('Current status of this item')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('future', 'Future')
                    .addOption('next-up', 'Next Up')
                    .addOption('in-progress', 'In Progress')
                    .addOption('waiting-on', 'Waiting On')
                    .addOption('validating', 'Validating')
                    .addOption('completed', 'Completed')
                    .addOption('canceled', 'Canceled')
                    .setValue(currentStatus)
                    .onChange(value => onChange(value as OkrStatus));
            });
    }
    
    /**
     * Add priority dropdown to a form
     * @param container Container to add the dropdown to
     * @param currentPriority Current priority value
     * @param onChange Callback for priority change
     */
    protected addPriorityDropdown(
        container: HTMLElement, 
        currentPriority: number, 
        onChange: (value: number) => void
    ) {
        new Setting(container)
            .setName('Priority')
            .setDesc('Priority level (1 is highest)')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('1', 'High (1)')
                    .addOption('2', 'Medium (2)')
                    .addOption('3', 'Normal (3)')
                    .addOption('4', 'Low (4)')
                    .setValue(currentPriority.toString())
                    .onChange(value => onChange(parseInt(value)));
            });
    }
    
    /**
     * Add date fields to a form
     * @param container Container to add the fields to
     * @param startDate Current start date
     * @param endDate Current end date
     * @param onStartChange Callback for start date change
     * @param onEndChange Callback for end date change
     */
    protected addDateFields(
        container: HTMLElement, 
        startDate: Date | null, 
        endDate: Date | null,
        onStartChange: (value: Date) => void,
        onEndChange: (value: Date) => void
    ) {
        // Format dates for input fields
        const formatDate = (date: Date | null): string => {
            if (!date) return '';
            return date.toISOString().split('T')[0];
        };
        
        // Start date
        new Setting(container)
            .setName('Start Date')
            .setDesc('When work begins')
            .addText(text => {
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(formatDate(startDate))
                    .onChange(value => {
                        if (value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                onStartChange(date);
                            }
                        }
                    });
                
                // Change input type to date
                const inputEl = text.inputEl;
                inputEl.type = 'date';
            });
        
        // End date
        new Setting(container)
            .setName('End Date')
            .setDesc('Deadline')
            .addText(text => {
                text
                    .setPlaceholder('YYYY-MM-DD')
                    .setValue(formatDate(endDate))
                    .onChange(value => {
                        if (value) {
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                onEndChange(date);
                            }
                        }
                    });
                
                // Change input type to date
                const inputEl = text.inputEl;
                inputEl.type = 'date';
            });
    }
    
    /**
     * Add tags input to a form
     * @param container Container to add the input to
     * @param currentTags Current tags
     * @param onChange Callback for tags change
     */
    protected addTagsInput(
        container: HTMLElement, 
        currentTags: string[], 
        onChange: (value: string[]) => void
    ) {
        new Setting(container)
            .setName('Tags')
            .setDesc('Tags separated by commas')
            .addText(text => {
                text
                    .setPlaceholder('tag1, tag2, tag3')
                    .setValue(currentTags.join(', '))
                    .onChange(value => {
                        const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
                        onChange(tags);
                    });
            });
    }
}