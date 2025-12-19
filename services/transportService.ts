
import { busService, BusServiceData, BusStopLocation, ArrivalInfo, BusSchedule, DestinationWatch, ParsedFirstLastSchedule, BusRoutePattern } from './busService';
import { mrtService, MRTLine, MRTStation, TrainServiceAlert, StationCrowdData, StationAccessibility } from './mrtService';
import { keyService } from './keyService';

export type { BusServiceData, BusStopLocation, ArrivalInfo, BusSchedule, DestinationWatch, ParsedFirstLastSchedule, BusRoutePattern };
export type { MRTLine, MRTStation, TrainServiceAlert, StationCrowdData, StationAccessibility };

// Simple in-memory cache for resolved routes
const routeCache = new Map<string, { pattern: BusRoutePattern, stops: BusStopLocation[] } | null>();

// Internal helper to clear cache
const clearInternalRouteCache = () => {
    routeCache.clear();
    console.debug("[Transport] Internal route cache cleared.");
};

// --- Google Polyline Decoder ---
const decodePolyline = (encoded: string): { lat: number; lng: number }[] => {
    const poly: { lat: number; lng: number }[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        const p = { lat: lat / 1e5, lng: lng / 1e5 };
        poly.push(p);
    }
    return poly;
};

// --- Traffic Types ---
export interface TrafficSegment {
    path: { lat: number; lng: number }[];
    speed: 'NORMAL' | 'SLOW' | 'JAM';
    color: string;
}

const resolveRoute = async (serviceNo: string, originStopId: string, destStopId?: string): Promise<{ pattern: BusRoutePattern, stops: BusStopLocation[] } | null> => {
    // Generate cache key
    const cacheKey = `${serviceNo}_${originStopId}_${destStopId || ''}`;
    
    console.debug(`[Transport] resolveRoute: ${serviceNo} from ${originStopId} ${destStopId ? 'to ' + destStopId : '(no dest)'}`);

    // Return cached result if available
    if (routeCache.has(cacheKey)) {
        const cached = routeCache.get(cacheKey);
        if (cached) {
             console.debug(`[Transport] Returning cached route for ${cacheKey}`);
             return cached;
        }
        // If we somehow have null in cache (legacy), ignore it and recompute
        routeCache.delete(cacheKey);
    }

    const allPatterns = busService.getAllRoutePatterns();
    const servicePatterns = allPatterns.filter(p => p.serviceNo.toUpperCase() === serviceNo.toUpperCase());

    console.debug(`[Transport] Found ${servicePatterns.length} patterns for ${serviceNo}`);

    if (servicePatterns.length === 0) {
        console.debug(`[Transport] No patterns found for service ${serviceNo}`);
        // Do NOT cache failure permanently
        return null;
    }

    const allStops = await busService.fetchAllBusStops();
    const stopMap = new Map(allStops.map(s => [s.id, s]));

    let bestMatch: { pattern: BusRoutePattern, stops: BusStopLocation[] } | null = null;

    for (const pattern of servicePatterns) {
        const originIdx = pattern.stops.indexOf(originStopId);
        if (originIdx === -1) continue;

        let destIdx = -1;
        if (destStopId) {
            destIdx = pattern.stops.indexOf(destStopId);
            if (destIdx !== -1 && destIdx <= originIdx) {
                // Destination exists but is before origin; wrong direction
                continue;
            }
        }

        // Map stops to BusStopLocation
        const stops: BusStopLocation[] = [];
        for (const id of pattern.stops) {
            const s = stopMap.get(id);
            if (s) {
                stops.push(s);
            } else {
                console.warn(`[Transport] Missing stop definition in DB: ${id} for service ${serviceNo}`);
                stops.push({ id, name: `Stop ${id}`, lat: 0, lng: 0 }); // Fallback for missing stop data
            }
        }

        const candidate = { pattern, stops };

        // If we have a destination and it is valid (after origin), this is a strong match
        if (destStopId && destIdx > originIdx) {
            console.debug(`[Transport] Strong match found: Dir ${pattern.direction} (${pattern.stops.length} stops)`);
            routeCache.set(cacheKey, candidate);
            return candidate;
        }

        // Otherwise, store as fallback (contains origin)
        if (!bestMatch) {
            bestMatch = candidate;
        }
    }

    if (bestMatch) {
        console.debug(`[Transport] Fallback match chosen: Dir ${bestMatch.pattern.direction} (${bestMatch.pattern.stops.length} stops)`);
        routeCache.set(cacheKey, bestMatch);
        return bestMatch;
    }

    console.debug(`[Transport] No valid pattern found containing origin ${originStopId}`);
    return null;
};

