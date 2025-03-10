import { ItemView, WorkspaceLeaf } from 'obsidian';
import AgendaHeroOKRPlugin from '../../main';

export class TestView extends ItemView {
    plugin: AgendaHeroOKRPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroOKRPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'agenda-hero-okr-test';
    }

    getDisplayText(): string {
        return 'AgendaHeroOKR Test View';
    }

    async onOpen() {
        const container = this.containerEl.createDiv({ cls: 'agenda-hero-okr-test-container' });
        container.createEl('h2', { text: 'AgendaHeroOKR Test View' });
        
        // Einfacher Test-Inhalt
        const content = container.createEl('div', { cls: 'agenda-hero-okr-test-content' });
        content.createEl('p', { text: 'Wenn du diese Nachricht siehst, funktioniert die View-Erstellung!' });
        
        // Buttons zum Testen
        const buttonContainer = container.createEl('div', { cls: 'agenda-hero-okr-test-buttons' });
        
        const calendarButton = buttonContainer.createEl('button', { text: 'Kalender-Ansicht testen' });
        calendarButton.addEventListener('click', () => {
            try {
                this.plugin.activateView('agenda-hero-okr-calendar');
            } catch (error) {
                content.createEl('p', { text: `Fehler beim Öffnen der Kalender-Ansicht: ${error.message}`, cls: 'error' });
                console.error('Fehler beim Öffnen der Kalender-Ansicht:', error);
            }
        });
        
        const taskListButton = buttonContainer.createEl('button', { text: 'Tasklisten-Ansicht testen' });
        taskListButton.addEventListener('click', () => {
            try {
                this.plugin.activateView('agenda-hero-okr-tasklist');
            } catch (error) {
                content.createEl('p', { text: `Fehler beim Öffnen der Tasklisten-Ansicht: ${error.message}`, cls: 'error' });
                console.error('Fehler beim Öffnen der Tasklisten-Ansicht:', error);
            }
        });
    }

    async onClose() {
        // Cleanup
    }
}