import { App, TFile, Vault } from 'obsidian';

/**
 * Helper class for file system operations
 */
export class FileSystemHelper {
    private app: App;
    private vault: Vault;
    
    constructor(app: App) {
        this.app = app;
        this.vault = app.vault;
    }
    
    /**
     * Check if a file exists
     * @param path File path
     * @returns Whether the file exists
     */
    async fileExists(path: string): Promise<boolean> {
        try {
            const file = this.app.vault.getAbstractFileByPath(path);
            return file instanceof TFile;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if a folder exists
     * @param path Folder path
     * @returns Whether the folder exists
     */
    async folderExists(path: string): Promise<boolean> {
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            return folder !== null && !(folder instanceof TFile);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get a file by path
     * @param path File path
     * @returns The file
     */
    getFile(path: string): TFile {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !(file instanceof TFile)) {
            throw new Error(`File not found: ${path}`);
        }
        return file;
    }
    
    /**
     * Ensure a folder exists, creating it if necessary
     * @param path Folder path
     */
    async ensureFolderExists(path: string): Promise<void> {
        if (await this.folderExists(path)) return;
        
        // Create folder
        await this.vault.createFolder(path);
    }
    
    /**
     * Get all files in a folder
     * @param path Folder path
     * @returns Array of files
     */
    async getFilesInFolder(path: string): Promise<TFile[]> {
        // Get all files in the vault
        const allFiles = this.vault.getFiles();
        
        // Filter files in the specified folder
        return allFiles.filter(file => file.path.startsWith(path + '/'));
    }
    
    /**
     * Read file content
     * @param path File path
     * @returns File content
     */
    async readFile(path: string): Promise<string> {
        const file = this.getFile(path);
        return await this.vault.read(file);
    }
    
    /**
     * Write content to a file
     * @param path File path
     * @param content Content to write
     * @param create Whether to create the file if it doesn't exist
     */
    async writeFile(path: string, content: string, create: boolean = false): Promise<void> {
        if (await this.fileExists(path)) {
            // Update existing file
            const file = this.getFile(path);
            await this.vault.modify(file, content);
        } else if (create) {
            // Create new file
            await this.vault.create(path, content);
        } else {
            throw new Error(`File not found: ${path}`);
        }
    }
    
    /**
     * Generate a filename from a template
     * @param template Filename template
     * @param data Data for template variables
     * @returns Generated filename
     */
    generateFilename(template: string, data: Record<string, any>): string {
        // Replace variables in template
        let filename = template;
        
        for (const [key, value] of Object.entries(data)) {
            filename = filename.replace(`\${${key}}`, String(value));
        }
        
        return filename;
    }
    
    /**
     * Sanitize a string for use in a filename
     * @param input String to sanitize
     * @returns Sanitized string
     */
    sanitizeFilename(input: string): string {
        // Remove invalid characters and replace spaces with hyphens
        return input.replace(/[\\/:*?"<>|]/g, '')
                    .replace(/\s+/g, '-')
                    .substring(0, 50); // Limit length
    }
    
    /**
     * Escape special characters in a string for use in a regular expression
     * @param string String to escape
     * @returns Escaped string
     */
    escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}