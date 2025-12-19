
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { aiService } from '../services/aiService';
import { 
    PawPrint, 
    Activity, 
    Utensils, 
    AlertTriangle, 
    Plus, 
    Trash2, 
    ChevronDown, 
    ChevronUp, 
    Info, 
    Scale,
    Cat,
    Sparkles,
    Loader2,
    Edit2,
    Check,
    X,
    PieChart,
    Search,
    Wand2,
    HelpCircle,
    Save,
    Beef,
    Cookie
} from 'lucide-react';

// --- Types ---

type LifeStage = "kitten" | "adult" | "senior";
type ActivityLevel = "low" | "normal" | "high";
type AgeUnit = "months" | "years";
type FoodTexture = "pate" | "chunks" | "shredded" | "minced" | "mousse" | "flaked" | "dry" | "freeze_dried" | "raw" | "other";

// Simplified BCS for UI (mapped to 1-9 internally)
type BodyShape = "thin" | "ideal" | "chunky" | "chonk";

interface FoodEntry {
  id: string;
  name: string;
  kcalPer100g: number;
  sharePercent: number; // % of calories
  lifeStageTag: "kitten" | "all" | "adult" | "topper";
  completeBalanced: boolean;
  texture: FoodTexture;
  isAiGenerated?: boolean;
  source?: string;
}

interface CatProfile {
  id: string;
  name: string;
  breed: string;
  ageValue: number;
  ageUnit: AgeUnit;
  weightKg: number;
  lifeStage: LifeStage;
  desexed: boolean;
  activity: ActivityLevel;
  bodyConditionScore: number; // 1-9 Scale
  notes: string; // Allergies, quirks, etc.
  foods: FoodEntry[];
  aiAnalysis?: string; 
  lastAnalyzed?: number;
  themeColor?: 'default' | 'amber' | 'red' | 'blue' | 'green' | 'purple';
}

const STORAGE_KEY = 'moncchichi_beast_profiles';

const BODY_SHAPES: { id: BodyShape; label: string; bcs: number; desc: string }[] = [
    { id: 'thin', label: 'Slender', bcs: 3, desc: 'Ribs visible, very tucked waist.' },
    { id: 'ideal', label: 'Perfect', bcs: 5, desc: 'Well-proportioned, visible waist.' },
    { id: 'chunky', label: 'Chunky', bcs: 7, desc: 'Ribs hard to feel, belly pouch.' },
    { id: 'chonk', label: 'Chonky', bcs: 9, desc: 'Round, no waist, heavy belly.' },
];

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; desc: string }[] = [
    { id: 'low', label: 'Couch Potato', desc: 'Sleeps all day, minimal play.' },
    { id: 'normal', label: 'Playful', desc: 'Active bursts, standard house cat.' },
    { id: 'high', label: 'Athlete', desc: 'Constantly running, zooming, high energy.' },
];

const TEXTURES: { value: FoodTexture; label: string; }[] = [
    { value: 'pate', label: 'Pâté' },
    { value: 'chunks', label: 'Chunks' },
    { value: 'shredded', label: 'Shredded' },
    { value: 'minced', label: 'Minced' },
    { value: 'mousse', label: 'Mousse' },
    { value: 'flaked', label: 'Flaked' },
    { value: 'dry', label: 'Dry Kibble' },
    { value: 'freeze_dried', label: 'Freeze-Dried' },
    { value: 'raw', label: 'Raw' },
    { value: 'other', label: 'Other' },
];

const DEFAULT_PROFILES: CatProfile[] = [
    {
        id: 'tootie-potato',
        name: "Tootie Potato De Silva",
        breed: "Domestic Shorthair",
        ageValue: 8,
        ageUnit: "months",
        weightKg: 3.3,
        lifeStage: "kitten",
        desexed: true,
        activity: "high",
        bodyConditionScore: 7, // Chunky
        notes: "Mostly wet food, can eat kibble.",
        themeColor: 'amber',
        foods: [
            {
                id: 'rc-kitten-dry',
                name: "Royal Canin Kitten Dry",
                kcalPer100g: 400,
                // Recalibrated for BCS 7 (Chunky) to maintain ~24g
                // DER reduced due to BCS, so share % must increase to keep grams constant
                sharePercent: 29.5, 
                lifeStageTag: "kitten",
                completeBalanced: true,
                texture: 'dry'
            },
            {
                id: 'ac-white-fish',
                name: "Aristocats White Fish",
                kcalPer100g: 70,
                // Recalibrated for BCS 7 to maintain ~160g
                sharePercent: 34.5,
                lifeStageTag: "all",
                completeBalanced: true,
                texture: 'chunks'
            }
        ],
    },
    {
        id: 'fruity-tomato',
        name: "Fruity Tomato De Silva",
        breed: "Domestic Shorthair",
        ageValue: 1,
        ageUnit: "years",
        weightKg: 4.3,
        lifeStage: "adult",
        desexed: true,
        activity: "low", // Couch Potato
        bodyConditionScore: 5,
        notes: "Kibble food only.",
        themeColor: 'red',
        foods: [
            {
                id: 'rc-indoor-27',
                name: "Royal Canin Indoor 27",
                kcalPer100g: 375,
                // Recalibrated for Low Activity to maintain ~48g
                sharePercent: 91.0, 
                lifeStageTag: "adult",
                completeBalanced: true,
                texture: 'dry'
            }
        ],
    }
];

