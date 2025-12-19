
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { keyService, ApiId } from '../services/keyService';
import { aiService } from '../services/aiService';
import { transportService } from '../services/transportService';
import { nlbService } from '../services/nlbService';
import { realtimeWeatherService } from '../services/realtimeWeatherService';
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2, Sparkles, Server, BookOpen, Bus, CloudLightning, Activity, Smartphone, Map as MapIcon, TrendingUp, BarChart } from 'lucide-react';

interface KeyConfig {
    id: ApiId;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    placeholder: string;
}

const CONFIGS: KeyConfig[] = [
    {
        id: 'GEMINI',
        name: 'The Oracle (Gemini)',
        description: 'Primary Intelligence. Powers Ershin, Analysis, and Creative tasks.',
        icon: <Sparkles size={20} />,
        color: 'text-purple-400',
        placeholder: 'AIzaSy...'
    },
    {
        id: 'OPENAI',
        name: 'The Backup Mind (OpenAI)',
        description: 'Failsafe Intelligence. Activates if The Oracle is unreachable.',
        icon: <Server size={20} />,
        color: 'text-green-400',
        placeholder: 'sk-proj-...'
    },
    {
        id: 'GOOGLE_MAPS',
        name: 'Pathfinder (Google Maps)',
        description: 'Live Traffic & Routes API. Powers visual maps and routing.',
        icon: <MapIcon size={20} />,
        color: 'text-cyan-400',
        placeholder: 'AIzaSy...'
    },
    {
        id: 'LTA',
        name: 'Griffin\'s Path (LTA)',
        description: 'Real-time Transport Data. Required for precise bus timings.',
        icon: <Bus size={20} />,
        color: 'text-orange-400',
        placeholder: 'AccountKey...'
    },
    {
        id: 'NLB',
        name: 'Codex Key (NLB)',
        description: 'Library Access Key.',
        icon: <BookOpen size={20} />,
        color: 'text-red-400',
        placeholder: 'Api-Key...'
    },
    {
        id: 'NLB_APP',
        name: 'Codex App Code (NLB)',
        description: 'Your registered App Name (e.g. MoncchichiHub). Must match Key.',
        icon: <Smartphone size={20} />,
        color: 'text-red-400',
        placeholder: 'AppCode...'
    },
    {
        id: 'NEA',
        name: 'Elements (NEA)',
        description: 'Weather Data. (Currently Open Access, Key Optional)',
        icon: <CloudLightning size={20} />,
        color: 'text-blue-400',
        placeholder: 'Optional...'
    },
    {
        id: 'FINNHUB',
        name: 'Gallywix Wire (Finnhub)',
        description: 'Global Market News & Stock Quotes. Powers Goblin Brokerage.',
        icon: <TrendingUp size={20} />,
        color: 'text-moncchichi-success',
        placeholder: 'Finnhub API Key...'
    },
    {
        id: 'ALPHAVANTAGE',
        name: 'The Golden Ledger (AlphaVantage)',
        description: 'Advanced Sentiment Analysis & Historical Data.',
        icon: <BarChart size={20} />,
        color: 'text-yellow-500',
        placeholder: 'AlphaVantage Key...'
    }
];

