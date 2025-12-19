
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MapPin, Navigation, Clock, Flag, X, ArrowDown, Map as MapIcon, RotateCcw, AlertTriangle, ArrowLeft, ChevronUp, ChevronDown, Car, Zap, Turtle, AlertOctagon, Sparkles, Sword, Shield, Skull, Scroll, Tent, MessageSquare, Mail, Check, Radio, GraduationCap, ShoppingBag, Utensils, Trees, HeartPulse, Landmark, Info, Circle, Signal, Bus, Star, Search, RadioTower } from 'lucide-react';
import { BusStopLocation, transportService, TrafficSegment } from '../services/transportService';
import { busService } from '../services/busService';
import { soundService } from '../services/soundService';
import { aiService } from '../services/aiService';

interface RouteMapProps {
  serviceNo?: string; 
  stopId: string;
  stopName: string;
  destStopId?: string;
  onBack: () => void;
  userLocation: { lat: number; lng: number } | null;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onViewStop: (stop: BusStopLocation) => void;
}

const ICONS_SVG = {
    EDUCATION: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    SHOPPING: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    FOOD: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
    NATURE: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 5.3-2.1"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .9-1.7l-3.9-5a1 1 0 0 0-1.6 0l-2.5 3a1 1 0 0 0 .8 1.7"/></svg>`,
    HEALTH: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>`,
    CULTURE: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    LANDMARK: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    BUS_FRONT: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M4 10c0-4.4 3.6-8 8-8s8 3.6 8 8v10a2 2 0 0 1-2 2h-1.5a1.5 1.5 0 0 1-1.5-1.5V19h-6v1.5a1.5 1.5 0 0 1-1.5 1.5H5.5a2 2 0 0 1-2-2V10zm2 0v3h12v-3c0-3.3-2.7-6-6-6s-6 2.7-6 6z"/><circle cx="7" cy="16" r="1.5" fill="white"/><circle cx="17" cy="16" r="1.5" fill="white"/></svg>`
};

const getPoiType = (name: string): { type: string, svg: string, color: string, iconComponent: any } | null => {
   const n = name.toLowerCase();
   if (n.match(/^(blk|opp blk|bet blks|bef|aft)\s+\d+/)) return null;
   if (n.includes('sch') || n.includes('poly') || n.includes('inst') || n.includes('jc') || n.includes('college')) 
       return { type: 'Education', svg: ICONS_SVG.EDUCATION, color: '#3b82f6', iconComponent: GraduationCap };
   if (n.includes('mall') || n.includes('plaza') || n.includes('ctr') || n.includes('sq') || n.includes('city') || n.includes('point') || n.includes('hub') || n.includes('mart')) 
       return { type: 'Shopping', svg: ICONS_SVG.SHOPPING, color: '#ec4899', iconComponent: ShoppingBag };
   if (n.includes('mkt') || n.includes('fc') || n.includes('food')) 
       return { type: 'Food', svg: ICONS_SVG.FOOD, color: '#f97316', iconComponent: Utensils };
   if (n.includes('pk') || n.includes('gdn') || n.includes('reservoir') || n.includes('park') || n.includes('nature')) 
       return { type: 'Nature', svg: ICONS_SVG.NATURE, color: '#22c55e', iconComponent: Trees };
   if (n.includes('hosp') || n.includes('polyclinic') || n.includes('med')) 
       return { type: 'Healthcare', svg: ICONS_SVG.HEALTH, color: '#ef4444', iconComponent: HeartPulse };
   if (n.includes('ch') || n.includes('mque') || n.includes('tp') || n.includes('temple') || n.includes('mosque') || n.includes('church') || n.includes('cathedral')) 
       return { type: 'Culture', svg: ICONS_SVG.CULTURE, color: '#eab308', iconComponent: Landmark };
   if (!n.includes('opp') && !n.includes('bef') && !n.includes('aft'))
       return { type: 'Place', svg: ICONS_SVG.LANDMARK, color: '#8b5cf6', iconComponent: MapPin };
   return null; 
};

const TrafficInsightManager: React.FC<{ 
    serviceNo: string, 
    currentStop: BusStopLocation, 
    destinationStop: BusStopLocation, 
    onLoading: (isLoading: boolean) => void, 
    onInsightReady: (data: { title: string, roads: string, desc: string, status: string }) => void 
}> = ({ serviceNo, currentStop, destinationStop, onLoading, onInsightReady }) => {
    const segmentKey = `${currentStop.id}-${destinationStop.id}`;
    const lastCheckedSegment = useRef<string>("");
    useEffect(() => {
        if (segmentKey === lastCheckedSegment.current) return;
        lastCheckedSegment.current = segmentKey;
        let active = true;
        const fetchTraffic = async () => {
            onLoading(true);
            soundService.startThinking();
            try {
                const prompt = `
                Analyze traffic for Bus ${serviceNo} specifically on the route segment from "${currentStop.name}" to "${destinationStop.name}".
                Use Google Maps routing data.
                Return a JSON object with this EXACT structure:
                {
                    "status": "CLEAR" | "MODERATE" | "HEAVY",
                    "flavorTitle": "A World of Warcraft Zone Name fitting the traffic.",
                    "roads": "List the 1 or 2 main roads taken in this segment.",
                    "wowDescription": "A concise (max 10 words) report from a Flight Master."
                }`;
                const res = await aiService.generateText({
                    userPrompt: prompt,
                    temperature: 0.4,
                    systemInstruction: "You are a WoW Flight Master reporting on specific flight paths. Concise JSON only.",
                    useMaps: true
                });
                if (!active) return;
                const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(jsonStr);
                soundService.stopThinking();
                onInsightReady({
                    title: parsed.flavorTitle,
                    roads: parsed.roads,
                    desc: parsed.wowDescription,
                    status: parsed.status
                });
            } catch (e) {
                soundService.stopThinking();
            } finally {
                if (active) onLoading(false);
            }
        };
        const timer = setTimeout(fetchTraffic, 100);
        return () => { 
            active = false; 
            clearTimeout(timer);
            soundService.stopThinking();
        };
    }, [serviceNo, segmentKey]);
    return null;
};

