
import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { soundService, SOUND_EVENTS, SoundEventId } from '../services/soundService';
import { Play, Upload, RotateCcw, Music, Volume2 } from 'lucide-react';

const SoundStudio: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Force re-render when state updates
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const massInputRef = useRef<HTMLInputElement>(null);
    const [targetEventId, setTargetEventId] = useState<SoundEventId | null>(null);

    const handlePlay = (id: SoundEventId) => {
        switch(id) {
            case 'click': soundService.playClick(); break;
            case 'interaction': soundService.playInteraction(); break;
            case 'navigation': soundService.playNavigation(); break;
            case 'quest_complete': soundService.playQuestComplete(); break;
            case 'quest_start': soundService.playQuestStart(); break;
            case 'quest_restore': soundService.playQuestRestore(); break;
            case 'trash': soundService.playTrash(); break;
            case 'alert': soundService.playAlert(); break;
            case 'whisper': soundService.playWhisper(); break;
            case 'arrival': soundService.playArrival(); break;
            case 'tick': soundService.playTick(); break;
            case 'gps_ping': soundService.playGpsPing(); break;
            case 'grimoire_open': soundService.playGrimoireOpen(); break;
            case 'quest_log_open': soundService.playQuestLogOpen(); break;
            case 'bus_open': soundService.playBusOpen(); break;
            case 'bus_close': soundService.playBusClose(); break;
        }
    };

    const handleUploadClick = (id: SoundEventId) => {
        setTargetEventId(id);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && targetEventId) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit check
                alert("File too large. Please use short clips under 2MB.");
                return;
            }
            await soundService.setCustomSound(targetEventId, file);
            setLastUpdate(Date.now());
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTargetEventId(null);
    };

    // Secret Mass Upload Handler
    const handleMassUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        let updateCount = 0;
        
        // Helper: Remove special chars and lowercase for flexible matching
        const simplify = (s: string) => s.toLowerCase().replace(/[\s-_.]+/g, '');

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 3 * 1024 * 1024) continue; // Skip huge files silently

            // Get filename without extension
            const rawName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const simpleName = simplify(rawName);

            // 1. Alias Matching
            if (simpleName === 'whisper') {
                // Special Rule: 'whisper' maps to both whisper (Insight) and alert
                await soundService.setCustomSound('whisper', file);
                await soundService.setCustomSound('alert', file);
                updateCount += 2;
            } 
            else if (simpleName.includes('grimoire') || simpleName.includes('codex') || simpleName.includes('book') || simpleName.includes('reader')) {
                // Maps "codex.mp3", "grimoire_open.wav", "book_flip.mp3" to the Grimoire event
                await soundService.setCustomSound('grimoire_open', file);
                updateCount++;
            }
            else if (simpleName.includes('quest') || simpleName.includes('checklist') || simpleName.includes('todo') || simpleName.includes('log')) {
                // Maps "questlog.mp3", "checklist_open.wav" to Quest Log event
                await soundService.setCustomSound('quest_log_open', file);
                updateCount++;
            }
            else if (simpleName.includes('bus') && simpleName.includes('open')) {
                await soundService.setCustomSound('bus_open', file);
                updateCount++;
            }
            else if (simpleName.includes('bus') && simpleName.includes('close')) {
                await soundService.setCustomSound('bus_close', file);
                updateCount++;
            }
            else {
                // 2. Direct Fuzzy ID Matching
                const match = SOUND_EVENTS.find(ev => 
                    simplify(ev.id) === simpleName || 
                    simplify(ev.label) === simpleName
                );

                if (match) {
                    await soundService.setCustomSound(match.id, file);
                    updateCount++;
                }
            }
        }

        if (updateCount > 0) {
            alert(`Secret Activated: ${updateCount} sound assets matched and updated.`);
            setLastUpdate(Date.now());
        }

        if (massInputRef.current) massInputRef.current.value = '';
    };

    const handleReset = async (id: SoundEventId) => {
        await soundService.resetSound(id);
        setLastUpdate(Date.now());
    };

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                        {ICONS.SoundStudio} Sound Studio
                    </h2>
                </div>
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".mp3,.wav,.ogg,.m4a,audio/*" 
                onChange={handleFileChange}
            />

            {/* Secret Mass Upload Input */}
            <input 
                type="file" 
                ref={massInputRef} 
                className="hidden" 
                multiple
                accept=".mp3,.wav,.ogg,.m4a,audio/*" 
                onChange={handleMassUpload}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-moncchichi-surfaceAlt/30 border border-moncchichi-border p-4 rounded-xl flex items-start gap-3 mb-2">
                    <div 
                        onClick={() => massInputRef.current?.click()}
                        className="p-2 bg-moncchichi-accent/10 rounded-full text-moncchichi-accent shrink-0 cursor-pointer active:scale-90 transition-transform hover:bg-moncchichi-accent/20"
                        title="Mass Upload"
                    >
                        <Volume2 size={20} />
                    </div>
                    <div className="text-sm text-moncchichi-textSec leading-relaxed">
                        Customize your Moncchichi experience. Upload short audio clips (MP3/WAV) to replace system sounds.
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {SOUND_EVENTS.map(evt => {
                        const customFileName = soundService.getCustomFileName(evt.id);
                        const isCustom = !!customFileName;
                        
                        return (
                            <div key={evt.id} className={`bg-moncchichi-surface border ${isCustom ? 'border-moncchichi-accent/50 shadow-[0_0_10px_rgba(166,145,242,0.1)]' : 'border-moncchichi-border'} rounded-xl p-4 transition-all`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-bold text-sm ${isCustom ? 'text-moncchichi-accent' : 'text-moncchichi-text'}`}>{evt.label}</h3>
                                            {isCustom && (
                                                <div className="flex items-center gap-1 bg-moncchichi-accent/10 px-1.5 py-0.5 rounded border border-moncchichi-accent/20">
                                                    <span className="text-[9px] font-bold uppercase text-moncchichi-accent">Custom</span>
                                                    <span className="text-[9px] text-moncchichi-textSec max-w-[100px] truncate" title={customFileName || ''}>{customFileName}</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-moncchichi-textSec mt-0.5">{evt.description}</p>
                                    </div>
                                    <button 
                                        onClick={() => handlePlay(evt.id)}
                                        className="p-2 bg-moncchichi-surfaceAlt rounded-full hover:bg-moncchichi-text hover:text-moncchichi-bg text-moncchichi-textSec transition-colors"
                                    >
                                        <Play size={16} fill="currentColor" />
                                    </button>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleUploadClick(evt.id)}
                                        className="flex-1 py-2 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg text-xs font-bold text-moncchichi-text hover:border-moncchichi-accent transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} /> Upload
                                    </button>
                                    {isCustom && (
                                        <button 
                                            onClick={() => handleReset(evt.id)}
                                            className="px-3 py-2 bg-moncchichi-error/10 border border-moncchichi-error/30 rounded-lg text-xs font-bold text-moncchichi-error hover:bg-moncchichi-error/20 transition-colors flex items-center justify-center"
                                            title="Reset to default"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SoundStudio;
