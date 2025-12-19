
import { aiService, UploadProgress } from './aiService';
import { mockService } from './mockService';
import { storageService } from './storageService';
import { summarizerService } from './videoMashService'; 
import { protocolService } from './protocolService'; 
import { bookService } from './bookService'; 
import { LogEntry } from '../types';

// Threshold for switching to local fallback (Whisper/Slice)
const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;

export interface AnalysisResult {
    summary: string;
    keyPoints: string[];
    transcription: string;
    method?: string; 
}

export interface WeaverJob {
    id: string;
    timestamp: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'ANALYZING' | 'COMPLETE' | 'ERROR';
    progress: number;
    message: string;
    logs: string[];
    result?: AnalysisResult;
    error?: string;
    activeFileBlob?: File | Blob; 
    
    uploadStats?: {
        loaded: number;
        total: number;
        speed: number; 
        eta: number; 
    };
}

class WeaverService {
    // Changed from single activeJob to a Map of active jobs
    private activeJobs: Map<string, WeaverJob> = new Map();
    private listeners: (() => void)[] = [];
    private history: WeaverJob[] = [];

    constructor() {
        this.loadHistory();
    }

    private async loadHistory() {
        try {
            const items = await storageService.getAllItems<WeaverJob>('weaver_history');
            this.history = items.sort((a, b) => b.timestamp - a.timestamp);
            this.notifyListeners();
        } catch (e) {
            console.warn("Failed to load Weaver history");
        }
    }

    public subscribe(cb: () => void) {
        this.listeners.push(cb);
        cb();
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(l => l());
    }

