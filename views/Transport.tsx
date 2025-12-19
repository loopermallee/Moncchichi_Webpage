
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ICONS } from '../constants';
import { transportService, BusServiceData, BusStopLocation, ArrivalInfo, MRTLine, MRTStation, TrainServiceAlert, StationCrowdData, StationAccessibility, BusRoutePattern, ParsedFirstLastSchedule } from '../services/transportService';
import { busService } from '../services/busService';
import { locationService } from '../services/locationService';
import { soundService } from '../services/soundService';
import { Accessibility, Search, Star, ChevronDown, ChevronUp, MapPin, RotateCcw, Edit2, Check, BusFront, TrainFront, Users, AlertTriangle, Loader2, RefreshCw, WifiOff, Lock, ChevronsUp, ChevronsDown, Eye, HelpCircle, Ghost, XCircle, Clock, X, Map as MapIcon, MoreHorizontal, Flag, Database, Trash2, Download, Route, Moon, Calendar, Zap, Plus, Lightbulb, Sun, Sunrise, Sunset, Bed, Gauge, ArrowRight, Car } from 'lucide-react';
import RouteMap from '../components/RouteMap'; // Unified Map Component
import { motion, AnimatePresence } from 'framer-motion';

interface StopWithArrivals extends BusStopLocation {
    services: BusServiceData[];
    isLoading?: boolean;
    error?: string;
}

type TransportMode = 'BUS' | 'TRAIN';

interface TransportProps {
  onBack: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

// --- Extracted Components to prevent Re-render Loops ---

const RefreshTimer: React.FC<{ lastUpdated: number | null, onRefresh: () => void, isLoading: boolean }> = ({ lastUpdated, onRefresh, isLoading }) => {
    const [progress, setProgress] = useState(0);
    const [timeLabel, setTimeLabel] = useState("Syncing...");
    const [secondsLeft, setSecondsLeft] = useState(60);

    useEffect(() => {
        if (!lastUpdated) {
            setProgress(0);
            setTimeLabel("Waiting...");
            setSecondsLeft(60);
            return;
        }

        const update = () => {
            const now = Date.now();
            const diff = now - lastUpdated;
            const cycle = 60000; // 60 seconds
            
            // Progress Bar (0 to 100%)
            const pct = Math.min((diff / cycle) * 100, 100);
            setProgress(pct);

            // Countdown Timer
            const remaining = Math.max(0, cycle - diff);
            setSecondsLeft(Math.ceil(remaining / 1000));

            const mins = Math.floor(diff / 60000);
            
            if (diff > 300000) setTimeLabel(`Stale (${mins}m)`);
            else if (diff > 120000) setTimeLabel(`Delayed (${mins}m)`);
            else if (diff < 60000) setTimeLabel("Live");
            else setTimeLabel(`${mins}m ago`);
        };

        update();
        const tick = setInterval(update, 250);
        return () => clearInterval(tick);
    }, [lastUpdated]);

    let barColor = "bg-moncchichi-success";
    let textColor = "text-moncchichi-textSec";

    if (progress >= 85) {
        barColor = "bg-moncchichi-error";
        if (progress >= 100) textColor = "text-moncchichi-error";
    } else if (progress >= 50) {
        barColor = "bg-moncchichi-warning";
    }

    return (
        <div className="flex items-center gap-3">
            <div className="flex flex-col items-end min-w-[60px]">
                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
                    {isLoading && <Loader2 size={10} className="animate-spin" />}
                    {timeLabel}
                </div>
                <div className="w-full h-1 bg-moncchichi-surfaceAlt rounded-full overflow-hidden mt-1 relative">
                    <div 
                        className={`h-full rounded-full transition-all duration-300 ease-linear ${barColor} ${isLoading ? 'opacity-50' : 'opacity-100'}`}
                        style={{ width: `${progress}%` }} 
                    />
                </div>
                <div className="text-[9px] font-mono text-moncchichi-textSec opacity-70 mt-0.5">{secondsLeft}s</div>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onRefresh(); }} 
                disabled={isLoading}
                className="p-2 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border text-moncchichi-textSec hover:text-moncchichi-text active:scale-90 transition-all"
            >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
        </div>
    );
};

const TimingBadge: React.FC<{ arrival: ArrivalInfo | null, label?: string, isLocked: boolean }> = ({ arrival, label, isLocked }) => {
    // Fail Gracefully: Locked but no data
    if (!arrival && isLocked) {
        return (
           <div className="flex flex-col items-center w-12">
                <span className="text-[9px] text-moncchichi-textSec font-bold uppercase mb-0.5">{label}</span>
                <div className="relative w-full h-8">
                    <div className="w-full h-full flex items-center justify-center rounded border-b-2 bg-moncchichi-surfaceAlt border-moncchichi-warning/50 text-moncchichi-warning">
                        <HelpCircle size={14} />
                    </div>
                </div>
            </div>
        );
    }

    // General Fail Gracefully: Missing data
    if (!arrival) return (
        <div className="flex flex-col items-center w-12 opacity-50">
            <span className="text-[9px] text-moncchichi-textSec font-bold uppercase mb-0.5">{label}</span>
            <Ghost size={18} className="text-moncchichi-textSec mt-1" />
        </div>
    );

    const loadColors = {
        'SEA': 'border-moncchichi-success text-moncchichi-success',
        'SDA': 'border-moncchichi-warning text-moncchichi-warning',
        'LSD': 'border-moncchichi-error text-moncchichi-error',
    }[arrival.load] || 'border-moncchichi-textSec text-moncchichi-textSec';

    return (
        <div className="flex flex-col items-center w-12">
            <span className="text-[9px] text-moncchichi-textSec font-bold uppercase mb-0.5">{label}</span>
            <div className="relative w-full h-8">
                <div className={`w-full h-full flex items-center justify-center rounded border-b-2 bg-moncchichi-surfaceAlt ${loadColors}`}>
                    <span className="text-sm font-bold text-moncchichi-text">
                        {arrival.mins <= 0 ? 'Arr' : arrival.mins}
                    </span>
                </div>
                
                {/* Trend & Status Indicators - Positioned relative to the box now */}
                {isLocked && (
                    <div className={`absolute -top-2 -right-2 p-0.5 rounded-full bg-moncchichi-surface border border-moncchichi-border shadow-sm z-10`}>
                        {arrival.trend === 'NEW' && <Eye size={10} className="text-blue-400" />}
                        {arrival.trend === 'FASTER' && <ChevronsUp size={10} className="text-moncchichi-success" strokeWidth={3} />}
                        {arrival.trend === 'SLOWER' && <ChevronsDown size={10} className="text-moncchichi-error" strokeWidth={3} />}
                        {(!arrival.trend || arrival.trend === 'SAME') && <div className="w-2 h-2 rounded-full bg-moncchichi-textSec/50" />}
                    </div>
                )}
            </div>
            
            <span className="text-[8px] text-moncchichi-textSec mt-0.5 scale-90">{arrival.type === 'DD' ? 'Double' : 'Single'}</span>
        </div>
    );
};

