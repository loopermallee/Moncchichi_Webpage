
import { fetchLTA } from '../src/services/proxyApi';
import { keyService } from './keyService';
import { mockService } from './mockService';
import { storageService } from './storageService';
import { CHEEAUN_SERVICES, CHEEAUN_STOPS, CHEEAUN_ROUTES } from './cheeaunOfflineDb';
import { aiService } from './aiService';

// --- Types ---

export interface ArrivalInfo {
  mins: number;
  load: 'SEA' | 'SDA' | 'LSD' | string; 
  type: 'SD' | 'DD' | 'BD' | string;   
  feature: 'WAB' | string;           
  trend?: 'FASTER' | 'SLOWER' | 'SAME' | 'NEW';
  lat?: number;
  lng?: number;
  destinationCode?: string; // Added for route direction matching
}

export interface BusServiceData {
  serviceNo: string;
  operator: string;
  next: ArrivalInfo | null;
  subsequent: ArrivalInfo | null;
  subsequent2: ArrivalInfo | null;
  stopName?: string;
  stopId?: string;
  insight?: string; 
}

export interface BusStopData {
  id: string;
  services: BusServiceData[];
}

export interface BusStopLocation {
    id: string;
    name: string;
    lat?: number; 
    lng?: number;
    distance?: number;
}

export interface BusTiming {
    wd: string | null;  // HHMM or null
    sat: string | null; // HHMM or null
    sun: string | null; // HHMM or null
}

export interface BusSchedule {
    first: BusTiming;
    last: BusTiming;
}

export type RawFirstLastFile = { [busStopCode: string]: string[] };

export interface ParsedFirstLastSchedule {
  stopId: string;
  serviceNo: string;
  wdFirst: string | null;
  wdLast: string | null;
  satFirst: string | null;
  satLast: string | null;
  sunFirst: string | null;
  sunLast: string | null;
}

interface WatchedBusRecord {
    timestamp: number;
    nextMins: number;
    subMins: number;
    sub2Mins: number;
}

export interface BusRoutePattern {
    serviceNo: string;
    direction: 1 | 2;
    stops: string[];
    polyline: { lat: number; lng: number }[];
    source: 'LTA' | 'BUSROUTER' | 'STATIC';
    lastUpdated: number;
}

export interface DestinationWatch {
    serviceNo: string;
    originStopId: string;
    destinationStopId: string;
    destinationName: string;
    alerted: boolean;
    timestamp: number; // Added for sequencing
}

export interface StopsMeta {
    version: string;
    stopCount: number;
    generatedAt: string;
    lastSyncedAt?: string;
    source: string;
}

export interface RoutesMeta {
    routeCount: number;
    lastSyncedAt: string;
    source: string;
    generatedAt: string;
    waypointsCount?: number;
}

export interface SearchResult {
    results: BusStopLocation[];
    suggestion: string | null;
}

// --- Cheeaun offline raw types + parsers ---

// Raw JSON shapes coming from cheeaunOfflineDb.ts
type CheeaunServicesRaw = typeof CHEEAUN_SERVICES;
type CheeaunStopsRaw = typeof CHEEAUN_STOPS;

// Cleaned-up in-memory DB shapes we will actually use
interface OfflineRoutesDb {
  [serviceNo: string]: {
    1?: string[]; // direction 1 stop IDs
    2?: string[]; // direction 2 stop IDs
  };
}

interface OfflineStopsDb {
  [stopId: string]: BusStopLocation; // id, name, lat, lng
}

/**
 * Build an OfflineRoutesDb from Cheeaun's routes.min.json shape.
 * routes.min.json shape is:
 *   { "160": [ [ "stopId1", ... ], [ "stopIdX", ... ] ], ... }
 */
const OFFLINE_ROUTES_DB: OfflineRoutesDb = (() => {
  const db: OfflineRoutesDb = {};
  const raw: CheeaunServicesRaw = CHEEAUN_SERVICES;

  for (const serviceNo of Object.keys(raw)) {
    const svc: any = (raw as any)[serviceNo];
    if (!svc) continue;

    const routes = svc.routes;
    if (!Array.isArray(routes)) continue;

    // services.min.json: routes is an array of variants.
    // We only care about the first two as Dir 1 and Dir 2.
    const [dir1, dir2] = routes as [string[] | undefined, string[] | undefined];

    const rec: { 1?: string[]; 2?: string[] } = {};

    if (Array.isArray(dir1) && dir1.length > 0) {
      rec[1] = dir1;
    }
    if (Array.isArray(dir2) && dir2.length > 0) {
      rec[2] = dir2;
    }

    if (rec[1] || rec[2]) {
      db[serviceNo] = rec;
    }
  }

  return db;
})();
/**
 * Build an OfflineStopsDb from Cheeaun's stops.min.json shape.
 * stops.min.json shape is:
 *   { "stopId": [ lng, lat, name, road ], ... }
 */
const OFFLINE_STOPS_DB: OfflineStopsDb = (() => {
  const db: OfflineStopsDb = {};
  const raw: CheeaunStopsRaw = CHEEAUN_STOPS;

  for (const stopId of Object.keys(raw)) {
    const entry = (raw as any)[stopId];
    if (!Array.isArray(entry) || entry.length < 3) continue;

    const [lng, lat, name] = entry;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    db[stopId] = {
      id: stopId,
      name: String(name ?? `Stop ${stopId}`),
      lat,
      lng,
      // distance is optional and filled later when we have user location
    };
  }

  return db;
})();
// --- Constants ---

const STATIC_ROUTES_RAW = `{"160":[["28009","28211","28221","28431","28581","43419","43099","43109","43619","43629","44151","44559","44051","45021","45209","46009"],["46009","45201","45029","44059","44551","44159","43621","43611","43101","43091","43411","28589","28439","28229","28219","28009"]],"180":[["22009","21221","21509","21519","21149","21139","21129","44151","44559","44051","45021","45209","44049","44039","44029","44019"],["44019","44021","44031","44041","45201","45029","44059","44551","44159","21121","21131","21141","21511","21501","21229","22009"]],"143":[["28009","28211","28201","43009","14141","14119","10021","09048","09038","04171"],["04171","09038","09048","10021","14119","14141","43009","28201","28211","28009"]],"97":[["28009","28211","28201","43009","14141","10021","09048","04171"],["04171","09048","10021","14141","43009","28009"]]}`;

let parsedStaticRoutes: { [serviceNo: string]: string[][] } | null = null;

function parseStaticRoutes(): { [serviceNo: string]: string[][] } {
    if (parsedStaticRoutes) return parsedStaticRoutes;
    try {
        parsedStaticRoutes = JSON.parse(STATIC_ROUTES_RAW);
    } catch (e) {
        console.error("Failed to parse STATIC_ROUTES_RAW", e);
        parsedStaticRoutes = {};
    }
    return parsedStaticRoutes!;
}

const BASE_URL = 'https://arrivelah2.busrouter.sg';
const PROXY_URL = 'https://corsproxy.io/?';
const FIRSTLAST_URL = 'https://raw.githubusercontent.com/cheeaun/sgbusdata/master/data/v1/firstlast.json';

const STORAGE_KEY_FAV = 'moncchichi_fav_stops';
const STORAGE_KEY_WATCHED = 'moncchichi_watched_buses'; 
const STORAGE_KEY_DESTINATIONS = 'moncchichi_destinations';
const STORAGE_KEY_WAYPOINTS = 'moncchichi_route_waypoints'; // New Key
const STORAGE_KEY_STOPS_DB = 'moncchichi_bus_stops_db';
const STORAGE_KEY_STOPS_META = 'moncchichi_bus_stops_meta';
const STORAGE_KEY_STOPS_LAST_CHECK = 'moncchichi_bus_stops_last_check';
// UPDATED: Bumped version to v3 to invalidate corrupted cache from previous fetches
const STORAGE_KEY_ROUTES_DB = 'moncchichi_bus_routes_db_v3';
const STORAGE_KEY_ROUTES_META = 'moncchichi_bus_routes_meta';
const SEEDED_KEY = 'moncchichi_fav_seeded_v4'; // Bumped version to force replacement of favorites

