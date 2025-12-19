
import { storageService } from './storageService';

export type SoundEventId = 
    | 'click' 
    | 'interaction' 
    | 'whisper' 
    | 'tick' 
    | 'navigation' 
    | 'alert' 
    | 'arrival' 
    | 'quest_start' 
    | 'quest_complete' 
    | 'quest_restore' 
    | 'trash'
    | 'gps_ping'
    | 'grimoire_open'
    | 'quest_log_open'
    | 'bus_open'
    | 'bus_close';

export interface SoundProfile {
    id: SoundEventId;
    label: string;
    description: string;
}

export const SOUND_EVENTS: SoundProfile[] = [
    { id: 'navigation', label: 'Navigation', description: 'Screen transitions' },
    { id: 'interaction', label: 'Interaction', description: 'General toggles and inputs' },
    { id: 'click', label: 'UI Click', description: 'Standard button press' },
    { id: 'gps_ping', label: 'GPS Ping', description: 'Location updates and map centering' },
    { id: 'bus_open', label: 'Bus Stop Expand', description: 'Opening stop details (Pneumatic)' },
    { id: 'bus_close', label: 'Bus Stop Collapse', description: 'Closing stop details' },
    { id: 'quest_complete', label: 'Task Complete', description: 'Checklist item checked' },
    { id: 'quest_start', label: 'Task Created', description: 'New item added' },
    { id: 'quest_restore', label: 'Task Restore', description: 'Unchecking an item' },
    { id: 'trash', label: 'Delete', description: 'Removing items' },
    { id: 'alert', label: 'Alert', description: 'Notifications and warnings' },
    { id: 'whisper', label: 'Insight', description: 'AI notifications' },
    { id: 'grimoire_open', label: 'Open Grimoire', description: 'Entering the library/reader' },
    { id: 'quest_log_open', label: 'Open Quest Log', description: 'Entering the checklist' },
];

const CUSTOM_SOUND_MAP_KEY = 'moncchichi_sound_map';

interface CustomSoundEntry {
    assetId: string;
    filename: string;
}

class SoundService {
    private audioContext: AudioContext | null = null;
    private thinkingInterval: any = null;
    
    // Cache for loaded audio buffers (both built-in and custom)
    private soundCache: Map<string, AudioBuffer> = new Map();
    // Track files that failed to load to avoid repeated 404 requests
    private failedSounds: Set<string> = new Set();
    
    // Map of EventID -> { AssetID, Filename }
    private customSoundMap: Record<string, CustomSoundEntry> = {};

    constructor() {
        this.loadCustomMap();
    }

    private loadCustomMap() {
        try {
            const stored = localStorage.getItem(CUSTOM_SOUND_MAP_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Migration: If values are strings (legacy), convert to object
                Object.keys(parsed).forEach(key => {
                    const val = parsed[key];
                    if (typeof val === 'string') {
                        this.customSoundMap[key] = { assetId: val, filename: 'Custom Audio' };
                    } else {
                        this.customSoundMap[key] = val;
                    }
                });
            }
        } catch (e) {
            console.warn("Failed to load sound map");
        }
    }

    private saveCustomMap() {
        localStorage.setItem(CUSTOM_SOUND_MAP_KEY, JSON.stringify(this.customSoundMap));
    }

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Tries to play a sound. Priorities:
     * 1. Custom uploaded sound (from IndexedDB)
     * 2. Built-in file (/public/sounds/...)
     * 3. Fallback synthesizer
     */
    private async playSoundEffect(name: SoundEventId, fallbackFn?: () => void, volume: number = 1.0) {
        const ctx = this.getContext();
        if (ctx.state === 'suspended') ctx.resume();

        // 1. Check for Custom Sound
        const customEntry = this.customSoundMap[name];
        if (customEntry) {
            const customAssetId = customEntry.assetId;
            try {
                // Check cache first
                if (this.soundCache.has(customAssetId)) {
                    this.playBuffer(this.soundCache.get(customAssetId)!, volume);
                    return;
                }

                // Load from DB
                const blob = await storageService.getAssetBlob(customAssetId);
                if (blob) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                    this.soundCache.set(customAssetId, audioBuffer);
                    this.playBuffer(audioBuffer, volume);
                    return;
                } else {
                    // Asset missing? Clean up map
                    delete this.customSoundMap[name];
                    this.saveCustomMap();
                }
            } catch (e) {
                console.warn(`Failed to play custom sound for ${name}`, e);
            }
        }

        // 2. Built-in File
        const path = `/sounds/${name}.mp3`;

        // If we already know it's missing, use fallback immediately
        if (this.failedSounds.has(path)) {
            fallbackFn?.();
            return;
        }

        // If cached, play immediately
        if (this.soundCache.has(path)) {
            this.playBuffer(this.soundCache.get(path)!, volume);
            return;
        }