const DynamicTimeBar: React.FC<{ start: string | null, end: string | null, isActive: boolean }> = ({ start, end, isActive }) => {
    // Current Time Calculation
    const [currentTime, setCurrentTime] = useState<number>(0);
    
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            let val = now.getHours() + now.getMinutes() / 60;
            // Handle late night edge case (00:00 - 04:00) as end of previous cycle for visualization
            if (val < 4) val += 24;
            setCurrentTime(val);
        };
        updateTime();
        // Update every minute
        const timer = setInterval(updateTime, 60000);
        return () => clearInterval(timer);
    }, []);

    if (!start || !end) return <div className="h-2 w-full bg-moncchichi-surfaceAlt/30 rounded-full" />;
    
    // Parse HHMM to float hours
    const parseTime = (t: string) => {
        let h = parseInt(t.slice(0, 2)) + parseInt(t.slice(2)) / 60;
        // If start time is very early (e.g. 00:30), assume it's late night service
        if (h < 4) h += 24; 
        return h;
    };
    
    const s = parseTime(start);
    let e = parseTime(end);
    
    // If end is before start, it implies crossing midnight (e.g. 0600 to 0100)
    if (e < s) e += 24;
    
    // Duration in hours
    const duration = e - s;
    if (duration <= 0) return null;

    // Calculate percentage position of current time within the operating window
    // 0% = First Bus, 100% = Last Bus
    let pct = ((currentTime - s) / duration) * 100;
    
    // Icon Logic
    let isSleeping = false;
    let displayIcon = <Sun size={12} className="text-yellow-400" />;
    
    if (pct < 0) {
        // Before first bus
        isSleeping = true;
        pct = 0; // Clamp to start
    } else if (pct > 100) {
        // After last bus
        isSleeping = true;
        pct = 100; // Clamp to end
    } else {
        // Active hours: Determine icon based on actual time
        const actualHour = currentTime % 24;
        if (actualHour >= 6 && actualHour < 12) displayIcon = <Sunrise size={12} className="text-orange-400" />;
        else if (actualHour >= 12 && actualHour < 17) displayIcon = <Sun size={12} className="text-yellow-400" />;
        else if (actualHour >= 17 && actualHour < 20) displayIcon = <Sunset size={12} className="text-orange-500" />;
        else displayIcon = <Moon size={12} className="text-blue-300" />;
    }

    // Dynamic Gradient Background Logic
    // We construct a gradient based on the time range covered by the bar
    const getColorForHour = (h: number) => {
        const hour = h % 24;
        if (hour >= 5 && hour < 7) return '#fb923c'; // Sunrise (Orange)
        if (hour >= 7 && hour < 17) return '#38bdf8'; // Day (Sky Blue)
        if (hour >= 17 && hour < 19) return '#a855f7'; // Sunset (Purple)
        return '#1e1b4b'; // Night (Dark Blue)
    };

    const steps = 6;
    let gradientStops = [];
    for (let i = 0; i <= steps; i++) {
        const h = s + (duration * (i / steps));
        const color = getColorForHour(h);
        gradientStops.push(`${color} ${(i / steps) * 100}%`);
    }
    const gradientStyle = `linear-gradient(to right, ${gradientStops.join(', ')})`;

    const formatTime = (t: string) => `${t.slice(0,2)}:${t.slice(2)}`;

    return (
        <div className="relative pt-6 pb-2 select-none w-full">
            {/* Markers (Start/End Times) */}
            <div className="flex justify-between w-full text-[9px] font-bold text-moncchichi-textSec absolute top-0">
                <div className="flex flex-col items-start">
                    <span className="text-moncchichi-accent">First</span>
                    <span>{formatTime(start)}</span>
                </div>
                {/* Current Time Label (Floating with icon) */}
                {/* Handled by icon popover or separate label? Let's keep it simple */}
                <div className="flex flex-col items-end">
                    <span className="text-moncchichi-accent">Last</span>
                    <span>{formatTime(end)}</span>
                </div>
            </div>

            {/* The Bar Track */}
            <div className="relative h-2.5 w-full rounded-full mt-1 overflow-hidden border border-moncchichi-border/50">
                {/* Gradient Background representing Day Cycle */}
                <div 
                    className="absolute inset-0 w-full h-full opacity-80"
                    style={{ background: gradientStyle }} 
                />
            </div>

            {/* The Traveler (Only shown if this row is active/today) */}
            {isActive && (
                <div 
                    className="absolute top-[22px] w-7 h-7 -ml-3.5 bg-moncchichi-surface border-2 border-moncchichi-border rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center z-10 transition-all duration-700 ease-in-out"
                    style={{ left: `${pct}%` }}
                >
                    {isSleeping ? (
                        <div className="animate-in zoom-in duration-300">
                             <Bed size={14} className="text-moncchichi-textSec" />
                        </div>
                    ) : (
                        <div className="animate-in zoom-in spin-in-12 duration-500">
                             {displayIcon}
                        </div>
                    )}
                </div>
            )}
            
            {/* Label for Current Status if Sleeping */}
            {isActive && isSleeping && (
                <div 
                    className="absolute top-14 text-[9px] font-bold text-moncchichi-textSec bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border/50 transition-all duration-700"
                    style={{ left: pct > 50 ? 'auto' : '0', right: pct > 50 ? '0' : 'auto' }}
                >
                    {pct > 50 ? "Service Ended" : "Not Started"}
                </div>
            )}
        </div>
    );
}

