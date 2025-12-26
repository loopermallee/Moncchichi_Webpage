
import React, { useState, useEffect, useRef } from 'react';
import { ICONS, MOCK_LOGS_INIT } from './constants';
import { LogEntry, ConnectionState } from './types';
import { mockService } from './services/mockService';
import { soundService } from './services/soundService';
import { settingsService } from './services/settingsService'; 
import { permissionService } from './services/permissionService'; 
import { errorService } from './services/errorService'; 
import { transportService } from './services/transportService'; 
import { getWeather, WeatherData } from './services/weatherService';
import { weaverService } from './services/weaverService'; 
import ConsoleLog from './components/ConsoleLog';
import Dashboard from './views/Dashboard';
import Assistant from './views/Assistant';
import Teleprompter from './views/Teleprompter';
import Permissions from './views/Permissions';
import Transport from './views/Transport';
import WeatherRealtime from './views/WeatherRealtime';
import Checklist from './views/Checklist';
import Reader from './views/Reader';
import Protocol from './views/Protocol';
import CatDietCalculator from './views/CatDietCalculator';
import TitanVault from './views/TitanVault';
import QuantumWeaver from './views/QuantumWeaver'; 
import SoundStudio from './views/SoundStudio';
import Toast, { ToastType } from './components/Toast';
import { CloudLightning, Key } from 'lucide-react';

