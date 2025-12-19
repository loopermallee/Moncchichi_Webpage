
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { permissionService, PermissionId, PermissionStatus } from '../services/permissionService';
import Toast, { ToastType } from '../components/Toast';

interface PermissionItem {
  id: PermissionId;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const Permissions: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [permissions] = useState<PermissionItem[]>([
    {
      id: 'bluetooth',
      title: 'Bluetooth',
      description: 'Required to connect to G1 glasses and sync data.',
      icon: ICONS.BluetoothConnected,
    },
    {
      id: 'location',
      title: 'Location',
      description: 'Required for Bluetooth Low Energy scanning on Android.',
      icon: ICONS.MapPin,
    },
    {
      id: 'microphone',
      title: 'Microphone',
      description: 'Required for AI Assistant voice commands.',
      icon: ICONS.MicOn,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Required to keep the connection alive in the background.',
      icon: ICONS.Bell,
    }
  ]);

  const [statuses, setStatuses] = useState<Record<PermissionId, PermissionStatus>>({
      bluetooth: permissionService.getStatus('bluetooth'),
      location: permissionService.getStatus('location'),
      microphone: permissionService.getStatus('microphone'),
      notifications: permissionService.getStatus('notifications')
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{message: string, type: ToastType} | null>(null);

  useEffect(() => {
    permissionService.syncWithBrowser();
    const unsub = permissionService.subscribe(() => {
        setStatuses({
            bluetooth: permissionService.getStatus('bluetooth'),
            location: permissionService.getStatus('location'),
            microphone: permissionService.getStatus('microphone'),
            notifications: permissionService.getStatus('notifications')
        });
    });
    return unsub;
  }, []);

  const handleRequest = async (id: PermissionId) => {
      const currentStatus = statuses[id];
      if (currentStatus === 'denied') {
          setToast({ message: "Permission blocked. Check browser settings.", type: "error" });
          return;
      }

      try {
          await permissionService.requestPermission(id);
      } catch (e: any) {
          // Errors handled in service or via status updates
          if (e.name === 'NotFoundError' || e.message.includes('cancelled')) {
              // User cancelled, no error toast needed
          } else {
               setToast({ message: "Request failed. Check console.", type: "error" });
          }
      }
  };

  const handleAllowAll = async () => {
    setLoading(true);
    for (const p of permissions) {
      if (statuses[p.id] === 'prompt') {
        try {
            await permissionService.requestPermission(p.id);
        } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
      }
    }
    setLoading(false);
  };

  const allGranted = Object.values(statuses).every(s => s === 'granted');

  return (
    <div className="flex flex-col h-full bg-moncchichi-bg relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="p-4 border-b border-moncchichi-border bg-moncchichi-surface flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-moncchichi-textSec hover:text-moncchichi-text">
          {ICONS.Back}
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2">
          {ICONS.Shield} Permissions
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-moncchichi-surfaceAlt/50 rounded-lg p-4 text-sm text-moncchichi-textSec border border-moncchichi-border">
          Moncchichi Hub saves your preferences locally. Grant permissions once to enable features.
        </div>

        <div className="space-y-3">
          {permissions.map(item => {
            const status = statuses[item.id];
            return (
                <div key={item.id} className={`bg-moncchichi-surface rounded-xl p-4 border ${status === 'denied' ? 'border-moncchichi-error/30' : 'border-moncchichi-border'} flex items-start gap-4`}>
                <div className={`p-2 rounded-lg ${status === 'granted' ? 'bg-moncchichi-success/10 text-moncchichi-success' : (status === 'denied' ? 'bg-moncchichi-error/10 text-moncchichi-error' : 'bg-moncchichi-surfaceAlt text-moncchichi-text')}`}>
                    {item.icon}
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold text-sm ${status === 'denied' ? 'text-moncchichi-error' : 'text-moncchichi-text'}`}>{item.title}</h3>
                    {status === 'granted' ? (
                        <span className="text-moncchichi-success">{ICONS.CheckCircle}</span>
                    ) : (
                        <button 
                        onClick={() => handleRequest(item.id)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                            status === 'denied' 
                            ? 'bg-moncchichi-error/10 text-moncchichi-error hover:bg-moncchichi-error/20' 
                            : 'bg-moncchichi-accent text-moncchichi-bg hover:opacity-90'
                        }`}
                        >
                        {status === 'denied' ? 'Blocked' : 'Allow'}
                        </button>
                    )}
                    </div>
                    <p className="text-xs text-moncchichi-textSec leading-relaxed">
                    {item.description}
                    {status === 'denied' && (
                        <span className="block mt-1 text-moncchichi-error font-bold">
                            ⚠️ Access blocked. Check browser settings.
                        </span>
                    )}
                    </p>
                </div>
                </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-moncchichi-surface border-t border-moncchichi-border pb-safe">
        <button 
          onClick={handleAllowAll}
          disabled={loading || allGranted}
          className="w-full h-12 bg-moncchichi-accent text-moncchichi-bg rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-moncchichi-bg border-t-transparent rounded-full animate-spin" />
          ) : (
            ICONS.Check
          )}
          {allGranted ? 'All Permissions Granted' : 'Allow All Permissions'}
        </button>
      </div>
    </div>
  );
};

export default Permissions;
