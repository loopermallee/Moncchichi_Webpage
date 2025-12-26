import { GoogleGenAI } from "@google/genai";
import { callGemini, callOpenAI } from "../src/services/proxyApi";
import { keyService } from "./keyService";
import { mockService } from "./mockService";
import { storageService } from "./storageService";

export type AiProvider = 'GEMINI' | 'OPENAI';

export interface UploadProgress {
    loaded: number;
    total: number;
    speed: number; // bytes per second
    eta: number; // seconds
}

export interface GenerationOptions {
    userPrompt: string;
    systemInstruction?: string;
    model?: string;
    temperature?: number;
    useSearch?: boolean;
    useMaps?: boolean;
}

export interface MultimodalOptions {
    prompt: string;
    fileBase64?: string;
    fileBlob?: Blob;
    images?: string[]; // Array of Base64 images for frame-based analysis
    mimeType: string;
    systemInstruction?: string;
    onProgress?: (progress: UploadProgress) => void;
}

export interface AiResponse {
    text: string;
    provider: AiProvider;
    error?: string;
}

// 20MB limit for inlineData (Base64) - Switch to Files API above this.
const INLINE_DATA_LIMIT = 20 * 1024 * 1024;
// 10MB Chunk size for safer, sequential uploads
const UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024; 

class AiService {
    private provider: AiProvider = 'GEMINI';

    public setProvider(p: AiProvider) {
        this.provider = p;
    }

    public getProvider(): AiProvider {
        return this.provider;
    }

    /**
     * Specifically optimized for Map POIs.
     * Strategy: Check local DB -> Try OpenAI (gpt-4o-mini) -> Fallback to Gemini (gemini-3-flash-preview).
     * Results are cached indefinitely in IndexedDB.
     */
    public async getPoiDetails(poiName: string): Promise<string> {
        // 1. Check Local DB Cache
        try {
            const cached = await storageService.getItem<{id: string, desc: string, timestamp: number}>('poi_cache', poiName);
            if (cached && cached.desc) {
                mockService.emitLog('AI', 'INFO', `POI Cache Hit: ${poiName}`);
                return cached.desc;
            }
        } catch (e) {
            // Ignore cache errors and proceed to fetch
        }

        const prompt = `Describe "${poiName}" in Singapore in one short, punchy, interesting sentence (max 15 words). Focus on what it is known for locally.`;
        let resultText = "";

        // 2. Try OpenAI (gpt-4o-mini)
        try {
            const res = await this.generateOpenAI({
                userPrompt: prompt,
                model: 'gpt-4o-mini',
                temperature: 0.3
            });
            if (!res.error && res.text) {
                resultText = res.text;
            }
        } catch (e) {
            mockService.emitLog('AI', 'WARN', `POI OpenAI failed, falling back to Gemini.`);
        }

        // 3. Fallback to Gemini (3 Flash) if OpenAI failed or skipped for basic text task
        // Fix: Use 'gemini-3-flash-preview' for basic text tasks as per guidelines
        if (!resultText) {
            try {
                const res = await this.generateGemini({ 
                    userPrompt: prompt, 
                    model: 'gemini-3-flash-preview', 
                    temperature: 0.3 
                });
                if (res.text) {
                    resultText = res.text;
                }
            } catch (e) {
                mockService.emitLog('AI', 'ERROR', `POI Gemini failed: ${e}`);
            }
        }

        // 4. Save to Cache if successful
        if (resultText && !resultText.includes("unavailable")) {
            storageService.saveItem('poi_cache', {
                id: poiName,
                desc: resultText,
                timestamp: Date.now()
            }).catch(e => console.warn("Failed to cache POI", e));
        }

        return resultText || "Information currently unavailable.";
    }

    public async getTransitDuration(origin: string, destination: string): Promise<number | null> {
        try {
            const prompt = `Calculate the current travel time by public transport (Bus) from "${origin}" to "${destination}" in Singapore. Return a JSON object with a single property "minutes" (number).`;
            const response = await callGemini(prompt, { model: 'gemini-1.5-flash', temperature: 0 });
            const text = (response as any)?.text || '';
            if (text) {
                const json = JSON.parse(text);
                return typeof json.minutes === 'number' ? json.minutes : null;
            }
            return null;
        } catch (e) {
            mockService.emitLog('AI', 'WARN', `Transit duration fetch failed: ${e}`);
            return null;
        }
    }

    public async generateText(options: GenerationOptions): Promise<AiResponse> {
        if (this.provider === 'GEMINI') {
            return this.generateGemini(options);
        } else {
            return this.generateOpenAI(options);
        }
    }

