
import React, { useEffect, useRef, useState } from 'react';
import { ICONS } from '../constants';
import { Loader2, MapPin, Navigation } from 'lucide-react';

interface InAppMapProps {
  userLocation: { lat: number; lng: number } | null;
  targetLocation: { lat: number; lng: number; name: string; id: string };
  onBack: () => void;
}

const InAppMap: React.FC<InAppMapProps> = ({ userLocation, targetLocation, onBack }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load Leaflet
    const loadLeaflet = async () => {
      if ((window as any).L) {
        initMap();
        return;
      }

      try {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => initMap();
        script.onerror = () => setLoadError("Failed to load map engine.");
        document.body.appendChild(script);
      } catch (e) {
        setLoadError("Map initialization failed.");
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    // Prevent double init
    if (mapInstanceRef.current) return;

    setIsLoading(false);

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
    });
    mapInstanceRef.current = map;

    // Dark Mode Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Custom Icons
    const createIcon = (color: string, pulse: boolean = false) => {
        return L.divIcon({
            className: 'custom-map-icon',
            html: `<div style="
                background-color: ${color};
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 0 10px ${color};
                position: relative;
                ${pulse ? 'animation: pulse-ring 2s infinite;' : ''}
            "></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    };

    const markers = [];

    // Target Marker (Bus Stop)
    const targetMarker = L.marker([targetLocation.lat, targetLocation.lng], {
        icon: createIcon('#A691F2') // Moncchichi Accent
    }).addTo(map);
    
    targetMarker.bindPopup(`
        <div style="font-family: monospace; color: #333;">
            <strong>${targetLocation.name}</strong><br/>
            <span style="font-size: 10px; opacity: 0.7;">${targetLocation.id}</span>
        </div>
    `);
    markers.push(targetMarker);

    // User Marker
    if (userLocation && !((userLocation as any).isDefault)) {
        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
            icon: createIcon('#3b82f6', true) // Blue with pulse
        }).addTo(map);
        markers.push(userMarker);
    } else if (userLocation) {
        // If location is default/unavailable, show toast behavior happens in parent, 
        // but we can just center on target here.
    }

    // Fit Bounds
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
        // Open popup after animation
        setTimeout(() => targetMarker.openPopup(), 500);
    } else {
        map.setView([targetLocation.lat, targetLocation.lng], 16);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] bg-moncchichi-bg flex flex-col animate-in fade-in duration-300">
      <style>{`
        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-[500] flex justify-between items-start pointer-events-none">
        <button 
            onClick={onBack}
            className="pointer-events-auto bg-moncchichi-surface border border-moncchichi-border text-moncchichi-text px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-transform"
        >
            {ICONS.Back} Back
        </button>
        
        <div className="pointer-events-auto bg-moncchichi-surface/90 backdrop-blur border border-moncchichi-border p-3 rounded-xl shadow-lg max-w-[200px]">
            <div className="text-xs font-bold text-moncchichi-accent flex items-center gap-1.5 mb-1">
                <MapPin size={12} fill="currentColor" /> {targetLocation.id}
            </div>
            <div className="text-xs font-medium text-moncchichi-text leading-tight">
                {targetLocation.name}
            </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-moncchichi-bg">
        {isLoading && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-moncchichi-bg text-moncchichi-accent">
                <Loader2 size={32} className="animate-spin" />
            </div>
        )}
        {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 text-center">
                <Navigation size={48} className="text-moncchichi-textSec mb-4 opacity-50" />
                <h3 className="text-moncchichi-error font-bold mb-2">Map Unavailable</h3>
                <p className="text-moncchichi-textSec text-sm">{loadError}</p>
                <button onClick={onBack} className="mt-6 px-6 py-2 bg-moncchichi-surface border border-moncchichi-border rounded-lg">Return</button>
            </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full" style={{ background: '#1a1a1a' }} />
      </div>
      
      {/* Footer Info */}
      {userLocation && (userLocation as any).isDefault && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] bg-black/60 backdrop-blur px-4 py-2 rounded-full border border-white/10 text-[10px] text-white/80 whitespace-nowrap">
              User location unavailable
          </div>
      )}
    </div>
  );
};

export default InAppMap;