// New: Traffic Aware Route Fetcher
const getTrafficAwareRoute = async (origin: {lat: number, lng: number}, dest: {lat: number, lng: number}, waypoints: {lat: number, lng: number}[]): Promise<TrafficSegment[] | null> => {
    const apiKey = keyService.get('GOOGLE_MAPS'); 
    
    // We try to use Google Routes API. 
    try {
        const body = {
            origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
            destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
            intermediates: waypoints.map(wp => ({ location: { latLng: { latitude: wp.lat, longitude: wp.lng } } })),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            computeAlternativeRoutes: false,
            extraComputations: ["TRAFFIC_ON_POLYLINE"],
            routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: true }
        };

        const response = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`Routes API Failed (${response.status}): ${response.statusText}`);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
            const encoded = data.routes[0].polyline.encodedPolyline;
            const fullPath = decodePolyline(encoded);
            const intervals = data.routes[0].travelAdvisory?.speedReadingIntervals || [];
            
            const segments: TrafficSegment[] = [];
            
            // If no intervals returned, return whole path as normal
            if (!intervals || intervals.length === 0) {
                return [{ path: fullPath, speed: 'NORMAL', color: '#10b981' }]; // Green
            }

            // Map intervals to path segments
            intervals.forEach((interval: any) => {
                const start = interval.startPolylinePointIndex || 0;
                const end = interval.endPolylinePointIndex || 0;
                const speedType = interval.speed || 'NORMAL';
                
                let color = '#10b981'; // Green (Normal)
                let speed: 'NORMAL' | 'SLOW' | 'JAM' = 'NORMAL';
                
                if (speedType === 'SLOW') { color = '#f59e0b'; speed = 'SLOW'; } // Orange
                if (speedType === 'TRAFFIC_JAM') { color = '#ef4444'; speed = 'JAM'; } // Red

                // Slice path. Note: polyline indexes are 0-based vertices
                const segmentPath = fullPath.slice(start, end + 1);
                if (segmentPath.length > 0) {
                    segments.push({ path: segmentPath, speed, color });
                }
            });

            return segments;
        }
    } catch (e: any) {
        console.warn("Traffic API failed", e);
        // Explicitly log this to the console service so the user sees why traffic is missing
        if ((window as any).mockService) {
             (window as any).mockService.emitLog('TRANSPORT', 'ERROR', `Routes API Failed: ${e.message}`);
        }
        return null; // Strict failure, no simulation
    }
    return null;
};


// Wrapped wrappers for cache invalidation
const wrappedClearRouteCache = () => {
    clearInternalRouteCache();
    busService.clearRouteCache();
};

const wrappedRebuildRouteDb = async () => {
    clearInternalRouteCache();
    await busService.rebuildRouteDb();
};

const wrappedSyncRoutes = async () => {
    clearInternalRouteCache();
    return await busService.syncRoutes();
};