const TitanVault: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Fix: Initialize values with all required keys of ApiId to match Record<ApiId, string>
    const [values, setValues] = useState<Record<ApiId, string>>({ 
        GEMINI: '', 
        OPENAI: '', 
        LTA: '', 
        NLB: '', 
        NLB_APP: '', 
        NEA: '', 
        GOOGLE_MAPS: '',
        FINNHUB: '',
        ALPHAVANTAGE: ''
    });
    // Fix: Changed visible state to Partial<Record<ApiId, boolean>> to correctly handle {} initialization
    const [visible, setVisible] = useState<Partial<Record<ApiId, boolean>>>({});
    // Fix: Changed statuses state to Partial<Record<ApiId, ...>> to correctly handle {} initialization
    const [statuses, setStatuses] = useState<Partial<Record<ApiId, 'IDLE' | 'TESTING' | 'VALID' | 'INVALID'>>>({});

    useEffect(() => {
        const loaded: any = {};
        CONFIGS.forEach(c => {
            loaded[c.id] = keyService.get(c.id);
        });
        setValues(loaded);
    }, []);

    const handleSave = (id: ApiId) => {
        keyService.set(id, values[id]);
        setStatuses(prev => ({ ...prev, [id]: 'IDLE' }));
    };

    const handleTest = async (id: ApiId) => {
        keyService.set(id, values[id]);
        setStatuses(prev => ({ ...prev, [id]: 'TESTING' }));

        let isValid = false;
        try {
            if (id === 'GEMINI') isValid = await aiService.validateGeminiKey();
            else if (id === 'OPENAI') isValid = await aiService.validateOpenAiKey();
            else if (id === 'LTA') isValid = await transportService.validateLtaKey();
            else if (id === 'NLB' || id === 'NLB_APP') isValid = await nlbService.validateNlbKey();
            else if (id === 'GOOGLE_MAPS') {
                try {
                     const res = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': values[id],
                            'X-Goog-FieldMask': 'routes.duration'
                        },
                        body: JSON.stringify({
                            origin: { location: { latLng: { latitude: 1.35, longitude: 103.8 } } },
                            destination: { location: { latLng: { latitude: 1.36, longitude: 103.81 } } }
                        })
                    });
                    isValid = res.ok;
                } catch { isValid = false; }
            }
            else if (id === 'NEA') {
                try {
                    await realtimeWeatherService.getUnifiedWeather();
                    isValid = true;
                } catch { isValid = false; }
            }
            else if (id === 'FINNHUB') {
                try {
                    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${values[id]}`);
                    isValid = res.ok;
                } catch { isValid = false; }
            }
            else if (id === 'ALPHAVANTAGE') {
                try {
                    const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=${values[id]}`);
                    isValid = res.ok;
                } catch { isValid = false; }
            }
        } catch (e) {
            isValid = false;
        }

        setStatuses(prev => ({ ...prev, [id]: isValid ? 'VALID' : 'INVALID' }));
    };

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg">
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                        <Key size={20} className="text-moncchichi-accent"/> Titan's Vault
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-moncchichi-surfaceAlt/30 border border-moncchichi-border p-4 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-moncchichi-accent/10 rounded-full text-moncchichi-accent shrink-0">
                        <Key size={20} />
                    </div>
                    <div className="text-sm text-moncchichi-textSec leading-relaxed">
                        <span className="font-bold text-moncchichi-text block mb-1">Secure Storage</span>
                        Keys are stored locally on your device. They are never sent to our servers.
                    </div>
                </div>

                <div className="space-y-4 pb-10">
                    {CONFIGS.map(config => {
                        const status = statuses[config.id];
                        const isTesting = status === 'TESTING';
                        const isVisible = visible[config.id];
                        const isOptional = config.placeholder.includes("Optional");

                        return (
                            <div key={config.id} className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-4 transition-all hover:border-moncchichi-accent/30 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border/50 ${config.color}`}>
                                        {config.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-moncchichi-text">{config.name}</h3>
                                        <p className="text-[10px] text-moncchichi-textSec">{config.description}</p>
                                    </div>
                                    <div className="ml-2">
                                        {status === 'VALID' && <CheckCircle size={18} className="text-moncchichi-success animate-in zoom-in" />}
                                        {status === 'INVALID' && <XCircle size={18} className="text-moncchichi-error animate-in zoom-in" />}
                                        {status === 'TESTING' && <Loader2 size={18} className="animate-spin text-moncchichi-accent" />}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 bg-moncchichi-bg border border-moncchichi-border rounded-lg px-3 py-2 focus-within:border-moncchichi-accent focus-within:ring-1 focus-within:ring-moncchichi-accent/50 transition-all">
                                    <input 
                                        type={isVisible ? "text" : "password"}
                                        value={values[config.id] || ''}
                                        onChange={(e) => setValues({...values, [config.id]: e.target.value})}
                                        onBlur={() => handleSave(config.id)}
                                        placeholder={config.placeholder}
                                        className="flex-1 bg-transparent text-sm text-moncchichi-text focus:outline-none font-mono placeholder-moncchichi-textSec/30"
                                    />
                                    <button 
                                        onClick={() => setVisible({...visible, [config.id]: !isVisible})}
                                        className="text-moncchichi-textSec hover:text-moncchichi-text p-1 rounded"
                                    >
                                        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                <div className="flex justify-end gap-3 mt-3">
                                    <button 
                                        onClick={() => handleTest(config.id)}
                                        disabled={isTesting || (!values[config.id] && !isOptional)}
                                        className="text-xs font-bold text-moncchichi-textSec hover:text-moncchichi-text flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-transparent hover:bg-moncchichi-surfaceAlt hover:border-moncchichi-border transition-all disabled:opacity-50"
                                    >
                                        <Activity size={14} /> Test Connection
                                    </button>
                                    <button 
                                        onClick={() => handleSave(config.id)}
                                        className="text-xs font-bold bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-text px-3 py-1.5 rounded-lg hover:bg-moncchichi-accent hover:text-moncchichi-bg hover:border-moncchichi-accent transition-all active:scale-95"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TitanVault;
