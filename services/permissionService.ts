
import { settingsService } from './settingsService';
import { mockService } from './mockService';
import { BLE_UUIDS } from '../constants';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';
export type PermissionId = 'bluetooth' | 'location' | 'microphone' | 'notifications';

const STORAGE_KEY = 'moncchichi_permissions';

class PermissionService {
  private state: Record<PermissionId, PermissionStatus> = {
    bluetooth: 'prompt',
    location: 'prompt',
    microphone: 'prompt',
    notifications: 'prompt'
  };
  
  private listeners: (() => void)[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = { ...this.state, ...JSON.parse(stored) };
      }
    } catch (e) {
        console.error("Failed to load permissions", e);
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.notifyListeners();
  }

  public subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
      this.listeners.forEach(l => l());
  }

  public getStatus(id: PermissionId): PermissionStatus {
    // If simulating, always return granted for core features to allow UI testing
    if (settingsService.get('isSimulating')) return 'granted';
    return this.state[id];
  }

  public updateStatus(id: PermissionId, status: PermissionStatus) {
    this.state[id] = status;
    this.save();
  }

  // Sync with actual browser APIs
  public async syncWithBrowser() {
      if (settingsService.get('isSimulating')) return;

      // 1. Microphone
      try {
          // @ts-ignore
          const micStatus = await navigator.permissions.query({ name: 'microphone' });
          this.updateStatus('microphone', micStatus.state);
      } catch (e) {}

      // 2. Location
      try {
          // @ts-ignore
          const locStatus = await navigator.permissions.query({ name: 'geolocation' });
          this.updateStatus('location', locStatus.state);
      } catch (e) {}

      // 3. Notifications
      if (typeof Notification !== 'undefined') {
         const notifStatus = Notification.permission === 'granted' ? 'granted' : (Notification.permission === 'denied' ? 'denied' : 'prompt');
         this.updateStatus('notifications', notifStatus);
      }

      // 4. Bluetooth (Approximation via existing connection)
      // @ts-ignore
      if (navigator.bluetooth && navigator.bluetooth.getDevices) {
          try {
              // @ts-ignore
              const devices = await navigator.bluetooth.getDevices();
              if (devices.length > 0 || mockService.getConnectionState() === 'CONNECTED') {
                  this.updateStatus('bluetooth', 'granted');
              }
          } catch (e) {}
      }
  }

  public async requestPermission(id: PermissionId): Promise<void> {
      // Persist "intent" immediately to handle UI updates
      this.updateStatus(id, 'prompt');
      
      try {
          if (id === 'microphone') {
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                  await navigator.mediaDevices.getUserMedia({ audio: true });
                  this.updateStatus('microphone', 'granted');
              } else {
                  throw new Error("Media Devices API not supported");
              }
          } else if (id === 'notifications') {
              if (typeof Notification !== 'undefined') {
                  const result = await Notification.requestPermission();
                  this.updateStatus('notifications', result === 'granted' ? 'granted' : 'denied');
              } else {
                  throw new Error("Notifications API not supported");
              }
          } else if (id === 'location') {
              if (navigator.geolocation) {
                  await new Promise((resolve, reject) => {
                      navigator.geolocation.getCurrentPosition(
                          (pos) => {
                              this.updateStatus('location', 'granted');
                              resolve(pos);
                          }, 
                          (err) => {
                              if (err.code === 1) { // PERMISSION_DENIED
                                  this.updateStatus('location', 'denied');
                              }
                              reject(err);
                          }
                      );
                  });
              } else {
                  throw new Error("Geolocation API not supported");
              }
          } else if (id === 'bluetooth') {
               // @ts-ignore
               if (navigator.bluetooth) {
                   // @ts-ignore
                   await navigator.bluetooth.requestDevice({ 
                       acceptAllDevices: true,
                       optionalServices: [BLE_UUIDS.SERVICE] 
                   });
                   this.updateStatus('bluetooth', 'granted');
               } else {
                   // Simulate grant if API missing but app handles it gracefully
                   this.updateStatus('bluetooth', 'granted');
               }
          }
      } catch (e: any) {
          if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
              this.updateStatus(id, 'denied');
          }
          throw e;
      }
  }
}

export const permissionService = new PermissionService();