const STOPS_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PREDEFINED_STOPS: Record<string, { name: string, lat: number, lng: number }> = {
    '44151': { name: 'Opp Bt Batok Fire Stn', lat: 1.3361, lng: 103.7593 },
    '44159': { name: 'Bt Batok Fire Stn', lat: 1.3365, lng: 103.7591 },
    '20089': { name: "Opp Carrier S'pore", lat: 1.3283, lng: 103.7562 },
    '20271': { name: 'Opp German Ctr', lat: 1.3327, lng: 103.7429 },
    '20239': { name: 'Aft Hasanah Mque', lat: 1.3347, lng: 103.7441 },
    '28059': { name: 'Ng Teng Fong General Hospital', lat: 1.3337, lng: 103.7454 }
};

// Geocode Cache (In-Memory)
const GEO_CACHE: Map<string, string> = new Map();

class BusService {
  private defaultStop = '44151';
  private allStopsCache: BusStopLocation[] = [];
  private stopsMeta: StopsMeta | null = null;
  private favorites: BusStopLocation[] = [];
  
  private watchedBusIds: Set<string> = new Set();
  private watchedState: Record<string, WatchedBusRecord> = {};
  private insightCache: Record<string, string> = {};
  
  // Schedule Cache
  private scheduleCache: RawFirstLastFile = {};
  private isScheduleLoading = false;
  private scheduleLoadPromise: Promise<void> | null = null;

  // Destination Watch (Alerts)
  private activeDestinations: Map<string, DestinationWatch> = new Map();
  private destinationListeners: (() => void)[] = [];

  // Route Waypoints (Persistent User Selections)
  // Map<ServiceNo, Set<StopId>>
  private routeWaypoints: Map<string, string[]> = new Map();

  // Route Pattern Cache
  private routePatterns: Record<string, BusRoutePattern> = {};
  private isRouteRefreshing = false;
  private routeRefreshListeners: ((isRefreshing: boolean) => void)[] = [];
  private stopsUpdateListeners: (() => void)[] = [];
  private staticRoutesLoaded = false;

  // DB Sync State
  private isDbUpdating = false;
  private dbUpdateListeners: ((isUpdating: boolean) => void)[] = [];

  constructor() {
      this.loadFavorites();
      this.loadWatchedBuses();
      this.loadRouteCache();
      this.loadScheduleCache(); // Trigger generic load attempt
      this.loadDestinations(); // Load persisted destinations
      this.loadRouteWaypoints(); // Load persisted route plans
      
      const routeKeys = Object.keys(this.routePatterns);
      if (routeKeys.length > 0) {
          mockService.emitLog("ROUTE_DB", "INFO", `routes_db loaded with ${routeKeys.length} patterns.`);
      }
  }

  // --- Favorites Management ---

