import { eventBus } from './event-bus';

/**
 * Centralized application state manager
 */
class AppState {
    private state: Record<string, any> = {};
    
    /**
     * Get a value from the state
     * @param key State key
     * @returns The value or undefined
     */
    get<T>(key: string): T | undefined {
        return this.state[key] as T;
    }
    
    /**
     * Set a value in the state
     * @param key State key
     * @param value Value to set
     */
    set<T>(key: string, value: T): void {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // Publish state change event
        eventBus.publish('state:changed', key, value, oldValue);
        eventBus.publish(`state:changed:${key}`, value, oldValue);
    }
    
    /**
     * Check if a key exists in the state
     * @param key State key
     * @returns True if the key exists
     */
    has(key: string): boolean {
        return key in this.state;
    }
    
    /**
     * Remove a key from the state
     * @param key State key
     */
    remove(key: string): void {
        if (this.has(key)) {
            const oldValue = this.state[key];
            delete this.state[key];
            
            // Publish state change event
            eventBus.publish('state:removed', key, oldValue);
            eventBus.publish(`state:removed:${key}`, oldValue);
        }
    }
    
    /**
     * Clear all state
     */
    clear(): void {
        this.state = {};
        eventBus.publish('state:cleared');
    }
}

// Export a singleton instance
export const appState = new AppState();