
import { aiService } from "./aiService";
import { keyService } from "./keyService";
import { mockService } from "./mockService";

export interface SummaryResult {
    summary: string;
    keyPoints: string[];
    transcription: string;
    method: string;
}

const PROMPTS = {
    "Distill Wisdom": "Analyze the transcript and extract key insights and wisdom including a concise title that reflects the content.\n\n**TITLE**\n\n**IDEAS**\n- ...\n\n**QUOTES**\n- ...\n\n**REFERENCES**\n- ...\n\n- **Formatting Guidelines**:\n  - **Title**: Start with the title in bold (`**TITLE**`).\n  - **Categories**: Use bold for category headers (`**IDEAS**`, `**QUOTES**`, `**REFERENCES**`).\n  - **Bullet Points**: Use hyphens (`-`) for each bullet point.\n  - **Omit Empty Categories**: Do not include a category if there are no relevant items.\n  - **No Additional Text**: Do not add any introductory phrases, explanations, or headers using `#`.\n  - **Strict Template Adherence**: Follow the template exactly as shown above without deviations.\n\nHere is the text:\n{text}",
    "Summarization": "Summarize the video transcript excerpt including a concise title that reflects the content. Wrap the title with **markdown bold notation**. Write the summary as if you are continuing a conversation without needing to signal a beginning. Here is the transcript: {text}",
    "Questions and answers": "Analyze the input text and generate the essential questions that, when answered, capture the main points and core meaning of the text. Do not add any introductory phrases, explanations! Just start with the questions and answers. Mark each question with **bold syntax** and don't number them. When formulating your questions: a. Address the central theme or argument b. Identify key supporting ideas c. Highlight important facts or evidence d. Reveal the purpose or perspective e. Explore any significant implications or conclusions. 3.) Answer all of your generated questions one-by-one in detail.\nHere is the text:\n{text}"
};

class SummarizerService {
    
    // --- 1. Transcription (Whisper with Chunking) ---

    public async transcribeFile(file: File, onProgress?: (msg: string, percent?: number) => void): Promise<{ text: string, isPartial: boolean }> {
        const apiKey = keyService.get('OPENAI');
        if (!apiKey) throw new Error("OpenAI Key required for Fallback Transcription");

        // Validation
        const supportedExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
        const fileName = file.name;
        const lastDotIndex = fileName.lastIndexOf('.');
        const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex + 1).toLowerCase() : '';

        if (!supportedExtensions.includes(ext)) {
            throw new Error(`Unsupported file format: .${ext}. Supported: ${supportedExtensions.join(', ')}`);
        }

        // Chunking Strategy
        // OpenAI limit is 25MB. We use 20MB chunks to be safe with overhead.
        const CHUNK_SIZE = 20 * 1024 * 1024; 
        const totalSize = file.size;
        
        let offset = 0;
        let chunkIndex = 0;
        let fullTranscript = "";
        let isPartial = false;
        
        // Helper to estimate total chunks
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

        onProgress?.(`Preparing ${totalChunks > 1 ? 'large ' : ''}media for transcription...`, 0);

        while (offset < totalSize) {
            chunkIndex++;
            const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
            const chunkName = `segment_${chunkIndex}.${ext}`; // Dummy name for API

            // Calculate progress bars (relative to whole file)
            const startPercent = Math.round((offset / totalSize) * 100);
            const endPercent = Math.round(Math.min((offset + CHUNK_SIZE) / totalSize, 1) * 100);

            try {
                const chunkText = await this.uploadChunkToWhisper(
                    chunkBlob, 
                    chunkName, 
                    apiKey, 
                    (chunkPct) => {
                        // Map chunk progress (0-100) to global progress
                        const overall = startPercent + Math.round((chunkPct / 100) * (endPercent - startPercent));
                        onProgress?.(`Transcribing segment ${chunkIndex}/${totalChunks}...`, overall);
                    }
                );
                
                fullTranscript += (fullTranscript ? "\n" : "") + chunkText;

            } catch (e: any) {
                console.error(`Transcription failed at chunk ${chunkIndex}`, e);
                
                // Robustness Policy:
                // If the FIRST chunk fails, the whole job is likely doomed (auth, network, format). Throw.
                // If SUBSEQUENT chunks fail, it might be because byte-slicing corrupted a frame. 
                // We stop here and return what we have (partial result) instead of failing everything.
                if (chunkIndex === 1) {
                    throw new Error(`Transcription failed: ${e.message}`);
                } else {
                    onProgress?.(`Segment ${chunkIndex} unreadable. Finalizing partial transcript...`, endPercent);
                    isPartial = true;
                    break; 
                }
            }

            offset += CHUNK_SIZE;
        }