    // New: Get all active jobs
    public getActiveJobs(): WeaverJob[] {
        return Array.from(this.activeJobs.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    // Compatibility: Returns the most recent active job (for default UI state)
    public getActiveJob(): WeaverJob | null {
        const jobs = this.getActiveJobs();
        return jobs.length > 0 ? jobs[0] : null;
    }

    public getHistory(): WeaverJob[] {
        return this.history;
    }

    public getJobById(id: string): WeaverJob | undefined {
        return this.activeJobs.get(id) || this.history.find(h => h.id === id);
    }

    public async deleteHistoryItem(id: string) {
        await storageService.deleteItem('weaver_history', id);
        this.history = this.history.filter(h => h.id !== id);
        this.notifyListeners();
    }

    // Refactored: Support concurrent jobs, no global lock
    public async startJob(file: File) {
        const jobId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        
        const newJob: WeaverJob = {
            id: jobId,
            timestamp: Date.now(),
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            status: 'UPLOADING',
            progress: 0,
            message: "Initializing Quantum Link...",
            logs: ["> Handshake initiated..."],
            activeFileBlob: file,
            uploadStats: { loaded: 0, total: file.size, speed: 0, eta: 0 }
        };

        this.activeJobs.set(jobId, newJob);
        this.notifyListeners();

        this.processJob(jobId, file);
    }

    // New: URL Support
    public async startJobFromUrl(rawUrl: string) {
        if (!rawUrl.startsWith("http")) { 
             throw new Error("Invalid URL protocol. Use HTTP/HTTPS.");
        }

        const jobId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        
        const newJob: WeaverJob = {
            id: jobId,
            timestamp: Date.now(),
            fileName: "remote_media", 
            fileType: "unknown",
            fileSize: 0,
            status: 'UPLOADING',
            progress: 0,
            message: "Resolving remote media...",
            logs: [`> Job started from URL`, `> Target: ${rawUrl}`],
            uploadStats: { loaded: 0, total: 0, speed: 0, eta: 0 }
        };

        this.activeJobs.set(jobId, newJob);
        this.notifyListeners();

        try {
            const file = await this.resolveMediaFromUrl(rawUrl, jobId);
            
            // Update job with actual file stats before processing
            this.updateJob(jobId, {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                activeFileBlob: file,
                message: "Media resolved. Starting analysis..."
            });
            
            // Hand off to existing pipeline
            this.processJob(jobId, file);

        } catch (e: any) {
            this.updateJob(jobId, {
                status: 'ERROR',
                message: "URL Resolution Failed",
                error: e.message,
                logs: [...(this.activeJobs.get(jobId)?.logs || []), `> FATAL: ${e.message}`]
            });
        }
    }

    // Helper: Resolve URL to File
    private async resolveMediaFromUrl(rawUrl: string, jobId: string): Promise<File> {
        let targetUrl = rawUrl;
        const currentJob = this.activeJobs.get(jobId);
        const currentLogs = currentJob?.logs || [];

        // 1. Google Drive Normalization
        const driveRegex = /drive\.google\.com/;
        if (driveRegex.test(rawUrl)) {
            const idMatch = rawUrl.match(/\/d\/([^/]+)/) || rawUrl.match(/id=([^&]+)/);
            if (idMatch && idMatch[1]) {
                const fileId = idMatch[1];
                targetUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                const msg = `> Normalized Google Drive link to direct download`;
                this.updateJob(jobId, { logs: [...currentLogs, msg] });
            }
        }

        this.updateJob(jobId, { message: "Downloading media from URL..." });

        // 2. Fetch (Direct -> Proxy)
        let blob: Blob | null = null;
        
        try {
            const res = await fetch(targetUrl);
            if (res.ok) blob = await res.blob();
        } catch (e) { /* Ignore direct fail due to CORS */ }

        if (!blob) {
            const msg = "> Direct fetch failed (CORS?). Attempting proxy...";
            this.updateJob(jobId, { logs: [...(this.activeJobs.get(jobId)?.logs || []), msg] });
            
            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`Proxy status: ${res.status}`);
                blob = await res.blob();
            } catch (e: any) {
                throw new Error(`Download failed: ${e.message}`);
            }
        }

        // 3. Validate & Build File
        const sizeMB = blob.size / 1024 / 1024;
        const logSize = `> Download complete. Size: ${sizeMB.toFixed(2)} MB`;
        const logType = `> Detected MIME: ${blob.type}`;
        this.updateJob(jobId, { logs: [...(this.activeJobs.get(jobId)?.logs || []), logSize, logType] });

        // Max 1GB Check
        if (sizeMB > 1024) {
            throw new Error(`File too large (${sizeMB.toFixed(1)}MB). Max 1GB.`);
        }

        // Infer Name
        let name = "remote_media";
        try {
            const urlObj = new URL(rawUrl);
            const pathName = urlObj.pathname.split('/').pop();
            if (pathName && pathName.includes('.') && pathName.length < 50) name = pathName;
        } catch {}
        
        if (!name.includes('.')) {
            if (blob.type.includes('video')) name += '.mp4';
            else if (blob.type.includes('audio')) name += '.mp3';
            else if (blob.type.includes('pdf')) name += '.pdf';
        }

        return new File([blob], name, { type: blob.type });
    }

    private updateJob(id: string, updates: Partial<WeaverJob>) {
        const job = this.activeJobs.get(id);
        if (!job) return;
        
        const updatedJob = { ...job, ...updates };
        this.activeJobs.set(id, updatedJob);
        this.notifyListeners();
    }

