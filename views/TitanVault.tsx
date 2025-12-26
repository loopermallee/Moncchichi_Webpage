
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { keyService, ApiId } from '../services/keyService';
import { aiService } from '../services/aiService';
import { transportService } from '../services/transportService';
import { nlbService } from '../services/nlbService';
import { realtimeWeatherService } from '../services/realtimeWeatherService';
import { Key, Eye, EyeOff, CheckCircle, XCircle, Loader2, Sparkles, Server, BookOpen, Bus, CloudLightning, Activity, Smartphone, Map as MapIcon, TrendingUp, BarChart, AlertTriangle, Clock3 } from 'lucide-react';

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

type HealthId = 'OPENAI' | 'GEMINI' | 'LTA' | 'NLB' | 'GOOGLE_MAPS';
type HealthStatus = {
    status: 'IDLE' | 'OK' | 'FAIL' | 'NOT_CONFIGURED';
    message?: string;
    checkedAt?: string;
    testing?: boolean;
};

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
    const [health, setHealth] = useState<Record<HealthId, HealthStatus>>({
        OPENAI: { status: 'IDLE' },
        GEMINI: { status: 'IDLE' },
        LTA: { status: 'IDLE' },
        NLB: { status: 'IDLE' },
        GOOGLE_MAPS: { status: 'IDLE' }
    });

    useEffect(() => {
        const loaded: any = {};
        CONFIGS.forEach(c => {
            loaded[c.id] = keyService.get(c.id);
        });
        setValues(loaded);
    }, []);

    const manualKeyMap: Record<HealthId, ApiId[]> = {
        OPENAI: ['OPENAI'],
        GEMINI: ['GEMINI'],
        LTA: ['LTA'],
        NLB: ['NLB', 'NLB_APP'],
        GOOGLE_MAPS: ['GOOGLE_MAPS']
    };

    const updateHealth = (id: HealthId, partial: Partial<HealthStatus>) => {
        setHealth(prev => ({ ...prev, [id]: { ...prev[id], ...partial } }));
    };

    const ensureBaseHealth = async () => {
        try {
            const res = await fetch('/api/health');
            const data = await res.json().catch(() => ({}));
            return res.ok && data?.ok !== false;
        } catch (e) {
            return false;
        }
    };

    const runHealthCheck = async (id: HealthId) => {
        updateHealth(id, { testing: true });
        const checkedAt = new Date().toISOString();
        try {
            if (id !== 'GOOGLE_MAPS') {
                const platformOk = await ensureBaseHealth();
                if (!platformOk) throw new Error('Platform health endpoint failed');
            }

            let ok = false;
            let message: string | undefined;

            if (id === 'LTA') {
                const res = await fetch('/api/ltaHealth');
                const data = await res.json().catch(() => ({}));
                ok = res.ok && data?.ok !== false;
                message = data?.reason;
            } else if (id === 'NLB') {
                const res = await fetch('/api/nlbHealth');
                const data = await res.json().catch(() => ({}));
                ok = res.ok && data?.ok !== false;
                message = data?.reason;
            } else if (id === 'OPENAI') {
                const res = await fetch('/api/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'ping' }) });
                ok = res.ok;
                if (!res.ok) message = 'Proxy call failed';
            } else if (id === 'GEMINI') {
                const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'ping' }) });
                ok = res.ok;
                if (!res.ok) message = 'Proxy call failed';
            } else if (id === 'GOOGLE_MAPS') {
                ok = !!values.GOOGLE_MAPS;
                message = ok ? undefined : 'No client key set';
            }

            const hasManualKey = manualKeyMap[id].every(key => values[key]);
            const notConfigured = (!ok && message?.toLowerCase().includes('missing') && !hasManualKey) || (!ok && id === 'GOOGLE_MAPS' && !values.GOOGLE_MAPS);

            updateHealth(id, { status: ok ? 'OK' : (notConfigured ? 'NOT_CONFIGURED' : 'FAIL'), message, checkedAt, testing: false });
        } catch (e: any) {
            updateHealth(id, { status: 'FAIL', message: e?.message || 'Unable to reach service', checkedAt, testing: false });
        }
    };

    const handleTestAll = async () => {
        for (const id of Object.keys(manualKeyMap) as HealthId[]) {
            await runHealthCheck(id);
        }
    };

    const handleSave = (id: ApiId) => {
        keyService.set(id, values[id]);
        setStatuses(prev => ({ ...prev, [id]: 'IDLE' }));
    };

    const renderStatus = (state: HealthStatus) => {
        if (state.testing) return <Loader2 size={16} className="animate-spin text-moncchichi-accent" />;
        if (state.status === 'OK') return <CheckCircle size={16} className="text-moncchichi-success" />;
        if (state.status === 'NOT_CONFIGURED') return <AlertTriangle size={16} className="text-yellow-400" />;
        if (state.status === 'FAIL') return <XCircle size={16} className="text-moncchichi-error" />;
        return <Clock3 size={16} className="text-moncchichi-textSec" />;
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
                <div className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-sm font-bold text-moncchichi-text">Titan's Vault Health</h3>
                            <p className="text-[11px] text-moncchichi-textSec">Proxy status for each API. Manual keys are stored locally and only used if proxies fail.</p>
                        </div>
                        <button
                            onClick={handleTestAll}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-moncchichi-border text-moncchichi-text hover:bg-moncchichi-surfaceAlt transition-all"
                        >
                            <Activity size={14} /> Test All
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {(Object.keys(manualKeyMap) as HealthId[]).map(id => {
                            const state = health[id];
                            const label = id === 'GOOGLE_MAPS' ? 'Google Maps' : id === 'LTA' ? 'LTA Proxy' : id === 'NLB' ? 'NLB Proxy' : `${id === 'OPENAI' ? 'OpenAI' : 'Gemini'} Proxy`;
                            return (
                                <div key={id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-moncchichi-border bg-moncchichi-surfaceAlt/40">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="mt-0.5">
                                            {renderStatus(state)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-moncchichi-text">{label}</div>
                                            <div className="text-[11px] text-moncchichi-textSec flex items-center gap-2">
                                                <span>{state.status === 'IDLE' ? 'Not tested yet' : state.status === 'OK' ? 'Proxy reachable' : state.status === 'NOT_CONFIGURED' ? 'Not configured' : 'Proxy failed'}</span>
                                                {state.checkedAt && <span className="text-[10px] text-moncchichi-textSec/80">Last checked: {new Date(state.checkedAt).toLocaleTimeString()}</span>}
                                            </div>
                                            {state.message && <div className="text-[11px] text-moncchichi-error mt-1">{state.message}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => runHealthCheck(id)}
                                            className="text-[11px] px-3 py-1.5 rounded-lg border border-moncchichi-border text-moncchichi-text hover:bg-moncchichi-surface transition-all disabled:opacity-50"
                                            disabled={state.testing}
                                        >
                                            {state.testing ? 'Testing...' : 'Test'}
                                        </button>
                                        {(state.status === 'FAIL' || state.status === 'NOT_CONFIGURED') && (
                                            <button
                                                onClick={() => {
                                                    const ids = manualKeyMap[id];
                                                    const next: Partial<Record<ApiId, boolean>> = { ...visible };
                                                    ids.forEach(k => next[k] = true);
                                                    setVisible(next);
                                                }}
                                                className="text-[11px] px-3 py-1.5 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-text hover:border-moncchichi-accent hover:text-moncchichi-accent transition-all"
                                            >
                                                Set manual key
                                            </button>
                                        )}
                                        {manualKeyMap[id].some(k => values[k]) && (
                                            <button
                                                onClick={() => {
                                                    const nextValues = { ...values } as Record<ApiId, string>;
                                                    manualKeyMap[id].forEach(key => { nextValues[key] = ''; keyService.set(key, ''); });
                                                    setValues(nextValues);
                                                }}
                                                className="text-[11px] px-3 py-1.5 rounded-lg border border-moncchichi-border text-moncchichi-text hover:bg-moncchichi-surface transition-all"
                                            >
                                                Clear manual key
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-moncchichi-surfaceAlt/30 border border-moncchichi-border p-4 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-moncchichi-accent/10 rounded-full text-moncchichi-accent shrink-0">
                        <Key size={20} />
                    </div>
                    <div className="text-sm text-moncchichi-textSec leading-relaxed">
                        <span className="font-bold text-moncchichi-text block mb-1">Secure Storage</span>
                        Keys are stored locally on your device. They are never sent to our servers. Manual keys act as a fallback when proxies are unavailable and remain on this device.
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
