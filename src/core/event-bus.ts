export type EventCallback = (...args: any[]) => void;

/**
 * Centralized event bus for plugin-wide communication between components
 */
class EventBus {
    private events: Map<string, EventCallback[]>;

    constructor() {
        this.events = new Map<string, EventCallback[]>();
    }

    /**
     * Subscribe to an event
     * @param event Event name
     * @param callback Function to execute when event is triggered
     */
    subscribe(event: string, callback: EventCallback): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        this.events.get(event)?.push(callback);
    }

    /**
     * Unsubscribe from an event
     * @param event Event name
     * @param callback Function to remove from subscribers
     */
    unsubscribe(event: string, callback: EventCallback): void {
        if (!this.events.has(event)) {
            return;
        }
        
        const callbacks = this.events.get(event);
        if (callbacks) {
            this.events.set(event, callbacks.filter(cb => cb !== callback));
        }
    }

    /**
     * Publish an event
     * @param event Event name
     * @param args Arguments to pass to subscribers
     */
    publish(event: string, ...args: any[]): void {
        if (!this.events.has(event)) {
            return;
        }
        
        const callbacks = this.events.get(event);
        callbacks?.forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        });
    }

    /**
     * Clear all event subscriptions
     */
    clear(): void {
        this.events.clear();
    }
}

// Export a singleton instance
export const eventBus = new EventBus();