    private async processJob(jobId: string, file: File) {
        // Subscribe to logs for this specific job context
        const logUnsub = mockService.subscribeToLogs((entry: LogEntry) => {
            if (entry.tag === 'AI' || entry.tag === 'WEAVER') {
                this.handleLogUpdate(jobId, entry);
            }
        });

        try {
            // 1. Enforce Video/Audio Only
            const isMedia = file.type.startsWith('video/') || file.type.startsWith('audio/');
            if (!isMedia) {
                throw new Error("Unsupported media type. Weaver only analyzes Video or Audio files.");
            }

            // 2. Check for Large Media Routing
            if (file.size > LARGE_FILE_THRESHOLD) {
                const job = this.activeJobs.get(jobId);
                const sizeMB = (file.size/1024/1024).toFixed(1);
                
                this.updateJob(jobId, { 
                    message: "Large Media Detected. Routing to Chunked Processor...",
                    logs: [...(job?.logs || []), `> Size ${sizeMB}MB > 20MB limit`, "> Engaging chunked slicer..."]
                });
                
                await this.attemptLocalFallback(jobId, file, "Size Exceeded Direct Limit");
                
            } else {
                // 3. Normal Gemini Path (<= 20MB)
                const prompt = `
                Analyze this media file (${file.type}).
                Provide a JSON response with the following structure (no markdown code blocks, just raw JSON):
                {
                    "summary": "A concise, engaging summary of the content (max 50 words).",
                    "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
                    "transcription": "The full transcription of the audio/video. If it is very long, provide a comprehensive summary."
                }
                `;

                const response = await aiService.generateMultimodal({
                    prompt: prompt,
                    fileBlob: file,
                    mimeType: file.type,
                    systemInstruction: "You are Quantum Weaver, a hyper-intelligent data analyzer. Extract knowledge with precision.",
                    onProgress: (p: UploadProgress) => {
                        const percent = Math.round((p.loaded / p.total) * 100);
                        // Map upload progress to 0-30% of total job
                        const jobProgress = Math.round(percent * 0.3);
                        
                        this.updateJob(jobId, {
                            status: 'UPLOADING',
                            progress: jobProgress,
                            uploadStats: {
                                loaded: p.loaded,
                                total: p.total,
                                speed: p.speed,
                                eta: p.eta
                            },
                            message: percent === 100 ? "Upload complete. Waiting for processing..." : "Uploading to Quantum Core..."
                        });
                    }
                });

                if (response.error) throw new Error(response.error);

                let data: AnalysisResult;
                try {
                    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    data = JSON.parse(cleanJson);
                    data.method = "Gemini Direct";
                } catch (parseError) {
                    data = {
                        summary: "Analysis complete, but structural integrity compromised.",
                        keyPoints: ["Raw output available in transcription."],
                        transcription: response.text,
                        method: "Gemini Direct (Raw)"
                    };
                }

                this.completeJob(jobId, data);
            }

        } catch (e: any) {
            mockService.emitLog('WEAVER', 'ERROR', e.message);
            const job = this.activeJobs.get(jobId);
            
            // If fallback hasn't been tried yet (e.g. Gemini error on small file), try it now
            // But if it's a huge file, it already tried fallback.
            if (job && !job.message.includes("Fallback") && !job.message.includes("Chunked")) {
                await this.attemptLocalFallback(jobId, file, e.message);
            } else {
                this.updateJob(jobId, {
                    status: 'ERROR',
                    message: "Processing Failed",
                    error: e.message
                });
            }
        } finally {
            logUnsub();
            this.notifyListeners();
        }
    }

    private async attemptLocalFallback(jobId: string, file: File, originalError: string) {
        const job = this.activeJobs.get(jobId);
        
        this.updateJob(jobId, {
            status: 'PROCESSING', // Still processing, but local phase
            progress: 30, // Start fallback from 30% mark
            message: "Engaging Whisper Fallback Protocols...",
            logs: [...(job?.logs || []), `> Reason: ${originalError}`, `> Switching to Chunked Service...`]
        });

        try {
            // Phase 1: Transcription (30-70% of total progress)
            const { text: textContent, isPartial } = await summarizerService.transcribeFile(file, (msg, percent) => {
                // Map 0-100% transcription to 30-70% total
                const jobProgress = percent !== undefined ? 30 + Math.floor(percent * 0.4) : undefined;
                this.updateJob(jobId, { 
                    message: msg,
                    ...(jobProgress !== undefined && { progress: jobProgress }),
                    logs: [...(this.activeJobs.get(jobId)?.logs || []), `> [Transcribe] ${msg}`] 
                });
            });

            // Phase 2: Analysis (70-100% of total progress)
            this.updateJob(jobId, { 
                status: 'ANALYZING',
                progress: 70,
                message: "Synthesizing Knowledge..." 
            });
            
            const result = await summarizerService.processContent(textContent, "Questions and answers", (msg, percent) => {
                // Map 0-100% analysis to 70-100% total
                const jobProgress = percent !== undefined ? 70 + Math.floor(percent * 0.3) : undefined;
                this.updateJob(jobId, { 
                    message: msg,
                    ...(jobProgress !== undefined && { progress: jobProgress }),
                    logs: [...(this.activeJobs.get(jobId)?.logs || []), `> [Analyze] ${msg}`] 
                });
            }, isPartial);

            result.method = `Fallback (Whisper + Chunking${isPartial ? ', partial' : ''})`;

            this.completeJob(jobId, result);
            mockService.emitLog('WEAVER', 'INFO', `Job ${jobId}: Fallback Analysis Successful`);

        } catch (localError: any) {
            // Ensure we catch the error properly and update the UI to ERROR state
            this.updateJob(jobId, {
                status: 'ERROR',
                message: "Weaving Failed.",
                error: `Fallback Pipeline Error: ${localError.message}`,
                logs: [...(this.activeJobs.get(jobId)?.logs || []), `> FATAL: ${localError.message}`]
            });
        }
    }