        // Try to fetch and decode
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            
            this.soundCache.set(path, audioBuffer);
            this.playBuffer(audioBuffer, volume);
        } catch (e) {
            // Mark as failed so we don't try again this session
            this.failedSounds.add(path);
            // Run fallback
            fallbackFn?.();
        }
    }

    private playBuffer(buffer: AudioBuffer, volume: number) {
        if (!this.audioContext) return;
        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();
        
        source.buffer = buffer;
        gain.gain.value = volume;
        
        source.connect(gain);
        gain.connect(this.audioContext.destination);
        source.start(0);
    }

    // --- Customization API ---

    public async setCustomSound(eventId: SoundEventId, file: File): Promise<void> {
        const assetId = `sound_${eventId}_${Date.now()}`;
        // Save blob to IndexedDB
        await storageService.saveAsset(assetId, file);
        // Update map
        this.customSoundMap[eventId] = {
            assetId: assetId,
            filename: file.name
        };
        this.saveCustomMap();
        // Clear cache for this ID to ensure reload
        // Note: we don't need to clear old asset from DB immediately
    }

    public async resetSound(eventId: SoundEventId): Promise<void> {
        if (this.customSoundMap[eventId]) {
            const assetId = this.customSoundMap[eventId].assetId;
            delete this.customSoundMap[eventId];
            this.saveCustomMap();
            // Cleanup cache
            this.soundCache.delete(assetId);
            // Optional: Remove from DB
            // await storageService.deleteItem('assets', assetId); 
        }
    }

    public isCustomized(eventId: SoundEventId): boolean {
        return !!this.customSoundMap[eventId];
    }
    
    public getCustomFileName(eventId: SoundEventId): string | null {
        return this.customSoundMap[eventId]?.filename || null;
    }

    // --- Event Methods ---

    public playClick() {
        this.playSoundEffect('click', () => {
            // Fallback Synth: High pitched "pop"
            this.synthClick();
        }, 0.5);
    }

    private synthClick() {
        try {
            const ctx = this.getContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.05);
        } catch (e) {}
    }

    public playInteraction() {
        this.playSoundEffect('interaction', () => {
            // Fallback Synth: Soft thud
            try {
                const ctx = this.getContext();
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(200, ctx.currentTime);
                
                gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.08);
            } catch (e) {}
        }, 0.4);
    }

    public playGpsPing() {
        this.playSoundEffect('gps_ping', () => {
            // Fallback Synth: Sonar Ping
            try {
                const ctx = this.getContext();
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1000, ctx.currentTime);
                
                gainNode.gain.setValueAtTime(0, ctx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.3);
            } catch (e) {}
        }, 0.5);
    }

    public playWhisper() {
        this.playSoundEffect('whisper', () => {
            // Fallback Synth: Mystery chime (WoW Message style)
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                
                const playTone = (freq: number, time: number) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, time);
                    gain.gain.setValueAtTime(0, time);
                    gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
                    osc.start(time);
                    osc.stop(time + 0.4);
                };

                // A slight high-pitched glissando or chord
                playTone(880, t);       // A5
                playTone(1108.73, t);   // C#6
                playTone(1318.51, t + 0.1); // E6
            } catch (e) {}
        }, 0.6);
    }

    public playTick() {
        this.playSoundEffect('tick', () => {
            // Fallback Synth: Mechanical click
            try {
                const ctx = this.getContext();
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(2000, ctx.currentTime);
                
                gainNode.gain.setValueAtTime(0.015, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.03);
            } catch (e) {}
        }, 0.3);
    }

    public playNavigation() {
        this.playSoundEffect('navigation', () => {
            // Fallback Synth: Swish
            try {
                const ctx = this.getContext();
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(300, ctx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.12);
            } catch (e) {}
        }, 0.4);
    }

    public playBusOpen() {
        this.playSoundEffect('bus_open', () => {
            // Fallback Synth: Pneumatic Hiss (White noise burst)
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                
                // Create buffer with noise
                const bufferSize = ctx.sampleRate * 0.4; // 0.4 seconds
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, t);
                filter.frequency.linearRampToValueAtTime(2000, t + 0.2); // Sweep up

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                noise.start(t);
                noise.stop(t + 0.4);
            } catch (e) {}
        }, 0.4);
    }

    public playBusClose() {
        this.playSoundEffect('bus_close', () => {
            // Fallback Synth: Thump + Hiss
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                
                // 1. Thump (Sine wave)
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
                const oscGain = ctx.createGain();
                oscGain.gain.setValueAtTime(0.2, t);
                oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                
                osc.connect(oscGain);
                oscGain.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.15);

                // 2. Hiss (Short burst)
                const bufferSize = ctx.sampleRate * 0.2;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 1000;
                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.05, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(ctx.destination);
                noise.start(t);
                noise.stop(t + 0.2);
            } catch (e) {}
        }, 0.5);
    }

    public playAlert() {
        this.playSoundEffect('alert', () => {
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(880, t);
                oscillator.frequency.setValueAtTime(0, t + 0.1);
                oscillator.frequency.setValueAtTime(880, t + 0.2);

                gainNode.gain.setValueAtTime(0.1, t);
                gainNode.gain.linearRampToValueAtTime(0, t + 0.1);
                gainNode.gain.setValueAtTime(0.1, t + 0.2);
                gainNode.gain.linearRampToValueAtTime(0, t + 0.3);

                oscillator.start(t);
                oscillator.stop(t + 0.35);
            } catch (e) {}
        });
    }

    public playArrival() {
        this.playSoundEffect('arrival', () => {
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                const notes = [523.25, 659.25, 783.99]; 

                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.type = 'sine';
                    osc.frequency.value = freq;

                    const start = t + (i * 0.15);
                    gain.gain.setValueAtTime(0, start);
                    gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

                    osc.start(start);
                    osc.stop(start + 0.6);
                });
            } catch (e) {}
        });
    }

    public playQuestStart() {
        this.playSoundEffect('quest_start', () => {
            // Fallback Synth: Drum + Chime
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;

                const drumOsc = ctx.createOscillator();
                const drumGain = ctx.createGain();
                drumOsc.connect(drumGain);
                drumGain.connect(ctx.destination);
                
                drumOsc.frequency.setValueAtTime(150, t);
                drumOsc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
                drumGain.gain.setValueAtTime(0.8, t);
                drumGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
                drumOsc.start(t);
                drumOsc.stop(t + 0.6);

                const notes = [523.25, 698.46, 880.00, 1046.50];
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    const start = t + 0.1 + (i * 0.05);
                    gain.gain.setValueAtTime(0, start);
                    gain.gain.linearRampToValueAtTime(0.05, start + 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
                    osc.start(start);
                    osc.stop(start + 1.0);
                });
            } catch (e) {}
        });
    }

    public playQuestComplete() {
        this.playSoundEffect('quest_complete', () => {
            // Fallback Synth: Enhanced Victory Fanfare
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                
                // Major 7th Arpeggio: C6, E6, G6, B6, C7
                const notes = [1046.50, 1318.51, 1567.98, 1975.53, 2093.00]; 
                
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    
                    // Triangle wave for a "chiptune/flute" like sound
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, t);
                    
                    // Staggered entrances
                    const start = t + (i * 0.06); 
                    const duration = 0.6;
                    
                    gain.gain.setValueAtTime(0, start);
                    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
                    
                    osc.start(start);
                    osc.stop(start + duration);
                });

                // Add a "sparkle" noise burst at the end
                const bufferSize = ctx.sampleRate * 0.5;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-5 * i / ctx.sampleRate);
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = ctx.createGain();
                noiseGain.gain.value = 0.05;
                
                // Highpass filter for sparkle
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.value = 3000;
                
                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(ctx.destination);
                
                noise.start(t + 0.3);
            } catch (e) {}
        });
    }

    public playQuestRestore() {
        this.playSoundEffect('quest_restore', () => {
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.15);
                osc.start(t);
                osc.stop(t + 0.15);
            } catch (e) {}
        });
    }

    public playTrash() {
        this.playSoundEffect('trash', () => {
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                // Noise burst
                const bufferSize = ctx.sampleRate * 0.5;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, t);
                filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                noise.start(t);
                noise.stop(t + 0.3);
            } catch (e) {}
        });
    }

    public playGrimoireOpen() {
        this.playSoundEffect('grimoire_open', () => {
            // Fallback Synth: Mystical Chord
            try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                // C Major 7: C4, E4, G4, B4
                const notes = [261.63, 329.63, 392.00, 493.88];
                
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    // Slow attack
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(0.05, t + 0.5 + (i * 0.1));
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
                    osc.start(t);
                    osc.stop(t + 2.5);
                });
            } catch (e) {}
        });
    }

    public playQuestLogOpen() {
        this.playSoundEffect('quest_log_open', () => {
             // Fallback Synth: Paper Shuffle (Filtered Noise)
             try {
                const ctx = this.getContext();
                const t = ctx.currentTime;
                const bufferSize = ctx.sampleRate * 0.3;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1000, t);
                filter.frequency.linearRampToValueAtTime(400, t + 0.2); // Sweep down
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                noise.start(t);
                noise.stop(t + 0.25);
            } catch (e) {}
        });
    }

    public startThinking() {
        if (this.thinkingInterval) return;
        
        const playBlip = () => {
             // For thinking, we stick to synth to allow dynamic variation easily
             try {
                const ctx = this.getContext();
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);
                oscillator.type = 'sine';
                const freq = 1000 + Math.random() * 200;
                oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
                gainNode.gain.setValueAtTime(0.008, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.05);
            } catch (e) {}
        };

        playBlip();
        this.thinkingInterval = setInterval(playBlip, 180);
    }

    public stopThinking() {
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
            this.thinkingInterval = null;
        }
    }
}

export const soundService = new SoundService();
