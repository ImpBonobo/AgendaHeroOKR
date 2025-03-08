import { ItemView, WorkspaceLeaf } from 'obsidian';
import AgendaHeroPlugin from '../../main';

export class TestView extends ItemView {
    plugin: AgendaHeroPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: AgendaHeroPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return 'agenda-hero-test';
    }

    getDisplayText(): string {
        return 'AgendaHero Test View';
    }

    async onOpen() {
        const container = this.containerEl.createDiv({ cls: 'agenda-hero-test-container' });
        container.createEl('h2', { text: 'AgendaHero Test View' });
        
        // Einfacher Test-Inhalt
        const content = container.createEl('div', { cls: 'agenda-hero-test-content' });
        content.createEl('p', { text: 'Wenn du diese Nachricht siehst, funktioniert die View-Erstellung!' });
        
        // Buttons zum Testen
        const buttonContainer = container.createEl('div', { cls: 'agenda-hero-test-buttons' });
        
        const calendarButton = buttonContainer.createEl('button', { text: 'Kalender-Ansicht testen' });
        calendarButton.addEventListener('click', () => {
            try {
                this.plugin.activateView('agenda-hero-calendar');
            } catch (error) {
                content.createEl('p', { text: `Fehler beim Öffnen der Kalender-Ansicht: ${error.message}`, cls: 'error' });
                console.error('Fehler beim Öffnen der Kalender-Ansicht:', error);
            }
        });
        
        const taskListButton = buttonContainer.createEl('button', { text: 'Tasklisten-Ansicht testen' });
        taskListButton.addEventListener('click', () => {
            try {
                this.plugin.activateView('agenda-hero-tasklist');
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