const BusScheduleViewer: React.FC<{ stopId: string, serviceNo: string }> = ({ stopId, serviceNo }) => {
  const [schedule, setSchedule] = useState<ParsedFirstLastSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      let active = true;
      setLoading(true);
      
      const fetchSchedule = async () => {
          const res = await transportService.getStopSchedule(stopId, serviceNo);
          if (active) {
              setSchedule(res);
              setLoading(false);
          }
      };
      
      fetchSchedule();
      return () => { active = false; };
  }, [stopId, serviceNo]);
  
  if (loading) return (
      <div className="p-3 bg-moncchichi-surfaceAlt/20 rounded-lg mt-2 flex justify-center">
          <Loader2 size={16} className="animate-spin text-moncchichi-accent" />
      </div>
  );

  if (!schedule) return (
      <div className="p-3 bg-moncchichi-surfaceAlt/20 rounded-lg mt-2 text-center">
          <span className="text-xs text-moncchichi-textSec">Schedule unavailable for {serviceNo}</span>
      </div>
  );

  const day = new Date().getDay(); // 0=Sun, 6=Sat
  const isSun = day === 0;
  const isSat = day === 6;
  const isWd = !isSun && !isSat;

  return (
     <div className="p-4 bg-moncchichi-surfaceAlt/10 border border-moncchichi-border/50 rounded-xl mt-2 text-xs animate-in slide-in-from-top-2">
        <div className="space-y-8 pb-2">
            {/* Weekday Row */}
            <div className={isWd ? "opacity-100" : "opacity-40 grayscale"}>
                <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${isWd ? 'text-moncchichi-accent' : 'text-moncchichi-textSec'}`}>Weekdays</span>
                    {isWd && <span className="text-[9px] bg-moncchichi-accent/10 text-moncchichi-accent px-1.5 py-0.5 rounded border border-moncchichi-accent/20">Today</span>}
                </div>
                <DynamicTimeBar start={schedule.wdFirst} end={schedule.wdLast} isActive={isWd} />
            </div>

            {/* Saturday Row */}
            <div className={isSat ? "opacity-100" : "opacity-40 grayscale"}>
                <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${isSat ? 'text-moncchichi-accent' : 'text-moncchichi-textSec'}`}>Saturdays</span>
                    {isSat && <span className="text-[9px] bg-moncchichi-accent/10 text-moncchichi-accent px-1.5 py-0.5 rounded border border-moncchichi-accent/20">Today</span>}
                </div>
                <DynamicTimeBar start={schedule.satFirst} end={schedule.satLast} isActive={isSat} />
            </div>

            {/* Sunday Row */}
            <div className={isSun ? "opacity-100" : "opacity-40 grayscale"}>
                <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${isSun ? 'text-moncchichi-accent' : 'text-moncchichi-textSec'}`}>Sun / PH</span>
                    {isSun && <span className="text-[9px] bg-moncchichi-accent/10 text-moncchichi-accent px-1.5 py-0.5 rounded border border-moncchichi-accent/20">Today</span>}
                </div>
                <DynamicTimeBar start={schedule.sunFirst} end={schedule.sunLast} isActive={isSun} />
            </div>
        </div>
     </div>
  )
}

const ArrivalItem: React.FC<{ 
    bus: BusServiceData; 
    stopName?: string;
    stopId?: string; // Add stopId prop
    isLocked: boolean;
    onToggleLock: () => void;
    onShowRoute: () => void;
    destinationSequence?: number | null; // Pass sequence number
}> = ({ bus, stopName, stopId, isLocked, onToggleLock, onShowRoute, destinationSequence }) => {
    
    const [showSchedule, setShowSchedule] = useState(false);
    const [schedule, setSchedule] = useState<ParsedFirstLastSchedule | null>(null);
    const intervalStr = transportService.getBusInterval(bus) || '--';
    const isUrgent = isLocked && bus.next && bus.next.mins <= 3;
    const longPressTimer = useRef<any>(null);
    const isLongPress = useRef(false);
    const effectiveStopId = bus.stopId || stopId;
    
    // Check if this bus has an active destination
    const destination = (bus.stopId || stopId) ? transportService.getDestinationWatch(bus.serviceNo, bus.stopId || stopId!) : undefined;

    // Load Schedule Async for Label
    useEffect(() => {
        if (effectiveStopId && bus.serviceNo) {
            // Note: Use 'then' as we are in useEffect
            transportService.getStopSchedule(effectiveStopId, bus.serviceNo).then(setSchedule);
        }
    }, [effectiveStopId, bus.serviceNo]);

    const handleTouchStart = () => {
        isLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
            onShowRoute();
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleBusNumberClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLongPress.current) {
            isLongPress.current = false;
            return;
        }
        onToggleLock();
    };

    // Calculate today's schedule for compact view
    let todayScheduleLabel = "";
    if (schedule) {
        const day = new Date().getDay();
        let start, end;
        if (day === 0) { start = schedule.sunFirst; end = schedule.sunLast; }
        else if (day === 6) { start = schedule.satFirst; end = schedule.satLast; }
        else { start = schedule.wdFirst; end = schedule.wdLast; }
        
        if (start && end) {
            const fmt = (t: string) => `${t.slice(0,2)}:${t.slice(2)}`;
            todayScheduleLabel = `Today: ${fmt(start)} - ${fmt(end)}`;
        }
    }

    // --- Not In Service Logic (First/Last Bus Check) ---
    if (!bus.next) {
        let statusMsg = "Not In Service";
        let StatusIcon = Moon;
        let timeDetail = "";

        if (schedule) {
            const now = new Date();
            const day = now.getDay(); // 0=Sun, 6=Sat
            const hour = now.getHours();
            const minute = now.getMinutes();
            const currTime = hour * 100 + minute; // e.g. 2330 or 600

            let first = null;
            let last = null;

            if (day === 0) { // Sunday/PH
                first = schedule.sunFirst; 
                last = schedule.sunLast;
            } else if (day === 6) { // Saturday
                first = schedule.satFirst; 
                last = schedule.satLast;
            } else { // Weekday
                first = schedule.wdFirst; 
                last = schedule.wdLast;
            }

            if (first && last) {
                const firstVal = parseInt(first);
                const lastVal = parseInt(last);
                
                if (currTime < firstVal && currTime > 400) {
                    statusMsg = "Starts Soon";
                    timeDetail = `${first.slice(0,2)}:${first.slice(2)}`;
                    StatusIcon = Clock;
                } else if (currTime > lastVal && currTime > firstVal) {
                    statusMsg = "Operation Ended";
                    timeDetail = `${last.slice(0,2)}:${last.slice(2)}`;
                    StatusIcon = Moon;
                } else if (currTime < firstVal && currTime <= 400) {
                        statusMsg = "First Bus";
                        timeDetail = `${first.slice(0,2)}:${first.slice(2)}`;
                        StatusIcon = Clock;
                } else {
                    // Fallback or "Active but no prediction"
                    statusMsg = "No Prediction";
                    StatusIcon = AlertTriangle;
                }
            }
        }

        return (
            <div className="w-full">
                <div 
                    className="p-3 select-none bg-moncchichi-surfaceAlt/5 hover:bg-moncchichi-surfaceAlt/10 transition-colors flex items-center justify-between group cursor-pointer"
                    onClick={() => setShowSchedule(!showSchedule)}
                >
                    <div 
                        className="flex items-center gap-3 mr-2 relative active:scale-95 transition-transform" 
                        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
                    >
                        <div className={`w-14 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 border transition-colors ${
                            isLocked 
                            ? 'border-moncchichi-accent/30 bg-moncchichi-accent/5 text-moncchichi-accent opacity-70' 
                            : 'border-moncchichi-border bg-moncchichi-surfaceAlt text-moncchichi-textSec opacity-40'
                        }`}>
                            <span className="font-bold text-base leading-none">{bus.serviceNo}</span>
                            <span className="text-[9px] mt-0.5 scale-90 uppercase">{bus.operator}</span>
                        </div>
                        {isLocked && (
                            <div className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-moncchichi-surface border border-moncchichi-accent/50 shadow-sm text-moncchichi-accent">
                                <Lock size={10} strokeWidth={3} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center opacity-60 group-hover:opacity-90 transition-opacity">
                        <div className="flex items-center gap-1.5 text-moncchichi-textSec mb-0.5">
                            <StatusIcon size={12} className={timeDetail ? "text-moncchichi-text" : "text-moncchichi-accent"} />
                            <span className="text-[10px] font-bold">{timeDetail || "Zzz..."}</span>
                        </div>
                        <span className="text-[9px] text-moncchichi-textSec font-bold uppercase tracking-wider">{statusMsg}</span>
                    </div>

                    <div className="w-12 flex justify-end items-center gap-2 pr-2">
                         <div className={`transition-transform duration-300 text-moncchichi-textSec ${showSchedule ? 'rotate-180 text-moncchichi-accent' : ''}`}>
                             <ChevronDown size={16} />
                         </div>
                    </div>
                </div>
                {showSchedule && effectiveStopId && (
                    <div className="px-3 pb-3">
                        <BusScheduleViewer stopId={effectiveStopId} serviceNo={bus.serviceNo} />
                    </div>
                )}
            </div>
        );
    }

    const getIntervalStyle = (str: string) => {
        if (str === '--') return 'bg-moncchichi-surfaceAlt border-moncchichi-border text-moncchichi-textSec';
        const mins = parseInt(str);
        if (isNaN(mins)) return 'bg-moncchichi-surfaceAlt border-moncchichi-border text-moncchichi-textSec'; 
        if (mins < 8) return 'bg-moncchichi-success/10 border-moncchichi-success/30 text-moncchichi-success';
        if (mins < 15) return 'bg-moncchichi-warning/10 border-moncchichi-warning/30 text-moncchichi-warning';
        return 'bg-moncchichi-error/10 border-moncchichi-error/30 text-moncchichi-error';
    };

    return (
      <div 
        className={`flex flex-col w-full select-none ${isUrgent ? 'bg-moncchichi-error/5' : ''} ${destination ? 'bg-moncchichi-accent/5' : ''}`}
      >
          <div 
            className="p-3 flex items-center justify-between hover:bg-moncchichi-surfaceAlt/30 transition-colors"
          >
              <div 
                className="flex items-center gap-3 mr-2 relative group cursor-pointer active:scale-95 transition-transform" 
                onClick={handleBusNumberClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
              >
                  <div className={`w-14 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-sm transition-all duration-300 border ${
                      isUrgent ? 'bg-moncchichi-error/20 border-moncchichi-error animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 
                      (isLocked ? 'bg-moncchichi-accent/10 border-moncchichi-accent' : 'bg-moncchichi-surfaceAlt border-moncchichi-border')
                  }`}>
                      <span className={`font-bold text-base leading-none ${isUrgent ? 'text-moncchichi-error' : (isLocked ? 'text-moncchichi-accent' : 'text-moncchichi-text')}`}>{bus.serviceNo}</span>
                      <span className="text-[9px] text-moncchichi-textSec mt-0.5 scale-90 uppercase">{bus.operator}</span>
                  </div>
                  {isLocked && (
                      <div className={`absolute -top-1.5 -right-1.5 p-0.5 rounded-full shadow-sm ${isUrgent ? 'bg-moncchichi-error text-white animate-bounce' : 'bg-moncchichi-accent text-moncchichi-bg'}`}>
                          <Lock size={10} strokeWidth={3} />
                      </div>
                  )}
              </div>

              <div className="flex-1 flex flex-col items-center">
                  <div className="grid grid-cols-3 gap-2 justify-items-center w-full">
                      <TimingBadge arrival={bus.next} label="Next" isLocked={isLocked} />
                      <TimingBadge arrival={bus.subsequent} label="2nd" isLocked={isLocked} />
                      <TimingBadge arrival={bus.subsequent2} label="3rd" isLocked={isLocked} />
                  </div>
                  {todayScheduleLabel && (
                      <div className="mt-1 text-[9px] text-moncchichi-textSec opacity-70 font-mono tracking-tight">
                          {todayScheduleLabel}
                      </div>
                  )}
              </div>

              <div className="flex flex-col gap-1.5 items-end ml-2 justify-center h-full">
                  <div className={`flex flex-col items-end justify-center px-2 py-1 rounded-lg border ${getIntervalStyle(intervalStr)}`}>
                      <span className="text-[8px] font-bold uppercase opacity-70 mb-0.5">Freq</span>
                      <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span className="text-[10px] font-bold">{intervalStr}</span>
                      </div>
                  </div>
                  {destination ? (
                      <button 
                          onClick={(e) => { e.stopPropagation(); onShowRoute(); }}
                          className="flex flex-col items-end justify-center px-2 py-1 rounded-lg border bg-yellow-500/10 border-yellow-500/30 text-yellow-500 animate-in fade-in"
                      >
                          <div className="flex items-center gap-1">
                              <MapPin size={10} fill="currentColor" />
                              <span className="text-[10px] font-bold truncate max-w-[60px]">{destinationSequence}</span>
                          </div>
                      </button>
                  ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowSchedule(!showSchedule); }}
                        className={`p-1.5 rounded-lg border transition-colors ${showSchedule ? 'bg-moncchichi-accent text-moncchichi-bg border-moncchichi-accent' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec border-moncchichi-border hover:text-moncchichi-text'}`}
                        title="View Schedule"
                      >
                          <Calendar size={14} />
                      </button>
                  )}
              </div>
          </div>
          
          {/* Collapsible Schedule Section */}
          {showSchedule && effectiveStopId && (
              <div className="px-3 pb-3">
                  <BusScheduleViewer stopId={effectiveStopId} serviceNo={bus.serviceNo} />
              </div>
          )}
      </div>
    );
};