// --- Logic Helpers ---

function calcRER(weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 0;
  return 70 * Math.pow(weightKg, 0.75);
}

function getFactorRange(
  lifeStage: LifeStage,
  desexed: boolean,
  activity: ActivityLevel,
  bcs: number
): { min: number; mid: number; max: number } {
  let factors = { min: 1.0, mid: 1.2, max: 1.4 }; // Default Adult

  if (lifeStage === "kitten") {
    factors = { min: 2.0, mid: 2.5, max: 3.0 };
  } else if (lifeStage === "adult") {
    if (!desexed) factors = { min: 1.4, mid: 1.5, max: 1.6 };
    else if (activity === "low") factors = { min: 0.8, mid: 1.0, max: 1.2 };
    else if (activity === "high") factors = { min: 1.2, mid: 1.4, max: 1.5 };
    else factors = { min: 1.0, mid: 1.2, max: 1.3 };
  } else {
    // Senior
    factors = { min: 1.0, mid: 1.1, max: 1.3 };
  }

  // Adjust for BCS (Goal is 5)
  if (bcs >= 7) { 
      // Overweight -> Reduce calories
      factors.mid *= 0.8;
      factors.max *= 0.8;
      factors.min *= 0.8;
  } else if (bcs <= 3) {
      // Underweight -> Increase calories
      factors.mid *= 1.2;
      factors.max *= 1.2;
      factors.min *= 1.2;
  }

  return factors;
}

function calculateLifeStage(value: number, unit: AgeUnit): LifeStage {
    if (unit === 'months') {
        if (value < 12) return 'kitten';
        if (value >= 132) return 'senior'; // 11 years
        return 'adult';
    } else {
        if (value < 1) return 'kitten';
        if (value >= 11) return 'senior';
        return 'adult';
    }
}

function getThemeStyles(theme?: string) {
    switch (theme) {
        case 'amber': return { 
            gradient: 'from-amber-500/20 to-transparent', 
            border: 'border-amber-500/30',
            icon: 'text-amber-500',
            bg: 'bg-amber-500/10',
            accent: 'text-amber-400'
        };
        case 'red': return { 
            gradient: 'from-red-500/20 to-transparent', 
            border: 'border-red-500/30',
            icon: 'text-red-500',
            bg: 'bg-red-500/10',
            accent: 'text-red-400'
        };
        case 'blue': return { 
            gradient: 'from-blue-500/20 to-transparent', 
            border: 'border-blue-500/30',
            icon: 'text-blue-500',
            bg: 'bg-blue-500/10',
            accent: 'text-blue-400'
        };
        case 'green': return { 
            gradient: 'from-emerald-500/20 to-transparent', 
            border: 'border-emerald-500/30',
            icon: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            accent: 'text-emerald-400'
        };
        case 'purple': return { 
            gradient: 'from-purple-500/20 to-transparent', 
            border: 'border-purple-500/30',
            icon: 'text-purple-500',
            bg: 'bg-purple-500/10',
            accent: 'text-purple-400'
        };
        default: return { 
            gradient: 'from-moncchichi-surfaceAlt/50 to-transparent', 
            border: 'border-moncchichi-border',
            icon: 'text-moncchichi-textSec',
            bg: 'bg-moncchichi-surfaceAlt',
            accent: 'text-moncchichi-accent'
        };
    }
}

// --- Component ---