        return { text: fullTranscript, isPartial };
    }

    private async uploadChunkToWhisper(blob: Blob, fileName: string, apiKey: string, onChunkProgress: (pct: number) => void): Promise<string> {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", blob, fileName); 
            formData.append("model", "whisper-1");
            formData.append("response_format", "verbose_json"); // Get timestamps

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "https://api.openai.com/v1/audio/transcriptions");
            xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
            xhr.timeout = 300000; // 5 minute timeout per chunk

            if (xhr.upload) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        onChunkProgress(percent);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        let text = data.text;
                        if (data.segments) {
                            text = data.segments.map((s: any) => 
                                `[${this.formatTimestamp(s.start)}] ${s.text.trim()}`
                            ).join('\n');
                        }
                        resolve(text);
                    } catch (e: any) {
                        reject(new Error(`JSON Parse Error: ${e.message}`));
                    }
                } else {
                    try {
                        const err = JSON.parse(xhr.responseText);
                        reject(new Error(err.error?.message || xhr.statusText));
                    } catch {
                        reject(new Error(`HTTP Error ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error("Network connection failed during upload."));
            xhr.ontimeout = () => reject(new Error("Request timed out (5m)."));
            
            xhr.send(formData);
        });
    }

    // --- 2. Chunking Logic ---

    private chunkText(text: string, chunkSize: number = 10000): string[] {
        if (chunkSize < 1000) chunkSize = 1000;
        
        const paragraphs = text.split('\n');
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentSize = 0;

        for (const para of paragraphs) {
            const paraSize = para.length + 1;
            if (currentSize + paraSize > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.join('\n'));
                currentChunk = [para];
                currentSize = paraSize;
            } else {
                currentChunk.push(para);
                currentSize += paraSize;
            }
        }
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join('\n'));
        }

        // Merge small chunks to optimize calls
        const mergedChunks: string[] = [];
        let tempChunk: string[] = [];
        let tempSize = 0;

        for (const chunk of chunks) {
            if (tempSize + chunk.length < chunkSize / 2) {
                tempChunk.push(chunk);
                tempSize += chunk.length;
            } else {
                if (tempChunk.length > 0) {
                    mergedChunks.push(tempChunk.join('\n'));
                }
                tempChunk = [chunk];
                tempSize = chunk.length;
            }
        }
        if (tempChunk.length > 0) {
            mergedChunks.push(tempChunk.join('\n'));
        }

        return mergedChunks;
    }

    // --- 3. Processing (Analysis) ---

    public async processContent(text: string, promptType: keyof typeof PROMPTS = "Questions and answers", onProgress?: (msg: string, percent?: number) => void, isPartial: boolean = false): Promise<SummaryResult> {
        onProgress?.("Structuring transcript for analysis...", 0);
        
        const chunks = this.chunkText(text);
        onProgress?.(`Processing ${chunks.length} transcript segments...`, 5);
        
        const template = PROMPTS[promptType];
        const summaries: string[] = [];
        
        // Process sequentially to respect rate limits and allow progress tracking
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const currentPercent = Math.round(((i + 1) / chunks.length) * 100);
            
            onProgress?.(`Analyzing segment ${i + 1}/${chunks.length}...`, currentPercent);
            
            const prompt = template.replace("{text}", chunk);
            
            try {
                // Wrap AI call in a timeout to prevent hanging forever
                const result = await this.generateWithTimeout(prompt, 180000); // 3 minutes per chunk max
                if (result) summaries.push(result);
            } catch (e: any) {
                console.warn(`Analysis chunk ${i} failed`, e);
                summaries.push(`[Analysis Error for Segment ${i+1}: ${e.message}]`);
            }
        }

        if (summaries.length === 0) {
            throw new Error("Analysis failed to generate any results.");
        }

        const fullSummary = summaries.join("\n\n---\n\n");
        
        // Extract key points (naive extraction)
        const keyPoints = fullSummary
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
            .slice(0, 5)
            .map(line => line.replace(/^[-•]\s*/, '').trim());

        const methodString = `Fallback (Whisper + Chunking${isPartial ? ', partial source' : ''})`;

        return {
            summary: fullSummary,
            keyPoints: keyPoints.length > 0 ? keyPoints : ["Check full summary for details."],
            transcription: text,
            method: methodString
        };
    }

    private async generateWithTimeout(prompt: string, timeoutMs: number): Promise<string> {
        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error("AI Service Timeout"));
            }, timeoutMs);

            try {
                const result = await aiService.generateText({
                    userPrompt: prompt,
                    temperature: 0.7
                });
                clearTimeout(timer);
                
                if (result.error) reject(new Error(result.error));
                else resolve(result.text);
            } catch (e) {
                clearTimeout(timer);
                reject(e);
            }
        });
    }

    private formatTimestamp(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

export const summarizerService = new SummarizerService();
export const videoMashService = summarizerService;