type View = 'dashboard' | 'assistant' | 'teleprompter' | 'console' | 'permissions' | 'transport' | 'weather-realtime' | 'checklist' | 'reader' | 'protocol' | 'cat-diet' | 'titan-vault' | 'quantum-weaver' | 'sound-studio';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Ref to track IDs of jobs that have already triggered a completion notification
  const notifiedJobIds = useRef<Set<string>>(new Set());

  // Global Error & Console Traps (Run Once)
  useEffect(() => {
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalInfo = console.info;
      const originalLog = console.log;
      const originalDebug = console.debug;

      const safeStringify = (args: any[]) => {
          return args.map(a => {
              if (typeof a === 'string') return a;
              if (a instanceof Error) return a.message;
              try { return JSON.stringify(a); } catch { return String(a); }
          }).join(' ');
      };

      console.error = (...args) => {
          originalError(...args);
          mockService.emitLog('SYSTEM', 'ERROR', safeStringify(args));
      };

      console.warn = (...args) => {
          originalWarn(...args);
          mockService.emitLog('SYSTEM', 'WARN', safeStringify(args));
      };

      console.info = (...args) => {
          originalInfo(...args);
          mockService.emitLog('SYSTEM', 'INFO', safeStringify(args));
      };

      console.log = (...args) => {
          originalLog(...args);
          mockService.emitLog('SYSTEM', 'INFO', safeStringify(args));
      };

      console.debug = (...args) => {
          originalDebug(...args);
          mockService.emitLog('SYSTEM', 'DEBUG', safeStringify(args));
      };

      const handleGlobalError = (event: ErrorEvent) => {
          mockService.emitLog('CRASH', 'ERROR', `${event.message} at ${event.filename}:${event.lineno}`);
      };

      const handlePromiseRejection = (event: PromiseRejectionEvent) => {
          mockService.emitLog('PROMISE', 'ERROR', `Unhandled Rejection: ${event.reason}`);
      };

      const handleOnline = () => {
          mockService.emitLog('NETWORK', 'INFO', 'Connection Restored');
          setToast({ message: "Network Online", type: "success" });
      };
      
      const handleOffline = () => {
          mockService.emitLog('NETWORK', 'WARN', 'Connection Lost - Offline Mode');
          setToast({ message: "Network Offline", type: "error" });
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handlePromiseRejection);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          console.error = originalError;
          console.warn = originalWarn;
          console.info = originalInfo;
          console.log = originalLog;
          console.debug = originalDebug;
          window.removeEventListener('error', handleGlobalError);
          window.removeEventListener('unhandledrejection', handlePromiseRejection);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  useEffect(() => {
    // Theme Persistence Application
    const theme = settingsService.get('theme');
    if (theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }

    // Subscribe to logs
    const unsubLogs = mockService.subscribeToLogs((entry) => {
      setLogs(prev => {
          if (prev.some(l => l.id === entry.id)) return prev;
          return [...prev, entry].slice(-500);
      });
    });

    // Subscribe to connection state
    let lastState = mockService.getConnectionState();
    const unsubConn = mockService.subscribeToConnection((state) => {
        setIsConnected(state === ConnectionState.CONNECTED);
        
        if (state === ConnectionState.CONNECTED && lastState !== ConnectionState.CONNECTED) {
            setToast({ message: "Connected to G1 Glasses", type: "success" });
            soundService.playClick();
        } else if (state === ConnectionState.DISCONNECTED && lastState === ConnectionState.CONNECTED) {
            setToast({ message: "Disconnected from device", type: "info" });
        } else if (state === ConnectionState.ERROR) {
            setToast({ message: "Connection failed. Check console.", type: "error" });
        }
        lastState = state;
    });

    // Subscribe to AI Error Service
    const unsubErrors = errorService.subscribe((error) => {
        soundService.playInteraction();
        setToast({ message: error.quirkyMessage, type: 'ai' });
    });

    // Subscribe to Weaver Service for background job notifications
    const unsubWeaver = weaverService.subscribe(() => {
        const activeJobs = weaverService.getActiveJobs();
        
        activeJobs.forEach(job => {
            // If a job is COMPLETE and we haven't notified the user yet
            if (job.status === 'COMPLETE' && !notifiedJobIds.current.has(job.id)) {
                notifiedJobIds.current.add(job.id);
                
                // Only show toast if user is NOT currently looking at the weaver screen
                if (currentView !== 'quantum-weaver') {
                    setToast({ message: `Analysis Complete: ${job.fileName}`, type: 'ai' });
                    soundService.playQuestComplete();
                }
            }
        });

        // Cleanup: Remove old job IDs from notified set if they are no longer in activeJobs
        // This prevents the set from growing indefinitely in very long sessions
        if (notifiedJobIds.current.size > 50) {
            const activeIds = new Set(activeJobs.map(j => j.id));
            notifiedJobIds.current.forEach(id => {
                if (!activeIds.has(id)) notifiedJobIds.current.delete(id);
            });
        }
    });

    permissionService.syncWithBrowser();
    getWeather().then(setWeather);

    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input[type="range"]') || target.closest('input[type="checkbox"]')) {
            if (!target.closest('nav')) {
                 soundService.playClick();
            }
        }
    };
    window.addEventListener('click', handleClick);

    return () => {
        unsubLogs();
        unsubConn();
        unsubErrors();
        unsubWeaver();
        window.removeEventListener('click', handleClick);
    };
  }, [currentView]); 
  
  // Background Polling for Transport Alerts
  useEffect(() => {
      const pollInterval = setInterval(async () => {
          if (currentView !== 'transport') {
              const alerts = await transportService.pollWatchedBuses();
              if (alerts.length > 0) {
                  setToast({ message: alerts[0], type: 'info' });
                  soundService.playAlert();
              }
          }
      }, 60000); 
      
      return () => clearInterval(pollInterval);
  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleShowToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const handleNavigate = (view: View) => {
      if (currentView === view) return;

      if (view === 'reader' || view === 'protocol') {
          soundService.playGrimoireOpen();
      } else if (view === 'checklist') {
          soundService.playQuestLogOpen();
      } else {
          soundService.playNavigation();
      }
      
      setCurrentView(view);
      setIsMenuOpen(false);
  };

  const NavItem = ({ id, icon, label }: { id: View; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => handleNavigate(id)}
      className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-2 pb-2 transition-all duration-200 active:scale-95 ${
        currentView === id 
          ? 'text-moncchichi-accent' 
          : 'text-moncchichi-textSec hover:text-moncchichi-text'
      }`}
    >
      <div className={`${currentView === id ? 'scale-110' : ''} transition-transform duration-200`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-moncchichi-bg text-moncchichi-text selection:bg-moncchichi-accent selection:text-moncchichi-bg overflow-hidden">
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="h-14 px-4 bg-moncchichi-surface border-b border-moncchichi-border flex items-center justify-between shrink-0 z-[100] relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg tracking-tighter uppercase text-moncchichi-accent select-none">Moncchichi</div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 transition-opacity duration-300" style={{opacity: isConnected ? 1 : 0.5}}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-moncchichi-success animate-pulse' : 'bg-moncchichi-error'}`}></div>
             <span className="text-xs font-medium text-moncchichi-textSec hidden sm:block">
                {isConnected ? "G1 Connected" : "Offline"}
             </span>
           </div>
           
           <div className="relative" ref={menuRef}>
             <button 
               onClick={() => {
                 setIsMenuOpen(!isMenuOpen);
                 soundService.playInteraction();
               }}
               className="p-2 -mr-2 text-moncchichi-textSec hover:text-moncchichi-text active:bg-moncchichi-surfaceAlt rounded-full transition-colors active:scale-95"
             >
               {ICONS.Menu}
             </button>
             
             {isMenuOpen && (
               <div className="absolute right-0 top-full mt-2 w-56 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right z-50">
                 
                 <button 
                     onClick={() => handleNavigate('weather-realtime')}
                     className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                     <div className="text-moncchichi-textSec"><CloudLightning size={20} /></div>
                     <span className="font-medium">Eye of the Storm</span>
                 </button>

                 <div className="h-px bg-moncchichi-border mx-2 my-1 opacity-50"></div>

                 <button 
                   onClick={() => handleNavigate('checklist')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Quest}</div>
                   <span>Quest Log</span>
                 </button>
                 
                 <button 
                   onClick={() => handleNavigate('transport')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Bus}</div>
                   <span>Griffin's Flight</span>
                 </button>

                 <button 
                   onClick={() => handleNavigate('reader')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Reader}</div>
                   <span>Grimoire of Knowledge</span>
                 </button>

                 <button 
                   onClick={() => handleNavigate('quantum-weaver')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Quantum}</div>
                   <span>Quantum Weaver</span>
                 </button>

                 <button 
                   onClick={() => handleNavigate('cat-diet')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.PetCalc}</div>
                   <span>Beast Mastery</span>
                 </button>
                 
                 <button 
                   onClick={() => handleNavigate('sound-studio')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.SoundStudio}</div>
                   <span>Sound Studio</span>
                 </button>

                 <div className="h-px bg-moncchichi-border mx-2 my-1 opacity-50"></div>

                 <button 
                   onClick={() => handleNavigate('teleprompter')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Teleprompter}</div>
                   <span>Teleprompter</span>
                 </button>

                 <div className="h-px bg-moncchichi-border my-1"></div>
                 
                 <button 
                   onClick={() => handleNavigate('titan-vault')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec"><Key size={20} /></div>
                   <span>Titan's Vault</span>
                 </button>

                 <button 
                   onClick={() => handleNavigate('permissions')}
                   className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-moncchichi-surface transition-colors active:bg-moncchichi-border/50"
                 >
                   <div className="text-moncchichi-textSec">{ICONS.Shield}</div>
                   <span>Permissions</span>
                 </button>
                 
                 <div className="h-px bg-moncchichi-border my-1"></div>
                 <div className="px-4 py-2 text-[10px] text-moncchichi-textSec text-center">
                   v1.7.2 (QueueFix)
                 </div>
               </div>
             )}
           </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative w-full bg-moncchichi-bg">
        <div className="absolute inset-0 overflow-y-auto scrollbar-hide overscroll-y-contain">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'assistant' && <Assistant />}
            {currentView === 'teleprompter' && <Teleprompter />}
            {currentView === 'console' && <div className="h-full p-0"><ConsoleLog logs={logs} onClear={handleClearLogs} /></div>}
            {currentView === 'permissions' && <Permissions onBack={() => handleNavigate('dashboard')} />}
            {currentView === 'transport' && <Transport onBack={() => handleNavigate('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'weather-realtime' && <WeatherRealtime onBack={() => handleNavigate('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'checklist' && <Checklist onBack={() => handleNavigate('dashboard')} />}
            {currentView === 'reader' && <Reader onBack={() => handleNavigate('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'protocol' && <Protocol onBack={() => handleNavigate('dashboard')} onShowToast={handleShowToast} />}
            {currentView === 'cat-diet' && <CatDietCalculator onBack={() => handleNavigate('dashboard')} />}
            {currentView === 'titan-vault' && <TitanVault onBack={() => handleNavigate('dashboard')} />}
            {currentView === 'quantum-weaver' && <QuantumWeaver onBack={() => handleNavigate('dashboard')} />}
            {currentView === 'sound-studio' && <SoundStudio onBack={() => handleNavigate('dashboard')} />}
          </div>
        </div>
      </main>

      <nav className="h-16 bg-moncchichi-surface border-t border-moncchichi-border flex justify-between items-stretch shrink-0 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
        <NavItem id="dashboard" icon={ICONS.Dashboard} label="Hub" />
        <NavItem id="assistant" icon={ICONS.Assistant} label="Assistant" />
        <NavItem id="protocol" icon={ICONS.Codex} label="Codex" />
        <NavItem id="console" icon={ICONS.Console} label="Console" />
      </nav>
    </div>
  );
}

export default App;