const BusStopCard: React.FC<{ 
    stop: StopWithArrivals, 
    isExpanded: boolean, 
    onToggleExpand: (id: string) => void, 
    onRetry: (stop: StopWithArrivals) => void,
    onToggleLock: (stopId: string, serviceNo: string) => void,
    onViewMap: (stop: StopWithArrivals) => void,
    onShowRoute: (bus: BusServiceData, stop: StopWithArrivals) => void,
    onToggleFav: (stop: StopWithArrivals) => void,
    refreshTick?: number,
    reorderTick?: number
}> = ({ stop, isExpanded, onToggleExpand, onRetry, onToggleLock, onViewMap, onShowRoute, onToggleFav, refreshTick, reorderTick }) => {
    // Re-check favorite status on every render/tick
    const isFav = transportService.isFavorite(stop.id);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(stop.name);

    const handleSaveName = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editName.trim()) {
            transportService.renameFavorite(stop.id, editName.trim());
        } else {
            setEditName(stop.name); 
        }
        setIsEditing(false);
    };

    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleFav(stop);
    };

    const getDistanceStyle = (distKm: number) => {
        const distM = distKm * 1000;
        if (distM < 150) return 'text-moncchichi-success bg-moncchichi-success/10 border-moncchichi-success/20';
        if (distM < 300) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (distM < 500) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        if (distM < 800) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
        return 'text-red-400 bg-red-400/10 border-red-400/20';
    };

    const formatDistance = (distKm: number) => {
        if (distKm < 1) return `${Math.round(distKm * 1000)}m`;
        return `${distKm.toFixed(1)}km`;
    };

    // Determine header style based on focused bus if collapsed
    // Modified to make header fully opaque when expanded to prevent content bleed-through
    const getHeaderStyle = () => {
        if (isExpanded) return 'bg-moncchichi-surface'; // Fully opaque to occlude scrolling content
        
        // Find if any service in this stop is watched
        const watchedService = stop.services.find(s => transportService.isWatched(stop.id, s.serviceNo));
        
        if (watchedService && watchedService.next) {
            const mins = watchedService.next.mins;
            if (mins < 8) return 'bg-moncchichi-success/20 backdrop-blur-md border-b-moncchichi-success/30';
            if (mins < 15) return 'bg-moncchichi-warning/20 backdrop-blur-md border-b-moncchichi-warning/30';
            return 'bg-moncchichi-error/20 backdrop-blur-md border-b-moncchichi-error/30';
        }
        
        return 'bg-moncchichi-surfaceAlt/50';
    };

    // Sort services: Watched buses first
    const sortedServices = React.useMemo(() => {
        return [...stop.services].sort((a, b) => {
            const aWatched = transportService.isWatched(stop.id, a.serviceNo);
            const bWatched = transportService.isWatched(stop.id, b.serviceNo);
            if (aWatched && !bWatched) return -1;
            if (!aWatched && bWatched) return 1;
            return 0; // Maintain original order otherwise
        });
    }, [stop.services, stop.id, refreshTick, reorderTick]); 

    return (
        <div className="bg-moncchichi-surface rounded-xl border border-moncchichi-border shadow-sm transition-all mb-3">
            <div 
                className={`sticky top-0 z-10 rounded-t-xl p-3 border-b border-moncchichi-border flex justify-between items-center cursor-pointer select-none transition-colors duration-300 ${getHeaderStyle()} ${!isExpanded ? 'border-b-0' : ''}`}
                onClick={() => {
                    if (isExpanded) soundService.playBusClose();
                    else soundService.playBusOpen();
                    onToggleExpand(stop.id);
                }}
            >
                <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 h-6">
                        {isEditing ? (
                            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1 bg-moncchichi-bg border border-moncchichi-accent rounded px-2 py-0.5 text-sm focus:outline-none"
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="p-1 text-moncchichi-success hover:bg-moncchichi-surfaceAlt rounded"><Check size={14} /></button>
                            </div>
                        ) : (
                            <>
                                <div className="font-bold text-sm text-moncchichi-text truncate">{stop.name}</div>
                                {isFav && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(stop.name); }}
                                        className="p-1 text-moncchichi-textSec hover:text-moncchichi-accent opacity-50 hover:opacity-100"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                        <div className="text-[10px] text-moncchichi-textSec font-mono bg-moncchichi-bg px-1.5 rounded border border-moncchichi-border">{stop.id}</div>
                        {stop.distance !== undefined && stop.distance < 999 && (
                            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${getDistanceStyle(stop.distance)}`}>
                                <MapPin size={10} />
                                {formatDistance(stop.distance)}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleFavoriteClick}
                        className={`p-2 transition-colors rounded-full hover:bg-moncchichi-bg ${isFav ? 'text-moncchichi-warning' : 'text-moncchichi-textSec'}`}
                    >
                        <Star size={16} fill={isFav ? "currentColor" : "none"} />
                    </button>
                    {/* Map Button for Stop Location */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onViewMap(stop); }}
                        className="p-2 transition-colors rounded-full text-moncchichi-textSec hover:text-moncchichi-accent hover:bg-moncchichi-bg"
                        title="View Stop"
                    >
                        <MapIcon size={16} />
                    </button>
                </div>
            </div>
            
            {isExpanded && (
                <div className="animate-in slide-in-from-top-2 duration-200 min-h-[50px]">
                    {stop.isLoading && stop.services.length === 0 ? (
                        <div className="p-4 flex flex-col items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin text-moncchichi-accent" />
                            <span className="text-xs text-moncchichi-textSec animate-pulse">Connecting to LTA...</span>
                        </div>
                    ) : stop.error ? (
                        <div className="p-4 flex items-center justify-between bg-moncchichi-error/5">
                            <div className="flex items-center gap-2 text-moncchichi-error text-xs font-bold">
                                <WifiOff size={14} />
                                <span>Connection Failed</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onRetry(stop); }}
                                className="text-xs font-bold bg-moncchichi-surface border border-moncchichi-border px-3 py-1 rounded hover:bg-moncchichi-surfaceAlt transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    ) : stop.services.length === 0 ? (
                        <div className="p-4 text-center text-xs text-moncchichi-textSec italic">No services currently available</div>
                    ) : (
                        <>
                            {stop.isLoading && (
                                <div className="h-1 w-full bg-moncchichi-surfaceAlt overflow-hidden">
                                    <div className="h-full bg-moncchichi-accent/50 animate-pulse w-full"></div>
                                </div>
                            )}
                            <AnimatePresence>
                            {sortedServices.map((bus) => {
                                // Use explicit state for lock to force re-render when global state changes
                                const isLocked = transportService.isWatched(stop.id, bus.serviceNo);
                                const destSeq = transportService.getDestinationSequence(bus.serviceNo, stop.id);
                                return (
                                    <motion.div
                                      key={`${stop.id}-${bus.serviceNo}`}
                                      layout
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                      className="border-b border-moncchichi-border last:border-0 last:rounded-b-xl overflow-hidden"
                                    >
                                        <ArrivalItem 
                                            bus={bus} 
                                            stopName={stop.name}
                                            stopId={stop.id}
                                            isLocked={isLocked}
                                            onToggleLock={() => onToggleLock(stop.id, bus.serviceNo)}
                                            onShowRoute={() => onShowRoute(bus, stop)}
                                            destinationSequence={destSeq}
                                        />
                                    </motion.div>
                                );
                            })}
                            </AnimatePresence>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const JourneyCard: React.FC<{
    serviceNo: string;
    stopIds: string[];
    onShowRoute: (serviceNo: string, firstStopId: string) => void;
    onDelete: (serviceNo: string) => void;
}> = ({ serviceNo, stopIds, onShowRoute, onDelete }) => {
    const [stops, setStops] = useState<{ id: string, name: string, lat?: number, lng?: number }[]>([]);
    const [arrival, setArrival] = useState<ArrivalInfo | null>(null);
    const [trafficLevel, setTrafficLevel] = useState<'LOW'|'MED'|'HIGH'|'UNKNOWN'>('UNKNOWN');
    const [travelTime, setTravelTime] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (stopIds.length === 0) {
                setStops([]);
                setLoading(false);
                return;
            }

            // 1. Resolve full route to establish sequence and get intermediate stops
            // Use the first saved stop as the starting point for route resolution
            const route = await transportService.resolveRoute(serviceNo, stopIds[0]);

            if (!route) {
               // Fallback if route resolution fails: just use saved stops
               const stopInfos = await Promise.all(stopIds.map(id => transportService.getBusStopInfo(id)));
               if (active) {
                   setStops(stopInfos.map(s => ({
                        id: s?.id || '?',
                        name: s?.name || 'Unknown Stop',
                        lat: s?.lat,
                        lng: s?.lng
                    })));
                    setLoading(false);
               }
               return;
            }

            // 2. Find range of saved stops within the full route
            const savedIndices = stopIds.map(id => route.stops.findIndex(s => s.id === id)).filter(i => i !== -1);
            
            if (savedIndices.length === 0) {
                 setLoading(false);
                 return;
            }

            // Use saved stops range strictly, ignoring GPS
            const startIdx = Math.min(...savedIndices);
            const endIdx = Math.max(...savedIndices);

            // 3. Slice the full segment including intermediate stops
            const segmentStops = route.stops.slice(startIdx, endIdx + 1);

            if (active) {
                setStops(segmentStops);
                
                // 4. Fetch Live Arrival for the START stop of the segment
                const startId = segmentStops[0].id;
                try {
                    const arrData = await transportService.getArrivals(startId);
                    const svc = arrData.services.find(s => s.serviceNo === serviceNo);
                    if (svc) {
                        setArrival(svc.next);
                        // 5. Estimate Traffic using Arrival Trend
                        let tLevel: 'LOW'|'MED'|'HIGH' = 'MED';
                        if (svc.next?.trend === 'SLOWER') tLevel = 'HIGH';
                        else if (svc.next?.trend === 'FASTER') tLevel = 'LOW';
                        
                        setTrafficLevel(tLevel);

                        // 6. Calculate Estimated Travel Time (Heuristic)
                        const count = segmentStops.length - 1;
                        // Base time per stop (approx) adjusted by traffic
                        let basePerStop = 2.5; // Average
                        if (tLevel === 'LOW') basePerStop = 2.0;
                        if (tLevel === 'HIGH') basePerStop = 3.5;
                        
                        const totalMins = Math.ceil(count * basePerStop);
                        setTravelTime(totalMins);
                    }
                } catch (e) {
                    console.warn("Failed to fetch journey arrival", e);
                }
            }
            setLoading(false);
        };
        load();
        return () => { active = false; };
    }, [serviceNo, stopIds]);

    if (stopIds.length === 0) return null;

    const getTrafficColor = () => {
        switch(trafficLevel) {
            case 'HIGH': return 'text-moncchichi-error';
            case 'MED': return 'text-moncchichi-warning';
            case 'LOW': return 'text-moncchichi-success';
            default: return 'text-moncchichi-textSec';
        }
    };

    const trafficColor = getTrafficColor();
    const midPointIndex = Math.floor((stops.length - 1) / 2);

    return (
        <div className="bg-moncchichi-surface rounded-xl border border-moncchichi-border shadow-sm p-4 mb-3 animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden">
            <div className="flex justify-between items-start mb-3 pl-2 relative z-20">
                <div className="flex items-center gap-3">
                    <div className="w-auto min-w-[52px] px-3 h-11 rounded-lg bg-moncchichi-accent/10 border border-moncchichi-accent/30 flex flex-col items-center justify-center shrink-0">
                        <span className="font-bold text-lg text-moncchichi-accent leading-none">{serviceNo}</span>
                    </div>
                    <div>
                        <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 opacity-90 ${trafficColor}`}>
                             <Car size={14} />
                             <span>{travelTime !== null ? `Travel: ~${travelTime} min` : "Calculating..."}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-moncchichi-textSec">
                            {arrival ? (
                                <span className="flex items-center gap-1">
                                    <Clock size={10} className="text-moncchichi-accent" />
                                    Bus arr: <span className="font-bold text-moncchichi-text">{arrival.mins <= 0 ? 'Now' : `${arrival.mins}m`}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" /> Checking bus...
                                </span>
                            )}
                            <span className="opacity-60">• {stops.length} Stops</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(serviceNo);
                    }}
                    className="p-2 text-moncchichi-textSec hover:text-moncchichi-error hover:bg-moncchichi-error/10 rounded-full transition-colors relative z-30"
                    title="Clear Journey"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Stop List */}
            <div className="space-y-0 mb-4 pl-3 relative">
                {loading ? (
                    <div className="flex items-center gap-2 text-xs text-moncchichi-textSec py-4">
                        <Loader2 size={12} className="animate-spin" /> Calculating full path...
                    </div>
                ) : (
                    stops.map((stop, index) => {
                        // Highlight the saved waypoints differently from intermediate stops
                        const isWaypoint = stopIds.includes(stop.id);
                        const isStart = index === 0;
                        const isEnd = index === stops.length - 1;
                        
                        return (
                            <div key={stop.id} className="flex items-start gap-3 relative group min-h-[24px]">
                                {/* Connector Line - Dotted for travel */}
                                {index < stops.length - 1 && (
                                    <div className="absolute left-[9px] top-4 bottom-[-8px] w-0.5 border-l-2 border-dotted border-moncchichi-border/60 group-last:hidden"></div>
                                )}
                                
                                {/* Time Bubble in the Middle */}
                                {index === midPointIndex && travelTime !== null && stops.length > 2 && (
                                     <div className="absolute left-[20px] top-[10px] z-20 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-full px-2 py-0.5 text-[9px] font-bold text-moncchichi-textSec flex items-center gap-1 shadow-sm whitespace-nowrap">
                                         <Clock size={8} /> ~{travelTime} min ride
                                     </div>
                                )}
                                
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 shadow-sm border mt-0.5 ${
                                    isStart ? 'bg-moncchichi-accent text-moncchichi-bg border-moncchichi-accent' : 
                                    (isEnd ? 'bg-yellow-500 text-moncchichi-bg border-yellow-500' : 
                                    (isWaypoint ? 'bg-moncchichi-surface text-moncchichi-text border-moncchichi-accent scale-75' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec border-moncchichi-border scale-50 opacity-60'))
                                }`}>
                                    {isStart || isEnd ? (index + 1) : ''}
                                </div>
                                
                                <div className={`flex-1 min-w-0 pt-0.5 pb-2 ${!isWaypoint && !isStart && !isEnd ? 'opacity-50' : ''}`}>
                                    <div className={`text-xs font-medium truncate ${isStart ? 'text-moncchichi-accent' : (isEnd ? 'text-yellow-500' : 'text-moncchichi-text')}`}>{stop.name}</div>
                                    {(isWaypoint || isStart || isEnd) && <div className="text-[9px] text-moncchichi-textSec font-mono">{stop.id}</div>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <button 
                onClick={() => onShowRoute(serviceNo, stops[0]?.id || stopIds[0])}
                className="w-full py-2 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-lg text-xs font-bold text-moncchichi-text hover:bg-moncchichi-accent hover:text-moncchichi-bg hover:border-moncchichi-accent transition-all flex items-center justify-center gap-2 ml-1"
                style={{ width: 'calc(100% - 4px)' }}
            >
                <MapIcon size={14} /> Track Full Route
            </button>
        </div>
    );
};

// --- DbInspector Component ---
const DbInspector: React.FC<{ onClose: () => void, onRefresh: () => void, onShowToast: (m: string, t: any) => void }> = ({ onClose, onRefresh, onShowToast }) => {
    const [tab, setTab] = useState<'STOPS' | 'ROUTES'>('STOPS');
    const [stops, setStops] = useState<BusStopLocation[]>([]);
    const [routes, setRoutes] = useState<BusRoutePattern[]>([]);
    const [meta, setMeta] = useState<any>(null);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadData();
    }, [tab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (tab === 'STOPS') {
                const data = await transportService.getAllBusStops();
                setStops(data);
                setMeta(transportService.getStopsMeta());
            } else {
                const data = transportService.getAllRoutePatterns();
                setRoutes(data);
                setMeta(transportService.getRoutesMeta()); 
            }
        } catch (e) {
            console.error("Failed to load DB", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            let msg = "";
            if (tab === 'STOPS') msg = await transportService.syncStops();
            else msg = await transportService.syncRoutes();
            onShowToast(msg, "success");
            loadData();
            onRefresh();
        } catch (e: any) {
            onShowToast(e.message, "error");
        } finally {
            setSyncing(false);
        }
    };

    const handleClearStops = () => {
        transportService.clearBusStopsCache();
        onShowToast("Stops DB cleared. Re-fetching...", "info");
        transportService.getAllBusStops().then(() => {
            loadData();
            onRefresh(); 
            onShowToast("Stops DB updated.", "success");
        });
    };

    const handleClearRoutes = async () => {
        transportService.clearRouteCache();
        onShowToast("Route DB cleared. Rebuilding static index...", "info");
        await transportService.rebuildRouteDb();
        loadData();
        onShowToast("Route DB rebuilt.", "success");
    };

    const filteredStops = stops.filter(s => 
        s.id.includes(filter) || s.name.toLowerCase().includes(filter.toLowerCase())
    ).slice(0, 100);

    const filteredRoutes = routes.filter(r => 
        r.serviceNo.includes(filter.toUpperCase())
    ).slice(0, 100);

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-moncchichi-surface border border-moncchichi-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
                <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surfaceAlt/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-moncchichi-accent/10 rounded-full text-moncchichi-accent"><Database size={20} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-moncchichi-text">Database Inspector</h3>
                            <div className="text-[10px] text-moncchichi-textSec font-mono">
                                {tab === 'STOPS' ? `${stops.length} Stops` : `${routes.length} Patterns`}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-moncchichi-surface rounded-full text-moncchichi-textSec transition-colors"><X size={18} /></button>
                </div>

                <div className="flex p-2 bg-moncchichi-surface border-b border-moncchichi-border gap-2">
                    <button onClick={() => setTab('STOPS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'STOPS' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec hover:bg-moncchichi-surfaceAlt'}`}>Bus Stops</button>
                    <button onClick={() => setTab('ROUTES')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'ROUTES' ? 'bg-moncchichi-text text-moncchichi-bg' : 'text-moncchichi-textSec hover:bg-moncchichi-surfaceAlt'}`}>Bus Routes</button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4">
                    {/* Unified Metadata Card */}
                    <div className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-3 text-xs space-y-3 relative">
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-moncchichi-textSec shrink-0 mt-0.5">Source:</span> 
                            <span className="font-mono bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border/50 text-right break-all leading-tight">{meta?.source || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-moncchichi-textSec shrink-0 mt-0.5">Generated:</span> 
                            <span className="font-mono text-right break-words leading-tight max-w-[65%]">{meta?.generatedAt ? new Date(meta.generatedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-moncchichi-textSec shrink-0 mt-0.5">Last Sync:</span> 
                            <span className="font-mono text-moncchichi-accent text-right break-words leading-tight max-w-[65%]">
                                {meta?.lastSyncedAt ? new Date(meta.lastSyncedAt).toLocaleString() : 'Unknown'}
                            </span>
                        </div>
                        
                        <button 
                            onClick={handleSync}
                            disabled={syncing}
                            className="w-full mt-2 py-3 bg-moncchichi-accent/10 border border-moncchichi-accent/30 text-moncchichi-accent rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-moncchichi-accent/20 transition-all active:scale-95 h-auto whitespace-normal text-center"
                        >
                            {syncing ? <Loader2 size={14} className="animate-spin shrink-0" /> : <RefreshCw size={14} className="shrink-0" />}
                            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" />
                        <input 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder={tab === 'STOPS' ? "Search stop name or ID..." : "Search service number..."}
                            className="w-full bg-moncchichi-bg border border-moncchichi-border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-moncchichi-accent transition-colors"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto border border-moncchichi-border rounded-xl bg-moncchichi-bg/50">
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-moncchichi-accent" /></div>
                        ) : (
                            <div className="divide-y divide-moncchichi-border/30">
                                {tab === 'STOPS' ? (
                                    filteredStops.length > 0 ? filteredStops.map(stop => (
                                        <div key={stop.id} className="p-2 hover:bg-moncchichi-surfaceAlt/50 text-[10px] font-mono flex justify-between items-center transition-colors border-b border-moncchichi-border/30 last:border-0">
                                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                                <span className="shrink-0 font-bold bg-moncchichi-accent/10 text-moncchichi-accent px-1.5 py-1 rounded border border-moncchichi-accent/20 w-[50px] text-center">{stop.id}</span>
                                                <div className="flex flex-col min-w-0 pr-2">
                                                    <span className="text-moncchichi-text font-bold leading-tight break-words" title={stop.name}>{stop.name}</span>
                                                    <span className="text-moncchichi-textSec text-[9px] opacity-70">{stop.lat?.toFixed(4)}, {stop.lng?.toFixed(4)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : <div className="p-8 text-center text-xs text-moncchichi-textSec opacity-50">No stops found.</div>
                                ) : (
                                    filteredRoutes.length > 0 ? filteredRoutes.map((route, idx) => (
                                        <div key={`${route.serviceNo}-${route.direction}-${idx}`} className="p-2 hover:bg-moncchichi-surfaceAlt/50 text-[10px] font-mono flex justify-between items-center transition-colors border-b border-moncchichi-border/30 last:border-0">
                                            <div className="flex-1 min-w-0 flex items-center gap-3">
                                                <span className="shrink-0 font-bold bg-moncchichi-accent/10 text-moncchichi-accent px-1.5 py-1 rounded border border-moncchichi-accent/20 w-[50px] text-center">{route.serviceNo}</span>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-moncchichi-text font-bold">Dir {route.direction}</span>
                                                        <span className="text-moncchichi-textSec text-[9px] border border-moncchichi-border px-1 rounded">{route.source}</span>
                                                    </div>
                                                    <span className="text-moncchichi-textSec text-[9px] opacity-70">{route.stops.length} Stops</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : <div className="p-8 text-center text-xs text-moncchichi-textSec opacity-50">No routes found.</div>
                                )}
                                
                                {((tab === 'STOPS' && stops.length > 100) || (tab === 'ROUTES' && routes.length > 100)) && !filter && (
                                    <div className="p-2 text-center text-[10px] text-moncchichi-textSec italic">
                                        ...and more...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-moncchichi-border bg-moncchichi-surface flex flex-col gap-2">
                    <button 
                        onClick={tab === 'STOPS' ? handleClearStops : handleClearRoutes}
                        className="w-full py-3 rounded-xl bg-moncchichi-error/10 text-moncchichi-error border border-moncchichi-error/30 font-bold text-xs flex items-center justify-center gap-2 hover:bg-moncchichi-error/20 transition-colors"
                    >
                        <Trash2 size={14} /> 
                        {tab === 'STOPS' ? "Clear Stops Cache" : "Reset Route DB"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Transport Component ---

const Transport: React.FC<TransportProps> = ({ onBack, onShowToast }) => {
  const [transportMode, setTransportMode] = useState<TransportMode>('BUS');
  const [viewMode, setViewMode] = useState<'NEARBY' | 'FAVORITES' | 'SEARCH' | 'JOURNEY'>('NEARBY');
  const [nearbyStopsData, setNearbyStopsData] = useState<StopWithArrivals[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRoutePatternRefreshing, setIsRoutePatternRefreshing] = useState(false);
  const [isDbUpdating, setIsDbUpdating] = useState(false);
  const [dbStatusLabel, setDbStatusLabel] = useState(transportService.getStopsLastUpdatedLabel());
  
  // Re-order state
  const [reorderTick, setReorderTick] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BusStopLocation[]>([]);
  const [searchCorrection, setSearchCorrection] = useState<string | null>(null);
  
  // Journey State
  const [journeys, setJourneys] = useState<Record<string, string[]>>({});

  // Overlay States
  const [showDbInspector, setShowDbInspector] = useState(false);
  const [mapTarget, setMapTarget] = useState<{stop: BusStopLocation, serviceNo?: string, destStopId?: string} | null>(null);
  
  const [expandedStops, setExpandedStops] = useState<Record<string, boolean>>({});
  const refreshIntervalRef = useRef<any>(null);
  const isFirstRender = useRef(true);

  // Search Effect
  useEffect(() => {
    if (viewMode === 'SEARCH' && searchQuery.trim().length > 1) {
        const delaySearch = setTimeout(() => {
            // Pass current location to search for distance calculation
            const result = transportService.searchStopsByName(searchQuery, location?.lat, location?.lng);
            setSearchResults(result.results);
            setSearchCorrection(result.suggestion);
        }, 300); // 300ms debounce
        return () => clearTimeout(delaySearch);
    } else {
        setSearchResults([]);
        setSearchCorrection(null);
    }
  }, [searchQuery, viewMode, location]); // Include location in deps to recalc distance if moved

  // Journey Tab Refresh
  useEffect(() => {
      if (viewMode === 'JOURNEY' && !mapTarget) {
          setJourneys(transportService.getAllRouteWaypoints());
      }
  }, [viewMode, mapTarget, reorderTick]);

  const handleAddStopFromSearch = (stop: BusStopLocation) => {
      transportService.addFavorite(stop);
      onShowToast(`Added ${stop.name} to Favorites`, 'success');
      setViewMode('FAVORITES');
      setSearchQuery(''); // Reset search
  };
  
  const handleApplyCorrection = () => {
      if (searchCorrection) {
          setSearchQuery(searchCorrection);
      }
  };
  
  const handleViewStopFromMap = (stop: BusStopLocation) => {
      setMapTarget(null);
      setViewMode('SEARCH');
      setSearchQuery(stop.name);
      setSearchResults([stop]); // Optimistic load
  };

  const handleDeleteJourney = (serviceNo: string) => {
      // Instant delete
      transportService.clearRouteWaypoints(serviceNo);
      setJourneys({ ...transportService.getAllRouteWaypoints() });
      soundService.playTrash();
  };

  const fetchArrivalsForStops = useCallback(async (stops: BusStopLocation[]) => {
      // Preserve existing data structure to prevent UI flash, mark loading
      const loadingState = stops.map(s => {
          const existing = nearbyStopsData.find(n => n.id === s.id);
          return {
              ...s, // Spread updates (e.g. distance)
              services: existing ? existing.services : [],
              isLoading: true,
              error: undefined
          } as StopWithArrivals;
      });
      setNearbyStopsData(loadingState);

      const promises = stops.map(async (stop) => {
          try {
              const data = await transportService.getArrivals(stop.id);
              return {
                  ...stop, // Spread updates
                  services: data.services,
                  isLoading: false
              } as StopWithArrivals;
          } catch (e) {
              return {
                  ...stop,
                  services: [],
                  isLoading: false,
                  error: "Failed to load"
              } as StopWithArrivals;
          }
      });

      const results = await Promise.all(promises);
      setNearbyStopsData(results);
  }, [nearbyStopsData]);

  const refreshData = useCallback(async (forceLocation = false) => {
      if (isRefreshing && !forceLocation) return;
      setIsRefreshing(true);
      
      try {
          // 1. Get Location (if needed or forced)
          let loc = location;
          if (forceLocation || !loc) {
              setIsLocating(true);
              const l = await locationService.getLocation();
              loc = { lat: l.lat, lng: l.lng };
              
              // OPTIMIZATION: Only update state if location actually changed
              setLocation(prev => {
                  if (prev && prev.lat === loc.lat && prev.lng === loc.lng) return prev;
                  return loc;
              });
              
              if (l.isDefault) {
                  onShowToast("Using default location (GPS unavailable)", "info");
              }
              
              transportService.getAddress(l.lat, l.lng).then(setLocationName);
              setIsLocating(false);
          }

          if (transportMode === 'BUS') {
              if (viewMode === 'FAVORITES') {
                  // CRITICAL: Ensure the DB is loaded before getting favorites so that hydration can fix missing coordinates
                  await transportService.getAllBusStops();
                  
                  let favs = transportService.getFavorites();
                  
                  // Standardize Distance Calculation for Favorites using current location
                  if (loc) {
                      favs = transportService.updateStopsWithDistance(favs, loc.lat, loc.lng);
                      // Sort favorites by distance (nearest first)
                      favs.sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
                  }

                  if (favs.length > 0) {
                      await fetchArrivalsForStops(favs);
                  } else {
                      setNearbyStopsData([]);
                  }
              } else if (viewMode === 'NEARBY') {
                  // viewMode is 'NEARBY'
                  if (loc) {
                      setNearbyLoading(true);
                      const stops = await transportService.findNearestStops(loc.lat, loc.lng);
                      await fetchArrivalsForStops(stops);
                      setNearbyLoading(false);
                  }
              }

              // Poll for Destination Arrival (if any active watch set from RouteMap)
              const destMsg = await transportService.pollDestinationArrival();
              if (destMsg) {
                  onShowToast(destMsg, "success");
                  soundService.playQuestComplete();
              }
          } else {
              // MRT Logic placeholder
          }
          
          setLastUpdated(Date.now());
      } catch (e) {
          console.error(e);
          onShowToast("Failed to refresh data", "error");
      } finally {
          setIsRefreshing(false);
          setIsLocating(false);
      }
  }, [isRefreshing, location, transportMode, viewMode, onShowToast, fetchArrivalsForStops]);

  // 1. Initial Load Effect (Run Once)
  useEffect(() => {
      transportService.seedFavorites();
      refreshData(true); // Force location fetch on mount
  }, []); // Empty dependency array ensures it runs once on mount

  // 2. View Mode Change Effect (Trigger Refresh on Tab Switch)
  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return; // Skip on mount, let the [] effect handle it with force=true
      }
      
      // Don't clear data if switching to search or journey, just stop refresh
      if (viewMode === 'SEARCH' || viewMode === 'JOURNEY') return;

      setNearbyStopsData([]); // Clear previous list immediately
      setExpandedStops({});
      refreshData();
  }, [viewMode]);

  // 3. Subscriptions & Interval Effect
  useEffect(() => {
      // Subscriptions
      const unsubStops = transportService.subscribeToStopsUpdate(() => {
          setDbStatusLabel(transportService.getStopsLastUpdatedLabel());
          refreshData(false); // Reload logic if DB changes
      });
      const unsubRoute = transportService.subscribeToRouteRefresh(setIsRoutePatternRefreshing);
      const unsubDbStatus = transportService.subscribeToDbUpdateStatus(setIsDbUpdating);
      
      // Subscribe to destination updates to refresh badges
      const unsubDest = transportService.subscribeToDestinations(() => {
          // Force re-render of list by incrementing reorderTick
          setReorderTick(prev => prev + 1);
      });
      
      // Auto-Refresh Interval
      refreshIntervalRef.current = setInterval(() => {
          if (viewMode !== 'SEARCH' && viewMode !== 'JOURNEY') {
             refreshData(false); // Periodic refresh without forcing location
          }
      }, 60000);

      return () => {
          unsubStops();
          unsubRoute();
          unsubDbStatus();
          unsubDest();
          if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      };
  }, [refreshData, viewMode]);

  const handleToggleExpand = (stopId: string) => {
      setExpandedStops(prev => ({ ...prev, [stopId]: !prev[stopId] }));
  };

  const handleRetryStop = async (stop: StopWithArrivals) => {
      // Optimistic update
      setNearbyStopsData(prev => prev.map(s => s.id === stop.id ? { ...s, isLoading: true, error: undefined } : s));
      try {
          const data = await transportService.getArrivals(stop.id);
          setNearbyStopsData(prev => prev.map(s => s.id === stop.id ? { ...s, services: data.services, isLoading: false } : s));
      } catch (e) {
          setNearbyStopsData(prev => prev.map(s => s.id === stop.id ? { ...s, isLoading: false, error: "Retry failed" } : s));
      }
  };

  const handleToggleLock = (stopId: string, serviceNo: string) => {
      transportService.toggleWatch(stopId, serviceNo);
      setReorderTick(prev => prev + 1); // Force BusStopCard to re-sort
      soundService.playClick();
  };

  const handleShowRoute = (bus: BusServiceData, stop: StopWithArrivals) => {
      setMapTarget({
          stop: stop,
          serviceNo: bus.serviceNo,
          destStopId: bus.next?.destinationCode
      });
  };
  
  // From Journey Card
  const handleShowRouteFromJourney = (serviceNo: string, firstStopId: string) => {
      // We need a base stop object. Fetch it or fake it since RouteMap will fetch pattern anyway.
      transportService.getBusStopInfo(firstStopId).then(stopInfo => {
          setMapTarget({
              stop: stopInfo || { id: firstStopId, name: `Stop ${firstStopId}`, lat: 0, lng: 0 },
              serviceNo: serviceNo,
              // destStopId not strictly needed as RouteMap uses persisted waypoints
          });
      });
  };

  const handleViewMap = (stop: StopWithArrivals) => {
      setMapTarget({ stop: stop });
  };

  const handleToggleFav = (stop: StopWithArrivals) => {
      if (transportService.isFavorite(stop.id)) {
          transportService.removeFavorite(stop.id);
          onShowToast("Removed from Favorites", "info");
      } else {
          transportService.addFavorite(stop);
          onShowToast("Added to Favorites", "success");
      }
      // If in favorites view, refresh list
      if (viewMode === 'FAVORITES') refreshData();
      else setNearbyStopsData([...nearbyStopsData]); // Trigger re-render for star icon
  };
  
  const getDistanceStyle = (distKm?: number) => {
      if (distKm === undefined) return '';
      const distM = distKm * 1000;
      if (distM < 150) return 'text-moncchichi-success bg-moncchichi-success/10 border-moncchichi-success/20';
      if (distM < 300) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      if (distM < 500) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      if (distM < 800) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      return 'text-red-400 bg-red-400/10 border-red-400/20';
  };

  const formatDistance = (distKm?: number) => {
      if (distKm === undefined) return '';
      if (distKm < 1) return `${Math.round(distKm * 1000)}m`;
      return `${distKm.toFixed(1)}km`;
  };


  return (
    <div className="flex flex-col h-full bg-moncchichi-bg">
        {showDbInspector && <DbInspector onClose={() => setShowDbInspector(false)} onRefresh={() => refreshData()} onShowToast={onShowToast} />}
        
        {mapTarget && (
            <RouteMap 
                serviceNo={mapTarget.serviceNo}
                stopId={mapTarget.stop.id}
                stopName={mapTarget.stop.name}
                destStopId={mapTarget.destStopId}
                userLocation={location}
                onBack={() => setMapTarget(null)}
                onShowToast={onShowToast}
                onViewStop={handleViewStopFromMap}
            />
        )}

        {/* Header */}
        <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
            <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                {ICONS.Back}
            </button>
            <div className="flex-1">
                <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                    {ICONS.Bus} Griffin's Flight
                </h2>
                <div className="flex items-center gap-1 text-[10px] text-moncchichi-textSec">
                    <MapPin size={10} />
                    {isLocating ? <span className="animate-pulse">Locating...</span> : (locationName || "Singapore")}
                </div>
            </div>
            
            {/* Status Icons */}
            <div className="flex items-center gap-2">
                {(isRoutePatternRefreshing || isDbUpdating) && (
                    <div className="p-2 bg-moncchichi-surfaceAlt rounded-full animate-pulse text-moncchichi-accent">
                        <Database size={16} />
                    </div>
                )}
                {viewMode !== 'SEARCH' && viewMode !== 'JOURNEY' && (
                    <RefreshTimer 
                        lastUpdated={lastUpdated} 
                        onRefresh={() => {
                            soundService.playGpsPing();
                            refreshData();
                        }} 
                        isLoading={isRefreshing} 
                    />
                )}
            </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4">
            <div className="flex p-1 bg-moncchichi-surfaceAlt rounded-lg border border-moncchichi-border overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setViewMode('NEARBY')}
                    className={`flex-1 min-w-[80px] py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'NEARBY' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                >
                    <MapPin size={14} /> Nearby
                </button>
                <button 
                    onClick={() => setViewMode('FAVORITES')}
                    className={`flex-1 min-w-[80px] py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'FAVORITES' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                >
                    <Star size={14} /> Favorites
                </button>
                <button 
                    onClick={() => setViewMode('JOURNEY')}
                    className={`flex-1 min-w-[80px] py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'JOURNEY' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                >
                    <Flag size={14} /> Journey
                </button>
                 <button 
                    onClick={() => setViewMode(viewMode === 'SEARCH' ? 'FAVORITES' : 'SEARCH')}
                    className={`py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 ${viewMode === 'SEARCH' ? 'bg-moncchichi-text text-moncchichi-bg shadow-sm' : 'text-moncchichi-textSec hover:text-moncchichi-text'}`}
                    title="Add Stop"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
        
        {/* Search Bar Area (Only visible in SEARCH mode) */}
        {viewMode === 'SEARCH' && (
            <div className="px-4 py-3 animate-in slide-in-from-top-2">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search bus stop name or ID..."
                        autoFocus
                        className="w-full bg-moncchichi-surface border border-moncchichi-border rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-moncchichi-accent text-moncchichi-text transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec hover:text-moncchichi-text p-1"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                {/* Auto-Suggestion Banner */}
                {searchCorrection && searchResults.length === 0 && (
                    <button 
                        onClick={handleApplyCorrection}
                        className="w-full mt-2 bg-moncchichi-surfaceAlt border border-moncchichi-accent/30 text-moncchichi-accent rounded-lg py-2 px-3 text-xs flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1 hover:bg-moncchichi-surfaceAlt/80 transition-colors"
                    >
                        <Lightbulb size={12} fill="currentColor" />
                        <span>Did you mean <strong>{searchCorrection}</strong>?</span>
                    </button>
                )}
            </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
            {viewMode === 'SEARCH' ? (
                <>
                    {searchResults.length > 0 ? (
                         <div className="space-y-2">
                            {searchResults.map(stop => (
                                <div 
                                    key={stop.id}
                                    onClick={() => handleAddStopFromSearch(stop)}
                                    className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-3 flex justify-between items-center hover:bg-moncchichi-surfaceAlt cursor-pointer transition-colors active:scale-[0.98]"
                                >
                                    <div className="min-w-0 pr-2">
                                        <div className="font-bold text-sm text-moncchichi-text truncate">{stop.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-mono bg-moncchichi-surfaceAlt px-1.5 py-0.5 rounded border border-moncchichi-border text-moncchichi-textSec">{stop.id}</span>
                                            {stop.distance !== undefined && stop.distance < 999 && (
                                                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${getDistanceStyle(stop.distance)}`}>
                                                    <MapPin size={8} />
                                                    {formatDistance(stop.distance)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-moncchichi-accent/10 text-moncchichi-accent p-2 rounded-full shrink-0">
                                        <Plus size={16} />
                                    </div>
                                </div>
                            ))}
                         </div>
                    ) : (
                        searchQuery.length > 1 && !searchCorrection && (
                            <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec opacity-50 gap-3">
                                <BusFront size={48} strokeWidth={1} />
                                <p className="text-sm">No stops found matching "{searchQuery}"</p>
                            </div>
                        )
                    )}
                    {!searchQuery && (
                        <div className="text-center py-12 text-moncchichi-textSec opacity-40">
                             <Search size={48} className="mx-auto mb-4" strokeWidth={1} />
                             <p className="text-sm">Type to search for bus stops to add.</p>
                        </div>
                    )}
                </>
            ) : viewMode === 'JOURNEY' ? (
                <>
                   {Object.keys(journeys).length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec gap-3 opacity-60">
                           <div className="p-4 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border">
                               <Flag size={32} />
                           </div>
                           <div className="text-center">
                               <h3 className="font-bold text-sm mb-1">No Active Journeys</h3>
                               <p className="text-xs max-w-xs">Select stops on the Route Map to plan a multi-stop trip.</p>
                           </div>
                       </div>
                   ) : (
                       <div className="space-y-4">
                           {Object.entries(journeys).map(([svcNo, stops]) => (
                               <JourneyCard 
                                   key={svcNo} 
                                   serviceNo={svcNo} 
                                   stopIds={stops} 
                                   onShowRoute={handleShowRouteFromJourney}
                                   onDelete={handleDeleteJourney}
                               />
                           ))}
                       </div>
                   )}
                </>
            ) : (
                <>
                {nearbyLoading && nearbyStopsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec gap-3">
                        <Loader2 size={32} className="animate-spin text-moncchichi-accent" />
                        <span className="text-xs font-mono">Scanning Frequency...</span>
                    </div>
                ) : nearbyStopsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-moncchichi-textSec gap-3 opacity-60">
                        <BusFront size={48} strokeWidth={1} />
                        <p className="text-sm">No stops found.</p>
                        <button onClick={() => {
                            soundService.playGpsPing();
                            refreshData(true);
                        }} className="text-xs text-moncchichi-accent hover:underline">Retry Location</button>
                    </div>
                ) : (
                    nearbyStopsData.map(stop => (
                        <BusStopCard 
                            key={stop.id}
                            stop={stop}
                            isExpanded={!!expandedStops[stop.id]}
                            onToggleExpand={handleToggleExpand}
                            onRetry={handleRetryStop}
                            onToggleLock={handleToggleLock}
                            onViewMap={handleViewMap}
                            onShowRoute={handleShowRoute}
                            onToggleFav={handleToggleFav}
                            refreshTick={lastUpdated || 0}
                            reorderTick={reorderTick}
                        />
                    ))
                )}
                </>
            )}
            
            {/* Footer / DB Status */}
            {viewMode !== 'SEARCH' && (
                <div className="mt-6 pt-4 border-t border-moncchichi-border/30 text-center">
                    <button 
                        onClick={() => setShowDbInspector(true)}
                        className="text-[10px] text-moncchichi-textSec hover:text-moncchichi-text flex items-center justify-center gap-2 mx-auto px-3 py-1 rounded-full hover:bg-moncchichi-surfaceAlt transition-colors"
                    >
                        <Database size={10} />
                        <span>DB: {dbStatusLabel}</span>
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default Transport;
