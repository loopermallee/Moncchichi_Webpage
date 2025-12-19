
import React, { useRef, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const PdfPage = React.memo(({ pdfDoc, pageNum, width, searchQuery }: { pdfDoc: any, pageNum: number, width: number, searchQuery?: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState<'LOADING' | 'RENDERED' | 'ERROR'>('LOADING');
    const [textItems, setTextItems] = useState<any[]>([]);
    const [pageViewport, setPageViewport] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current || width <= 0) return;
            try {
                const page = await pdfDoc.getPage(pageNum);
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const availWidth = width - 48; 
                const scale = availWidth / unscaledViewport.width;
                const viewport = page.getViewport({ scale });
                setPageViewport(viewport);

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (context) {
                    const outputScale = window.devicePixelRatio || 1;
                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);
                    canvas.style.width = Math.floor(viewport.width) + "px";
                    canvas.style.height = Math.floor(viewport.height) + "px";
                    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
                    const renderContext = { canvasContext: context, viewport: viewport, transform };
                    await page.render(renderContext).promise;
                    const textContent = await page.getTextContent();
                    if (isMounted) { setTextItems(textContent.items); setStatus('RENDERED'); }
                }
            } catch (e) { if (isMounted) setStatus('ERROR'); }
        };
        renderPage();
        return () => { isMounted = false; };
    }, [pdfDoc, pageNum, width]);

    const renderHighlightedText = (text: string) => {
        if (!searchQuery || searchQuery.trim().length < 2) return text;
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => regex.test(part) ? <span key={i} className="bg-yellow-400/40">{part}</span> : part);
    };

    return (
        <div className="flex flex-col items-center mb-6 relative group">
            <div className="text-[10px] text-moncchichi-textSec font-mono mb-2 opacity-50">--- Page {pageNum} ---</div>
            <div className={`relative shadow-lg rounded-sm ${status === 'LOADING' ? 'bg-moncchichi-surfaceAlt animate-pulse min-h-[300px] w-full' : ''}`} style={{ width: pageViewport ? pageViewport.width : '100%', height: pageViewport ? pageViewport.height : 'auto' }}>
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
                {status === 'RENDERED' && pageViewport && (
                    <div className="absolute inset-0 overflow-hidden leading-none select-text" style={{ color: 'transparent' }}>
                        {textItems.map((item: any, idx: number) => {
                            const tx = item.transform; 
                            const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
                            const fontHeightScaled = fontHeight * pageViewport.scale;
                            const x = tx[4] * pageViewport.scale;
                            const y = pageViewport.height - (tx[5] * pageViewport.scale) - fontHeightScaled;
                            const width = item.width * pageViewport.scale;
                            return ( <span key={idx} className="absolute whitespace-pre cursor-text" style={{ left: `${x}px`, top: `${y}px`, fontSize: `${fontHeightScaled}px`, fontFamily: 'sans-serif', transformOrigin: '0% 0%', width: `${width}px`, height: `${fontHeightScaled}px` }}>{renderHighlightedText(item.str)}</span> );
                        })}
                    </div>
                )}
                {status === 'LOADING' && ( <div className="absolute inset-0 flex items-center justify-center z-10"><Loader2 size={24} className="animate-spin text-moncchichi-textSec" /></div> )}
            </div>
        </div>
    );
});

export default PdfPage;