    public async generateMultimodal(options: MultimodalOptions): Promise<AiResponse> {
        const apiKey = keyService.get('GEMINI');
        if (!apiKey) return { text: "API Key Missing", provider: 'GEMINI', error: "No Gemini Key" };

        try {
            const ai = new GoogleGenAI({ apiKey });
            const modelName = 'gemini-3-flash-preview';
            
            mockService.emitLog('AI', 'INFO', `[Gemini Multi] Preparing payload...`);

            const parts: any[] = [];

            if (options.images && options.images.length > 0) {
                options.images.forEach(img => {
                    parts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: img
                        }
                    });
                });
                mockService.emitLog('AI', 'INFO', `[Gemini Multi] Attached ${options.images.length} frames.`);
            }
            else if (options.fileBlob) {
                if (options.fileBlob.size > INLINE_DATA_LIMIT) {
                    mockService.emitLog('AI', 'INFO', `[Gemini Multi] File size ${(options.fileBlob.size/1024/1024).toFixed(1)}MB > 20MB. cutting into chunks...`);

                    const uploadedFile = await this.uploadFileInChunks(
                        apiKey,
                        options.fileBlob,
                        options.mimeType,
                        options.onProgress
                    );
                    
                    if (!uploadedFile || !uploadedFile.uri) {
                        throw new Error("Upload failed: No file URI received from Gemini.");
                    }
                    
                    const fileUri = uploadedFile.uri;
                    const fileName = uploadedFile.name; 
                    mockService.emitLog('AI', 'INFO', `[Gemini Multi] Uploaded: ${fileUri}`);

                    let fileState: string = uploadedFile.state ?? 'UNKNOWN';
                    let attempts = 0;
                    while (fileState === 'PROCESSING') {
                        if (attempts > 60) throw new Error("File processing timed out."); 
                        mockService.emitLog('AI', 'INFO', `[Gemini Multi] Processing remote file...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        const refreshedFile = await ai.files.get({ name: fileName });

                        if (!refreshedFile) throw new Error("Failed to refresh file status.");

                        fileState = refreshedFile.state ?? fileState;
                        if (fileState === 'FAILED') throw new Error("Remote file processing failed.");
                        attempts++;
                    }

                    parts.push({
                        fileData: {
                            mimeType: uploadedFile.mimeType,
                            fileUri: fileUri
                        }
                    });

                } else {
                    let base64 = options.fileBase64;
                    if (!base64 && options.fileBlob) {
                        base64 = await this.blobToBase64(options.fileBlob);
                    }
                    if (!base64) throw new Error("No file data provided");

                    parts.push({
                        inlineData: {
                            mimeType: options.mimeType,
                            data: base64
                        }
                    });
                }
            }

            parts.push({ text: options.prompt });

            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    parts: parts
                },
                config: {
                    systemInstruction: options.systemInstruction || "You are a helpful analyst.",
                    temperature: 0.4
                }
            });

            return {
                text: response.text || "",
                provider: 'GEMINI'
            };

        } catch (e: any) {
            mockService.emitLog('AI', 'ERROR', `Gemini Multimodal Error: ${e.message}`);
            return { text: "Analysis failed.", provider: 'GEMINI', error: e.message };
        }
    }

    private async uploadFileInChunks(
        apiKey: string, 
        file: Blob, 
        mimeType: string,
        onProgress?: (p: UploadProgress) => void
    ): Promise<{ uri: string, name: string, mimeType: string, state: string }> {
        
        const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
        const metadata = { file: { display_name: "Moncchichi_Upload" } };
        
        mockService.emitLog('AI', 'INFO', `[Upload] Init: ${startUrl.substring(0, 60)}... | Size: ${file.size}`);

        const startRes = await fetch(startUrl, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': file.size.toString(),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!startRes.ok) {
            const errText = await startRes.text();
            mockService.emitLog('AI', 'ERROR', `[Upload] Init Failed: ${startRes.status} - ${errText}`);
            throw new Error(`Upload init failed (${startRes.status})`);
        }
        
        const uploadUrl = startRes.headers.get('X-Goog-Upload-Url');
        if (!uploadUrl) throw new Error("No upload URL returned");

        let offset = 0;
        const startTime = Date.now();

        while (offset < file.size) {
            const chunkEnd = Math.min(offset + UPLOAD_CHUNK_SIZE, file.size);
            const chunk = file.slice(offset, chunkEnd);
            const isLast = chunkEnd >= file.size;
            const command = isLast ? 'upload,finalize' : 'upload';
            
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', uploadUrl, true);
                
                xhr.setRequestHeader('X-Goog-Upload-Offset', offset.toString());
                xhr.setRequestHeader('X-Goog-Upload-Command', command);

                xhr.onload = () => {
                    if (xhr.status === 200 || xhr.status === 201) {
                        resolve();
                        if (isLast) {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                (window as any)._lastUploadResult = response.file;
                            } catch (e) {
                                reject(new Error("Failed to parse final upload response"));
                            }
                        }
                    } else {
                        mockService.emitLog('AI', 'ERROR', `[Upload] Chunk Failed: ${xhr.status} ${xhr.statusText}`);
                        reject(new Error(`Chunk upload failed: ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network error during chunk upload"));
                xhr.send(chunk);
            });

            offset = chunkEnd;

            if (onProgress) {
                const now = Date.now();
                const timeDiff = (now - startTime) / 1000;
                const speed = timeDiff > 0 ? offset / timeDiff : 0;
                const remaining = file.size - offset;
                const eta = speed > 0 ? remaining / speed : 0;
                
                onProgress({
                    loaded: offset, total: file.size, speed, eta
                });
            }
        }

        const result = (window as any)._lastUploadResult;
        delete (window as any)._lastUploadResult;
        
        if (result) return result;
        throw new Error("Upload completed but no file metadata returned");
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result as string;
                resolve(res.split(',')[1]); 
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    private async generateGemini(options: GenerationOptions): Promise<AiResponse> {
        try {
            mockService.emitLog('AI', 'INFO', `[Gemini] Requesting...`);
            const response = await callGemini(options.userPrompt, {
                model: options.model || (options.useMaps ? 'gemini-2.5-flash' : 'gemini-3-flash-preview'),
                temperature: options.temperature,
                systemInstruction: options.systemInstruction
            });
            return { text: (response as any)?.text || "", provider: 'GEMINI' };
        } catch (e: any) {
            mockService.emitLog('AI', 'ERROR', `Gemini Error: ${e.message}`);

            const manualKey = keyService.get('GEMINI');
            if (manualKey) {
                try {
                    const ai = new GoogleGenAI({ apiKey: manualKey });
                    const modelName = options.model || 'gemini-3-flash-preview';
                    const model = ai.getGenerativeModel({ model: modelName, systemInstruction: options.systemInstruction });
                    const result = await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: options.userPrompt }]}],
                        generationConfig: { temperature: options.temperature }
                    });
                    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) return { text, provider: 'GEMINI' };
                } catch (manualErr: any) {
                    mockService.emitLog('AI', 'ERROR', `Gemini manual key failed: ${manualErr?.message}`);
                }
            }

            return { text: "Error", provider: 'GEMINI', error: e.message };
        }
    }

    private async generateOpenAI(options: GenerationOptions): Promise<AiResponse> {
        try {
            mockService.emitLog('AI', 'INFO', `[OpenAI] Requesting...`);
            const prompt = options.systemInstruction
                ? `${options.systemInstruction}\n\n${options.userPrompt}`
                : options.userPrompt;

            const data = await callOpenAI(prompt, {
                model: options.model,
                temperature: options.temperature,
                systemInstruction: options.systemInstruction
            });
            return { text: (data as any)?.text || "", provider: 'OPENAI' };
        } catch (e: any) {
            mockService.emitLog('AI', 'ERROR', `OpenAI Error: ${e.message}`);

            const manualKey = keyService.get('OPENAI');
            if (manualKey) {
                try {
                    const messages: any[] = [];
                    if (options.systemInstruction) messages.push({ role: 'system', content: options.systemInstruction });
                    messages.push({ role: 'user', content: options.userPrompt });

                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${manualKey}`
                        },
                        body: JSON.stringify({
                            model: options.model || 'gpt-4o-mini',
                            messages,
                            temperature: options.temperature ?? 0.7
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const text = data?.choices?.[0]?.message?.content;
                        if (text) return { text, provider: 'OPENAI' };
                    }
                } catch (manualErr: any) {
                    mockService.emitLog('AI', 'ERROR', `OpenAI manual key failed: ${manualErr?.message}`);
                }
            }

            return { text: "Error", provider: 'OPENAI', error: e.message };
        }
    }

    public async validateGeminiKey(): Promise<boolean> {
        try { const res = await this.generateText({ userPrompt: "Test", model: 'gemini-3-flash-preview' }); return !res.error; } catch { return false; }
    }

    public async validateOpenAiKey(): Promise<boolean> {
        try { const res = await this.generateOpenAI({ userPrompt: "Test" }); return !res.error; } catch { return false; }
    }
}

export const aiService = new AiService();