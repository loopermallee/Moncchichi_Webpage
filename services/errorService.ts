
import { mockService } from './mockService';
import { LogEntry } from '../types';

export interface AnalyzedError {
  id: string;
  timestamp: number;
  source: string;
  technicalMessage: string;
  quirkyMessage: string;
}

class ErrorService {
  private errors: AnalyzedError[] = [];
  private listeners: ((error: AnalyzedError) => void)[] = [];
  
  // A bank of quirky prefixes/templates for immediate feedback
  private quirkyTemplates = [
    "I spy with my little eye something broken: ",
    "Uh oh, the gremlins are chewing the wires again: ",
    "My crystal ball is foggy regarding ",
    "Yikes! I tripped over a bit of code: ",
    "Whoopsie! The internet ghosts are haunting ",
    "System hiccup! I think it was ",
    "Alert! Alert! The magic smoke escaped from ",
    "I tried to fetch that, but my digital dog ate it: "
  ];

  constructor() {
    // Listen to raw logs to auto-capture errors
    mockService.subscribeToLogs((entry) => {
      if (entry.level === 'ERROR') {
        this.registerError(entry.tag, entry.message);
      }
    });
  }

  private getRandomQuirk(): string {
    return this.quirkyTemplates[Math.floor(Math.random() * this.quirkyTemplates.length)];
  }

  public registerError(source: string, message: string) {
    // Deduplicate: Don't spam if the exact same error happened in the last 2 seconds
    const lastError = this.errors[this.errors.length - 1];
    if (lastError && lastError.technicalMessage === message && (Date.now() - lastError.timestamp < 2000)) {
        return;
    }

    const quirkyMsg = `${this.getRandomQuirk()} ${source.toLowerCase()}.`;

    const newError: AnalyzedError = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      source,
      technicalMessage: message,
      quirkyMessage: quirkyMsg
    };

    this.errors.push(newError);
    
    // Keep buffer small
    if (this.errors.length > 20) this.errors.shift();

    this.notifyListeners(newError);
  }

  public subscribe(callback: (error: AnalyzedError) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(error: AnalyzedError) {
    this.listeners.forEach(l => l(error));
  }

  public getRecentErrors(): AnalyzedError[] {
    return [...this.errors];
  }

  public hasRecentErrors(): boolean {
      // Consider "recent" as in the last session or manual clear
      return this.errors.length > 0;
  }

  public clearErrors() {
      this.errors = [];
  }

  public getContextSummary(): string {
      if (this.errors.length === 0) return "System Health: 100% Awesome. No recent errors.";
      
      const list = this.errors.slice(-5).map(e => 
          `- [${new Date(e.timestamp).toLocaleTimeString()}] ${e.source}: ${e.technicalMessage}`
      ).join('\n');
      
      return `System Health: Glitchy.\nRecent Errors:\n${list}`;
  }
}

export const errorService = new ErrorService();