  private loadFavorites() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FAV);
      if (stored) {
          const parsed = JSON.parse(stored);
          // Sanitize loaded data: Ensure we only keep static properties, stripping distance
          this.favorites = parsed.map((s: any) => ({
              id: s.id,
              name: s.name,
              lat: s.lat,
              lng: s.lng
          }));
      } else {
          this.favorites = [];
      }
    } catch (e) {
      console.warn("Failed to load favorites", e);
      this.favorites = [];
    }
  }

  private saveFavorites() {
    // Explicitly map to ensure no dynamic properties like 'distance' or 'services' are saved
    const cleanFavorites = this.favorites.map(s => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng
    }));
    localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(cleanFavorites));
  }

  async seedFavorites() {
      const hasSeeded = localStorage.getItem(SEEDED_KEY);
      
      // If not seeded with V4 yet, overwrite/add defaults
      if (!hasSeeded) {
          const seeded = Object.entries(PREDEFINED_STOPS).map(([id, data]) => ({
              id,
              name: data.name,
              lat: data.lat,
              lng: data.lng
          }));
          
          // Overwrite existing favorites with new defaults
          this.favorites = seeded;
          this.saveFavorites();
          localStorage.setItem(SEEDED_KEY, 'true');
          
          // Clean up old key if exists
          localStorage.removeItem('moncchichi_fav_seeded'); 
          localStorage.removeItem('moncchichi_fav_seeded_v2'); 
          localStorage.removeItem('moncchichi_fav_seeded_v3');
          
          mockService.emitLog("APP", "INFO", "Seeded updated favorites (V4).");
      }
  }

  public getFavorites(): BusStopLocation[] { 
      // Auto-hydration: If we have the master DB loaded, check if any favorites are missing coordinates
      // and fix them automatically. This solves "hardcoded" or "missing" distance issues.
      if (this.allStopsCache.length > 0) {
          let updated = false;
          const hydrated = this.favorites.map(fav => {
              const cached = this.allStopsCache.find(s => s.id === fav.id);
              if (cached) {
                  // If favorite is missing vital info, backfill it from cache
                  if (!fav.lat || !fav.lng || fav.lat === 0) {
                      fav.lat = cached.lat;
                      fav.lng = cached.lng;
                      fav.name = cached.name; // Also update name if changed
                      updated = true;
                  }
                  // Return enriched object for display
                  return { ...fav, lat: cached.lat, lng: cached.lng, name: cached.name };
              }
              return fav;
          });

          if (updated) {
              this.favorites = hydrated; // Update internal state
              this.saveFavorites(); // Persist the fix
              mockService.emitLog("TRANSPORT", "INFO", "Repaired broken favorite coordinates.");
          }
          return hydrated;
      }
      return this.favorites; 
  }
  
  public isFavorite(stopId: string): boolean {
    return !!this.favorites.find(s => s.id === stopId);
  }

  public addFavorite(stop: BusStopLocation) {
    if (!this.favorites.find(s => s.id === stop.id)) {
      // Ensure we only store core location data, no dynamic props like distance
      const cleanStop: BusStopLocation = {
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng
      };
      this.favorites.push(cleanStop);
      this.saveFavorites();
    }
  }

  public removeFavorite(stopId: string) {
    this.favorites = this.favorites.filter(s => s.id !== stopId);
    this.saveFavorites();
  }

  public getFavorite(stopId: string): BusStopLocation | undefined {
      return this.favorites.find(s => s.id === stopId);
  }

  public renameFavorite(stopId: string, newName: string) {
      const idx = this.favorites.findIndex(s => s.id === stopId);
      if (idx !== -1) {
          this.favorites[idx].name = newName;
          this.saveFavorites();
      }
  }

  // --- Schedule Cache ---
  private async loadScheduleCache() {
      // If we already have data, don't reload
      if (Object.keys(this.scheduleCache).length > 0) return;
      
      // If already loading, await the existing promise
      if (this.scheduleLoadPromise) {
          await this.scheduleLoadPromise;
          return;
      }

      this.isScheduleLoading = true;
      this.scheduleLoadPromise = (async () => {
          try {
              // 1. Try Local Storage
              const stored = localStorage.getItem('moncchichi_bus_schedule');
              if (stored) {
                  try {
                      const parsed = JSON.parse(stored);
                      if (Object.keys(parsed).length > 0) {
                          this.scheduleCache = parsed;
                          // mockService.emitLog("TRANSPORT", "INFO", "Loaded schedules from storage.");
                          return;
                      }
                  } catch (e) {
                      localStorage.removeItem('moncchichi_bus_schedule');
                  }
              }

              // 2. Fetch from Network
              mockService.emitLog("TRANSPORT", "INFO", "Fetching fresh schedules (firstlast.json)...");
              const url = PROXY_URL + encodeURIComponent(FIRSTLAST_URL);
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              
              this.scheduleCache = await res.json();
              
              // 3. Save to Local Storage
              try {
                  localStorage.setItem('moncchichi_bus_schedule', JSON.stringify(this.scheduleCache));
              } catch (e) {
                  mockService.emitLog("TRANSPORT", "WARN", "Schedule cache too large for LocalStorage");
              }
          } catch (e: any) {
              mockService.emitLog("TRANSPORT", "WARN", "Failed to load schedules: " + e.message);
          } finally {
              this.isScheduleLoading = false;
              this.scheduleLoadPromise = null;
          }
      })();

      await this.scheduleLoadPromise;
  }

  private parseScheduleLine(stopId: string, tokens: string[]): ParsedFirstLastSchedule {
      // Helper to convert "=" to null
      const p = (v: string) => (v === '=' ? null : v);
      return {
          stopId,
          serviceNo: tokens[0],
          wdFirst: p(tokens[1]),
          wdLast: p(tokens[2]),
          satFirst: p(tokens[3]),
          satLast: p(tokens[4]),
          sunFirst: p(tokens[5]),
          sunLast: p(tokens[6])
      };
  }

  async getStopSchedule(stopId: string, serviceNo: string): Promise<ParsedFirstLastSchedule | null> {
      if (Object.keys(this.scheduleCache).length === 0) {
          await this.loadScheduleCache();
      }
      
      const lines = this.scheduleCache[stopId];
      if (!lines) return null;
      
      // Lines are strings: "143M 0600 2330 = = 0700 ="
      // Find the line starting with serviceNo
      const target = serviceNo.toUpperCase(); // Ensure case match
      
      for (const line of lines) {
          // Optimization: Check startswith before splitting
          if (line.startsWith(target + ' ')) {
              const tokens = line.split(' ');
              // Double check exact match of service number token
              if (tokens[0] === target || tokens[0] === serviceNo) {
                  return this.parseScheduleLine(stopId, tokens);
              }
          }
      }
      
      // Fallback: Full scan if exact startswith failed (e.g. padding issues?)
      for (const line of lines) {
          const tokens = line.split(' ');
          if (tokens[0] === serviceNo || tokens[0] === target) {
              return this.parseScheduleLine(stopId, tokens);
          }
      }

      return null;
  }

  async getStopSchedules(stopId: string): Promise<ParsedFirstLastSchedule[]> {
      if (Object.keys(this.scheduleCache).length === 0) {
          await this.loadScheduleCache();
      }
      
      const lines = this.scheduleCache[stopId];
      if (!lines) return [];
      
      return lines.map(line => this.parseScheduleLine(stopId, line.split(' ')));
  }

  public subscribeToStopsUpdate(cb: () => void) {
      this.stopsUpdateListeners.push(cb);
      return () => { this.stopsUpdateListeners = this.stopsUpdateListeners.filter(l => l !== cb); };
  }

  public subscribeToDbUpdateStatus(cb: (isUpdating: boolean) => void) {
      this.dbUpdateListeners.push(cb);
      cb(this.isDbUpdating);
      return () => { this.dbUpdateListeners = this.dbUpdateListeners.filter(l => l !== cb); };
  }

  private notifyStopsUpdate() {
      this.stopsUpdateListeners.forEach(cb => cb());
  }

  private notifyDbUpdateStatus(isUpdating: boolean) {
      this.isDbUpdating = isUpdating;
      this.dbUpdateListeners.forEach(cb => cb(isUpdating));
  }

  public getStopsMeta() { return this.stopsMeta; }

  public getRoutesMeta(): RoutesMeta {
      try {
          const stored = localStorage.getItem(STORAGE_KEY_ROUTES_META);
          if (stored) {
              return JSON.parse(stored);
          }
      } catch(e) {}
      return {
          source: 'Static (Default)',
          routeCount: Object.keys(this.routePatterns).length,
          lastSyncedAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          waypointsCount: this.routeWaypoints.size // Useful for debugging
      };
  }

  public getStopsLastUpdatedLabel(): string {
      if (!this.stopsMeta) return "Using built-in snapshot";
      const dateStr = this.stopsMeta.lastSyncedAt || this.stopsMeta.generatedAt;
      if (!dateStr) return "Unknown";
      
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Updated today";
      if (diffDays === 1) return "Updated yesterday";
      if (diffDays > 30) return `Updated ${new Date(dateStr).toLocaleDateString()}`;
      return `Updated ${diffDays} days ago`;
  }

  // --- Destination Watch (Single Active Alerts) ---
  
  private loadDestinations() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_DESTINATIONS);
        if (stored) {
           const list: DestinationWatch[] = JSON.parse(stored);
           list.forEach(d => this.activeDestinations.set(this.getBusKey(d.originStopId, d.serviceNo), d));
        }
      } catch(e) {}
  }

  private saveDestinations() {
      const list = Array.from(this.activeDestinations.values());
      localStorage.setItem(STORAGE_KEY_DESTINATIONS, JSON.stringify(list));
      this.notifyDestinationListeners();
  }

  public subscribeToDestinations(cb: () => void) {
      this.destinationListeners.push(cb);
      return () => { this.destinationListeners = this.destinationListeners.filter(l => l !== cb); };
  }

  private notifyDestinationListeners() {
      this.destinationListeners.forEach(cb => cb());
  }

  private getBusKey(originStopId: string, serviceNo: string): string {
      return `${originStopId}_${serviceNo}`;
  }

  public setDestinationWatch(serviceNo: string, originStopId: string, destinationStopId: string, destinationName: string) {
      const key = this.getBusKey(originStopId, serviceNo);
      
      const existing = this.activeDestinations.get(key);
      if (existing && existing.destinationStopId === destinationStopId) {
          return; // No change
      }

      this.activeDestinations.set(key, {
          serviceNo,
          originStopId,
          destinationStopId,
          destinationName,
          alerted: false,
          timestamp: existing ? existing.timestamp : Date.now()
      });
      this.saveDestinations();
      mockService.emitLog("TRANSPORT", "INFO", `Tracking Bus ${serviceNo} from ${originStopId} to ${destinationName}`);
  }

  public clearDestinationWatch(serviceNo: string, originStopId: string) {
      const key = this.getBusKey(originStopId, serviceNo);
      if (this.activeDestinations.has(key)) {
          this.activeDestinations.delete(key);
          this.saveDestinations();
          mockService.emitLog("TRANSPORT", "INFO", `Stopped tracking Bus ${serviceNo} from ${originStopId}`);
      }
  }

  public getDestinationWatch(serviceNo: string, originStopId: string): DestinationWatch | undefined {
      const key = this.getBusKey(originStopId, serviceNo);
      return this.activeDestinations.get(key);
  }

  public getDestinationSequence(serviceNo: string, originStopId: string): number | null {
      const key = this.getBusKey(originStopId, serviceNo);
      if (!this.activeDestinations.has(key)) return null;
      
      // Sort all active destinations by timestamp to find the sequence
      const all = Array.from(this.activeDestinations.values()).sort((a, b) => a.timestamp - b.timestamp);
      const index = all.findIndex(d => d.serviceNo === serviceNo && d.originStopId === originStopId);
      
      return index !== -1 ? index + 1 : null;
  }

  public async pollDestinationArrival(): Promise<string | null> {
      if (this.activeDestinations.size === 0) return null;

      for (const [key, watch] of this.activeDestinations.entries()) {
          if (watch.alerted) continue;

          try {
              const data = await this.getArrivals(watch.destinationStopId);
              const svc = data.services.find(s => s.serviceNo === watch.serviceNo);
              
              if (svc && svc.next) {
                  const mins = svc.next.mins;
                  if (mins <= 2) {
                      watch.alerted = true;
                      this.activeDestinations.set(key, watch);
                      this.saveDestinations();
                      return `Arriving at ${watch.destinationName} (${watch.serviceNo}) soon! Get ready.`;
                  }
              }
          } catch (e) {
              // Ignore errors during poll
          }
      }
      return null;
  }

  // --- Route Planning (Multiple Waypoints Persisted) ---

  private loadRouteWaypoints() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_WAYPOINTS);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Convert plain object back to Map: Record<serviceNo, stopIds[]>
            Object.entries(parsed).forEach(([serviceNo, stops]) => {
                if (Array.isArray(stops)) {
                    this.routeWaypoints.set(serviceNo, stops as string[]);
                }
            });
        }
    } catch(e) {
        console.warn("Failed to load route waypoints");
    }
  }

  private saveRouteWaypoints() {
      // Convert Map to Object for JSON stringify
      const obj: Record<string, string[]> = {};
      this.routeWaypoints.forEach((stops, serviceNo) => {
          if (stops.length > 0) {
              obj[serviceNo] = [...stops];
          }
      });
      localStorage.setItem(STORAGE_KEY_WAYPOINTS, JSON.stringify(obj));
  }

  public toggleRouteWaypoint(serviceNo: string, stopId: string) {
      if (!serviceNo) return;
      
      const stops = this.routeWaypoints.get(serviceNo) || [];
      const idx = stops.indexOf(stopId);
      
      if (idx !== -1) {
          // Remove if exists
          stops.splice(idx, 1);
      } else {
          // Add if new
          stops.push(stopId);
      }
      
      if (stops.length > 0) {
          this.routeWaypoints.set(serviceNo, stops);
      } else {
          this.routeWaypoints.delete(serviceNo);
      }
      
      this.saveRouteWaypoints();
  }

  public getRouteWaypoints(serviceNo: string): string[] {
      return this.routeWaypoints.get(serviceNo) || [];
  }

  public getAllRouteWaypoints(): Record<string, string[]> {
      const obj: Record<string, string[]> = {};
      this.routeWaypoints.forEach((stops, serviceNo) => {
          if (stops.length > 0) {
              obj[serviceNo] = [...stops];
          }
      });
      return obj;
  }

  public clearRouteWaypoints(serviceNo: string) {
      this.routeWaypoints.delete(serviceNo);
      this.saveRouteWaypoints();
  }

  // --- Route Cache Management ---
  private loadRouteCache() {
      try {
          const storedDB = localStorage.getItem(STORAGE_KEY_ROUTES_DB);
          if (storedDB) {
              this.routePatterns = JSON.parse(storedDB);
          }
      } catch (e) {
          console.warn("Failed to load route cache");
          this.routePatterns = {};
      }
      
      // Automatically sync static routes database on startup
      this.loadStaticRoutePatternsFromCheeaun();
  }

  private saveRouteCache() {
      try {
          localStorage.setItem(STORAGE_KEY_ROUTES_DB, JSON.stringify(this.routePatterns));
          const meta: RoutesMeta = {
              source: 'Static (Cheeaun) + Dynamic',
              routeCount: Object.keys(this.routePatterns).length,
              lastSyncedAt: new Date().toISOString(),
              generatedAt: new Date().toISOString()
          };
          localStorage.setItem(STORAGE_KEY_ROUTES_META, JSON.stringify(meta));
      } catch (e) {
          console.warn("Failed to save route cache (likely quota exceeded)");
      }
  }

  private normalizeServiceNo(no: string): string {
      return no.trim().toUpperCase();
  }

  private getRoutePatternKey(serviceNo: string, direction: 1 | 2): string {
      return `${this.normalizeServiceNo(serviceNo)}_${direction}`;
  }

  public subscribeToRouteRefresh(cb: (isRefreshing: boolean) => void) {
      this.routeRefreshListeners.push(cb);
      cb(this.isRouteRefreshing);
      return () => {
          this.routeRefreshListeners = this.routeRefreshListeners.filter(l => l !== cb);
      }
  }

  private setRouteRefreshing(val: boolean) {
      this.isRouteRefreshing = val;
      this.routeRefreshListeners.forEach(cb => cb(val));
  }

  public async maybeRefreshRouteDataInBackground() {
      // Background logic retained for staleness checks if needed
  }

  // --- STATIC ROUTE LOADER (Offline First) ---
  private async loadStaticRoutePatternsFromCheeaun(): Promise<void> {
      if (this.staticRoutesLoaded) return;
      this.staticRoutesLoaded = true; // Prevent re-entry

      mockService.emitLog("ROUTE_DB", "INFO", "Loading static routes (Cheeaun offline DB)...");

      try {
          let count = 0;

          // 1) Preferred: full Cheeaun offline DB
          const offlineKeys = Object.keys(OFFLINE_ROUTES_DB);
          if (offlineKeys.length > 0) {
              for (const serviceNo of offlineKeys) {
                  const entry = OFFLINE_ROUTES_DB[serviceNo];
                  if (!entry) continue;

                  const maybeAdd = (dir: 1 | 2, stops?: string[]) => {
                      if (!stops || stops.length === 0) return;
                      const key = this.getRoutePatternKey(serviceNo, dir);

                      // Do not overwrite any patterns already fetched from BusRouter/LTA
                      if (this.routePatterns[key]) return;

                      this.routePatterns[key] = {
                          serviceNo: this.normalizeServiceNo(serviceNo),
                          direction: dir,
                          stops,
                          polyline: [], // can be filled later once we have coords
                          source: 'STATIC',
                          lastUpdated: Date.now(),
                      };
                      count++;
                  };

                  maybeAdd(1, entry[1]);
                  maybeAdd(2, entry[2]);
              }
          } else {
              // 2) Fallback: tiny built-in STATIC_ROUTES_RAW (just in case)
              const data = parseStaticRoutes();
              for (const [serviceNo, directions] of Object.entries(data)) {
                  if (!Array.isArray(directions)) continue;
                  const [dir1, dir2] = directions as [string[] | undefined, string[] | undefined];

                  const maybeAdd = (dir: 1 | 2, stops?: string[]) => {
                      if (!stops || stops.length === 0) return;
                      const key = this.getRoutePatternKey(serviceNo, dir);
                      if (this.routePatterns[key]) return;

                      this.routePatterns[key] = {
                          serviceNo: this.normalizeServiceNo(serviceNo),
                          direction: dir,
                          stops,
                          polyline: [],
                          source: 'STATIC',
                          lastUpdated: Date.now(),
                      };
                      count++;
                  };

                  maybeAdd(1, dir1);
                  maybeAdd(2, dir2);
              }
          }

          this.saveRouteCache();
          mockService.emitLog(
              "ROUTE_DB",
              "INFO",
              `STATIC routes loaded: ${count} patterns; sample keys: ${Object.keys(this.routePatterns)
                  .slice(0, 5)
                  .join(', ')}`
          );
      } catch (e: any) {
          mockService.emitLog("ROUTE_DB", "ERROR", `Static load failed: ${e.message}`);
          this.staticRoutesLoaded = false; // allow retry later
      }
  }

  // --- Dynamic Route Fetchers ---

  private async fetchRouteFromLta(serviceNo: string) {
      const cleanNo = this.normalizeServiceNo(serviceNo);
      if (!cleanNo) throw new Error("Invalid Service No");

      if (this.allStopsCache.length === 0) {
          try { await this.fetchAllBusStops(); } catch(e) {}
      }

      const data = await fetchLTA('BusRoutes', { query: { ServiceNo: cleanNo } }, keyService.get('LTA'));
      // STRIOT FILTER: LTA API might ignore ServiceNo param if empty or malformed
      const items = (data.value || []).filter((i: any) => i.ServiceNo === cleanNo);
      
      if (items.length === 0) throw new Error("No Data from LTA");

      const dir1Items = items.filter((i: any) => i.Direction === 1).sort((a: any, b: any) => a.StopSequence - b.StopSequence);
      const dir2Items = items.filter((i: any) => i.Direction === 2).sort((a: any, b: any) => a.StopSequence - b.StopSequence);

      const buildPolyline = (stopIds: string[]) => {
          return stopIds.map(id => {
              const s = this.allStopsCache.find(x => x.id === id);
              return s && s.lat && s.lng ? { lat: s.lat, lng: s.lng } : null;
          }).filter(p => p !== null) as { lat: number, lng: number }[];
      };

      if (dir1Items.length > 0) {
          const stops = dir1Items.map((i: any) => i.BusStopCode);
          this.routePatterns[this.getRoutePatternKey(cleanNo, 1)] = {
              serviceNo: cleanNo, direction: 1, stops, 
              polyline: buildPolyline(stops),
              source: 'LTA', lastUpdated: Date.now()
          };
      }
      if (dir2Items.length > 0) {
          const stops = dir2Items.map((i: any) => i.BusStopCode);
          this.routePatterns[this.getRoutePatternKey(cleanNo, 2)] = {
              serviceNo: cleanNo, direction: 2, stops,
              polyline: buildPolyline(stops),
              source: 'LTA', lastUpdated: Date.now()
          };
      }
  }

  private async fetchRouteFromBusRouter(serviceNo: string) {
      const cleanNo = this.normalizeServiceNo(serviceNo);
      const target = `https://busrouter.sg/data/2/bus-services/${cleanNo}.json`;
      const proxy = `${PROXY_URL}${encodeURIComponent(target)}`;
      
      const res = await fetch(proxy);
      if (!res.ok) throw new Error("BusRouter Failed");
      const data = await res.json();

      if (data['1'] && data['1'].stops) {
           let polyline: { lat: number, lng: number }[] = [];
           if (Array.isArray(data['1'].route)) {
               polyline = data['1'].route.map((p: any) => ({ lat: p[1], lng: p[0] }));
           }
           this.routePatterns[this.getRoutePatternKey(cleanNo, 1)] = {
              serviceNo: cleanNo, direction: 1, stops: data['1'].stops, 
              polyline,
              source: 'BUSROUTER', lastUpdated: Date.now()
          };
      }
      if (data['2'] && data['2'].stops) {
           let polyline: { lat: number, lng: number }[] = [];
           if (Array.isArray(data['2'].route)) {
               polyline = data['2'].route.map((p: any) => ({ lat: p[1], lng: p[0] }));
           }
           this.routePatterns[this.getRoutePatternKey(cleanNo, 2)] = {
              serviceNo: cleanNo, direction: 2, stops: data['2'].stops, 
              polyline,
              source: 'BUSROUTER', lastUpdated: Date.now()
          };
      }
  }

  private async getOrFetchRoutePattern(serviceNo: string, currentStopId?: string, destStopId?: string): Promise<BusRoutePattern | null> {
      const cleanNo = this.normalizeServiceNo(serviceNo);
      if (!cleanNo) return null;
      
      // 1. Try to find in cache immediately
      const getCachedMatches = () => {
          const p1 = this.routePatterns[this.getRoutePatternKey(cleanNo, 1)];
          const p2 = this.routePatterns[this.getRoutePatternKey(cleanNo, 2)];
          return { p1, p2 };
      };

      // 2. Logic to pick the best direction based on trace
      const resolveDirection = (p1?: BusRoutePattern, p2?: BusRoutePattern) => {
          if (!p1 && !p2) return null;

          // SANITY CHECK: Routes with > 120 stops are likely anomalies/corrupted data.
          // Discard them immediately to force a fresh fetch.
          if (p1 && p1.stops.length > 120) {
              mockService.emitLog("ROUTE", "WARN", `Anomaly detected: Pattern 1 has ${p1.stops.length} stops. Discarding.`);
              delete this.routePatterns[this.getRoutePatternKey(cleanNo, 1)];
              p1 = undefined;
          }
          if (p2 && p2.stops.length > 120) {
              mockService.emitLog("ROUTE", "WARN", `Anomaly detected: Pattern 2 has ${p2.stops.length} stops. Discarding.`);
              delete this.routePatterns[this.getRoutePatternKey(cleanNo, 2)];
              p2 = undefined;
          }
          
          // Re-check after potential discard
          if (!p1 && !p2) return null;

          // If only one exists, return it (e.g. Loop service might only have Dir 1)
          if (p1 && !p2) return p1;
          if (!p1 && p2) return p2;

          // If both exist, we MUST use stops to disambiguate
          if (!currentStopId) return p1; // Default to 1 if we don't know where we are

          // Helper: Check if sequence is valid (current -> ... -> dest)
          const isValidSequence = (p: BusRoutePattern) => {
              const currentIdx = p.stops.indexOf(currentStopId);
              if (currentIdx === -1) return false; // Current stop not in this direction pattern

              if (destStopId) {
                  // Find destination index searching FROM current index forward
                  const destIdx = p.stops.indexOf(destStopId, currentIdx + 1);
                  if (destIdx !== -1) return true; // Found downstream
                  return false;
              }
              // If no dest provided, we can only rely on existence of current stop
              return true; 
          };

          const p1Valid = p1 && isValidSequence(p1!);
          const p2Valid = p2 && isValidSequence(p2!);

          if (p1Valid && !p2Valid) return p1;
          if (!p1Valid && p2Valid) return p2;
          
          // Both valid or both invalid? Default to p1.
          return p1;
      };

      // 3. Execution Flow
      
      // Step A: Check Cache
      let { p1, p2 } = getCachedMatches();
      let selected = resolveDirection(p1, p2);

      // Step B: If cache missing or static-only, try to upgrade/fetch live
      // We always want live geometry (polyline) if possible.
      const isStatic = (selected && selected.source === 'STATIC') || (!selected && (p1?.source === 'STATIC' || p2?.source === 'STATIC'));
      const missing = !p1 && !p2;

      if ((missing || isStatic) && !this.isRouteRefreshing) {
          mockService.emitLog("ROUTE", "INFO", `Fetching/Upgrading route for ${cleanNo}...`);
          this.setRouteRefreshing(true);
          try {
              // Try BusRouter first (Best geometry)
              await this.fetchRouteFromBusRouter(cleanNo);
          } catch (e) {
              // Fallback to LTA if BusRouter fails
              try {
                  await this.fetchRouteFromLta(cleanNo);
              } catch(e2) {}
          } finally {
              this.setRouteRefreshing(false);
              this.saveRouteCache();
          }
          
          // Re-evaluate after fetch
          const refreshed = getCachedMatches();
          p1 = refreshed.p1;
          p2 = refreshed.p2;
          selected = resolveDirection(p1, p2);
      }

      // Step C: If still nothing, try loading Static DB (Offline fallback)
      if (!p1 && !p2 && !this.staticRoutesLoaded) {
          await this.loadStaticRoutePatternsFromCheeaun();
          const staticMatches = getCachedMatches();
          p1 = staticMatches.p1;
          p2 = staticMatches.p2;
          selected = resolveDirection(p1, p2);
      }

      mockService.emitLog("ROUTE", "INFO", `Resolved Route: ${selected ? `Dir ${selected.direction} (${selected.stops.length} stops) [${selected.source}]` : 'None'}`);
      return selected || p1 || p2 || null;
  }

  public async getRoutePattern(serviceNo: string, currentStopId: string, destStopId?: string): Promise<{
      stops: BusStopLocation[];
      polyline: { lat: number; lng: number }[];
      lastUpdated: number;
      source?: string;
  } | null> {
      const pattern = await this.getOrFetchRoutePattern(serviceNo, currentStopId, destStopId);
      
      if (!pattern) {
          return null; // Degraded mode trigger
      }

      if (this.allStopsCache.length === 0) {
          try { await this.fetchAllBusStops(); } catch (e) {}
      }

      const stops = pattern.stops.map(id => {
          const cached = this.allStopsCache.find(s => s.id === id);
          return cached || { id, name: `Stop ${id}`, lat: 0, lng: 0 };
      });

      return {
          stops,
          polyline: pattern.polyline || [],
          lastUpdated: pattern.lastUpdated,
          source: pattern.source
      };
  }

  // --- Watched Bus Management (Unchanged) ---
  
  private loadWatchedBuses() {
      try {
          const stored = localStorage.getItem(STORAGE_KEY_WATCHED);
          if (stored) {
              this.watchedBusIds = new Set(JSON.parse(stored));
          }
      } catch (e) {
          console.warn("Failed to load watched buses");
      }
  }

  private saveWatchedBuses() {
      localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(Array.from(this.watchedBusIds)));
  }

  public isWatched(stopId: string, serviceNo: string): boolean {
      return this.watchedBusIds.has(`${stopId}_${serviceNo}`);
  }

  public toggleWatch(stopId: string, serviceNo: string) {
      const key = `${stopId}_${serviceNo}`;
      if (this.watchedBusIds.has(key)) {
          this.watchedBusIds.delete(key);
          delete this.watchedState[key];
      } else {
          this.watchedBusIds.add(key);
      }
      this.saveWatchedBuses();
  }

  private calculateTrend(prevMins: number, newMins: number, elapsedMins: number): 'FASTER' | 'SLOWER' | 'SAME' {
      const expected = prevMins - elapsedMins;
      const buffer = 1;

      if (newMins < expected - buffer) return 'FASTER';
      if (newMins > expected + buffer) return 'SLOWER';
      return 'SAME';
  }

  private processWatchedBuses(stopId: string, services: BusServiceData[]) {
      const now = Date.now();

      services.forEach(svc => {
          const key = `${stopId}_${svc.serviceNo}`;
          if (this.watchedBusIds.has(key)) {
              const prev = this.watchedState[key];
              
              if (prev) {
                  const elapsedMins = (now - prev.timestamp) / 60000;
                  
                  if (Math.abs(svc.next?.mins! - prev.nextMins) > 15) {
                      if (svc.next) svc.next.trend = 'NEW';
                      if (svc.subsequent) svc.subsequent.trend = 'NEW';
                      if (svc.subsequent2) svc.subsequent2.trend = 'NEW';
                  } else {
                      if (svc.next) svc.next.trend = this.calculateTrend(prev.nextMins, svc.next.mins, elapsedMins);
                      if (svc.subsequent) svc.subsequent.trend = this.calculateTrend(prev.subMins, svc.subsequent.mins, elapsedMins);
                      if (svc.subsequent2) svc.subsequent2.trend = this.calculateTrend(prev.sub2Mins, svc.subsequent2.mins, elapsedMins);
                  }
              } else {
                  if (svc.next) svc.next.trend = 'NEW';
                  if (svc.subsequent) svc.subsequent.trend = 'NEW';
                  if (svc.subsequent2) svc.subsequent2.trend = 'NEW';
              }

              this.watchedState[key] = {
                  timestamp: now,
                  nextMins: svc.next?.mins ?? 999,
                  subMins: svc.subsequent?.mins ?? 999,
                  sub2Mins: svc.subsequent2?.mins ?? 999
              };
          }
      });
  }
  
  public async pollWatchedBuses(): Promise<string[]> {
      if (this.watchedBusIds.size === 0) return [];

      const stopsToFetch = new Set<string>();
      this.watchedBusIds.forEach(key => {
          const [stopId] = key.split('_');
          stopsToFetch.add(stopId);
      });

      const alerts: string[] = [];

      for (const stopId of stopsToFetch) {
          try {
              const data = await this.getArrivals(stopId);
              
              data.services.forEach(svc => {
                  if (this.isWatched(stopId, svc.serviceNo)) {
                      if (svc.next && svc.next.mins <= 1 && svc.next.mins >= 0) {
                           alerts.push(`Bus ${svc.serviceNo} is arriving at stop ${stopId}!`);
                      } else if (svc.next && svc.next.mins === 5) {
                           alerts.push(`Bus ${svc.serviceNo} is 5 mins away.`);
                      }
                  }
              });
          } catch (e) {
              console.warn(`Background poll failed for ${stopId}`);
          }
      }

      return alerts;
  }
  
  public getInsight(stopId: string, serviceNo: string): string | undefined {
      return this.insightCache[`${stopId}_${serviceNo}`];
  }

  public setInsight(stopId: string, serviceNo: string, text: string) {
      this.insightCache[`${stopId}_${serviceNo}`] = text;
  }

  // --- Bus Stops Loading (Offline First) ---

  private saveCachedStopsAndMeta(stops: BusStopLocation[], meta: StopsMeta) {
      try {
          localStorage.setItem(STORAGE_KEY_STOPS_DB, JSON.stringify(stops));
          localStorage.setItem(STORAGE_KEY_STOPS_META, JSON.stringify(meta));
          this.allStopsCache = stops;
          this.stopsMeta = meta;
          this.notifyStopsUpdate();
      } catch (e) {
          console.warn("Failed to save bus DB to storage (quota?)");
      }
  }

  public clearBusStopsCache() {
      localStorage.removeItem(STORAGE_KEY_STOPS_DB);
      localStorage.removeItem(STORAGE_KEY_STOPS_META);
      localStorage.removeItem(STORAGE_KEY_STOPS_LAST_CHECK);
      this.allStopsCache = [];
      this.stopsMeta = null;
      this.notifyStopsUpdate();
      mockService.emitLog("TRANSPORT", "INFO", "Bus DB Cache Cleared.");
  }

  public getAllRoutePatterns(): BusRoutePattern[] {
      return Object.values(this.routePatterns);
  }

  public clearRouteCache() {
      localStorage.removeItem(STORAGE_KEY_ROUTES_DB);
      localStorage.removeItem(STORAGE_KEY_ROUTES_META);
      this.routePatterns = {};
      this.staticRoutesLoaded = false;
      this.setRouteRefreshing(false);
      mockService.emitLog("TRANSPORT", "INFO", "Route DB Cache Cleared.");
  }

  public async rebuildRouteDb() {
      this.clearRouteCache();
      this.setRouteRefreshing(true);
      await this.loadStaticRoutePatternsFromCheeaun();
      this.setRouteRefreshing(false);
  }

  private loadCachedStopsAndMeta(): boolean {
        try {
            const dbStr = localStorage.getItem(STORAGE_KEY_STOPS_DB);
            const metaStr = localStorage.getItem(STORAGE_KEY_STOPS_META);
            if (dbStr && metaStr) {
                this.allStopsCache = JSON.parse(dbStr);
                this.stopsMeta = JSON.parse(metaStr);
                return true;
            }
        } catch (e) {
            mockService.emitLog("TRANSPORT", "WARN", "Corrupted bus DB cache; ignoring.");
        }
        return false;
    }

  async fetchAllBusStops(): Promise<BusStopLocation[]> {
      // 1. Return in-memory cache if available
      if (this.allStopsCache.length > 0) return this.allStopsCache;

      // 2. Load from LocalStorage if available
      if (this.loadCachedStopsAndMeta()) {
          // Still let it check in the background for newer data
          this.checkForStopsUpdateInBackground();
          return this.allStopsCache;
      }

      // 3. Offline seed from Cheeaun snapshot
      const offlineIds = Object.keys(OFFLINE_STOPS_DB);
      if (offlineIds.length > 0) {
          const stops: BusStopLocation[] = offlineIds.map(id => OFFLINE_STOPS_DB[id]);

          const meta: StopsMeta = {
              version: 'cheeaun-offline-v1',
              source: 'cheeaun-sgbusdata-offline',
              stopCount: stops.length,
              generatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString(),
          };

          this.saveCachedStopsAndMeta(stops, meta);
          // Try to upgrade silently if network exists; if not, it will just log a harmless warning.
          this.checkForStopsUpdateInBackground();
          mockService.emitLog("TRANSPORT", "INFO", "Bus stop DB initialised from Cheeaun offline snapshot.");
          return stops;
      }

      // 4. Fallback: Network fetch (blocking init – old behaviour)
      try {
          const stops = await this.fetchStopsFromBusRouter();
          const meta: StopsMeta = {
              version: `busrouter-${Date.now()}`,
              source: 'busrouter-sg',
              stopCount: stops.length,
              generatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
          };
          this.saveCachedStopsAndMeta(stops, meta);
          mockService.emitLog("TRANSPORT", "INFO", "Bus stop DB initialised from BusRouter.");
          return stops;
      } catch (e) {
          mockService.emitLog("TRANSPORT", "WARN", "BusRouter fetch failed, trying LTA fallback...");
      }

      try {
          const stops = await this.fetchStopsFromLTA();
          const meta: StopsMeta = {
              version: `lta-${Date.now()}`,
              source: 'lta-datamall',
              stopCount: stops.length,
              generatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
          };
          this.saveCachedStopsAndMeta(stops, meta);
          return stops;
      } catch (e) {
          mockService.emitLog("TRANSPORT", "ERROR", "Failed to init bus stops DB.");
          return [];
      }
  }

  private async fetchStopsFromBusRouter(): Promise<BusStopLocation[]> {
      const target = 'https://busrouter.sg/data/2/bus-stops.json';
      const proxy = `${PROXY_URL}${encodeURIComponent(target)}`;
      const res = await fetch(proxy);
      if (!res.ok) throw new Error("BusRouter Failed");
      const data = await res.json();
      
      return data.map((s: any) => ({
          id: s[0], // Code
          name: s[2], // Name
          lat: s[4], // Lat
          lng: s[3]  // Lng
      }));
  }

  private async fetchStopsFromLTA(): Promise<BusStopLocation[]> {
      let stops: BusStopLocation[] = [];
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
          const data = await fetchLTA('BusStops', { query: { $skip: skip } }, keyService.get('LTA'));
          const items = data.value || [];
          
          stops = stops.concat(items.map((i: any) => ({
              id: i.BusStopCode,
              name: i.Description,
              lat: i.Latitude,
              lng: i.Longitude
          })));

          if (items.length < 500) hasMore = false;
          skip += 500;
      }
      return stops;
  }

  public async syncStops(): Promise<string> {
      try {
          // Try BusRouter first
          const stops = await this.fetchStopsFromBusRouter();
          const meta: StopsMeta = {
              version: `busrouter-${Date.now()}`,
              source: 'busrouter-sg',
              stopCount: stops.length,
              generatedAt: new Date().toISOString(),
              lastSyncedAt: new Date().toISOString()
          };
          this.saveCachedStopsAndMeta(stops, meta);
          return `Synced ${stops.length} stops from BusRouter.`;
      } catch (e) {
          // Fallback LTA
          try {
              const stops = await this.fetchStopsFromLTA();
              const meta: StopsMeta = {
                  version: `lta-${Date.now()}`,
                  source: 'lta-datamall',
                  stopCount: stops.length,
                  generatedAt: new Date().toISOString(),
                  lastSyncedAt: new Date().toISOString()
              };
              this.saveCachedStopsAndMeta(stops, meta);
              return `Synced ${stops.length} stops from LTA.`;
          } catch(e2) {
              throw new Error("Sync failed. Check network/keys.");
          }
      }
  }

  public async syncRoutes(): Promise<string> {
      this.clearRouteCache(); // Start fresh
      this.setRouteRefreshing(true);
      try {
          await this.loadStaticRoutePatternsFromCheeaun();
          return `Synced ${Object.keys(this.routePatterns).length} route patterns.`;
      } catch (e: any) {
          throw new Error(`Route sync failed: ${e.message}`);
      } finally {
          this.setRouteRefreshing(false);
      }
  }

  private async checkForStopsUpdateInBackground() {
      const lastCheckStr = localStorage.getItem(STORAGE_KEY_STOPS_LAST_CHECK);
      const now = Date.now();
      
      // Throttle check (e.g., once every 24 hours)
      if (lastCheckStr && (now - parseInt(lastCheckStr)) < STOPS_CHECK_INTERVAL_MS) {
          return;
      }

      this.notifyDbUpdateStatus(true);
      mockService.emitLog("TRANSPORT", "INFO", "Checking for bus DB updates...");

      try {
          const stops = await this.fetchStopsFromBusRouter();
          
          if (stops.length !== this.allStopsCache.length) {
               const meta: StopsMeta = {
                  version: `busrouter-${Date.now()}`,
                  source: 'busrouter-sg',
                  stopCount: stops.length,
                  generatedAt: new Date().toISOString(),
                  lastSyncedAt: new Date().toISOString()
              };
              this.saveCachedStopsAndMeta(stops, meta);
              mockService.emitLog("TRANSPORT", "INFO", "Bus DB Updated in background.");
          }
          localStorage.setItem(STORAGE_KEY_STOPS_LAST_CHECK, now.toString());
      } catch (e) {
          mockService.emitLog("TRANSPORT", "WARN", "Background DB update failed (harmless).");
      } finally {
          this.notifyDbUpdateStatus(false);
      }
  }

  // --- Utils ---

  public async estimateTravelTime(serviceNo: string, originStopId: string, destStopId: string, stopCount: number): Promise<number> {
      try {
          const data = await this.getArrivals(destStopId);
          const svc = data.services.find(s => s.serviceNo === serviceNo);
          if (svc && svc.next && svc.next.mins >= 0) {
              return svc.next.mins;
          }
      } catch (e) {}

      // Try AI Estimate via Google Maps
      const origin = await this.getBusStopInfo(originStopId);
      const dest = await this.getBusStopInfo(destStopId);
      
      if (origin && dest) {
           const aiDuration = await aiService.getTransitDuration(origin.name, dest.name);
           if (aiDuration) {
               mockService.emitLog("ROUTE", "INFO", `AI estimated ${aiDuration} mins from ${origin.name} to ${dest.name}`);
               return aiDuration;
           }
      }

      // Fallback
      const estimate = stopCount * 3; // Bump fallback to 3 mins per stop as 2 is optimistic
      mockService.emitLog("ROUTE", "WARN", `No live arrival at dest. using fallback ETA: ${estimate}m`);
      return estimate;
  }

  public calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  }

  public updateStopsWithDistance(stops: BusStopLocation[], lat: number, lng: number): BusStopLocation[] {
      return stops.map(s => {
          if (!s.lat || !s.lng) return { ...s, distance: undefined };
          const dist = this.calculateDistance(lat, lng, s.lat, s.lng);
          return { ...s, distance: dist };
      });
  }

  // --- Levenshtein Algorithm for Fuzzy Search ---
  private levenshtein(a: string, b: string): number {
      const matrix = [];
      let i, j;

      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;

      // Init matrix
      for (i = 0; i <= b.length; i++) matrix[i] = [i];
      for (j = 0; j <= a.length; j++) matrix[0][j] = j;

      for (i = 1; i <= b.length; i++) {
          for (j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                  matrix[i][j] = Math.min(
                      matrix[i - 1][j - 1] + 1, // substitution
                      Math.min(
                          matrix[i][j - 1] + 1, // insertion
                          matrix[i - 1][j] + 1  // deletion
                      )
                  );
              }
          }
      }
      return matrix[b.length][a.length];
  }

  // --- Legacy / Helper ---

  getDefaultStop() { return this.defaultStop; }
  setDefaultStop(id: string) { this.defaultStop = id; }

  searchStopsByName(query: string, userLat?: number, userLng?: number): SearchResult {
      const q = query.toLowerCase();
      // First try strict filtering
      let matches = this.allStopsCache.filter(s => 
          s.name.toLowerCase().includes(q) || s.id.includes(q)
      );

      // If matches found or query too short for fuzzy logic, return as is
      if (matches.length > 0 || query.length < 3) {
          // Calculate distance if location provided
          if (userLat !== undefined && userLng !== undefined) {
              matches = this.updateStopsWithDistance(matches, userLat, userLng);
              // Sort by distance if available, else by name match position
              matches.sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
          }
          return { results: matches.slice(0, 10), suggestion: null };
      }

      // If no matches, attempt fuzzy search
      // Find the closest name match in the entire DB
      let bestMatch: BusStopLocation | null = null;
      let minDistance = Infinity;
      
      // Threshold: Allow roughly 40% errors relative to query length
      // e.g. for "Orchrd" (6 chars), allow ~2 edits
      const threshold = Math.max(2, Math.floor(query.length * 0.4));

      for (const stop of this.allStopsCache) {
          const dist = this.levenshtein(q, stop.name.toLowerCase());
          if (dist < minDistance) {
              minDistance = dist;
              bestMatch = stop;
          }
      }

      if (bestMatch && minDistance <= threshold) {
          // We have a decent suggestion
          // Return an empty result set but provide the suggestion string
          return { results: [], suggestion: bestMatch.name };
      }

      return { results: [], suggestion: null };
  }

  getBusInterval(bus: BusServiceData): string | null {
      let est = null;

      // Check gap between 2nd and 3rd bus (often cleaner)
      if (bus.subsequent && bus.subsequent2) {
          const diff = bus.subsequent2.mins - bus.subsequent.mins;
          if (diff >= 0) est = diff;
      }

      // Check gap between 1st and 2nd bus
      if (bus.next && bus.subsequent) {
          const diff = bus.subsequent.mins - bus.next.mins;
          if (diff >= 0) {
              // If we have no estimate yet, or this one suggests a larger (more likely normal) gap than the previous check (which might be bunching)
              // OR if the previous estimate was essentially 0 (bunching), prioritize this if it's bigger
              if (est === null || (est < 2 && diff > est)) {
                  est = diff;
              }
          }
      }

      if (est !== null) {
          return `${est}m`;
      }
      return null;
  }

  public async getAddress(lat: number, lng: number): Promise<string> {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (GEO_CACHE.has(key)) return GEO_CACHE.get(key)!;

      try {
          // Use Nominatim via Proxy for simple reverse geocoding
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
          const proxyUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
          
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error("Geocode failed");
          const data = await res.json();
          
          const addr = data.address;
          let result = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
          
          if (addr) {
              const road = addr.road || addr.pedestrian || addr.street || addr.path;
              const area = addr.suburb || addr.neighbourhood || addr.district || addr.city;
              
              if (road && area) result = `${road}, ${area}`;
              else if (road) result = road;
              else if (area) result = area;
          }
          
          GEO_CACHE.set(key, result);
          // Keep cache small
          if (GEO_CACHE.size > 50) {
              const first = GEO_CACHE.keys().next().value;
              if (first) GEO_CACHE.delete(first);
          }
          
          return result;
      } catch (e) {
          return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      }
  }

  public async validateLtaKey(): Promise<boolean> {
      try {
          await this.getArrivals('09048');
          return true;
      } catch { return false; }
  }

  public async hasRoutePattern(serviceNo: string): Promise<boolean> {
      const cached = await this.getOrFetchRoutePattern(serviceNo);
      return !!cached;
  }

  // --- Arrivals Fetching ---

  async getArrivals(stopId: string): Promise<BusStopData> {
      let services: BusServiceData[] = [];
      let fetchSuccess = false;

      // 1. Try LTA if Key exists
      try {
          const data = await fetchLTA('BusArrivalv2', { query: { BusStopCode: stopId } }, keyService.get('LTA'));
          if (data.Services) {
              services = data.Services.map((s: any) => ({
                  serviceNo: s.ServiceNo,
                  operator: s.Operator,
                  next: this.mapLtaArrival(s.NextBus),
                  subsequent: this.mapLtaArrival(s.NextBus2),
                  subsequent2: this.mapLtaArrival(s.NextBus3)
              }));
              fetchSuccess = true;
          }
      } catch (e) {
          console.warn("LTA Fetch failed, trying fallback...", e);
      }

      // 2. Fallback to Arrivelah if LTA failed or no key
      if (!fetchSuccess) {
          try {
              const res = await fetch(`${BASE_URL}/?id=${stopId}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data.services) {
                      services = data.services.map((s: any) => ({
                          serviceNo: s.no,
                          operator: s.operator,
                          next: this.mapArrivelahArrival(s.next),
                          subsequent: this.mapArrivelahArrival(s.subsequent),
                          subsequent2: this.mapArrivelahArrival(s.next2 || s.subsequent2)
                      }));
                  }
              }
          } catch (e) {
              console.warn(`All arrival fetches failed for ${stopId}`, e);
          }
      }

      this.processWatchedBuses(stopId, services);
      return { id: stopId, services };
  }

  private mapLtaArrival(bus: any): ArrivalInfo | null {
      if (!bus || !bus.EstimatedArrival) return null;
      const arrivalTime = new Date(bus.EstimatedArrival).getTime();
      const now = Date.now();
      const mins = Math.floor((arrivalTime - now) / 60000);
      return {
          mins: mins < 0 ? 0 : mins,
          load: bus.Load,
          type: bus.Type,
          feature: bus.Feature,
          lat: parseFloat(bus.Latitude),
          lng: parseFloat(bus.Longitude),
          destinationCode: bus.DestinationCode
      };
  }

  private mapArrivelahArrival(bus: any): ArrivalInfo | null {
      if (!bus || !bus.time) return null;
      const arrivalTime = new Date(bus.time).getTime();
      const now = Date.now();
      const mins = Math.floor((arrivalTime - now) / 60000);
      return {
          mins: mins < 0 ? 0 : mins,
          load: (bus.load || 'SEA').toUpperCase(), // Normalize to LTA codes
          type: (bus.type || 'SD').toUpperCase(), // Normalize
          feature: (bus.feature || '').toUpperCase(),
          lat: bus.lat ? parseFloat(bus.lat) : undefined,
          lng: bus.lng ? parseFloat(bus.lng) : undefined,
          destinationCode: bus.destination?.code
      };
  }

  async findNearestStops(lat: number, lng: number): Promise<BusStopLocation[]> {
      const allStops = await this.fetchAllBusStops();
      const stopsWithDist = this.updateStopsWithDistance(allStops, lat, lng);
      return stopsWithDist.sort((a, b) => (a.distance || 999999) - (b.distance || 999999)).slice(0, 10);
  }

  async getBusStopInfo(stopId: string): Promise<BusStopLocation | undefined> {
      const allStops = await this.fetchAllBusStops();
      return allStops.find(s => s.id === stopId);
  }
}

export const busService = new BusService();
