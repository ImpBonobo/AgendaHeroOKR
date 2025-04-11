import { OkrStatus } from '../../models/okr-models';
import { OkrPersistenceConfig } from './persistence-config';

/**
 * Helper class for parsing and generating Markdown content
 */
export class MarkdownParser {
    private config: OkrPersistenceConfig;
    
    constructor(config: OkrPersistenceConfig) {
        this.config = config;
    }
    
    /**
     * Update the parser configuration
     * @param config New configuration
     */
    updateConfig(config: OkrPersistenceConfig) {
        this.config = config;
    }
    
    /**
     * Extract YAML frontmatter from content
     * @param content Markdown content
     * @returns Parsed frontmatter object or null if none found
     */
    extractFrontmatter(content: string): Record<string, any> | null {
        // Regular expression to extract YAML frontmatter
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        
        const match = frontmatterRegex.exec(content);
        if (!match) return null;
        
        const yamlContent = match[1];
        
        // Parse YAML content
        const frontmatter: Record<string, any> = {};
        
        // Simple YAML parser (for key-value pairs only)
        const lines = yamlContent.split('\n');
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            
            // Handle arrays
            if (value.startsWith('[') && value.endsWith(']')) {
                // Parse array values and assign directly to frontmatter
                frontmatter[key] = value.slice(1, -1).split(',').map(item => item.trim());
            } else {
                // Assign string value normally
                frontmatter[key] = value;
            }
        }
        
        return frontmatter;
    }
    
    /**
     * Extract title from content (first heading)
     * @param content Markdown content
     * @returns The title or null if none found
     */
    extractTitle(content: string): string | null {
        // Regular expression to extract the first heading
        const titleRegex = /^#\s+(.*)/m;
        
        const match = titleRegex.exec(content);
        if (!match) return null;
        
        return match[1].trim();
    }
    
    /**
     * Extract description from content (text between title and next heading)
     * @param content Markdown content
     * @returns The description or null if none found
     */
    extractDescription(content: string): string | undefined {
        // Remove frontmatter
        const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---/, '').trim();
        
        // Find first heading
        const firstHeadingIndex = contentWithoutFrontmatter.indexOf('# ');
        if (firstHeadingIndex === -1) return undefined;
        
        // Find the end of the first line
        const firstLineEnd = contentWithoutFrontmatter.indexOf('\n', firstHeadingIndex);
        if (firstLineEnd === -1) return undefined;
        
        // Find the next heading
        const nextHeadingIndex = contentWithoutFrontmatter.indexOf('\n#', firstLineEnd);
        
        // Extract text between first heading and next heading (or end of content)
        let descriptionEnd = nextHeadingIndex !== -1 ? nextHeadingIndex : contentWithoutFrontmatter.length;
        let description = contentWithoutFrontmatter.slice(firstLineEnd + 1, descriptionEnd).trim();
        
        // If description is empty, return undefined
        if (!description) return undefined;
        
        return description;
    }
    
    /**
     * Parse tags from frontmatter
     * @param tagsValue Tags value from frontmatter
     * @returns Array of tags
     */
    parseTags(tagsValue: any): string[] {
        if (!tagsValue) return [];
        
        if (typeof tagsValue === 'string') {
            // Remove brackets and split by commas
            return tagsValue.replace(/[\[\]]/g, '').split(',').map(t => t.trim());
        }
        
        if (Array.isArray(tagsValue)) {
            return tagsValue.map(t => String(t).trim());
        }
        
        return [];
    }
    
    /**
     * Format a date as YYYY-MM-DD
     * @param date Date to format
     * @returns Formatted date string
     */
    formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }
    
    /**
     * Format a time as HH:MM
     * @param date Date to extract time from
     * @returns Formatted time string
     */
    formatTime(date: Date): string {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    
    /**
     * Parse a date string
     * @param dateStr Date string (YYYY-MM-DD)
     * @returns Date object or null if invalid
     */
    parseDate(dateStr: string | string[] | undefined): Date | null {
        if (!dateStr) return null;
        
        // Ensure we're working with a string
        const dateString = Array.isArray(dateStr) ? dateStr[0] : String(dateStr);
        
        try {
            // For YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return new Date(dateString);
            }
            
            // Try to parse with Date constructor
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return null;
            }
            
            return date;
        } catch (error) {
            console.error(`Error parsing date ${dateString}:`, error);
            return null;
        }
    }
    
    /**
     * Convert OKR status to user-friendly label
     * @param status OKR status
     * @returns User-friendly label
     */
    statusToLabel(status: OkrStatus): string {
        switch (status) {
            case 'future': return 'Future';
            case 'next-up': return 'Next Up';
            case 'in-progress': return 'In Progress';
            case 'waiting-on': return 'Waiting On';
            case 'validating': return 'Validating';
            case 'completed': return 'Completed';
            case 'canceled': return 'Canceled';
            default: return 'Unknown';
        }
    }
}