const CatDietCalculator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Initialized with DEFAULT_PROFILES to prevent undefined access on first render
    const [profiles, setProfiles] = useState<CatProfile[]>(DEFAULT_PROFILES);
    const [activeId, setActiveId] = useState<string>(DEFAULT_PROFILES[0].id);
    const [isEditing, setIsEditing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [expandedFoodId, setExpandedFoodId] = useState<string | null>(null);
    const [showShareHelp, setShowShareHelp] = useState(false);
    
    // Food Search State
    const [foodQuery, setFoodQuery] = useState("");
    const [isSearchingFood, setIsSearchingFood] = useState(false);

    // Save State Indicator
    const [lastSaved, setLastSaved] = useState<number>(Date.now());

    // Load initial state
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const migrated = parsed.map((p: any) => {
                        let updated = { ...p };
                        if (p.age && p.ageValue === undefined) {
                            const isMonth = p.age.toLowerCase().includes('month');
                            updated.ageValue = parseInt(p.age) || 1;
                            updated.ageUnit = isMonth ? 'months' : 'years';
                        }
                        if (p.bodyConditionScore === undefined) updated.bodyConditionScore = 5;
                        if (p.notes === undefined) updated.notes = "";
                        updated.foods = (updated.foods || []).map((f: any) => ({
                            ...f,
                            texture: f.texture || (f.name.toLowerCase().includes('dry') ? 'dry' : 'pate')
                        }));
                        return updated;
                    });
                    setProfiles(migrated);
                    setActiveId(migrated[0].id);
                    return;
                }
            }
        } catch (e) { console.error(e); }
        // If no storage, defaults are already set by useState
    }, []);

    // Save on change
    useEffect(() => {
        if (profiles.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
            setLastSaved(Date.now());
        }
    }, [profiles]);

    const activeProfile = profiles.find(p => p.id === activeId) || profiles[0];
    
    // Guard against undefined profile early
    if (!activeProfile) return null;

    const theme = getThemeStyles(activeProfile.themeColor);

    const updateProfile = (updates: Partial<CatProfile>) => {
        setProfiles(prev => prev.map(p => p.id === activeId ? { ...p, ...updates } : p));
    };

    const updateProfileAge = (val: number, unit: AgeUnit) => {
        const newStage = calculateLifeStage(val, unit);
        updateProfile({ ageValue: val, ageUnit: unit, lifeStage: newStage });
    };

    const updateFood = (foodId: string, updates: Partial<FoodEntry>) => {
        if (!activeProfile) return;
        const updatedFoods = activeProfile.foods.map(f => f.id === foodId ? { ...f, ...updates } : f);
        updateProfile({ foods: updatedFoods });
    };

    const removeFood = (foodId: string) => {
        if (!activeProfile) return;
        updateProfile({ foods: activeProfile.foods.filter(f => f.id !== foodId) });
    };

    const createNewProfile = () => {
        const newProfile: CatProfile = {
            ...DEFAULT_PROFILES[0],
            id: `beast_${Date.now()}`,
            name: "New Beast",
            breed: "Unknown",
            ageValue: 1,
            ageUnit: "years",
            weightKg: 4.0,
            notes: "",
            bodyConditionScore: 5,
            foods: [],
            themeColor: 'default'
        };
        setProfiles(prev => [...prev, newProfile]);
        setActiveId(newProfile.id);
        setIsEditing(true);
        setShowProfileMenu(false);
    };

    const deleteActiveProfile = () => {
        if (profiles.length <= 1) return;
        const newProfiles = profiles.filter(p => p.id !== activeId);
        setProfiles(newProfiles);
        setActiveId(newProfiles[0].id);
        setShowProfileMenu(false);
    };

    // --- Smart Food Search ---
    const handleAddFoodBySearch = async () => {
        if (!foodQuery.trim()) return;
        setIsSearchingFood(true);

        try {
            const prompt = `
            You are a precise veterinary nutritionist database.
            Search for the exact commercial cat food product matching: "${foodQuery}".
            
            Return a JSON object (NO markdown) with this EXACT format:
            {
                "name": "Full Brand & Product Name",
                "kcalPer100g": number, // ACCURATE As-Fed calories per 100g. If unsure, estimate based on texture type (e.g. Pate ~90-100, Dry ~350-400).
                "texture": "pate" | "chunks" | "shredded" | "dry" | "freeze_dried" | "raw",
                "completeBalanced": boolean,
                "source": "Brief source name or URL (e.g. 'purina.com')"
            }
            
            Example:
            User: "Fancy Feast Chicken"
            Output: {"name": "Fancy Feast Classic Pate Chicken Feast", "kcalPer100g": 95, "texture": "pate", "completeBalanced": true, "source": "Purina.com"}
            `;

            const result = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.1,
                useSearch: true // Enable grounding for sources
            });

            // Extract JSON from response (handle potential markdown blocks)
            const cleanText = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);

            const newFood: FoodEntry = {
                id: `food_${Date.now()}`,
                name: data.name || foodQuery,
                kcalPer100g: data.kcalPer100g || 100, // Safe default
                sharePercent: activeProfile.foods.length === 0 ? 100 : 0, // Auto-set 100% if first item
                lifeStageTag: "all",
                completeBalanced: data.completeBalanced ?? true,
                texture: data.texture || 'pate',
                isAiGenerated: true,
                source: data.source
            };

            updateProfile({ foods: [...activeProfile.foods, newFood] });
            setFoodQuery(""); 

        } catch (e) {
            console.error("Food search failed", e);
            // Fallback manual add
            const fallbackFood: FoodEntry = {
                id: `food_${Date.now()}`,
                name: foodQuery,
                kcalPer100g: 100, // Default generic
                sharePercent: activeProfile.foods.length === 0 ? 100 : 0,
                lifeStageTag: "all",
                completeBalanced: true,
                texture: 'pate'
            };
            updateProfile({ foods: [...activeProfile.foods, fallbackFood] });
            setFoodQuery("");
        } finally {
            setIsSearchingFood(false);
        }
    };

    // --- Calculations ---
    // (activeProfile check is already done above)

    const rer = calcRER(activeProfile.weightKg);
    const { min, mid, max } = getFactorRange(
        activeProfile.lifeStage, 
        activeProfile.desexed, 
        activeProfile.activity,
        activeProfile.bodyConditionScore
    );
    
    const derMid = rer * mid;
    const foodsWithCalc = activeProfile.foods.map(f => {
        const share = f.sharePercent || 0;
        const kcalForFood = derMid * (share / 100);
        const grams = f.kcalPer100g > 0 ? kcalForFood / (f.kcalPer100g / 100) : 0;
        return { ...f, kcalForFood, grams };
    });

    const totalShare = activeProfile.foods.reduce((sum, f) => sum + (f.sharePercent || 0), 0);
    const totalCalories = foodsWithCalc.reduce((sum, f) => sum + f.kcalForFood, 0);
    const hasShareIssue = Math.round(totalShare) !== 100;

    // --- Responsive Color Logic ---
    const calorieRatio = derMid > 0 ? totalCalories / derMid : 0;
    let calorieStatusColor = 'text-moncchichi-textSec';
    let calorieStatusText = 'Empty';

    if (foodsWithCalc.length > 0) {
        if (calorieRatio < 0.85) {
            calorieStatusColor = 'text-yellow-500';
            calorieStatusText = 'Underfed';
        } else if (calorieRatio < 0.98) {
            calorieStatusColor = 'text-blue-400';
            calorieStatusText = 'Moderate';
        } else if (calorieRatio <= 1.02) {
            calorieStatusColor = 'text-moncchichi-success';
            calorieStatusText = 'Perfect';
        } else {
            calorieStatusColor = 'text-moncchichi-error';
            calorieStatusText = 'Overfed';
        }
    }

    // --- Reverse Calculation (Grams -> Share) ---
    const updateFoodGrams = (foodId: string, grams: number) => {
        if (!activeProfile || derMid <= 0) return;
        const food = activeProfile.foods.find(f => f.id === foodId);
        if (!food || food.kcalPer100g <= 0) return;

        // kcal provided by these grams
        const kcalProvided = grams * (food.kcalPer100g / 100);
        // % of daily target
        const newShare = (kcalProvided / derMid) * 100;
        
        updateFood(foodId, { sharePercent: newShare });
    };

    // Map internal BCS to UI Shape
    const getCurrentShape = (): BodyShape => {
        const bcs = activeProfile.bodyConditionScore;
        if (bcs <= 3) return 'thin';
        if (bcs >= 4 && bcs <= 5) return 'ideal';
        if (bcs >= 6 && bcs <= 7) return 'chunky';
        return 'chonk';
    };

    // --- AI Insight ---
    const handleConsultOracle = async () => {
        setIsAnalyzing(true);
        try {
            const dietSummary = foodsWithCalc.map(f => 
                `- ${f.name} (${f.texture}): ${Math.round(f.grams)}g/day`
            ).join('\n');

            const prompt = `
            Pet: ${activeProfile.name}, ${activeProfile.weightKg}kg, BCS ${activeProfile.bodyConditionScore}/9.
            Activity: ${activeProfile.activity}.
            Calorie Target: ${Math.round(derMid)} kcal.
            Plan:
            ${dietSummary}
            
            Give a 3-bullet simplified advice summary for a pet owner.
            1. Is this amount of food roughly correct?
            2. One health tip based on weight/age.
            3. A fun comment about the cat's name.
            Keep it very short and encouraging.
            `;

            const result = await aiService.generateText({
                userPrompt: prompt,
                temperature: 0.7
            });

            updateProfile({ 
                aiAnalysis: result.text,
                lastAnalyzed: Date.now()
            });

        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-moncchichi-bg font-mono">
            {/* Header */}
            <div className="px-4 py-3 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-20 shadow-sm">
                <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text rounded-full hover:bg-moncchichi-surfaceAlt transition-colors">
                    {ICONS.Back}
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-moncchichi-text tracking-tight flex items-center gap-2">
                        <PawPrint size={20} className="text-moncchichi-accent"/> Beast Mastery
                    </h2>
                </div>
                <div className="relative">
                    <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 bg-moncchichi-surfaceAlt border border-moncchichi-border px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform">
                        <span className="truncate max-w-[80px]">{activeProfile.name}</span>
                        <ChevronDown size={14} />
                    </button>
                    {showProfileMenu && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                            <div className="p-1 max-h-48 overflow-y-auto">
                                {profiles.map(p => (
                                    <button key={p.id} onClick={() => { setActiveId(p.id); setShowProfileMenu(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold mb-1 ${activeId === p.id ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-text hover:bg-moncchichi-surface'}`}>
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t border-moncchichi-border p-1 flex flex-col gap-1">
                                <button onClick={createNewProfile} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surface">
                                    <Plus size={14} /> New Beast
                                </button>
                                {profiles.length > 1 && (
                                    <button onClick={deleteActiveProfile} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-moncchichi-error hover:bg-moncchichi-error/10">
                                        <Trash2 size={14} /> Delete Current
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
                
                {/* 1. Profile / Stats Card */}
                <div className={`rounded-xl border ${theme.border} overflow-hidden transition-all duration-300 shadow-sm relative bg-moncchichi-surface`}>
                    {/* Auto-save indicator */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-50 transition-opacity z-10">
                        <Check size={10} className="text-moncchichi-success" />
                    </div>

                    {/* Header & Basic Stats */}
                    <div className={`p-4 bg-gradient-to-b ${theme.gradient}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-4 items-center">
                                <div className={`w-14 h-14 ${theme.bg} rounded-full flex items-center justify-center border ${theme.border} shrink-0`}>
                                    <Cat size={28} className={theme.icon} />
                                </div>
                                <div>
                                    {isEditing ? (
                                        <input 
                                            type="text" 
                                            value={activeProfile.name} 
                                            onChange={e => updateProfile({ name: e.target.value })} 
                                            className="bg-moncchichi-bg border border-moncchichi-accent rounded px-2 py-1 text-lg font-bold w-32 focus:outline-none"
                                        />
                                    ) : (
                                        <h2 className="text-xl font-bold text-moncchichi-text leading-tight">{activeProfile.name}</h2>
                                    )}
                                    <div className="text-xs text-moncchichi-textSec mt-1 font-medium">{activeProfile.breed || "Cat"}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-moncchichi-accent text-moncchichi-bg shadow-lg' : `bg-moncchichi-surfaceAlt ${theme.icon} hover:text-moncchichi-text`}`}
                            >
                                {isEditing ? <Check size={18} /> : <Edit2 size={18} />}
                            </button>
                        </div>

                        {/* Visual Stats Row */}
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <div className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-3 relative">
                                <span className="text-[9px] text-moncchichi-textSec uppercase font-bold absolute top-2 left-3">Weight</span>
                                <div className="flex items-baseline justify-center mt-3">
                                    {isEditing ? (
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={activeProfile.weightKg} 
                                            onChange={e => updateProfile({ weightKg: parseFloat(e.target.value) || 0 })}
                                            className="bg-moncchichi-bg border border-moncchichi-accent rounded w-16 text-center font-bold text-lg focus:outline-none"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold text-moncchichi-text tracking-tighter">{activeProfile.weightKg}</span>
                                    )}
                                    <span className="text-xs ml-1 text-moncchichi-textSec">kg</span>
                                </div>
                            </div>
                            
                            <div className="bg-moncchichi-surface border border-moncchichi-border rounded-xl p-3 relative">
                                <span className="text-[9px] text-moncchichi-textSec uppercase font-bold absolute top-2 left-3">Age</span>
                                <div className="flex items-baseline justify-center mt-3">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" 
                                                value={activeProfile.ageValue} 
                                                onChange={e => updateProfileAge(parseFloat(e.target.value) || 0, activeProfile.ageUnit)}
                                                className="bg-moncchichi-bg border border-moncchichi-accent rounded w-12 text-center font-bold text-lg focus:outline-none"
                                            />
                                            <button onClick={() => updateProfileAge(activeProfile.ageValue, activeProfile.ageUnit === 'months' ? 'years' : 'months')} className="text-xs bg-moncchichi-surfaceAlt px-1 py-0.5 rounded border border-moncchichi-border uppercase">{activeProfile.ageUnit === 'months' ? 'M' : 'Y'}</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-2xl font-bold text-moncchichi-text tracking-tighter">{activeProfile.ageValue}</span>
                                            <span className="text-xs ml-1 text-moncchichi-textSec">{activeProfile.ageUnit === 'months' ? 'mths' : 'yrs'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Edit Mode: Detailed Selectors */}
                    {isEditing ? (
                        <div className="p-4 space-y-6 bg-moncchichi-bg/30 border-t border-moncchichi-border animate-in slide-in-from-top-2">
                            {/* Theme Color Selector */}
                            <div>
                                <label className="text-[10px] font-bold text-moncchichi-textSec uppercase mb-2 block">Theme Color</label>
                                <div className="flex gap-2">
                                    {['default', 'amber', 'red', 'blue', 'green', 'purple'].map((color) => (
                                        <button 
                                            key={color}
                                            onClick={() => updateProfile({ themeColor: color as any })}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                                activeProfile.themeColor === color ? 'scale-110 border-white' : 'border-transparent opacity-50'
                                            } ${
                                                color === 'amber' ? 'bg-amber-500' : 
                                                color === 'red' ? 'bg-red-500' : 
                                                color === 'blue' ? 'bg-blue-500' : 
                                                color === 'green' ? 'bg-emerald-500' : 
                                                color === 'purple' ? 'bg-purple-500' : 
                                                'bg-moncchichi-accent'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Body Shape Selector */}
                            <div>
                                <label className="text-[10px] font-bold text-moncchichi-textSec uppercase mb-2 block">Body Shape</label>
                                <div className="space-y-2">
                                    {BODY_SHAPES.map(shape => (
                                        <button 
                                            key={shape.id}
                                            onClick={() => updateProfile({ bodyConditionScore: shape.bcs })}
                                            className={`w-full flex items-center p-2 rounded-xl border transition-all ${
                                                activeProfile.bodyConditionScore === shape.bcs 
                                                ? 'bg-moncchichi-accent/10 border-moncchichi-accent shadow-sm' 
                                                : 'bg-moncchichi-surface border-moncchichi-border opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full mr-3 ${activeProfile.bodyConditionScore === shape.bcs ? 'bg-moncchichi-accent' : 'bg-moncchichi-border'}`} />
                                            <div className="text-left flex-1">
                                                <div className={`text-xs font-bold ${activeProfile.bodyConditionScore === shape.bcs ? 'text-moncchichi-accent' : 'text-moncchichi-text'}`}>{shape.label}</div>
                                                <div className="text-[10px] text-moncchichi-textSec">{shape.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Activity Selector */}
                            <div>
                                <label className="text-[10px] font-bold text-moncchichi-textSec uppercase mb-2 block">Energy Level</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {ACTIVITY_LEVELS.map(act => (
                                        <button 
                                            key={act.id}
                                            onClick={() => updateProfile({ activity: act.id })}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border h-20 transition-all ${
                                                activeProfile.activity === act.id
                                                ? 'bg-moncchichi-text text-moncchichi-bg border-moncchichi-text'
                                                : 'bg-moncchichi-surface border-moncchichi-border text-moncchichi-textSec'
                                            }`}
                                        >
                                            <span className="text-[10px] font-bold text-center leading-tight mb-1">{act.label}</span>
                                            {activeProfile.activity === act.id && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 text-[10px] text-moncchichi-textSec italic text-center">
                                    {ACTIVITY_LEVELS.find(a => a.id === activeProfile.activity)?.desc}
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="flex justify-between items-center bg-moncchichi-surface p-3 rounded-xl border border-moncchichi-border">
                                <span className="text-xs font-bold text-moncchichi-text">Neutered / Spayed?</span>
                                <button 
                                    onClick={() => updateProfile({ desexed: !activeProfile.desexed })}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${activeProfile.desexed ? 'bg-moncchichi-success' : 'bg-moncchichi-border'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${activeProfile.desexed ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        // View Mode: Summary Chips
                        <div className="px-4 pb-4 flex gap-2">
                            <div className="px-3 py-1.5 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border text-[10px] font-bold text-moncchichi-textSec flex items-center gap-1">
                                <Scale size={12} />
                                {BODY_SHAPES.find(s => s.id === getCurrentShape())?.label || 'Ideal'}
                            </div>
                            <div className="px-3 py-1.5 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border text-[10px] font-bold text-moncchichi-textSec flex items-center gap-1">
                                <Activity size={12} />
                                {ACTIVITY_LEVELS.find(a => a.id === activeProfile.activity)?.label || 'Normal'}
                            </div>
                            <div className="px-3 py-1.5 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border text-[10px] font-bold text-moncchichi-textSec flex items-center gap-1">
                                {activeProfile.desexed ? 'Neutered' : 'Intact'}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Target Calories (Big Display) */}
                {!isEditing && (
                    <div className="relative">
                        <div className={`absolute inset-0 ${theme.bg} blur-xl rounded-full opacity-50 pointer-events-none`}></div>
                        <div className={`flex justify-between items-center bg-moncchichi-surface p-5 rounded-2xl border ${theme.border} shadow-lg relative z-10`}>
                            <div>
                                <div className={`text-[10px] font-bold ${theme.accent} uppercase tracking-wider mb-1 flex items-center gap-1`}>
                                    <Sparkles size={12} /> Daily Fuel Target
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-3xl font-black font-mono tracking-tight transition-colors duration-300 ${calorieStatusColor}`}>
                                        {Math.round(totalCalories)}
                                    </span>
                                    <span className="text-xl font-bold text-moncchichi-textSec opacity-70">/</span>
                                    <span className="text-xl font-bold text-moncchichi-textSec">{Math.round(derMid)}</span>
                                    <span className="text-sm font-bold text-moncchichi-textSec ml-1">kcal</span>
                                </div>
                                {foodsWithCalc.length > 0 && (
                                    <div className={`text-[10px] font-bold uppercase mt-1 ${calorieStatusColor}`}>
                                        {calorieStatusText}
                                    </div>
                                )}
                            </div>
                            <div className="text-right opacity-60">
                                <Utensils size={32} className="text-moncchichi-textSec" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Smart Food List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-moncchichi-textSec uppercase tracking-wider flex items-center gap-2">
                            <Utensils size={14} /> Menu
                        </h3>
                        {foodsWithCalc.length > 0 && (
                            <button onClick={() => setShowShareHelp(!showShareHelp)} className="text-[10px] text-moncchichi-accent flex items-center gap-1 hover:underline">
                                <HelpCircle size={12} /> What is 'Bowl Filled'?
                            </button>
                        )}
                    </div>

                    {showShareHelp && (
                        <div className="bg-moncchichi-surfaceAlt/50 border border-moncchichi-accent/30 rounded-lg p-3 text-[10px] text-moncchichi-textSec leading-relaxed animate-in fade-in">
                            <strong className="text-moncchichi-accent">Bowl Filled %</strong> indicates how much of the cat's daily calorie quota is used by this food. 100% means the daily needs are fully met.
                        </div>
                    )}

                    {/* Magic Add Input */}
                    <div className="relative">
                        <input 
                            type="text"
                            value={foodQuery}
                            onChange={(e) => setFoodQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddFoodBySearch()}
                            disabled={isSearchingFood}
                            placeholder={isSearchingFood ? "Consulting the Oracle..." : "Exact name (e.g. 'Fancy Feast Chicken Pate')"}
                            className={`w-full bg-moncchichi-surface border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none placeholder-moncchichi-textSec/50 transition-all duration-300 ${
                                isSearchingFood 
                                ? 'border-moncchichi-accent shadow-[0_0_15px_rgba(166,145,242,0.4)] animate-pulse cursor-wait' 
                                : 'border-moncchichi-border focus:border-moncchichi-accent'
                            }`}
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-moncchichi-textSec">
                            <Search size={16} />
                        </div>
                        <button 
                            onClick={handleAddFoodBySearch}
                            disabled={!foodQuery.trim() || isSearchingFood}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-moncchichi-surfaceAlt hover:bg-moncchichi-accent hover:text-moncchichi-bg rounded-lg text-moncchichi-textSec transition-colors disabled:opacity-50"
                        >
                            {isSearchingFood ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        </button>
                    </div>

                    {/* Allocation Warning */}
                    {foodsWithCalc.length > 0 && (
                        <div className={`text-[10px] px-3 py-2 rounded-lg border font-bold flex items-center gap-2 animate-in fade-in ${
                            hasShareIssue 
                            ? 'bg-moncchichi-warning/10 text-moncchichi-warning border-moncchichi-warning/30' 
                            : 'bg-moncchichi-success/10 text-moncchichi-success border-moncchichi-success/30'
                        }`}>
                            {hasShareIssue ? <AlertTriangle size={12} /> : <Check size={12} />}
                            <span>
                                {totalShare < 100 ? `Bowl is only ${Math.round(totalShare)}% full` : 
                                 totalShare > 100 ? `Bowl is overflowing (${Math.round(totalShare)}%)` : 
                                 "Perfectly Balanced Diet (100%)"}
                            </span>
                        </div>
                    )}

                    {/* Food Items */}
                    <div className="space-y-3">
                        {foodsWithCalc.length === 0 && (
                            <div className="text-center py-8 opacity-50 flex flex-col items-center gap-2">
                                <div className="p-3 bg-moncchichi-surfaceAlt rounded-full"><HelpCircle size={24} className="text-moncchichi-textSec" /></div>
                                <p className="text-xs text-moncchichi-textSec italic">Type a specific food name above to auto-calculate.</p>
                            </div>
                        )}
                        
                        {foodsWithCalc.map((food) => (
                            <div key={food.id} className="bg-moncchichi-surface border border-moncchichi-border rounded-xl overflow-hidden shadow-sm group">
                                {/* Header / Main View */}
                                <div className="p-3 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-moncchichi-surfaceAlt border border-moncchichi-border/50 flex items-center justify-center shrink-0">
                                        {food.texture.includes('dry') ? <Cookie size={18} /> : <Beef size={18} />}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-moncchichi-text truncate">{food.name}</div>
                                        <div className="flex items-center gap-2 text-[10px] text-moncchichi-textSec">
                                            <span className="bg-moncchichi-surfaceAlt px-1.5 rounded border border-moncchichi-border/50 capitalize">{food.texture}</span>
                                            {food.isAiGenerated && <span className="flex items-center gap-0.5 text-moncchichi-accent"><Sparkles size={8} /> AI Info</span>}
                                        </div>
                                    </div>

                                    <div className="text-right flex flex-col items-end">
                                        <div className="flex items-baseline justify-end gap-0.5">
                                            <input 
                                                type="number"
                                                value={food.grams === 0 ? '' : Math.round(food.grams)}
                                                placeholder="0"
                                                onChange={(e) => updateFoodGrams(food.id, parseFloat(e.target.value) || 0)}
                                                className="w-16 bg-transparent text-xl font-bold text-moncchichi-text font-mono text-right focus:outline-none focus:border-b focus:border-moncchichi-accent p-0 placeholder-moncchichi-textSec/30"
                                            />
                                            <span className="text-xs text-moncchichi-textSec">g</span>
                                        </div>
                                        <div className="text-[9px] text-moncchichi-textSec font-bold mt-0.5">PER DAY</div>
                                    </div>
                                </div>

                                {/* Details / Edit View (Simplified) */}
                                <div className="bg-moncchichi-surfaceAlt/30 border-t border-moncchichi-border/50 p-2">
                                    <div className="flex items-center gap-2">
                                        {/* Slider for Share */}
                                        <div className="flex-1 flex flex-col gap-1">
                                            <div className="flex justify-between text-[10px] font-bold text-moncchichi-textSec uppercase">
                                                <span>Bowl Filled</span>
                                                <span>{Math.round(food.sharePercent)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="100" 
                                                value={food.sharePercent} 
                                                onChange={(e) => updateFood(food.id, { sharePercent: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-1.5 bg-moncchichi-bg rounded-lg appearance-none cursor-pointer accent-moncchichi-accent"
                                            />
                                        </div>

                                        {/* Manual Detail Toggle */}
                                        <button 
                                            onClick={() => setExpandedFoodId(expandedFoodId === food.id ? null : food.id)}
                                            className={`p-2 rounded-lg transition-colors ${expandedFoodId === food.id ? 'bg-moncchichi-accent text-moncchichi-bg' : 'text-moncchichi-textSec hover:bg-moncchichi-bg'}`}
                                        >
                                            <Edit2 size={14} />
                                        </button>

                                        <div className="w-px h-6 bg-moncchichi-border/50 mx-1"></div>

                                        <button onClick={() => removeFood(food.id)} className="p-2 text-moncchichi-textSec hover:text-moncchichi-error hover:bg-moncchichi-bg rounded-lg transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Expanded Calorie Edit */}
                                    {expandedFoodId === food.id && (
                                        <div className="mt-2 pt-2 border-t border-moncchichi-border/30 grid grid-cols-2 gap-2 animate-in slide-in-from-top-1">
                                            <div className="bg-moncchichi-bg p-2 rounded border border-moncchichi-border/50">
                                                <label className="text-[9px] text-moncchichi-textSec uppercase font-bold block mb-1">Kcal/100g (As Fed)</label>
                                                <input 
                                                    type="number" 
                                                    value={food.kcalPer100g}
                                                    onChange={(e) => updateFood(food.id, { kcalPer100g: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-transparent text-xs font-mono focus:outline-none font-bold"
                                                />
                                            </div>
                                            <div className="flex flex-col justify-center items-center text-center p-1">
                                                <span className="text-[10px] text-moncchichi-textSec italic leading-tight">
                                                    Adjust only if package differs.
                                                </span>
                                                {food.source && (
                                                    <span className="text-[9px] text-moncchichi-accent/70 mt-1 truncate max-w-[120px]" title={food.source}>
                                                        Source: {food.source.replace(/^https?:\/\/(www\.)?/, '').substring(0, 20)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {foodsWithCalc.length > 0 && (
                        <div className="mt-3 flex justify-end">
                            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${hasShareIssue ? 'bg-moncchichi-warning/10 border-moncchichi-warning/30 text-moncchichi-warning' : 'bg-moncchichi-success/10 border-moncchichi-success/30 text-moncchichi-success'}`}>
                                <PieChart size={12} />
                                <span>{Math.round(totalShare)}% Bowl Filled</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* AI Oracle Button */}
                <div className="mt-6 pt-6 border-t border-moncchichi-border">
                    {!activeProfile.aiAnalysis ? (
                        <button 
                            onClick={handleConsultOracle}
                            disabled={isAnalyzing || foodsWithCalc.length === 0}
                            className="w-full py-3 rounded-xl bg-moncchichi-surface border border-moncchichi-accent/30 text-moncchichi-accent font-bold text-xs flex items-center justify-center gap-2 hover:bg-moncchichi-accent hover:text-moncchichi-bg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {isAnalyzing ? "Consulting..." : "Ask Oracle for Advice"}
                        </button>
                    ) : (
                        <div className="bg-moncchichi-surfaceAlt/30 rounded-xl p-4 border border-moncchichi-accent/20 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-moncchichi-accent uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles size={14} /> Oracle Insight
                                </h3>
                                <button onClick={handleConsultOracle} disabled={isAnalyzing} className="p-1 text-moncchichi-textSec hover:text-moncchichi-accent bg-moncchichi-surface rounded-full border border-moncchichi-border">
                                    {isAnalyzing ? <Loader2 size={12} className="animate-spin"/> : <Edit2 size={12} />}
                                </button>
                            </div>
                            <div className="prose prose-invert prose-xs text-moncchichi-text leading-relaxed whitespace-pre-wrap text-xs">
                                {activeProfile.aiAnalysis}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default CatDietCalculator;
