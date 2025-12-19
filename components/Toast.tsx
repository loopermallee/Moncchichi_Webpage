
import React, { useEffect } from 'react';
import { ICONS } from '../constants';
import { Sparkles, Bot } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'ai';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 4000); // Slightly longer for AI reading time
        return () => clearTimeout(timer);
    }, [onClose, message]);

    const bgColors = {
        success: 'bg-moncchichi-surfaceAlt border-moncchichi-success text-moncchichi-success',
        error: 'bg-moncchichi-surfaceAlt border-moncchichi-error text-moncchichi-error',
        info: 'bg-moncchichi-surfaceAlt border-moncchichi-accent text-moncchichi-accent',
        ai: 'bg-indigo-950/90 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 backdrop-blur-md',
    };

    const getIcon = () => {
        switch(type) {
            case 'success': return ICONS.CheckCircle;
            case 'error': return ICONS.XCircle;
            case 'info': return ICONS.Glasses;
            case 'ai': return <Bot size={24} className="text-indigo-300" />;
        }
    };

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex items-start gap-4 px-5 py-4 rounded-2xl border shadow-2xl animate-in slide-in-from-top-5 zoom-in-95 duration-300 max-w-[90vw] sm:max-w-md ${bgColors[type]}`}>
            {/* Icon Wrapper with Animation for AI */}
            <div className={`shrink-0 mt-0.5 relative ${type === 'ai' ? 'animate-pulse' : ''}`}>
                {type === 'ai' && (
                    <div className="absolute inset-0 bg-indigo-400 rounded-full blur-lg opacity-30 animate-ping"></div>
                )}
                {getIcon()}
            </div>
            
            <div className="flex flex-col">
                {type === 'ai' && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 mb-1 flex items-center gap-1">
                        <Sparkles size={10} /> Moncchichi Insight
                    </span>
                )}
                <span className={`text-sm font-medium leading-relaxed ${type === 'ai' ? 'text-gray-100' : 'text-moncchichi-text'}`}>
                    {message}
                </span>
            </div>
        </div>
    );
};

export default Toast;