const RouteMap: React.FC<RouteMapProps> = ({ serviceNo, stopId, stopName, destStopId, onBack, userLocation, onShowToast, onViewStop }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const poiMarkersRef = useRef<any[]>([]);
  const trafficLightMarkersRef = useRef<any[]>([]);
  const liveBusLayerRef = useRef<any>(null);
  const destMarkersLayerRef = useRef<any>(null);
  
  const passedPolylineRef = useRef<any>(null);
  const activePolylineRef = useRef<any>(null);
  const trafficPolylinesRef = useRef<any[]>([]);
  const futurePolylineRef = useRef<any>(null);
  
  const userMarkerRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState<BusStopLocation[]>([]); 
  
  const [realTimeCurrentIndex, setRealTimeCurrentIndex] = useState<number>(0);
  const [selectedStopIndices, setSelectedStopIndices] = useState<number[]>([]); 

  const [isDegradedMode, setIsDegradedMode] = useState(false);
  const [showDegradedBanner, setShowDegradedBanner] = useState(false);
  const [isRouteDetached, setIsRouteDetached] = useState(false);
  const [routeSource, setRouteSource] = useState<string>("");
  const [routeTerminals, setRouteTerminals] = useState<string>("");
  
  const [canRetry, setCanRetry] = useState(false);
  const [etaMins, setEtaMins] = useState<number>(0);
  const [liveLocation, setLiveLocation] = useState<{ lat: number, lng: number } | null>(userLocation);
  
  const [stopArrivals, setStopArrivals] = useState<Record<number, string | number>>({});
  const [trafficStatus, setTrafficStatus] = useState<string>('CLEAR');

  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [liveUpdateStatus, setLiveUpdateStatus] = useState<string>('');
  const [isRadarScanning, setIsRadarScanning] = useState(false);

  const [isRoutesApiLoading, setIsRoutesApiLoading] = useState(false);
  const [trafficSegments, setTrafficSegments] = useState<TrafficSegment[] | null>(null);
  const [trafficLights, setTrafficLights] = useState<{lat: number, lng: number, state: 'RED'|'GREEN'|'YELLOW'}[]>([]);
  const trafficIntervalRef = useRef<any>(null);

  const [isTrafficLoading, setIsTrafficLoading] = useState(false);
  const [trafficHeader, setTrafficHeader] = useState<{ title: string, roads: string, desc: string, status: string } | null>(null);
  const trafficTimerRef = useRef<any>(null);

  const [activePoi, setActivePoi] = useState<{name: string, type: string, icon: any, color: string, desc: string, loading: boolean} | null>(null);
  
  const touchStartY = useRef(0);
  const [contextMenuStop, setContextMenuStop] = useState<BusStopLocation | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const isScrollingRef = useRef(false);

  const isSingleStopMode = !serviceNo;

  useEffect(() => {
    let isMounted = true;
    const loadLeaflet = async () => {
      if ((window as any).L) {
        initData();
        return;
      }
      try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => { if (isMounted) initData(); };
        document.body.appendChild(script);
      } catch (e) {
        if (isMounted) setLoadError("Map engine failed to load.");
      }
    };
    loadLeaflet();
    if (!isSingleStopMode) {
        soundService.playNavigation();
    }
    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);
      if (trafficIntervalRef.current) clearInterval(trafficIntervalRef.current);
    };
  }, [serviceNo, stopId, destStopId]);

  const fetchLiveBusLocations = useCallback(async () => {
    if (!serviceNo || orderedStops.length === 0) return;
    const L = (window as any).L;
    if (!mapInstanceRef.current || !L) return;

    if (!liveBusLayerRef.current) {
        liveBusLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    setIsRadarScanning(true);
    setLiveUpdateStatus('Scanning Fleet...');

    try {
        const lastIdx = selectedStopIndices.length > 0 ? Math.max(...selectedStopIndices) : orderedStops.length - 1;
        const scanIndices = [];
        for (let i = realTimeCurrentIndex; i <= lastIdx; i += 4) {
            scanIndices.push(i);
        }
        if (!scanIndices.includes(lastIdx)) scanIndices.push(lastIdx);

        const foundBusIds = new Set<string>();
        const scanResults = await Promise.all(
            scanIndices.map(async (idx) => {
                try {
                    const data = await transportService.getArrivals(orderedStops[idx].id);
                    const svc = data.services.find(s => s.serviceNo === serviceNo);
                    return { idx, svc };
                } catch { return { idx, svc: null }; }
            })
        );

        liveBusLayerRef.current.clearLayers();

        scanResults.forEach(({ idx, svc }) => {
            if (!svc) return;
            const buses = [
                { data: svc.next, rank: '1st', color: '#06b6d4', z: 3000, scale: 1.1 },
                { data: svc.subsequent, rank: '2nd', color: '#ec4899', z: 2900, scale: 1.0 },
                { data: svc.subsequent2, rank: '3rd', color: '#8b5cf6', z: 2800, scale: 0.9 }
            ];

            buses.forEach(b => {
                if (b.data && b.data.lat && b.data.lng && b.data.lat !== 0) {
                    const busId = `${b.data.lat}_${b.data.lng}`;
                    if (foundBusIds.has(busId)) return;
                    foundBusIds.add(busId);

                    const mins = b.data.mins <= 0 ? 'Arr' : `${b.data.mins}m`;
                    const iconHtml = `
                    <div class="flex flex-col items-center justify-center transform transition-all duration-1000" style="transform: scale(${b.scale})">
                        <div style="background-color: ${b.color}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap; margin-bottom: 2px; border: 1.5px solid white;">
                            ${mins}
                        </div>
                        <div class="bus-marker-bounce" style="color: ${b.color}; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
                            ${ICONS_SVG.BUS_FRONT}
                        </div>
                        <div style="color: ${b.color}; font-size: 8px; font-weight: 900; text-transform: uppercase; margin-top: -1px; background: rgba(255,255,255,0.8); padding: 0 4px; border-radius: 4px; border: 1px solid ${b.color}; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                            ${b.rank}
                        </div>
                    </div>`;
                    
                    const icon = L.divIcon({
                        className: 'live-bus-marker-container',
                        html: iconHtml,
                        iconSize: [40, 65],
                        iconAnchor: [20, 50]
                    });
                    L.marker([b.data.lat, b.data.lng], { icon, zIndexOffset: b.z }).addTo(liveBusLayerRef.current);
                }
            });
            
            if (svc.next) {
                setStopArrivals(prev => ({ ...prev, [idx]: svc.next!.mins }));
            }
        });

        if (foundBusIds.size > 0) {
            setLiveUpdateStatus(`Radar Active: ${foundBusIds.size} Units Tracked`);
        } else {
            setLiveUpdateStatus('Radar Clear');
        }
    } catch (e) {
        setLiveUpdateStatus('Radar Interference');
    } finally {
        setIsRadarScanning(false);
    }
  }, [serviceNo, orderedStops, realTimeCurrentIndex, selectedStopIndices]);

  useEffect(() => {
    if (isSingleStopMode || !serviceNo || orderedStops.length === 0) return;
    fetchLiveBusLocations();
    const busPollInterval = setInterval(fetchLiveBusLocations, 20000);
    return () => clearInterval(busPollInterval);
  }, [fetchLiveBusLocations, isSingleStopMode, serviceNo, orderedStops.length]);

  useEffect(() => {
      let watchId: number;
      if (navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition(
              (pos) => {
                  setLiveLocation({
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude
                  });
              },
              (err) => console.warn("Live tracking error", err),
              { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
          );
      }
      return () => {
          if (watchId) navigator.geolocation.clearWatch(watchId);
      };
  }, []);

  const fetchProgressively = useCallback(async () => {
      if (isSingleStopMode || !serviceNo || orderedStops.length === 0) return;
      let baseTime = 0;
      try {
         const currentStopData = await transportService.getArrivals(orderedStops[realTimeCurrentIndex].id);
         const svc = currentStopData.services.find(s => s.serviceNo === serviceNo);
         if (svc && svc.next) {
             baseTime = svc.next.mins;
             setStopArrivals(prev => ({ ...prev, [realTimeCurrentIndex]: baseTime }));
         }
      } catch(e) {}

      const initialEstimates: Record<number, string> = {};
      let accumulatedDist = 0;
      for (let i = realTimeCurrentIndex + 1; i < orderedStops.length; i++) {
          const prev = orderedStops[i-1];
          const curr = orderedStops[i];
          if (prev.lat && curr.lat && prev.lng && curr.lng) {
              const d = transportService.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
              accumulatedDist += d;
              const estimatedMins = baseTime + Math.round((accumulatedDist * 2) + (i - realTimeCurrentIndex));
              initialEstimates[i] = `~${estimatedMins}`;
          }
      }
      setStopArrivals(prev => {
          const next = { ...prev };
          Object.entries(initialEstimates).forEach(([k, v]) => {
              const idx = Number(k);
              if (next[idx] === undefined || typeof next[idx] === 'string') {
                  next[idx] = v;
              }
          });
          return next;
      });
      const limit = Math.min(orderedStops.length, realTimeCurrentIndex + 20);
      for (let i = realTimeCurrentIndex; i < limit; i++) {
          try {
              const stop = orderedStops[i];
              const data = await transportService.getArrivals(stop.id);
              const svc = data.services.find(s => s.serviceNo === serviceNo);
              if (svc && svc.next) {
                  setStopArrivals(prev => ({ ...prev, [i]: svc.next!.mins }));
              }
          } catch (e) { }
          await new Promise(resolve => setTimeout(resolve, 200));
      }
  }, [realTimeCurrentIndex, serviceNo, orderedStops, isSingleStopMode]);

  useEffect(() => {
      fetchProgressively();
      const intervalId = setInterval(fetchProgressively, 60000);
      return () => clearInterval(intervalId);
  }, [fetchProgressively]);

  useEffect(() => {
      trafficIntervalRef.current = setInterval(() => {
          setTrafficLights(prevLights => prevLights.map(light => {
              if (Math.random() > 0.8) {
                  if (light.state === 'GREEN') return { ...light, state: 'YELLOW' };
                  if (light.state === 'YELLOW') return { ...light, state: 'RED' };
                  if (light.state === 'RED') return { ...light, state: 'GREEN' };
              }
              return light;
          }));
      }, 3000);
      return () => {
          if (trafficIntervalRef.current) clearInterval(trafficIntervalRef.current);
      };
  }, []);

  useEffect(() => {
      if (orderedStops.length > 0 && realTimeCurrentIndex > 0) {
          setTimeout(() => {
              const el = document.getElementById(`stop-${realTimeCurrentIndex}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 500);
      }
  }, [orderedStops.length]);

  useEffect(() => {
      const L = (window as any).L;
      if (!mapInstanceRef.current || !L) return;

      if (liveLocation) {
          if (!userMarkerRef.current) {
              const userIcon = L.divIcon({
                  className: 'user-location-icon',
                  html: `<div class="relative flex items-center justify-center w-12 h-12"><div class="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md z-10"></div><div class="absolute w-full h-full bg-blue-500/20 rounded-full animate-ping"></div></div>`,
                  iconSize: [48, 48],
                  iconAnchor: [24, 24]
              });
              userMarkerRef.current = L.marker([liveLocation.lat, liveLocation.lng], { icon: userIcon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current);
          } else {
              userMarkerRef.current.setLatLng([liveLocation.lat, liveLocation.lng]);
          }
      }

      if (isSingleStopMode || orderedStops.length === 0) return;

      const searchWindow = 2;
      const nextIndexLimit = Math.min(realTimeCurrentIndex + searchWindow, orderedStops.length - 1);
      for (let i = realTimeCurrentIndex + 1; i <= nextIndexLimit; i++) {
          const stop = orderedStops[i];
          if (stop.lat && stop.lng && liveLocation) {
              const distKm = transportService.calculateDistance(liveLocation.lat, liveLocation.lng, stop.lat, stop.lng);
              if (distKm < 0.05) {
                  setRealTimeCurrentIndex(i);
                  const el = document.getElementById(`stop-${i}`);
                  if (el && isSheetExpanded) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  break;
              }
          }
      }

      if (passedPolylineRef.current) mapInstanceRef.current.removeLayer(passedPolylineRef.current);
      if (activePolylineRef.current) mapInstanceRef.current.removeLayer(activePolylineRef.current);
      trafficPolylinesRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
      trafficPolylinesRef.current = [];
      if (futurePolylineRef.current) mapInstanceRef.current.removeLayer(futurePolylineRef.current);
      
      const lastDestIndex = selectedStopIndices.length > 0 ? Math.max(...selectedStopIndices) : null;
      const renderEndIndex = lastDestIndex !== null ? lastDestIndex : orderedStops.length - 1;

      const latLngs = orderedStops
          .slice(0, renderEndIndex + 1)
          .map(s => (s.lat && s.lng) ? [s.lat, s.lng] : null)
          .filter(p => p !== null) as [number, number][];

      if (latLngs.length > 1) {
          const passedPath = latLngs.slice(0, realTimeCurrentIndex + 1);
          if (passedPath.length > 1) {
              passedPolylineRef.current = L.polyline(passedPath, {
                  color: '#374151', 
                  weight: 4, opacity: 0.5, dashArray: '5, 10'
              }).addTo(mapInstanceRef.current);
          }
          if (trafficSegments && trafficSegments.length > 0) {
              const currentStop = orderedStops[realTimeCurrentIndex];
              const destStop = orderedStops[renderEndIndex];
              let hasFoundStart = realTimeCurrentIndex === 0;
              let hasReachedDest = false;
              const SNAP_THRESHOLD = 0.0008; 
              trafficSegments.forEach(seg => {
                  if (hasReachedDest) return;
                  const segmentPoints: {lat: number, lng: number}[] = [];
                  const rawPath = seg.path;
                  for (let i = 0; i < rawPath.length; i++) {
                      const pt = rawPath[i];
                      if (!hasFoundStart && currentStop.lat && currentStop.lng) {
                          const dist = Math.abs(pt.lat - currentStop.lat) + Math.abs(pt.lng - currentStop.lng);
                          if (dist < SNAP_THRESHOLD) hasFoundStart = true;
                      }
                      if (hasFoundStart) {
                          segmentPoints.push(pt);
                          if (destStop.lat && destStop.lng) {
                              const dist = Math.abs(pt.lat - destStop.lat) + Math.abs(pt.lng - destStop.lng);
                              if (renderEndIndex !== 0 && dist < SNAP_THRESHOLD) {
                                  hasReachedDest = true;
                                  break;
                              }
                          }
                      }
                  }
                  if (segmentPoints.length > 1) {
                      const poly = L.polyline(segmentPoints, {
                          color: seg.color, weight: 6, opacity: 0.9, lineCap: 'round'
                      }).addTo(mapInstanceRef.current);
                      trafficPolylinesRef.current.push(poly);
                  }
              });
          } else {
              if (realTimeCurrentIndex < renderEndIndex) {
                  const nextIdx = Math.min(realTimeCurrentIndex + 2, latLngs.length);
                  const activePath = latLngs.slice(realTimeCurrentIndex, nextIdx);
                  if (activePath.length > 1) {
                      activePolylineRef.current = L.polyline(activePath, {
                          color: '#A691F2', weight: 6, opacity: 1, className: 'bus-route-active-anim'
                      }).addTo(mapInstanceRef.current);
                  }
                  if (nextIdx < latLngs.length) {
                      const futurePath = latLngs.slice(nextIdx - 1);
                      futurePolylineRef.current = L.polyline(futurePath, {
                          color: '#9CA3AF', weight: 4, opacity: 0.8,
                      }).addTo(mapInstanceRef.current);
                  }
              }
          }
      }
      
      markersRef.current.forEach((marker, idx) => {
          const el = marker.getElement();
          if (lastDestIndex !== null && idx > lastDestIndex) {
              if (el) el.style.display = 'none';
              return;
          }
          if (el) el.style.display = 'block';
          if (el) {
              const div = el.querySelector('div');
              if (div) {
                  if (idx < realTimeCurrentIndex) {
                       div.style.backgroundColor = '#374151';
                       div.style.opacity = '0.5';
                       div.style.border = '2px solid rgba(255,255,255,0.1)';
                       div.style.width = '8px'; div.style.height = '8px';
                  } else if (idx === realTimeCurrentIndex) {
                       div.style.backgroundColor = '#A691F2';
                       div.style.opacity = '1';
                       div.style.border = '3px solid white';
                       div.style.boxShadow = '0 0 15px #A691F2';
                       div.style.width = '16px'; div.style.height = '16px';
                       marker.setZIndexOffset(1000);
                  } else {
                       div.style.backgroundColor = '#fff';
                       div.style.opacity = '0.9';
                       div.style.border = '2px solid rgba(0,0,0,0.2)';
                       div.style.width = '10px'; div.style.height = '10px';
                       marker.setZIndexOffset(100);
                  }
              }
          }
      });
      updateDestinationMarkers();
      trafficLightMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
      trafficLightMarkersRef.current = [];
      if (trafficSegments && trafficSegments.length > 0 && trafficLights.length > 0) {
          trafficLights.forEach(light => {
              const colorMap = { RED: '#ef4444', GREEN: '#22c55e', YELLOW: '#f59e0b' };
              const color = colorMap[light.state];
              const shadowColor = light.state === 'GREEN' ? '#22c55e' : (light.state === 'RED' ? '#ef4444' : 'transparent');
              const icon = L.divIcon({
                  className: 'traffic-light-icon',
                  html: `<div style="background-color: ${color}; width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 8px ${shadowColor}; border: 1px solid white;"></div>`,
                  iconSize: [10, 10]
              });
              const m = L.marker([light.lat, light.lng], { icon, zIndexOffset: 800 }).addTo(mapInstanceRef.current);
              trafficLightMarkersRef.current.push(m);
          });
      }
  }, [liveLocation, orderedStops, realTimeCurrentIndex, isSingleStopMode, trafficSegments, trafficLights, selectedStopIndices]); 

  useEffect(() => {
      if (isSingleStopMode || !serviceNo) return;
      if (selectedStopIndices.length > 0) {
          const upcomingDest = selectedStopIndices.find(idx => idx > realTimeCurrentIndex);
          if (upcomingDest !== undefined && orderedStops[upcomingDest]) {
               transportService.setDestinationWatch(serviceNo, stopId, orderedStops[upcomingDest].id, orderedStops[upcomingDest].name);
          }
      }
  }, [selectedStopIndices, serviceNo, stopId, orderedStops, isSingleStopMode, realTimeCurrentIndex]);

  const updateDestinationMarkers = () => {
    const L = (window as any).L;
    if (!mapInstanceRef.current || !L) return;
    if (!destMarkersLayerRef.current) destMarkersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    else destMarkersLayerRef.current.clearLayers();
    selectedStopIndices.forEach((idx, i) => {
        const stop = orderedStops[idx];
        if (stop && stop.lat && stop.lng) {
             const icon = L.divIcon({
                  className: 'dest-marker',
                  html: `<div style="background-color: #F0B429; width: 30px; height: 30px; border-radius: 50% 50% 0 50%; border: 2px solid white; transform: rotate(45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 3000;">
                    <div style="transform: rotate(-45deg); font-weight: bold; font-size: 12px; color: white;">${i + 1}</div>
                  </div>`,
                  iconSize: [30, 30], iconAnchor: [15, 30]
              });
              L.marker([stop.lat, stop.lng], { icon, zIndexOffset: 3000 }).addTo(destMarkersLayerRef.current);
        }
    });
  };

  const initData = async () => {
      setIsLoading(true);
      setLoadError(null);
      setCanRetry(false);
      setIsDegradedMode(false);
      setShowDegradedBanner(false);
      setIsRouteDetached(false);
      setTrafficSegments(null);
      setTrafficLights([]);
      setStopArrivals({});
      try {
          if (isSingleStopMode || !serviceNo) {
              const currentStopInfo = await transportService.getBusStopInfo(stopId);
              const mainStop = { id: stopId, name: currentStopInfo?.name || stopName, lat: currentStopInfo?.lat || liveLocation?.lat, lng: currentStopInfo?.lng || liveLocation?.lng };
              setOrderedStops([mainStop]);
              setRealTimeCurrentIndex(0);
              if (mainStop.lat && mainStop.lng) initMap([mainStop]);
              else setLoadError("Stop coordinates unavailable.");
              setIsLoading(false);
              return;
          }
          const resolved = await transportService.resolveRoute(serviceNo, stopId, destStopId);
          if (!resolved) {
              setIsDegradedMode(true);
              setShowDegradedBanner(true);
              const currentStopInfo = await transportService.getBusStopInfo(stopId);
              const startStop = { id: stopId, name: currentStopInfo?.name || stopName, lat: currentStopInfo?.lat || liveLocation?.lat, lng: currentStopInfo?.lng || liveLocation?.lng };
              setOrderedStops([startStop]);
              setRealTimeCurrentIndex(0);
              if (startStop.lat && startStop.lng) initMap([startStop]);
              setIsLoading(false);
              return;
          }
          setRouteSource(resolved.pattern.source || 'UNKNOWN');
          const boardingIndex = resolved.stops.findIndex(s => s.id === stopId);
          if (boardingIndex === -1) setIsRouteDetached(true);
          const initialCurrentIndex = Math.max(0, boardingIndex);
          if (resolved.stops.length > 1) {
              const startName = resolved.stops[0].name.replace(/(Int|Ter|Stn)/g, '').trim();
              const endName = resolved.stops[resolved.stops.length - 1].name.replace(/(Int|Ter|Stn)/g, '').trim();
              setRouteTerminals(`${startName} -> ${endName}`);
          }
          setOrderedStops(resolved.stops);
          setRealTimeCurrentIndex(initialCurrentIndex);
          const savedIds = transportService.getRouteWaypoints(serviceNo);
          const restoredIndices = savedIds.map(id => resolved.stops.findIndex(s => s.id === id)).filter(idx => idx !== -1).sort((a, b) => a - b);
          if (restoredIndices.length > 0) setSelectedStopIndices(restoredIndices);
          else if (destStopId) {
              const dIdx = resolved.stops.findIndex(s => s.id === destStopId);
              if (dIdx !== -1) { setSelectedStopIndices([dIdx]); transportService.toggleRouteWaypoint(serviceNo, destStopId); }
          }
          initMap(resolved.stops);
          const finalDestIndex = restoredIndices.length > 0 ? restoredIndices[restoredIndices.length - 1] : resolved.stops.length - 1;
          const origin = resolved.stops[initialCurrentIndex];
          const dest = resolved.stops[finalDestIndex];
          if (origin?.lat && dest?.lat && initialCurrentIndex < finalDestIndex) {
              const waypoints = resolved.stops.slice(initialCurrentIndex + 1, finalDestIndex).filter((_, i) => i % 5 === 0).map(s => ({ lat: s.lat || 0, lng: s.lng || 0 })).filter(p => p.lat !== 0);
              setIsRoutesApiLoading(true);
              transportService.getTrafficAwareRoute({ lat: origin.lat, lng: origin.lng }, { lat: dest.lat, lng: dest.lng }, waypoints).then(segments => {
                  if (segments && segments.length > 0) {
                      setTrafficSegments(segments);
                      const mainPath = segments[0]?.path || [];
                      if (mainPath.length > 20) {
                           const lights: {lat: number, lng: number, state: 'RED'|'GREEN'|'YELLOW'}[] = [];
                           for (let i = 10; i < mainPath.length; i += 40) {
                               const pt = mainPath[i];
                               lights.push({ lat: pt.lat, lng: pt.lng, state: Math.random() > 0.5 ? 'GREEN' : 'RED' });
                           }
                           setTrafficLights(lights);
                      }
                  } else {
                      setTrafficSegments(null); setTrafficLights([]);
                  }
              }).finally(() => setIsRoutesApiLoading(false));
          }
      } catch (e) {
          setLoadError("Unable to load map data."); setCanRetry(true);
      } finally {
          setIsLoading(false);
      }
  };

  const initMap = (stops: BusStopLocation[]) => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;
      if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false });
          mapInstanceRef.current = map;
          map.on('click', () => setIsSheetExpanded(false));
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
          if (!liveBusLayerRef.current) liveBusLayerRef.current = L.layerGroup().addTo(map);
          if (!destMarkersLayerRef.current) destMarkersLayerRef.current = L.layerGroup().addTo(map);
      }
      const map = mapInstanceRef.current;
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];
      poiMarkersRef.current.forEach(m => map.removeLayer(m));
      poiMarkersRef.current = [];
      trafficLightMarkersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
      trafficLightMarkersRef.current = [];
      if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null; 
      const latLngs: [number, number][] = [];
      stops.forEach((stop, index) => {
          if (!stop || !stop.lat || !stop.lng) return;
          latLngs.push([stop.lat, stop.lng]);
          const icon = L.divIcon({
              html: `<div style="background-color: #fff; width: 10px; height: 10px; border-radius: 50%; opacity: 0.8; border: 2px solid rgba(0,0,0,0.2); transition: all 0.3s ease;"></div>`,
              iconSize: [10, 10], iconAnchor: [5, 5]
          });
          const marker = L.marker([stop.lat, stop.lng], { icon, zIndexOffset: 100 }).addTo(map);
          if (!isSingleStopMode) marker.on('click', () => handleSetDestination(index));
          markersRef.current.push(marker);
          const poi = getPoiType(stop.name);
          if (poi) {
             const poiIcon = L.divIcon({
                  className: 'poi-icon',
                  html: `<div style="background-color: ${poi.color}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.5); border: 2px solid white;">${poi.svg}</div>`,
                  iconSize: [20, 20], iconAnchor: [10, 30] 
              });
              const poiMarker = L.marker([stop.lat + 0.00015, stop.lng], { icon: poiIcon, zIndexOffset: 500 }).addTo(map);
              poiMarker.on('click', () => handlePoiClick(stop.name, poi.type, poi.iconComponent, poi.color));
              poiMarkersRef.current.push(poiMarker);
          }
      });
      if (latLngs.length > 0) map.fitBounds(L.latLngBounds(latLngs), { paddingBottomRight: [0, 200], paddingTopLeft: [20, 20] });
      updateDestinationMarkers();
  };

  const handlePoiClick = async (stopName: string, type: string, Icon: any, color: string) => {
    soundService.playInteraction();
    setActivePoi({ name: stopName, type, icon: Icon, color, desc: '', loading: true });
    try {
        const desc = await aiService.getPoiDetails(stopName);
        setActivePoi(prev => (prev && prev.name === stopName) ? { ...prev, desc, loading: false } : prev);
        soundService.playWhisper();
    } catch(e) {
        setActivePoi(prev => (prev && prev.name === stopName) ? { ...prev, desc: "Information currently unavailable.", loading: false } : prev);
    }
  };

  const handleClearDestination = () => { 
      if (serviceNo) {
          transportService.clearRouteWaypoints(serviceNo);
      }
      setSelectedStopIndices([]); 
  };

  const handleSetDestination = (index: number) => {
      const stop = orderedStops[index];
      if (stop?.lat && stop?.lng && mapInstanceRef.current) mapInstanceRef.current.flyTo([stop.lat, stop.lng], 16, { animate: true, duration: 0.8 });
      if (isDegradedMode || isSingleStopMode) return; 
      if (index <= realTimeCurrentIndex) { onShowToast("Stop passed.", "info"); return; }
      
      const isSelected = selectedStopIndices.includes(index);
      let newIndices;

      if (isSelected) {
          newIndices = selectedStopIndices.filter(i => i !== index);
          if (newIndices.length === 0 && serviceNo) {
              transportService.clearRouteWaypoints(serviceNo);
              setSelectedStopIndices([]);
              return;
          }
      } else {
          if (selectedStopIndices.length === 0 && serviceNo) {
              const boardingStop = orderedStops[realTimeCurrentIndex];
              const currentWaypoints = transportService.getRouteWaypoints(serviceNo);
              if (boardingStop && !currentWaypoints.includes(boardingStop.id)) {
                  transportService.toggleRouteWaypoint(serviceNo, boardingStop.id);
              }
              newIndices = [realTimeCurrentIndex, index].sort((a, b) => a - b);
          } else {
              newIndices = [...selectedStopIndices, index].sort((a, b) => a - b);
          }
          soundService.playInteraction();
      }

      setSelectedStopIndices(newIndices);
      if (serviceNo && stop) {
          transportService.toggleRouteWaypoint(serviceNo, stop.id);
      }
  };
  
  const handleRecenter = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (mapInstanceRef.current) {
          soundService.playGpsPing();
          if (liveLocation) {
              mapInstanceRef.current.flyTo([liveLocation.lat, liveLocation.lng], 17, { animate: true, duration: 1.2 });
              if (isSheetExpanded && orderedStops.length > 0) {
                  let closestIdx = -1; let minDistance = Infinity;
                  orderedStops.forEach((stop, idx) => {
                      if (stop.lat && stop.lng) {
                          const dist = transportService.calculateDistance(liveLocation.lat, liveLocation.lng, stop.lat, stop.lng);
                          if (dist < minDistance) { minDistance = dist; closestIdx = idx; }
                      }
                  });
                  if (closestIdx !== -1) {
                      const el = document.getElementById(`stop-${closestIdx}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
              }
          } else if (orderedStops.length > 0) {
               const latLngs = orderedStops.map(s => (s.lat && s.lng) ? [s.lat, s.lng] : null).filter(p => p !== null) as [number, number][];
               if (latLngs.length > 0) {
                    const L = (window as any).L;
                    if(L) mapInstanceRef.current.fitBounds(L.latLngBounds(latLngs), { paddingBottomRight: [0, 200], paddingTopLeft: [20, 20] });
               }
          }
      } else onShowToast("Map not ready", "info");
  };
  
  const handleInsightReady = (data: { title: string, roads: string, desc: string, status: string }) => {
      setTrafficHeader(data); setTrafficStatus(data.status); soundService.playWhisper();
      if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current);
      trafficTimerRef.current = setTimeout(() => setTrafficHeader(null), 10000);
  };
  
  const getTrafficColorForStop = (idx: number) => {
      if (!trafficSegments || trafficSegments.length === 0) return '#A691F2';
      const totalStops = orderedStops.length;
      if (totalStops <= 1) return '#A691F2';
      const progress = idx / (totalStops - 1);
      const totalSegments = trafficSegments.length;
      const targetSegmentIdx = Math.min(Math.floor(progress * totalSegments), totalSegments - 1);
      return trafficSegments[targetSegmentIdx].color;
  };

  const onTouchStart = (e: React.TouchEvent) => touchStartY.current = e.touches[0].clientY;
  const onTouchEnd = (e: React.TouchEvent) => {
      const diff = touchStartY.current - e.changedTouches[0].clientY;
      if (diff > 50) setIsSheetExpanded(true); if (diff < -50) setIsSheetExpanded(false);
  };
  const handleTouchStart = (stop: BusStopLocation) => {
    isScrollingRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
        if (!isScrollingRef.current) { setContextMenuStop(stop); soundService.playInteraction(); }
    }, 600);
  };
  const handleTouchMove = () => {
    isScrollingRef.current = true;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };
  const handleTouchEndItem = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const lastSelectedIndex = selectedStopIndices.length > 0 ? selectedStopIndices[selectedStopIndices.length - 1] : null;
  const remainingStops = lastSelectedIndex !== null ? lastSelectedIndex - realTimeCurrentIndex : 0;
  let displayEta = etaMins;
  if (lastSelectedIndex !== null) {
      const val = stopArrivals[lastSelectedIndex];
      if (typeof val === 'number') displayEta = val;
      else if (typeof val === 'string') displayEta = parseInt(val.replace('~', '')) || 0;
  }
  const currentSeq = selectedStopIndices.length;

  return (
    <div className="fixed inset-0 z-[5000] bg-moncchichi-bg flex flex-col animate-in fade-in duration-300">
      <style>{`
        @keyframes dash-flow { to { stroke-dashoffset: -20; } }
        @keyframes bounce-gentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .bus-route-active-anim { stroke-dasharray: 10, 8; animation: dash-flow 1s linear infinite; }
        .bus-marker-bounce { animation: bounce-gentle 2s infinite ease-in-out; }
      `}</style>
      
      {serviceNo && lastSelectedIndex !== null && orderedStops[realTimeCurrentIndex] && orderedStops[lastSelectedIndex] && (
          <TrafficInsightManager serviceNo={serviceNo} currentStop={orderedStops[realTimeCurrentIndex]} destinationStop={orderedStops[lastSelectedIndex]} onLoading={setIsTrafficLoading} onInsightReady={handleInsightReady} />
      )}

      {activePoi && (
          <div className="absolute top-20 left-4 right-4 z-[2100] flex justify-center pointer-events-none animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-moncchichi-surface/95 backdrop-blur-md border border-moncchichi-border p-4 rounded-2xl shadow-2xl max-w-sm pointer-events-auto relative">
                   <button onClick={() => setActivePoi(null)} className="absolute top-2 right-2 p-1 text-moncchichi-textSec hover:text-moncchichi-text bg-moncchichi-surfaceAlt rounded-full"><X size={14} /></button>
                   <div className="flex items-start gap-3">
                       <div className="p-2.5 rounded-xl shadow-inner shrink-0" style={{ backgroundColor: `${activePoi.color}20` }}>{React.createElement(activePoi.icon, { size: 20, style: { color: activePoi.color } })}</div>
                       <div>
                           <div className="flex items-center gap-2 mb-0.5"><h3 className="font-bold text-sm text-moncchichi-text">{activePoi.name}</h3><span className="text-[9px] px-1.5 py-0.5 rounded border border-moncchichi-border font-bold uppercase tracking-wider" style={{ color: activePoi.color, borderColor: `${activePoi.color}40` }}>{activePoi.type}</span></div>
                           {activePoi.loading ? (<div className="flex items-center gap-2 text-xs text-moncchichi-textSec mt-1"><Loader2 size={12} className="animate-spin" /> Retrieving intel...</div>) : (<p className="text-xs text-moncchichi-textSec leading-relaxed">{activePoi.desc}</p>)}
                       </div>
                   </div>
              </div>
          </div>
      )}

      {contextMenuStop && (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setContextMenuStop(null)}>
            <div className="bg-moncchichi-surface border border-moncchichi-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surfaceAlt/50"><h3 className="font-bold text-lg text-moncchichi-text">{contextMenuStop.name}</h3><span className="text-xs text-moncchichi-textSec font-mono">{contextMenuStop.id}</span></div>
                <div className="p-2 space-y-1">
                    <button onClick={() => { if (transportService.isFavorite(contextMenuStop.id)) { transportService.removeFavorite(contextMenuStop.id); onShowToast("Removed from Favorites", "info"); } else { transportService.addFavorite(contextMenuStop); onShowToast("Added to Favorites", "success"); } setContextMenuStop(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-moncchichi-surfaceAlt rounded-xl transition-colors text-left"><div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500"><Star size={24} fill={transportService.isFavorite(contextMenuStop.id) ? "currentColor" : "none"} /></div><div><div className="font-bold text-sm text-moncchichi-text">{transportService.isFavorite(contextMenuStop.id) ? "Remove Favorite" : "Add to Favorites"}</div><div className="text-xs text-moncchichi-textSec">Pin to your main dashboard</div></div></button>
                    <button onClick={() => { onViewStop(contextMenuStop); setContextMenuStop(null); }} className="w-full flex items-center gap-4 p-4 hover:bg-moncchichi-surfaceAlt rounded-xl transition-colors text-left"><div className="p-3 bg-blue-500/10 rounded-full text-blue-500"><Search size={24} /></div><div><div className="font-bold text-sm text-moncchichi-text">Jump to Search</div><div className="text-xs text-moncchichi-textSec">View in manual search mode</div></div></button>
                </div>
                <div className="p-2 border-t border-moncchichi-border"><button onClick={() => setContextMenuStop(null)} className="w-full py-3 text-center text-xs font-bold text-moncchichi-textSec hover:text-moncchichi-text">Cancel</button></div>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-[2000] flex justify-between items-start pointer-events-none">
        <button onClick={onBack} className="pointer-events-auto bg-moncchichi-surface border border-moncchichi-border text-moncchichi-text px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-transform backdrop-blur-md"><ArrowLeft size={18} /> Back</button>
        <div className="pointer-events-auto bg-moncchichi-surface/90 backdrop-blur-md border border-moncchichi-border p-3 rounded-2xl shadow-xl max-w-[280px] text-right min-w-[140px]">
            {isSingleStopMode ? (
                <>
                    <div className="text-xs font-bold text-moncchichi-accent flex items-center justify-end gap-1.5 mb-1"><MapPin size={12} fill="currentColor" /> {stopId}</div>
                    <div className="text-xs font-medium text-moncchichi-text leading-tight">{stopName}</div>
                </>
            ) : trafficHeader ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                     <div className={`text-xs font-bold uppercase tracking-widest mb-1 flex items-center justify-end gap-1.5 ${trafficHeader.status === 'HEAVY' ? 'text-red-400' : (trafficHeader.status === 'MODERATE' ? 'text-yellow-400' : 'text-green-400')}`}>{trafficHeader.status === 'HEAVY' ? <Skull size={12} /> : (trafficHeader.status === 'MODERATE' ? <Shield size={12} /> : <Sword size={12} />)}{trafficHeader.title}</div>
                     <div className="text-[9px] font-mono text-moncchichi-textSec font-bold mb-1 uppercase whitespace-normal break-words">{trafficHeader.roads}</div>
                     <div className="text-[10px] text-moncchichi-text leading-tight font-serif italic opacity-90 whitespace-normal break-words">"{trafficHeader.desc}"</div>
                </div>
            ) : (
                <>
                    <div className="text-sm font-black text-moncchichi-accent flex items-center justify-end gap-1.5 mb-1">
                        {isTrafficLoading && <Loader2 size={12} className="animate-spin text-moncchichi-accent" />}
                        {(isRoutesApiLoading || isRadarScanning) && <RadioTower size={12} className="animate-pulse text-cyan-400" />}
                        Bus {serviceNo}
                    </div>
                    <div className="text-[10px] font-bold text-moncchichi-text opacity-90 truncate mb-1 max-w-full">{routeTerminals}</div>
                    <div className="flex items-center justify-end gap-2">
                        {routeSource && <span className="text-[8px] bg-moncchichi-surface border border-moncchichi-border px-1 rounded text-moncchichi-textSec uppercase">{routeSource}</span>}
                        <div className="text-[9px] font-medium text-moncchichi-textSec truncate">Current: {orderedStops[realTimeCurrentIndex]?.name || stopName}</div>
                    </div>
                    {liveUpdateStatus && <div className="text-[8px] font-mono text-moncchichi-accent mt-0.5 animate-pulse text-right">{liveUpdateStatus}</div>}
                </>
            )}
        </div>
      </div>
      
      {liveLocation && (
          <button onClick={handleRecenter} className={`absolute right-4 z-[4000] bg-moncchichi-surface/90 backdrop-blur border border-moncchichi-border text-moncchichi-accent p-3 rounded-full shadow-xl active:scale-95 transition-all duration-500 ease-out-back ${isSheetExpanded ? 'bottom-[56%]' : 'bottom-20'}`}><Navigation size={20} fill="currentColor" /></button>
      )}

      <div className="flex-1 relative bg-moncchichi-bg">
        {isLoading && <div className="absolute inset-0 flex items-center justify-center z-10 bg-moncchichi-bg text-moncchichi-accent"><Loader2 size={32} className="animate-spin" /></div>}
        {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 text-center bg-moncchichi-bg/95 backdrop-blur-sm">
                <MapIcon size={48} className="text-moncchichi-textSec mb-4 opacity-50" />
                <h3 className="text-moncchichi-text font-bold mb-2">Map Unavailable</h3>
                <p className="text-moncchichi-textSec text-sm mb-6 max-w-xs">{loadError}</p>
                <div className="flex gap-3"><button onClick={onBack} className="px-6 py-2 bg-moncchichi-surface border border-moncchichi-border rounded-lg text-sm font-bold">Return</button>{canRetry && <button onClick={() => initData()} className="px-6 py-2 bg-moncchichi-accent text-moncchichi-bg rounded-lg text-sm font-bold flex items-center gap-2"><RotateCcw size={14} /> Retry</button>}</div>
            </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#1a1a1a' }} />
      </div>

      {!isSingleStopMode && (
          <div className={`transition-all duration-500 ease-out-back bg-moncchichi-surface border-t border-moncchichi-border flex flex-col z-[3000] shadow-[0_-8px_30px_rgba(0,0,0,0.5)] absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden pb-safe ${isSheetExpanded ? 'h-[55%]' : 'h-16'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <div className="w-full flex flex-col items-center justify-center py-2 cursor-pointer hover:bg-moncchichi-surfaceAlt/30 transition-colors rounded-t-2xl min-h-[40px] shrink-0 active:bg-moncchichi-surfaceAlt/50 z-[3001] relative" onClick={() => setIsSheetExpanded(!isSheetExpanded)} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}><div className="w-10 h-1 bg-moncchichi-border rounded-full mb-1" />{isSheetExpanded ? (<ChevronDown size={12} className="text-moncchichi-textSec opacity-50" />) : (<div className="animate-bounce"><ChevronUp size={20} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" strokeWidth={3} /></div>)}</div>
              {!isSheetExpanded && <div className="absolute inset-0 z-[3000] cursor-pointer" onClick={() => setIsSheetExpanded(true)} />}
              {isDegradedMode && showDegradedBanner && (<div className="bg-moncchichi-surfaceAlt border-b border-moncchichi-border px-4 py-3 flex items-start gap-3 shrink-0"><AlertTriangle size={14} className="text-moncchichi-warning shrink-0 mt-0.5" /><span className="text-[10px] text-moncchichi-textSec flex-1 leading-relaxed">Route map unavailable. Showing boarding stop only.</span><button onClick={() => setShowDegradedBanner(false)} className="text-moncchichi-textSec hover:text-moncchichi-text p-1 -mr-2 -mt-1 rounded-full hover:bg-moncchichi-border/50 transition-colors"><X size={14} /></button></div>)}
              <div className="p-4 pt-0 border-b border-moncchichi-border flex items-center justify-between shrink-0">{lastSelectedIndex !== null ? (<div className="flex-1"><div className="text-[9px] font-black text-moncchichi-textSec uppercase tracking-widest mb-1 flex items-center gap-1"><div className="w-4 h-4 rounded-full bg-yellow-500 text-white flex items-center justify-center text-[9px] font-bold">{currentSeq}</div>Waypoints Active</div><div className="text-base font-bold text-moncchichi-text truncate max-w-[250px]">{orderedStops[lastSelectedIndex]?.name}</div><div className="flex items-center gap-3 mt-1.5"><span className="text-xs font-mono font-bold text-moncchichi-accent bg-moncchichi-accent/10 px-2 py-0.5 rounded border border-moncchichi-accent/20">{remainingStops} stops</span><span className="text-[10px] font-bold text-moncchichi-textSec flex items-center gap-1"><Clock size={10} /> ~{displayEta} min</span></div></div>) : (<div className="flex items-center gap-3 text-moncchichi-textSec opacity-70 py-2"><div className="p-2 bg-moncchichi-surface rounded-full border border-moncchichi-border"><Flag size={16} /></div><div className="text-xs font-bold">Tap stops to plan journey</div></div>)}</div>
              <div className="flex-1 overflow-y-auto" ref={listRef}><div className="relative"><div className="absolute left-[27px] top-0 bottom-0 w-1 bg-moncchichi-border/50 z-0"></div>{orderedStops.map((stop, idx) => {
                          const isPast = idx < realTimeCurrentIndex; const isCurrent = idx === realTimeCurrentIndex; const isSelected = selectedStopIndices.includes(idx); const selectionIndex = selectedStopIndices.indexOf(idx) + 1; const arrivalVal = stopArrivals[idx]; const isLive = typeof arrivalVal === 'number'; const isActiveSegment = idx >= realTimeCurrentIndex && (lastSelectedIndex === null || idx < lastSelectedIndex); const lineColor = isActiveSegment ? getTrafficColorForStop(idx) : 'transparent'; const nextColor = isActiveSegment && (idx + 1 < orderedStops.length) ? getTrafficColorForStop(idx + 1) : lineColor; const segmentGradient = isActiveSegment ? `linear-gradient(to bottom, ${lineColor}, ${nextColor})` : undefined;
                          return (
                              <div key={stop.id} id={`stop-${idx}`} onClick={() => handleSetDestination(idx)} onTouchStart={() => handleTouchStart(stop)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEndItem} onMouseDown={() => handleTouchStart(stop)} onMouseUp={handleTouchEndItem} onMouseLeave={handleTouchEndItem} className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group relative z-10 ${isPast ? 'opacity-40 grayscale' : 'hover:bg-moncchichi-surfaceAlt/50'} ${isCurrent ? 'bg-moncchichi-accent/5' : ''} ${isSelected ? 'bg-yellow-500/5' : ''}`}>
                                  {isActiveSegment && idx < orderedStops.length - 1 && (<div className="absolute left-[27px] top-[24px] w-1 h-[calc(100%)] z-0" style={{ background: segmentGradient }} />)}
                                  <div className="flex flex-col items-center justify-center min-w-[24px] h-[24px] relative z-10">{isCurrent ? (<div className="relative"><div className="w-6 h-6 bg-moncchichi-accent rounded-full flex items-center justify-center shadow-[0_0_15px_#A691F2] z-20 animate-pulse"><Bus size={14} className="text-moncchichi-bg" fill="currentColor" /></div><div className="absolute inset-0 bg-moncchichi-accent rounded-full animate-ping opacity-50"></div></div>) : isSelected ? (<div className="relative"><div className="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white flex items-center justify-center shadow-[0_0_15px_#F0B429] z-20"><span className="text-[10px] font-bold text-white leading-none">{selectionIndex}</span></div>{idx === lastSelectedIndex && <div className="absolute inset-0 bg-yellow-500 rounded-full animate-ping opacity-50"></div>}</div>) : (<div className={`w-3 h-3 rounded-full border-2 ${isPast ? 'bg-moncchichi-border border-moncchichi-textSec' : 'bg-moncchichi-surface border-moncchichi-textSec'} z-10 transition-colors`} />)}</div>
                                  <div className="flex-1 min-w-0"><div className={`text-sm font-bold truncate ${isCurrent ? 'text-moncchichi-accent' : (isSelected ? 'text-yellow-500' : 'text-moncchichi-text')}`}>{stop.name}</div><div className="text-[10px] text-moncchichi-textSec font-mono flex items-center gap-2"><span>{stop.id}</span>{isCurrent && <span className="text-moncchichi-accent font-bold flex items-center gap-0.5"><ArrowDown size={10} /> You are here</span>}</div></div>
                                  <div className="flex flex-col items-end gap-1">{isSelected && idx === lastSelectedIndex && <Flag size={14} className="text-yellow-500" />}{arrivalVal !== undefined && !isPast && (<div className="flex flex-col items-end"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isSelected ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : (isLive ? 'bg-moncchichi-success/10 text-moncchichi-success border-moncchichi-success/30' : 'bg-moncchichi-surfaceAlt text-moncchichi-textSec border-moncchichi-border')}`}>{arrivalVal} min</span>{isLive && <div className="flex items-center gap-0.5 mt-0.5"><Signal size={8} className="text-moncchichi-success animate-pulse" /><span className="text-[8px] text-moncchichi-textSec">LIVE</span></div>}</div>)}</div>
                              </div>
                          );
                      })}</div><div className="h-12" /></div>
          </div>
      )}
    </div>
  );
};

export default RouteMap;
