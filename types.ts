
export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export type RecurrenceType = 'DAILY' | 'WEEKLY' | 'CUSTOM';

export interface RecurrenceConfig {
  type: RecurrenceType;
  intervalDays: number;
  lastCompletedAt?: number;
  nextDueAt?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  dueDate: number; // timestamp for "When to do"
  createdAt: number;
  subtasks: Subtask[];
  recurrence?: RecurrenceConfig;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface DeviceVitals {
  batteryPercent: number;
  caseBatteryPercent: number;
  firmwareVersion: string;
  hardwareId: string;
  signalRssi: number;
  isCharging: boolean;
  isWorn: boolean;
  inCase: boolean;
  uptimeSeconds: number;
  brightness: number;
  silentMode: boolean;
  leftLensName: string;
  rightLensName: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  tag: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
}

export enum HeadsetState {
  WORN = 'WORN',
  IDLE = 'IDLE',
  CHARGING = 'CHARGING'
}

export enum MessageSource {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT'
}

export enum MessageOrigin {
  SYSTEM = 'SYSTEM',
  DEVICE = 'DEVICE',
  LLM = 'LLM',
  API = 'API',
  USER = 'USER'
}

export interface ChatMessage {
  id: string;
  text: string;
  source: MessageSource;
  origin: MessageOrigin;
  timestamp: number;
}