    private completeJob(jobId: string, data: AnalysisResult) {
        const job = this.activeJobs.get(jobId);
        if (!job) return;
        
        const completedJob: WeaverJob = {
            ...job,
            status: 'COMPLETE',
            progress: 100,
            message: data.method?.includes('Fallback') ? "Completed via Fallback." : "Weaving Complete.",
            result: data
        };

        this.activeJobs.set(jobId, completedJob);
        
        // Persist to history
        const historyItem = { ...completedJob, activeFileBlob: undefined };
        storageService.saveItem('weaver_history', historyItem);
        this.history = [historyItem, ...this.history];
        this.notifyListeners();
    }

    private handleLogUpdate(jobId: string, entry: LogEntry) {
        const job = this.activeJobs.get(jobId);
        if (!job || job.status === 'COMPLETE' || job.status === 'ERROR') return;

        const newLogs = [...job.logs, `> ${entry.message}`].slice(-20);
        let newProgress = job.progress;
        let newStatus = job.status;
        let newMessage = job.message;

        // Heuristics for Gemini phases which are opaque
        if (entry.message.includes('Processing remote')) {
            newStatus = 'PROCESSING';
            newProgress = Math.max(newProgress, 35); 
            newMessage = "The Oracle is thinking...";
        } else if (entry.message.includes('Generating')) {
            newStatus = 'ANALYZING';
            newProgress = Math.max(newProgress, 85);
            newMessage = "Weaving final response...";
        }

        this.updateJob(jobId, {
            logs: newLogs,
            status: newStatus,
            progress: newProgress,
            message: newMessage
        });
    }

    public async chatAboutJob(job: WeaverJob, userMsg: string, chatHistory: {role: string, text: string}[]): Promise<string> {
        let prompt = `
        Context: The user is asking questions about a video/audio file previously analyzed.
        Analysis Summary: ${job.result?.summary}
        Key Points: ${job.result?.keyPoints.join(', ')}
        Full Transcript: ${job.result?.transcription.substring(0, 10000)}...
        
        Chat History:
        ${chatHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}
        USER: ${userMsg}
        
        Answer the user's question specifically based on the file content provided above. Keep it concise.
        `;

        const response = await aiService.generateText({
            userPrompt: prompt,
            systemInstruction: "You are Quantum Weaver. Answer questions based on the provided file analysis."
        });

        return response.text;
    }
    
    // Clear completed or errored jobs from memory
    public clearActiveJobs() {
        // Only keep jobs that are still running
        const running = new Map<string, WeaverJob>();
        this.activeJobs.forEach((job, id) => {
            if (job.status === 'UPLOADING' || job.status === 'PROCESSING' || job.status === 'ANALYZING') {
                running.set(id, job);
            }
        });
        this.activeJobs = running;
        this.notifyListeners();
    }

    // Dismiss a specific job
    public dismissJob(id: string) {
        if (this.activeJobs.has(id)) {
            this.activeJobs.delete(id);
            this.notifyListeners();
        }
    }
}

export const weaverService = new WeaverService();
