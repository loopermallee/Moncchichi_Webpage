import React from 'react';

export const formatDisplayTitle = (title: string): React.ReactNode => {
    // Helper to render the tag
    const renderWithTag = (type: 'ADULT' | 'PAEDS', cleanTitle: string) => (
        React.createElement('span', { className: "flex items-center gap-2 truncate" },
            React.createElement('span', {
                className: `px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                    type === 'PAEDS' 
                    ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' 
                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                }`
            }, type === 'PAEDS' ? 'Paeds' : 'Adult'),
            React.createElement('span', { className: "truncate" }, cleanTitle)
        )
    );

    if (!title) return '';

    let cleanedTitle = title.trim();
    let explicitType: 'ADULT' | 'PAEDS' | null = null;

    // 0. Detect and strip trailing "(Adults)", "(Adult)", "(Paeds)", "(Paediatrics)" etc.
    const trailingMatch = cleanedTitle.match(/\s*\(([^)]+)\)\s*$/i);
    if (trailingMatch) {
        const label = trailingMatch[1].trim().toLowerCase();
        if (['adult', 'adults'].includes(label)) {
            explicitType = 'ADULT';
        } else if (
            ['paeds', 'paed', 'paediatric', 'paediatrics', 'peds', 'pediatrics'].includes(
                label
            )
        ) {
            explicitType = 'PAEDS';
        }

        if (explicitType) {
            // Remove the trailing "(...)" part from the title
            cleanedTitle = cleanedTitle.slice(0, trailingMatch.index).trim();
        }
    }

    // 1. CPG/EMS-SOP Format
    // Handles: CPG-10A Title, CPG-10-A, CPG-10 A, EMS-SOP 12P
    const cpgMatch = cleanedTitle.match(
        /^(?:CPG|EMS-SOP)[-\s_]+(\d+)?(?:[-\s_]*([APap]))?(?:[-\s_.]+)(.+)$/i
    );

    if (cpgMatch) {
        const [, _idNumber, apChar, restTitle] = cpgMatch;
        let typeFromId: 'ADULT' | 'PAEDS' | null = null;

        if (apChar) {
            const ch = apChar.toUpperCase();
            if (ch === 'A') typeFromId = 'ADULT';
            if (ch === 'P') typeFromId = 'PAEDS';
        }

        const finalType = explicitType || typeFromId;
        const cleanTitle = restTitle.trim();

        if (finalType) {
            return renderWithTag(finalType, cleanTitle);
        }
        return cleanTitle;
    }

    // 2. Simple Prefix Format (e.g. "A Title", "P_Title")
    const prefixMatch = cleanedTitle.match(/^([APap])[\s-_]+(.+)/);
    if (prefixMatch) {
        const prefix = prefixMatch[1].toUpperCase();
        const cleanTitle = prefixMatch[2].trim();
        let typeFromPrefix: 'ADULT' | 'PAEDS' | null = null;

        if (prefix === 'A') typeFromPrefix = 'ADULT';
        if (prefix === 'P') typeFromPrefix = 'PAEDS';

        const finalType = explicitType || typeFromPrefix;
        if (finalType) {
            return renderWithTag(finalType, cleanTitle);
        }
        return cleanTitle;
    }

    // 3. Generic "CPG-Title" / "EMS-SOP-Title" without ID / suffix
    if (/^(?:CPG|EMS-SOP)[-\s_.]+/i.test(cleanedTitle)) {
        const stripped = cleanedTitle.replace(/^(?:CPG|EMS-SOP)[-\s_.]+/i, '').trim();
        if (explicitType) {
            return renderWithTag(explicitType, stripped);
        }
        return stripped;
    }

    // 4. If only the trailing "(Adults)/(Paeds)" told us the type, use that
    if (explicitType) {
        return renderWithTag(explicitType, cleanedTitle);
    }

    // 5. Fallback: return as-is
    return cleanedTitle;
};

export const formatFileSize = (bytes: number) => { return (bytes / 1024 / 1024).toFixed(2) + " MB"; };
export const formatTimestamp = (ts: number) => { if (!ts) return "Unknown"; return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }); };
export const getUploadDate = (bookId: string) => {
    const parts = bookId.split(/-(.+)/); 
    if (parts.length > 1) { const ts = parseInt(parts[1], 10); if (!isNaN(ts)) return formatTimestamp(ts); }
    return "Unknown";
};