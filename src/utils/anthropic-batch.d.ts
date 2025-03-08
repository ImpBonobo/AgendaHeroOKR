// src/utils/anthropic-batch.d.ts
declare module 'src/utils/anthropic-batch' {
    interface BatchRequest {
        customId: string;
        model?: string;
        maxTokens?: number;
        prompt: string;
    }

    interface BatchResponse {
        // Hier könntest du die genaue Struktur der API-Antwort definieren
        [key: string]: any;
    }

    export function sendBatchRequests(requests: BatchRequest[], outputPath: string): Promise<BatchResponse>;
}
