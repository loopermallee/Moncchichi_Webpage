
import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { ICONS } from '../constants';
import { Terminal, ArrowDown, AlertTriangle, AlertCircle, Filter, Ban, X, Clock, Calendar, Copy, Check, Search } from 'lucide-react';

interface ConsoleLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

const TAG_COLORS: Record<string, string> = {
  BLE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  RX: 'bg-green-500/10 text-green-400 border-green-500/20',
  TX: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SERVICE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VITALS: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  AI: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  APP: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  
  // New Process Tags
  TRANSPORT: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  GPS: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  ROUTE: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  WEAVER: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  CODEX: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NLB: 'bg-red-500/10 text-red-400 border-red-500/20',
  NETWORK: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  SYSTEM: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  
  DEFAULT: 'bg-gray-700/10 text-gray-400 border-gray-600/20'
};

const FILTER_TAGS = ['BLE', 'RX', 'TX', 'SERVICE', 'VITALS', 'AI', 'TRANSPORT', 'GPS', 'WEAVER', 'CODEX', 'NLB', 'NETWORK', 'SYSTEM'];

type SeverityFilter = 'ALL' | 'ERROR_ONLY' | 'ERROR_WARN';

const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs, onClear }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Scroll & Pinning State
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [hasPendingNewLogs, setHasPendingNewLogs] = useState(false);

  // Inspector State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);

  // Compute filtered logs based on Tag, Severity, AND Search Query
  const filteredLogs = logs.filter(l => {
      // 1. Tag Filter
      const tagMatch = activeFilter ? l.tag === activeFilter : true;
      
      // 2. Severity Filter
      let severityMatch = true;
      if (severityFilter === 'ERROR_ONLY') severityMatch = l.level === 'ERROR';
      if (severityFilter === 'ERROR_WARN') severityMatch = l.level === 'ERROR' || l.level === 'WARN';

      // 3. Search Query (Text)
      let searchMatch = true;
      if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          searchMatch = 
              l.message.toLowerCase().includes(q) || 
              l.tag.toLowerCase().includes(q) || 
              l.level.toLowerCase().includes(q);
      }

      return tagMatch && severityMatch && searchMatch;
  });

  // Track logs length to detect new arrivals
  const prevLogsLength = useRef(logs.length);

  // Effect: Handle Auto-Scroll
  useEffect(() => {
    if (isPinnedToBottom) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, isPinnedToBottom]);

  // Effect: Detect new logs while unpinned
  useEffect(() => {
      if (logs.length > prevLogsLength.current) {
          if (!isPinnedToBottom) {
              setHasPendingNewLogs(true);
          }
      }
      prevLogsLength.current = logs.length;
  }, [logs.length, isPinnedToBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
      // 20px threshold to consider "at bottom"
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 20;

      if (isAtBottom) {
          setIsPinnedToBottom(true);
          setHasPendingNewLogs(false);
      } else {
          setIsPinnedToBottom(false);
      }
  };

  const jumpToBottom = () => {
      setIsPinnedToBottom(true);
      setHasPendingNewLogs(false);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-moncchichi-error';
      case 'WARN': return 'text-moncchichi-warning';
      case 'DEBUG': return 'text-moncchichi-accent';
      default: return 'text-moncchichi-textSec';
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    }) + '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  const serializeLogs = (targetLogs: LogEntry[]) => {
    return targetLogs.map(l => {
        const date = new Date(l.timestamp).toISOString();
        return `${date} [${l.level}] [${l.tag}] ${l.message}`;
    }).join('\n');
  };

  const handleCopy = () => {
    const text = serializeLogs(filteredLogs);
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(console.error);
    } else {
        console.warn("Clipboard API not supported");
    }
  };

  const handleCopyEntry = (log: LogEntry) => {
      const text = `${new Date(log.timestamp).toISOString()} [${log.level}] [${log.tag}] ${log.message}`;
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
              setCopiedEntryId(log.id);
              setTimeout(() => setCopiedEntryId(null), 2000);
          }).catch(console.error);
      }
  };

  const handleExport = () => {
    const text = serializeLogs(filteredLogs);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moncchichi-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTagClick = (tag: string) => {
      setActiveFilter(prev => prev === tag ? null : tag);
  };

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg font-mono text-xs sm:text-sm relative overflow-hidden">
      {/* Header */}
      <div className="bg-moncchichi-surface p-2 px-3 border-b border-moncchichi-border flex items-center gap-3 sticky top-0 z-10 shadow-sm h-14 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-moncchichi-text font-bold hidden sm:block">Console</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-textSec whitespace-nowrap">
            {filteredLogs.length} / {logs.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-[80px] relative">
            <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full bg-moncchichi-bg border border-moncchichi-border rounded-lg pl-8 pr-8 py-1.5 text-xs text-moncchichi-text focus:outline-none focus:border-moncchichi-accent transition-colors placeholder-moncchichi-textSec/50"
            />
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-moncchichi-textSec" />
            {searchQuery && (
                <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-moncchichi-textSec hover:text-moncchichi-text"
                >
                    <X size={14} />
                </button>
            )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleCopy} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {copied ? <span className="text-moncchichi-success">{ICONS.Check}</span> : ICONS.Copy}
          </button>
          <button onClick={handleExport} className="p-2 text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {ICONS.Export}
          </button>
          <div className="w-px h-4 bg-moncchichi-border mx-1"></div>
          <button onClick={onClear} className="p-2 text-moncchichi-textSec hover:text-moncchichi-error hover:bg-moncchichi-surfaceAlt rounded-lg transition-colors">
            {ICONS.Clear}
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div 
        className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 relative" 
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-moncchichi-textSec opacity-50 gap-2">
            <Terminal size={32} />
            {logs.length > 0 ? (
                <>
                    <span>No logs match current filters</span>
                    <div className="flex gap-2 mt-2 flex-wrap justify-center">
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="text-xs text-moncchichi-accent hover:underline border border-moncchichi-accent/30 px-3 py-1 rounded-full hover:bg-moncchichi-accent/10 flex items-center gap-1"
                            >
                                <X size={12} /> Clear Search
                            </button>
                        )}
                        {activeFilter && (
                            <button 
                                onClick={() => setActiveFilter(null)}
                                className="text-xs text-moncchichi-accent hover:underline border border-moncchichi-accent/30 px-3 py-1 rounded-full hover:bg-moncchichi-accent/10"
                            >
                                Clear Tag: {activeFilter}
                            </button>
                        )}
                        {severityFilter !== 'ALL' && (
                            <button 
                                onClick={() => setSeverityFilter('ALL')}
                                className="text-xs text-moncchichi-accent hover:underline border border-moncchichi-accent/30 px-3 py-1 rounded-full hover:bg-moncchichi-accent/10"
                            >
                                Clear Severity
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <span>No logs available</span>
            )}
          </div>
        )}
        {filteredLogs.map((log) => {
          const isExpanded = expandedLogId === log.id;
          return (
            <div key={log.id} className="flex flex-col">
              <div 
                className={`flex gap-2 p-1 border-l-2 border-transparent hover:bg-moncchichi-surfaceAlt/50 hover:border-moncchichi-border group cursor-pointer ${isExpanded ? 'bg-moncchichi-surfaceAlt/30 border-moncchichi-border/50' : ''}`}
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              >
                <span className="text-gray-600 whitespace-nowrap select-none text-[10px] pt-0.5 font-medium min-w-[60px]">
                  {formatTime(log.timestamp)}
                </span>
                <div className="flex-1 break-words">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleTagClick(log.tag); }}
                    className={`font-bold text-[10px] mr-1.5 px-1.5 py-0.5 rounded border align-middle inline-block mb-0.5 hover:brightness-125 transition-all cursor-pointer ${
                        TAG_COLORS[log.tag] || TAG_COLORS.DEFAULT
                    }`}
                    title="Click to filter by this tag"
                  >
                    {log.tag}
                  </button>
                  <span className={`${getLevelColor(log.level)} leading-tight select-text`}>
                    {log.message}
                  </span>
                </div>
              </div>

              {/* Detail View */}
              {isExpanded && (
                <div className="ml-[68px] mb-2 p-3 bg-moncchichi-surfaceAlt/40 rounded-lg border border-moncchichi-border/50 animate-in slide-in-from-top-1 text-xs">
                    <div className="flex justify-between items-start mb-2 pb-2 border-b border-moncchichi-border/30">
                        <div className="flex flex-col gap-1 text-[10px] text-moncchichi-textSec font-mono opacity-80">
                            <div className="flex items-center gap-2">
                                <Calendar size={10} />
                                <span>{new Date(log.timestamp).toISOString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`uppercase font-bold ${getLevelColor(log.level)}`}>{log.level}</span>
                                <span>•</span>
                                <span>ID: {log.id}</span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCopyEntry(log); }}
                            className="flex items-center gap-1.5 px-2 py-1 bg-moncchichi-surface border border-moncchichi-border rounded hover:bg-moncchichi-accent hover:text-moncchichi-bg transition-colors text-[10px] font-bold text-moncchichi-textSec"
                        >
                            {copiedEntryId === log.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedEntryId === log.id ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className={`whitespace-pre-wrap font-mono leading-relaxed select-text ${getLevelColor(log.level)}`}>
                        {log.message}
                    </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} className="h-2" />
        
        {/* Floating Jump Button */}
        {hasPendingNewLogs && (
            <div className="sticky bottom-2 flex justify-center w-full pointer-events-none">
                <button 
                    onClick={jumpToBottom}
                    className="pointer-events-auto flex items-center gap-2 bg-moncchichi-accent text-moncchichi-bg px-4 py-2 rounded-full shadow-lg font-bold text-xs animate-in slide-in-from-bottom-2 hover:scale-105 transition-transform"
                >
                    <ArrowDown size={14} />
                    New Logs
                </button>
            </div>
        )}
      </div>

      {/* Filter Bar (Sticky Bottom) */}
      <div className="bg-moncchichi-surface border-t border-moncchichi-border p-2 shrink-0 z-10 flex flex-col sm:flex-row gap-2 sm:items-center">
        
        {/* Top Row (Mobile): Severity + Mobile Reset */}
        <div className="flex items-center justify-between gap-2 shrink-0">
            {/* Severity Toggles */}
            <div className="flex bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border shrink-0">
                <button 
                    onClick={() => setSeverityFilter('ALL')}
                    className={`px-3 py-1.5 rounded-l-lg text-[10px] font-bold transition-colors ${severityFilter === 'ALL' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                >
                    All
                </button>
                <div className="w-px bg-moncchichi-border"></div>
                <button 
                    onClick={() => setSeverityFilter('ERROR_WARN')}
                    className={`px-3 py-1.5 text-[10px] font-bold transition-colors flex items-center gap-1 ${severityFilter === 'ERROR_WARN' ? 'bg-moncchichi-warning text-moncchichi-bg' : 'text-moncchichi-textSec hover:text-moncchichi-warning'}`}
                >
                    <AlertTriangle size={10} /> Alerts
                </button>
                <div className="w-px bg-moncchichi-border"></div>
                <button 
                    onClick={() => setSeverityFilter('ERROR_ONLY')}
                    className={`px-3 py-1.5 rounded-r-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${severityFilter === 'ERROR_ONLY' ? 'bg-moncchichi-error text-white' : 'text-moncchichi-textSec hover:text-moncchichi-error'}`}
                >
                    <AlertCircle size={10} /> Errors
                </button>
            </div>

            {/* Mobile Reset Button */}
            {(activeFilter || severityFilter !== 'ALL' || searchQuery) && (
                <button 
                    onClick={() => { setActiveFilter(null); setSeverityFilter('ALL'); setSearchQuery(''); }}
                    className="sm:hidden text-[10px] text-moncchichi-textSec px-3 py-1.5 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg hover:text-moncchichi-text flex items-center gap-1 font-bold whitespace-nowrap"
                >
                    <Ban size={12} /> Reset
                </button>
            )}
        </div>

        {/* Desktop Divider */}
        <div className="hidden sm:block w-px h-6 bg-moncchichi-border mx-1 shrink-0"></div>

        {/* Tag Filters Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1 sm:flex-wrap sm:overflow-visible">
             <Filter size={14} className="text-moncchichi-textSec shrink-0 hidden sm:block" />
             {FILTER_TAGS.map(tag => (
                <button
                    key={tag}
                    onClick={() => setActiveFilter(activeFilter === tag ? null : tag)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                        activeFilter === tag 
                        ? 'bg-moncchichi-text text-moncchichi-bg border-moncchichi-text shadow-sm' 
                        : (TAG_COLORS[tag] || TAG_COLORS.DEFAULT) + ' hover:brightness-125 opacity-80 hover:opacity-100'
                    }`}
                >
                    {tag}
                </button>
             ))}

             {/* Desktop Reset Button */}
             {(activeFilter || severityFilter !== 'ALL' || searchQuery) && (
                <button 
                    onClick={() => { setActiveFilter(null); setSeverityFilter('ALL'); setSearchQuery(''); }}
                    className="hidden sm:flex text-[10px] text-moncchichi-textSec ml-auto px-2 hover:text-moncchichi-text items-center gap-1 whitespace-nowrap shrink-0"
                >
                    <Ban size={12} /> Reset
                </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default ConsoleLog;
