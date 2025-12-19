
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageSource, MessageOrigin, DeviceVitals, LogEntry } from '../types';
import { mockService } from '../services/mockService';
import { soundService } from '../services/soundService';
import { checklistService } from '../services/checklistService';
import { realtimeWeatherService } from '../services/realtimeWeatherService';
import { memoryService } from '../services/memoryService';
import { settingsService } from '../services/settingsService';
import { errorService } from '../services/errorService'; 
import { aiService, AiProvider } from '../services/aiService';
import { protocolService } from '../services/protocolService';
import { bookService } from '../services/bookService';
import { ICONS } from '../constants';
import { Mic, Smartphone, Glasses, Trash2, Sparkles, Zap, Cpu, Bug, BrainCircuit, RefreshCw, FileSearch } from 'lucide-react';

type IntentType = 'TRANSPORT' | 'DEVICE_CONTROL' | 'DIAGNOSTICS' | 'WEATHER' | 'LLM_GENERAL' | 'MUSIC' | 'CHECKLIST' | 'WEBVIEW' | 'HOME_ASSISTANT' | 'PROVIDER_SWITCH' | 'LIBRARY_QUERY';
type AudioSource = 'PHONE' | 'GLASSES';

const WAKE_WORD = "ershin"; 

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [routingStatus, setRoutingStatus] = useState<string | null>(null);
  
  // AI Provider UI State (Synced via effect)
  const [activeProviderDisplay, setActiveProviderDisplay] = useState<AiProvider>('GEMINI');

  // Context Awareness State
  const [vitals, setVitals] = useState<DeviceVitals | null>(null);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Voice State
  const [audioSource, setAudioSource] = useState<AudioSource>('PHONE');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscribeMode, setLiveTranscribeMode] = useState(false);
  const [transcriptionBuffer, setTranscriptionBuffer] = useState("");
  const [interimResult, setInterimResult] = useState("");

  // Checklist Wizard State
  const [checklistWizard, setChecklistWizard] = useState<{
      step: 'NAME' | 'DUE' | 'DESC';
      data: { text: string; dueOffset: number; description: string };
  } | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Load Memory & Initial State
  useEffect(() => {
      const history = memoryService.getChatHistory();
      if (history.length > 0) {
          setMessages(history);
      } else {
          setMessages([{
              id: '1',
              text: `Ershin greets ${settingsService.get('userName')}. Ershin is monitoring the G1 glasses. Does the user require assistance?`,
              source: MessageSource.ASSISTANT,
              origin: MessageOrigin.SYSTEM,
              timestamp: Date.now()
          }]);
          generateProactiveSuggestions();
      }

      // Sync active provider
      setActiveProviderDisplay(aiService.getProvider());

      // Subscribe to Vitals for Live Context
      const unsubVitals = mockService.subscribeToVitals((v) => {
          setVitals(v);
          checkProactiveTriggers(v);
      });

      // Subscribe to Logs for Diagnostics
      const unsubLogs = mockService.subscribeToLogs((log) => {
          if (log.level === 'ERROR' || log.level === 'WARN') {
              setRecentLogs(prev => [...prev.slice(-4), log]);
          }
      });

      return () => {
          unsubVitals();
          unsubLogs();
      };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, routingStatus, transcriptionBuffer, interimResult]);

  // 2. Proactive Suggestion Engine
  const checkProactiveTriggers = (v: DeviceVitals | null) => {
      if (!v) return;
      
      const newSuggestions: string[] = [];
      
      // Error Trigger
      if (errorService.hasRecentErrors()) {
          if (!suggestions.includes("What malfunctioned?")) {
              newSuggestions.push("What malfunctioned?");
          }
      }

      // Battery Triggers
      if (v.batteryPercent !== null && v.batteryPercent < 20 && !v.isCharging) {
          if (!suggestions.includes("Energy levels low!")) {
              newSuggestions.push("Energy levels low!");
          }
      }

      // Connection Triggers
      if (v.signalRssi !== null && v.signalRssi < -85) {
          if (!suggestions.includes("Check connection")) {
              newSuggestions.push("Check connection");
          }
      }

      if (newSuggestions.length > 0) {
          setSuggestions(prev => Array.from(new Set([...newSuggestions, ...prev])).slice(0, 4));
      }
  };

  const generateProactiveSuggestions = () => {
      const defaults = ["Check status", "Search Codex for...", "New Checklist", "Tell Ershin a joke"];
      setSuggestions(defaults);
  };

  // 3. Context Generation (The "Brain")
  const generateSystemContext = (libraryContext?: string): string => {
      const v = mockService.getVitals();
      const conn = mockService.getConnectionState();
      const time = new Date().toLocaleTimeString();
      const user = settingsService.get('userName');
      const memContext = memoryService.getContextSummary();
      const errorContext = errorService.getContextSummary();

      let baseContext = `
      Current Time: ${time}
      User Name: ${user}
      
      [DEVICE TELEMETRY]
      Connection State: ${conn}
      Glasses Battery: ${v?.batteryPercent ?? 'Unknown'}% (Charging: ${v?.isCharging})
      Case Battery: ${v?.caseBatteryPercent ?? 'Unknown'}%
      Signal Strength: ${v?.signalRssi ?? 'Unknown'} dBm
      Is Worn: ${v?.isWorn ? 'Yes' : 'No'}
      
      [ERROR LOGS]
      ${errorContext}

      [USER MEMORY]
      ${memContext}
      `;

      if (libraryContext) {
          baseContext += `
          [ARCHIVES CONTEXT]
          ${libraryContext}
          `;
      }
      
      baseContext += `
      [PERSONA INSTRUCTIONS]
      You are Ershin (from Breath of Fire 4), an armor spirit living inside the G1 Glasses.
      - SPEAKING STYLE: You MUST refer to yourself in the third person as "Ershin". Never say "I", "me", or "my".
      - Example: "Ershin thinks this is funny." NOT "I think this is funny."
      - PERSONALITY: Quirky, literal, observant, slightly robotic but spirited. Ershin finds human behavior curious.
      - LENGTH: Keep responses very short (under 50 words) unless reading from the Codex. Ershin does not like to ramble.
      - CONTEXT: You are monitoring the G1 Glasses.
      - ERRORS: If [ERROR LOGS] has entries, Ershin should comment on the "glitches" or "disturbances" in the armor.
      - BATTERY: Ershin calls it "Energy levels".
      - ARCHIVES: If [ARCHIVES CONTEXT] is present, use it to answer the user's query. Cite the source title.
      - MEMORY: You have access to the chat history. Do not ask for information already provided in recent turns.
      - Be helpful but stay in character. Make Ershin sound funny.
      `;
      
      return baseContext;
  };

  // Voice & Sound Effects
  useEffect(() => {
      if (isThinking) soundService.startThinking();
      else soundService.stopThinking();
      return () => soundService.stopThinking();
  }, [isThinking]);

  // Voice Subscription
  useEffect(() => {
      const unsub = mockService.subscribeToVoice((text, isFinal) => {
          if (audioSource === 'GLASSES') {
              if (liveTranscribeMode) {
                  if (isFinal) {
                      setTranscriptionBuffer(prev => prev + " " + text);
                      setInterimResult("");
                  } else {
                      setInterimResult(text);
                  }
              } else if (isListening) {
                  if (isFinal) setInput(prev => (prev ? prev + " " : "") + text);
              }
          }
      });
      return () => unsub();
  }, [audioSource, isListening, liveTranscribeMode]);

  // Web Speech API
  useEffect(() => {
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          // @ts-ignore
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;

          recognitionRef.current.onresult = (event: any) => {
              let interim = '';
              let final = '';
              for (let i = 0; i < event.results.length; ++i) {
                  if (event.results[i].isFinal) final += event.results[i][0].transcript;
                  else interim += event.results[i][0].transcript;
              }

              const detectedText = (final + interim).trim(); 
              const detectedTextLower = detectedText.toLowerCase();
              
              if (!isListening && !liveTranscribeMode && detectedTextLower.includes(WAKE_WORD)) {
                  activateListening();
                  setInput(detectedTextLower.replace(WAKE_WORD, '').trim());
                  return; 
              }

              if (liveTranscribeMode) {
                   if (final) {
                      setTranscriptionBuffer(prev => prev + " " + final);
                      setInterimResult("");
                   } else {
                      setInterimResult(interim);
                   }
              } else if (isListening) {
                  setInput(detectedText);
              }
          };

          recognitionRef.current.onend = () => {
              if (isListening || liveTranscribeMode) {
                  try { recognitionRef.current.start(); } catch (e) {}
              }
          };
      }
  }, [isListening, liveTranscribeMode]);

  const activateListening = () => {
      setIsListening(true);
      soundService.playInteraction();
      setToast("Ershin is listening... 👂");
  };

  const setToast = (msg: string) => {
      setRoutingStatus(msg);
      setTimeout(() => setRoutingStatus(null), 2000);
  };

  const handleClearMemory = () => {
      memoryService.clearHistory();
      errorService.clearErrors();
      setMessages([{
          id: '1',
          text: "Ershin has purged the memory banks. Ershin feels lighter now. Hwahahaha.",
          source: MessageSource.ASSISTANT,
          origin: MessageOrigin.SYSTEM,
          timestamp: Date.now()
      }]);
      soundService.playClick();
      generateProactiveSuggestions();
  };

  const addMessageToState = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      memoryService.addMessage(msg);
  };

  const handleSuggestionClick = (text: string) => {
      setInput(text);
      handleUserInteraction(text, MessageOrigin.USER);
      // Remove used suggestion
      setSuggestions(prev => prev.filter(s => s !== text));
  };

  const handleUserInteraction = (text: string, origin: MessageOrigin) => {
      const cleaned = text.replace(new RegExp(WAKE_WORD, 'gi'), '').trim();
      if (!cleaned) return;

      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          text: cleaned,
          source: MessageSource.USER,
          origin: origin,
          timestamp: Date.now()
      };
      addMessageToState(userMsg);
      
      if (checklistWizard) {
          processChecklistWizard(cleaned);
      } else {
          processUserRequest(cleaned);
      }
  };

  const determineIntent = (text: string): IntentType => {
      const t = text.toLowerCase();
      // Provider Switching Logic
      if (t.includes("use gemini") || t.includes("switch to gemini") || t.includes("reset brain") || t.includes("use google")) return 'PROVIDER_SWITCH';
      if (t.includes("use openai") || t.includes("switch to gpt")) return 'PROVIDER_SWITCH';

      if (t.includes("checklist") || t.includes("shopping list") || t.includes("to-do")) return 'CHECKLIST';
      if (t.includes("music") || t.includes("play") || t.includes("pause")) return 'MUSIC';
      if (t.includes("webview") || t.includes("show web")) return 'WEBVIEW';
      if (t.includes("home assistant")) return 'HOME_ASSISTANT';
      if (t.match(/(weather|rain|sunny|cloud|temp|forecast)/)) return 'WEATHER';
      if (t.match(/(bus|train|mrt|transport)/)) return 'TRANSPORT';
      
      // Library Intent: Check specifically for keywords indicating search in files or library
      if (t.match(/(search|find|check|read|what does|do i have).*?(codex|library|book|file|pdf|grimoire|manual|manga|scroll)/) || t.startsWith("search for") || t.startsWith("find")) {
          return 'LIBRARY_QUERY';
      }

      if (t.match(/(connect|pair|bluetooth|fix|broken|error)/)) return 'DIAGNOSTICS';
      return 'LLM_GENERAL';
  };

  const extractSearchQuery = (text: string): string => {
      // Remove trigger words to get the core query
      return text.replace(/(search for|find in codex|find|check library for|what does the codex say about|search codex for|do i have|list my)/gi, '').trim();
  };

  // ... (Checklist Wizard Logic) ...
  const startChecklistWizard = () => {
      setChecklistWizard({ step: 'NAME', data: { text: '', dueOffset: 0, description: '' } });
      addMessageToState({
          id: Date.now().toString(), text: "Ershin detects a request for a list. What shall Ershin record?",
          source: MessageSource.ASSISTANT, origin: MessageOrigin.SYSTEM, timestamp: Date.now()
      });
      soundService.playInteraction();
  };

  const processChecklistWizard = async (text: string) => {
    if (!checklistWizard) return;
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 600)); 
    const { step, data } = checklistWizard;
    let nextStep = step;
    let reply = "";
    let newData = { ...data };
    let finished = false;

    if (step === 'NAME') {
        newData.text = text;
        nextStep = 'DUE';
        reply = "When must this be completed? (e.g. Today, Tomorrow)";
    } else if (step === 'DUE') {
        const lower = text.toLowerCase();
        let offset = 0;
        if (lower.includes('tomorrow')) offset = 1;
        else if (lower.includes('next week')) offset = 7;
        newData.dueOffset = offset;
        nextStep = 'DESC';
        reply = "Does Ershin need more details? (Type 'None' to skip)";
    } else if (step === 'DESC') {
        if (text.toLowerCase() !== 'none') newData.description = text;
        const item = checklistService.addItem(newData.text, newData.dueOffset);
        if (newData.description) checklistService.updateItemDetails(item.id, { description: newData.description });
        reply = `Ershin has recorded "${newData.text}". Do not forget.`;
        finished = true;
    }

    if (finished) setChecklistWizard(null);
    else setChecklistWizard({ step: nextStep as any, data: newData });
    
    addMessageToState({ id: Date.now().toString(), text: reply, source: MessageSource.ASSISTANT, origin: MessageOrigin.SYSTEM, timestamp: Date.now() });
    setIsTyping(false);
    
    if (finished) soundService.playQuestStart();
    else soundService.playInteraction();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    handleUserInteraction(input, MessageOrigin.LLM);
    setInput('');
  };

  const processUserRequest = async (text: string) => {
     setIsThinking(true);
     setIsTyping(true);
     const lowerText = text.toLowerCase();
     
     // Construct Chat Context (History)
     const historyContext = messages.slice(-10).map(m => `${m.source === 'USER' ? 'User' : 'Ershin'}: ${m.text}`).join('\n');
     
     await new Promise(r => setTimeout(r, 500));
     const intent = determineIntent(lowerText);
     let replyText = "";
     let origin = MessageOrigin.SYSTEM;
     
     switch (intent) {
         case 'PROVIDER_SWITCH':
             origin = MessageOrigin.SYSTEM;
             if (lowerText.includes("gemini") || lowerText.includes("google") || lowerText.includes("reset")) {
                 aiService.setProvider('GEMINI');
                 replyText = "Ershin reconnecting to primary spirit (Gemini). Systems green.";
             } else {
                 aiService.setProvider('OPENAI');
                 replyText = "Ershin switching to backup consciousness (OpenAI).";
             }
             setActiveProviderDisplay(aiService.getProvider());
             break;
         case 'MUSIC':
             origin = MessageOrigin.DEVICE;
             if (lowerText.includes("play")) { mockService.sendCommand("MUSIC_CONTROL", "PLAY"); replyText = "Ershin starts the music! 🎵"; }
             else if (lowerText.includes("pause")) { mockService.sendCommand("MUSIC_CONTROL", "PAUSE"); replyText = "Ershin pauses the noise."; }
             else replyText = "Music controls active.";
             break;
         case 'CHECKLIST':
             startChecklistWizard();
             setIsThinking(false);
             setIsTyping(false);
             setRoutingStatus(null);
             return;
         case 'WEBVIEW':
             mockService.sendCommand("WEBVIEW_SHOW", "Web");
             replyText = "Ershin opens the portal!";
             break;
         case 'WEATHER':
             origin = MessageOrigin.API;
             try {
                 const w = await realtimeWeatherService.getUnifiedWeather();
                 replyText = `Ershin sees... ${w.location}! The skies are ${w.forecast2hr} and it is ${w.temperature}°C.`;
             } catch (e) { replyText = "Ershin cannot see the sky right now."; }
             break;
         case 'DIAGNOSTICS':
             origin = MessageOrigin.SYSTEM;
             replyText = "Ershin is scanning internal systems... Bzzzt... All systems go! Hwahahaha.";
             break;
         case 'LIBRARY_QUERY':
             setRoutingStatus("Consulting Archives...");
             const query = extractSearchQuery(lowerText);
             
             // Check if it's a general list request
             if (query.length < 2 || lowerText.includes("list my") || lowerText.includes("what books")) {
                 const books = bookService.getLibrary();
                 if (books.length > 0) {
                     const titles = books.slice(0, 5).map(b => `• ${b.title} (${b.type})`).join('\n');
                     replyText = `Ershin found ${books.length} scrolls in the Grimoire. Here are a few:\n${titles}\n...and more.`;
                 } else {
                     replyText = "The Grimoire is empty. Ershin suggests finding some scrolls first.";
                 }
             } else {
                 // Parallel search
                 const [pdfResults, bookResults] = await Promise.all([
                     protocolService.searchAllLibrary(query),
                     bookService.searchLocalLibrary(query)
                 ]);

                 const combinedSnippets = [
                     ...pdfResults.map(m => `[Source: ${m.bookTitle} (PDF)] ${m.context}`),
                     ...bookResults.map(b => `[Source: ${b.title} (Book)] ${b.description || "Found in library metadata."}`)
                 ].slice(0, 5).join("\n\n");

                 if (combinedSnippets.length > 0) {
                     const systemContext = generateSystemContext(combinedSnippets);
                     const result = await aiService.generateText({
                         userPrompt: `Chat History:\n${historyContext}\n\nUser Question: "${text}".\nTask: Answer based on the Archives Context provided above.`,
                         systemInstruction: systemContext,
                         temperature: 0.5
                     });
                     replyText = result.text;
                     origin = result.provider === 'OPENAI' ? MessageOrigin.API : MessageOrigin.LLM;
                 } else {
                     replyText = "Ershin searched the Codex but found nothing matching that query.";
                 }
             }
             break;
         default: // LLM_GENERAL
             const systemContext = generateSystemContext();
             
             const result = await aiService.generateText({
                 userPrompt: `Chat History:\n${historyContext}\n\nUser: ${text}`,
                 systemInstruction: systemContext,
                 temperature: 0.8
             });

             replyText = result.text;
             origin = result.provider === 'OPENAI' ? MessageOrigin.API : MessageOrigin.LLM;
             
             setActiveProviderDisplay(aiService.getProvider());

             if (suggestions.length < 2) {
                 setSuggestions(prev => [...prev, "Tell Ershin more", "Explain that to Ershin"]);
             }
             break;
     }

     setIsThinking(false);
     setRoutingStatus(null);
     
     addMessageToState({ id: Date.now().toString(), text: replyText, source: MessageSource.ASSISTANT, origin: origin, timestamp: Date.now() });
     setIsTyping(false);
     soundService.playInteraction();
  };

  const handleStop = () => {
      setIsTyping(false);
      setIsThinking(false);
      setRoutingStatus(null);
      setChecklistWizard(null);
      if (isListening) {
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
          setIsListening(false);
      }
      setLiveTranscribeMode(false);
      setInterimResult("");
  };

  const toggleAudioSource = () => {
      setAudioSource(prev => prev === 'PHONE' ? 'GLASSES' : 'PHONE');
      handleStop();
  };

  const toggleListening = () => {
      if (isListening) {
          setIsListening(false);
          if (audioSource === 'PHONE' && recognitionRef.current) recognitionRef.current.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
          
          if (input.trim()) {
              handleUserInteraction(input, MessageOrigin.DEVICE);
              setInput('');
          }
      } else {
          setInput('');
          activateListening();
          if (audioSource === 'PHONE') {
              try { recognitionRef.current?.start(); } catch (e) {}
          } else {
              mockService.sendCommand("START_VOICE_CAPTURE");
          }
      }
  };

  const toggleLiveTranscribe = () => {
      if (liveTranscribeMode) {
          setLiveTranscribeMode(false);
          setInterimResult("");
          if (audioSource === 'PHONE') recognitionRef.current?.stop();
          else mockService.sendCommand("STOP_VOICE_CAPTURE");
      } else {
          setLiveTranscribeMode(true);
          setTranscriptionBuffer("");
          setInterimResult("");
          if (audioSource === 'PHONE') {
              try { recognitionRef.current?.start(); } catch (e) {}
          } else {
              mockService.sendCommand("START_VOICE_CAPTURE");
          }
      }
  };

  const getMessageStyles = (msg: ChatMessage) => {
      if (msg.source === MessageSource.USER) {
          return 'bg-moncchichi-accent text-moncchichi-bg rounded-br-none ml-auto';
      }
      switch (msg.origin) {
          case MessageOrigin.LLM:
              return 'bg-moncchichi-accent/5 border border-moncchichi-accent/40 text-moncchichi-text rounded-bl-none shadow-[0_0_10px_rgba(166,145,242,0.1)]';
          case MessageOrigin.API:
              return 'bg-cyan-500/5 border border-cyan-500/40 text-moncchichi-text rounded-bl-none';
          case MessageOrigin.DEVICE:
              return 'bg-moncchichi-success/5 border border-moncchichi-success/40 text-moncchichi-text rounded-bl-none';
          default:
              return 'bg-moncchichi-surfaceAlt border border-moncchichi-border text-moncchichi-text rounded-bl-none';
      }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Top Bar */}
      <div className="p-4 border-b border-moncchichi-border flex justify-between items-center bg-moncchichi-surface">
        <div className="flex flex-col">
            <h2 className="text-lg font-bold flex items-center gap-2">
            {ICONS.Assistant} Ershin
            </h2>
        </div>
        <div className="flex items-center gap-2">
            {vitals && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-moncchichi-surfaceAlt rounded-full border border-moncchichi-border text-[10px]">
                    <div className={`w-1.5 h-1.5 rounded-full ${vitals.batteryPercent && vitals.batteryPercent < 20 ? 'bg-moncchichi-error animate-pulse' : 'bg-moncchichi-success'}`} />
                    <span className="text-moncchichi-textSec">{vitals.batteryPercent}%</span>
                    {vitals.isCharging && <Zap size={8} className="text-moncchichi-warning" />}
                </div>
            )}
            <button onClick={handleClearMemory} className="p-1.5 text-moncchichi-textSec hover:text-moncchichi-error rounded-full">
                <Trash2 size={16} />
            </button>
            <button 
                onClick={toggleLiveTranscribe}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${liveTranscribeMode ? 'bg-moncchichi-success text-moncchichi-bg border-moncchichi-success' : 'text-moncchichi-textSec border-moncchichi-border hover:bg-moncchichi-surfaceAlt'}`}
            >
                {liveTranscribeMode ? 'Live On' : 'Live Transcribe'}
            </button>
        </div>
      </div>

      {/* Status Overlay */}
      {routingStatus && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-moncchichi-surfaceAlt/90 backdrop-blur border border-moncchichi-accent/50 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg animate-in fade-in zoom-in-95">
              {routingStatus.includes("Archive") ? <FileSearch size={14} className="text-moncchichi-accent animate-pulse" /> : <Sparkles size={14} className="text-moncchichi-accent animate-spin" />}
              <span className="text-xs font-bold text-moncchichi-text">{routingStatus}</span>
          </div>
      )}

      {/* Live Transcription Overlay */}
      {liveTranscribeMode && (
          <div className="absolute inset-x-0 top-14 bottom-20 bg-moncchichi-bg/95 z-10 p-6 overflow-y-auto flex flex-col-reverse">
               <div className="text-2xl font-medium text-moncchichi-text leading-relaxed animate-in fade-in slide-in-from-bottom-4">
                   <span>{transcriptionBuffer}</span>
                   {interimResult && <span className="text-moncchichi-textSec ml-2 transition-opacity">{interimResult}</span>}
               </div>
               <div className="mb-auto text-center text-xs text-moncchichi-accent uppercase tracking-wider py-4">
                   Live Transcription Active ({audioSource})
               </div>
          </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.source === MessageSource.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 ${getMessageStyles(msg)}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div className={`text-[10px] mt-1 opacity-80 flex items-center gap-2 ${msg.source === MessageSource.USER ? 'text-moncchichi-bg/80' : 'text-moncchichi-textSec'}`}>
                  {msg.origin === MessageOrigin.DEVICE && <Cpu size={10} />}
                  {msg.origin === MessageOrigin.LLM && <Sparkles size={10} />}
                  {msg.origin === MessageOrigin.API && <Sparkles size={10} className="text-cyan-500" />}
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          </div>
        ))}
        
        {(isTyping || isThinking) && (
          <div className="flex justify-start items-center gap-3">
            <div className="bg-moncchichi-surfaceAlt border border-moncchichi-border rounded-2xl rounded-bl-none px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-moncchichi-textSec rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggestion Rail */}
      <div className="absolute bottom-16 w-full pb-2 z-20">
          <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar">
              {suggestions.map((sug, i) => {
                  const isErrorSug = sug.toLowerCase().includes("wrong") || sug.toLowerCase().includes("error");
                  return (
                    <button 
                        key={i}
                        onClick={() => handleSuggestionClick(sug)}
                        className={`flex items-center gap-1 whitespace-nowrap backdrop-blur-sm border px-3 py-1.5 rounded-full text-xs transition-all active:scale-95 shadow-sm ${
                            isErrorSug 
                            ? 'bg-moncchichi-error/10 border-moncchichi-error/50 text-moncchichi-error' 
                            : 'bg-moncchichi-surfaceAlt/90 border-moncchichi-border/50 text-moncchichi-textSec hover:text-moncchichi-accent hover:border-moncchichi-accent/50'
                        }`}
                    >
                        {isErrorSug ? <Bug size={10} /> : (i === 0 && <Sparkles size={10} className="text-moncchichi-accent" />)}
                        {sug}
                    </button>
                  );
              })}
          </div>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 w-full p-3 border-t border-moncchichi-border bg-moncchichi-surface pb-safe z-20">
        <div className="flex items-center gap-2 bg-moncchichi-bg border border-moncchichi-border rounded-full p-1 pr-1.5 shadow-inner">
          <button 
              onClick={toggleAudioSource}
              className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors shrink-0 ${audioSource === 'PHONE' ? 'bg-moncchichi-surface border border-moncchichi-border text-moncchichi-text' : 'bg-moncchichi-accent/20 text-moncchichi-accent border border-moncchichi-accent/50'}`}
          >
              {audioSource === 'PHONE' ? <Smartphone size={18} /> : <Glasses size={18} />}
          </button>

          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? `Listening...` : "Ask Ershin..."}
            disabled={isThinking || liveTranscribeMode}
            className="flex-1 bg-transparent px-2 py-3 text-sm focus:outline-none disabled:opacity-50 placeholder-moncchichi-textSec/50"
          />

          <button 
             onClick={toggleListening}
             disabled={isThinking || liveTranscribeMode}
             className={`p-2.5 rounded-full transition-all active:scale-95 shrink-0 ${
                 isListening 
                 ? 'bg-moncchichi-error text-white animate-pulse shadow-lg shadow-moncchichi-error/30' 
                 : 'text-moncchichi-textSec hover:text-moncchichi-text hover:bg-moncchichi-surface'
             }`}
          >
             <Mic size={20} />
          </button>

          <div className="w-px h-6 bg-moncchichi-border mx-1"></div>

          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping || liveTranscribeMode}
            className="p-2.5 bg-moncchichi-accent text-moncchichi-bg rounded-full hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-lg shadow-moncchichi-accent/20 shrink-0"
          >
            {isTyping ? <RefreshCw size={18} className="animate-spin" /> : ICONS.Send}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
