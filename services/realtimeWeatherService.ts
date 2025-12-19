
import { mockService } from './mockService';
import { aiService } from './aiService';
import { locationService } from './locationService';

export interface NewsSource {
    title: string;
    uri: string;
}

export interface UnifiedWeatherReport {
    location: string;
    temperature: number | null;
    humidity: number | null;
    rain: number | null;
    windSpeed: number | null;
    windDirection?: number;
    uv: number | null;
    psi: number | null;
    wbgt: number | null; // Wet Bulb Globe Temperature (Heat Stress)
    pm25?: number;
    
    forecast2hr: string;
    lightningCount?: number; // Simulated or derived
    activeFloods?: number;
    alerts?: { type: string, message: string }[];
    
    // AI / Analysis
    dailyInsight: string;
    holisticSummary: string;
    newsSummary: string;
    monthlyOutlook: string;
    newsSources: NewsSource[];
    forecast4day?: {
        date: string;
        forecast: string;
        temperature: { low: number, high: number };
        wind: { speed: { low: number, high: number }, direction: string };
        category?: string;
    }[];
}

class RealtimeWeatherService {
    
    private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; // Distance in km
        return d;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI/180);
    }

    private getNearestValue(data: any, lat: number, lng: number): number | undefined {
        if (!data || !data.metadata || !data.items || data.items.length === 0) return undefined;
        
        const stations = data.metadata.stations;
        const readings = data.items[0].readings;
        
        let minDistance = Infinity;
        let nearestValue: number | undefined = undefined;

        for (const station of stations) {
            const dist = this.getDistance(lat, lng, station.location.latitude, station.location.longitude);
            if (dist < minDistance) {
                // Find reading for this station
                const reading = readings.find((r: any) => r.station_id === station.id);
                if (reading && reading.value !== undefined) {
                    minDistance = dist;
                    nearestValue = reading.value;
                }
            }
        }
        return nearestValue;
    }

    private getRegionalValue(data: any, lat: number, lng: number, key: string = 'psi_twenty_four_hourly'): number | undefined {
        if (!data || !data.items || data.items.length === 0) return undefined;
        
        const readings = data.items[0].readings;
        if (!readings || !readings[key]) return undefined;

        // Simple region mapping based on lat/lng relative to center
        // Center of SG approx 1.3521, 103.8198
        const regions = {
            north: { lat: 1.41803, lng: 103.82 },
            south: { lat: 1.29587, lng: 103.82 },
            east: { lat: 1.35735, lng: 103.94 },
            west: { lat: 1.35735, lng: 103.7 },
            central: { lat: 1.35735, lng: 103.82 }
        };

        let minDistance = Infinity;
        let closestRegion = 'central';

        Object.entries(regions).forEach(([region, coords]) => {
            const dist = this.getDistance(lat, lng, coords.lat, coords.lng);
            if (dist < minDistance) {
                minDistance = dist;
                closestRegion = region;
            }
        });

        // @ts-ignore
        return readings[key][closestRegion];
    }

    private async fetchNEA(endpoint: string, dateStr?: string) {
        try {
            const url = `https://api.data.gov.sg/v1/environment/${endpoint}${dateStr ? '?date=' + dateStr : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`NEA ${endpoint} failed`);
            return await res.json();
        } catch (e) {
            // console.warn(e); // Suppress noise
            return null;
        }
    }

    public async getUnifiedWeather(lat?: number, lng?: number): Promise<UnifiedWeatherReport> {
        // Default to SG Center if no location
        const latitude = lat || 1.3521;
        const longitude = lng || 103.8198;

        // Fetch all data in parallel
        const [tempData, humidData, rainData, windSpeedData, windDirData, uvData, psiData, forecast2hrData, forecast4dayData] = await Promise.all([
            this.fetchNEA('air-temperature'),
            this.fetchNEA('relative-humidity'),
            this.fetchNEA('rainfall'),
            this.fetchNEA('wind-speed'),
            this.fetchNEA('wind-direction'),
            this.fetchNEA('uv-index'),
            this.fetchNEA('psi'),
            this.fetchNEA('2-hour-weather-forecast'),
            this.fetchNEA('4-day-weather-forecast')
        ]);

        const report: UnifiedWeatherReport = {
            location: "Singapore",
            temperature: null,
            humidity: null,
            rain: null,
            windSpeed: null,
            uv: null,
            psi: null,
            wbgt: null, 
            forecast2hr: "Data Unavailable",
            dailyInsight: "Weather data currently unavailable.",
            holisticSummary: "",
            newsSummary: "",
            monthlyOutlook: "Seasonal data unavailable.",
            newsSources: []
        };

        // 1. Process Sensor Data (Nearest Neighbor)
        // Removed hardcoded fallbacks
        report.temperature = this.getNearestValue(tempData, latitude, longitude) ?? null;
        report.humidity = this.getNearestValue(humidData, latitude, longitude) ?? null;
        report.rain = this.getNearestValue(rainData, latitude, longitude) ?? null;
        
        const rawWind = this.getNearestValue(windSpeedData, latitude, longitude);
        if (rawWind !== undefined) {
             report.windSpeed = Math.round(rawWind * 1.852); // Knots to km/h
        } else {
             report.windSpeed = null;
        }

        report.windDirection = this.getNearestValue(windDirData, latitude, longitude);

        // 2. Regional/National Data
        if (uvData && uvData.items && uvData.items.length > 0) {
            report.uv = uvData.items[0].index[0].value; 
        } else {
            report.uv = null;
        }
        
        // PSI is regional
        report.psi = this.getRegionalValue(psiData, latitude, longitude, 'psi_twenty_four_hourly') ?? null;
        report.pm25 = this.getRegionalValue(psiData, latitude, longitude, 'pm25_one_hourly');

        // WBGT Approximation
        // Calculate only if we have source data
        if (report.temperature !== null && report.humidity !== null) {
            report.wbgt = 0.567 * report.temperature + 0.393 * (report.humidity / 100 * 6.105 * Math.exp(17.27 * report.temperature / (237.7 + report.temperature))) + 3.94;
            report.wbgt = Math.round(report.wbgt);
        } else {
            report.wbgt = null;
        }

        // 3. Forecasts
        // 2-hour
        if (forecast2hrData && forecast2hrData.area_metadata) {
            // Find nearest area
            let nearestArea = "Singapore";
            let minDist = Infinity;
            let forecast = "Unavailable";

            forecast2hrData.area_metadata.forEach((area: any) => {
                const d = this.getDistance(latitude, longitude, area.label_location.latitude, area.label_location.longitude);
                if (d < minDist) {
                    minDist = d;
                    nearestArea = area.name;
                }
            });
            
            const forecastItem = forecast2hrData.items[0]?.forecasts?.find((f: any) => f.area === nearestArea);
            if (forecastItem) forecast = forecastItem.forecast;
            
            report.location = nearestArea;
            report.forecast2hr = forecast;
        }

        // 4-day
        if (forecast4dayData && forecast4dayData.items && forecast4dayData.items.length > 0) {
            const data = forecast4dayData.items[0].forecasts;
            report.forecast4day = data.map((d: any) => ({
                date: d.date,
                forecast: d.forecast,
                temperature: d.temperature,
                wind: d.wind,
                category: d.forecast.includes('Shower') ? 'Rain' : (d.forecast.includes('Cloud') ? 'Cloudy' : 'Clear')
            }));
        }

        // Alerts (Simulated based on readings)
        const alerts = [];
        if (report.rain !== null && report.rain > 10) alerts.push({ type: 'RAIN', message: 'Heavy Rain Detected' });
        if (report.wbgt !== null && report.wbgt > 32) alerts.push({ type: 'HEAT', message: 'High Heat Stress Detected' });
        if (report.psi !== null && report.psi > 100) alerts.push({ type: 'HAZE', message: 'Unhealthy Air Quality' });
        report.alerts = alerts;

        return report;
    }

    public async generateWeatherInsights(report: UnifiedWeatherReport): Promise<Partial<UnifiedWeatherReport>> {
        try {
            // Provide "N/A" to LLM if data is null to avoid hallucinations
            const prompt = `
            Analyze this Singapore weather report:
            Location: ${report.location}
            Temp: ${report.temperature ?? 'N/A'}C, Humid: ${report.humidity ?? 'N/A'}%, Rain: ${report.rain ?? 'N/A'}mm
            Wind: ${report.windSpeed ?? 'N/A'}km/h, UV: ${report.uv ?? 'N/A'}, PSI: ${report.psi ?? 'N/A'}
            Forecast (2hr): ${report.forecast2hr}
            
            Generate a JSON object with:
            1. "dailyInsight": A witty, short sentence summary (max 15 words). If data is missing, say "Sensors offline, look outside."
            2. "holisticSummary": Practical advice for outdoor activity, clothing, and comfort (max 40 words).
            3. "newsSummary": A generic sentence about the current monsoon season or climate trend in Singapore.
            
            Example JSON:
            {
                "dailyInsight": "It's a scorcher, stay cool.",
                "holisticSummary": "Wear light clothes...",
                "newsSummary": "Northeast Monsoon brings showers..."
            }
            `;

            const result = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.7,
                useSearch: false // Save search quota, basic LLM enough
            });

            const cleanText = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);

            return {
                dailyInsight: data.dailyInsight || report.forecast2hr,
                holisticSummary: data.holisticSummary || "Stay hydrated.",
                newsSummary: data.newsSummary || "Typical tropical weather.",
                monthlyOutlook: "Monsoon season prevailing.", // Mock/Default
                newsSources: []
            };

        } catch (e) {
            return {};
        }
    }
}

export const realtimeWeatherService = new RealtimeWeatherService();