export const transportService = {
  getArrivals: busService.getArrivals.bind(busService),
  findNearestStops: busService.findNearestStops.bind(busService),
  getDefaultStop: busService.getDefaultStop.bind(busService),
  setDefaultStop: busService.setDefaultStop.bind(busService),
  searchStopsByName: busService.searchStopsByName.bind(busService),
  getBusStopInfo: busService.getBusStopInfo.bind(busService),
  isFavorite: busService.isFavorite.bind(busService),
  addFavorite: busService.addFavorite.bind(busService),
  removeFavorite: busService.removeFavorite.bind(busService),
  getFavorites: busService.getFavorites.bind(busService),
  getFavorite: busService.getFavorite.bind(busService),
  renameFavorite: busService.renameFavorite.bind(busService),
  calculateDistance: busService.calculateDistance.bind(busService),
  updateStopsWithDistance: busService.updateStopsWithDistance.bind(busService),
  getAddress: busService.getAddress.bind(busService),
  seedFavorites: busService.seedFavorites.bind(busService),
  getBusInterval: busService.getBusInterval.bind(busService),
  toggleWatch: busService.toggleWatch.bind(busService),
  isWatched: busService.isWatched.bind(busService),
  pollWatchedBuses: busService.pollWatchedBuses.bind(busService),
  validateLtaKey: busService.validateLtaKey.bind(busService),
  getStopSchedule: busService.getStopSchedule.bind(busService),
  // New method for retrieving all schedules for a stop
  getStopSchedules: busService.getStopSchedules.bind(busService),
  hasRoutePattern: busService.hasRoutePattern.bind(busService),
  
  // Destination Watching (Alerts)
  setDestinationWatch: busService.setDestinationWatch.bind(busService),
  clearDestinationWatch: busService.clearDestinationWatch.bind(busService),
  getDestinationWatch: busService.getDestinationWatch.bind(busService),
  pollDestinationArrival: busService.pollDestinationArrival.bind(busService),
  subscribeToDestinations: busService.subscribeToDestinations.bind(busService),
  getDestinationSequence: busService.getDestinationSequence.bind(busService),
  
  // Route Planning (Persistent Visual Waypoints)
  getRouteWaypoints: busService.getRouteWaypoints.bind(busService),
  toggleRouteWaypoint: busService.toggleRouteWaypoint.bind(busService),
  getAllRouteWaypoints: busService.getAllRouteWaypoints.bind(busService),
  clearRouteWaypoints: busService.clearRouteWaypoints.bind(busService),

  // Route Pattern Updates
  subscribeToRouteRefresh: busService.subscribeToRouteRefresh.bind(busService),
  maybeRefreshRouteDataInBackground: busService.maybeRefreshRouteDataInBackground.bind(busService),
  getAllRoutePatterns: busService.getAllRoutePatterns.bind(busService),
  getRoutesMeta: busService.getRoutesMeta.bind(busService),
  
  // Intercepted methods for cache clearing
  clearRouteCache: wrappedClearRouteCache,
  rebuildRouteDb: wrappedRebuildRouteDb,
  syncRoutes: wrappedSyncRoutes,

  // DB Updates
  getAllBusStops: busService.fetchAllBusStops.bind(busService),
  clearBusStopsCache: busService.clearBusStopsCache.bind(busService),
  getStopsMeta: busService.getStopsMeta.bind(busService),
  getStopsLastUpdatedLabel: busService.getStopsLastUpdatedLabel.bind(busService),
  subscribeToStopsUpdate: busService.subscribeToStopsUpdate.bind(busService),
  subscribeToDbUpdateStatus: busService.subscribeToDbUpdateStatus.bind(busService),
  syncStops: busService.syncStops.bind(busService),

  getMRTNetwork: mrtService.getMRTNetwork.bind(mrtService),
  getTrainServiceAlerts: mrtService.getTrainServiceAlerts.bind(mrtService),
  getStationCrowd: mrtService.getStationCrowd.bind(mrtService),
  getLiftStatus: mrtService.getLiftStatus.bind(mrtService),

  resolveRoute, // Export the updated helper
  getTrafficAwareRoute // New Export
};
