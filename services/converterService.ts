
// Converter Service
// Placeholder for future ffmpeg.wasm implementation to convert MOV/MKV to MP4/MP3
// Currently only validates or throws to signal unsupported formats clearly.

class ConverterService {
    
    private supportedOutputFormats = ['mp4', 'mp3'];

    /**
     * Checks if a file needs conversion to be compatible with standard web APIs (Whisper/Gemini)
     */
    public needsConversion(file: File): boolean {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const supportedByWhisper = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
        return !supportedByWhisper.includes(ext);
    }

    /**
     * Attempts to convert a file to a supported format.
     * Currently a stub that throws an error, as full FFmpeg WASM requires headers (COOP/COEP)
     * not easily guaranteed in all preview environments.
     */
    public async convertFile(file: File, targetFormat: 'mp4' | 'mp3' = 'mp4'): Promise<File> {
        if (!this.needsConversion(file)) return file;

        // In a full implementation, we would load @ffmpeg/ffmpeg here.
        // For now, we adhere to the requirement of "Explicit Error" for unsupported files.
        console.warn(`Conversion requested for ${file.name} to ${targetFormat}`);
        
        throw new Error(`Auto-conversion unavailable. Please convert ${file.name} to ${targetFormat} manually.`);
    }
}

export const converterService = new ConverterService();
