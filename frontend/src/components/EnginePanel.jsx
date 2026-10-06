import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const EnginePanel = ({ mt5Path, onPathChange, logs = [], isRunning, onToggle, onClearLogs }) => {
    const { t } = useLanguage();
    const scrollViewportRef = useRef(null);
    const [isCopied, setIsCopied] = useState(false);

    // Auto-scroll to the bottom of the logs whenever a new log arrives
    useEffect(() => {
        if (scrollViewportRef.current) {
            const { scrollHeight, clientHeight } = scrollViewportRef.current;
            if (scrollHeight > clientHeight) {
                scrollViewportRef.current.scrollTop = scrollHeight;
            }
        }
    }, [logs]);

    const choosePath = async () => {
        if(window.eel) {
            const path = await window.eel.choose_mt5_path()();
            if(path) onPathChange(path);
        }
    };

    const handleCopyLogs = async () => {
        if (!logs.length) return;
        
        // Format logs beautifully for the clipboard
        const logText = logs.map(l => `[${l.time}] ${l.message}`).join('\n');
        
        try {
            await navigator.clipboard.writeText(logText);
            setIsCopied(true);
            // Revert back to copy icon after 2 seconds
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <div className="flex flex-col gap-6 font-sans h-full">
            
            {/* --- Control Center --- */}
            <div className={`relative flex min-h-[180px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border bg-[#1A191E] p-6 ${isRunning ? 'border-emerald-500/30' : 'border-[#2F2E35]'}`}>

                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-6 relative z-10">{t('trading_engine')}</h3>
                
                <button 
                    onClick={onToggle} 
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 outline-none ${
                        isRunning 
                        ? 'bg-emerald-500 text-white shadow-[0_0_50px_-10px_#10b981] scale-105' 
                        : 'bg-[#18181b] border-2 border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-300 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 transition-all duration-500 ${isRunning ? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    
                    {isRunning && (
                        <span className="absolute inset-0 rounded-full border border-white/50 animate-ping opacity-50"></span>
                    )}
                </button>
                
                <div className="mt-5 relative z-10 flex flex-col items-center h-10 justify-start">
                    <span className={`text-xs font-bold transition-all duration-300 ${isRunning ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-zinc-500'}`}>
                        {isRunning ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
                    </span>
                    <span className={`text-[9px] text-emerald-500/60 mt-1 font-mono transition-opacity duration-300 ${isRunning ? 'opacity-100' : 'opacity-0'}`}>
                        Processing Ticks...
                    </span>
                </div>
            </div>

            {/* --- Path Settings --- */}
            <div className="shrink-0 rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">{t('terminal_path')}</label>
                    <span className={`w-2 h-2 rounded-full ${mt5Path ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                </div>
                <div className="flex gap-2 bg-[#09090b] p-1.5 rounded-xl border border-white/5 focus-within:border-emerald-500/30 transition-colors">
                    <input 
                        type="text" 
                        value={mt5Path || "Not Selected"} 
                        readOnly
                        className="flex-1 bg-transparent border-none outline-none px-2 text-[10px] text-zinc-400 font-mono truncate" 
                    />
                    <button onClick={choosePath} className="px-3 bg-white/5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-bold transition-colors">
                        BROWSE
                    </button>
                </div>
            </div>

            {/* --- Console Logs --- */}
            {}
            <div className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E]">
                
                <div className="group flex shrink-0 items-center justify-between border-b border-[#2F2E35] bg-[#1E1D22] px-4 py-3">
                     <div className="flex items-center gap-2">
                         <svg className="w-3 h-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3" /></svg>
                         <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('live_logs')}</h3>
                     </div>
                     
                     <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                        {/* Copy Logs Button */}
                        <button 
                            onClick={handleCopyLogs} 
                            disabled={!logs.length}
                            className="p-1.5 rounded-md bg-white/5 hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Copy All Logs"
                        >
                            {isCopied ? (
                                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            )}
                        </button>
                        
                        {/* Clear Logs Button */}
                        <button 
                            onClick={onClearLogs} 
                            disabled={!logs.length}
                            className="p-1.5 rounded-md bg-white/5 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Clear Console"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                     </div>
                </div>
                
                {}
                <div 
                    ref={scrollViewportRef}
                    className="h-96 overflow-y-auto custom-scroll space-y-2 bg-[#141318] p-4 font-mono text-[10px] scroll-smooth"
                >
                    <div className="text-zinc-600 border-l-2 border-zinc-800 pl-2">System Initialized. Waiting for commands...</div>
                    {logs.map((log, index) => (
                        <div key={index} className="flex gap-2">
                            <span className="opacity-50 text-[9px] text-zinc-600 shrink-0 mt-0.5">[{log.time}]</span>
                            {/* whitespace-pre-wrap ensures multi-line python tracebacks render perfectly */}
                            <div className={`flex-1 pl-2 border-l-2 leading-relaxed break-words whitespace-pre-wrap animate-fade-in ${
                                log.color.includes('rose') ? 'border-rose-500/50 text-rose-400 bg-rose-500/5 py-1 pr-1' : 
                                log.color.includes('emerald') ? 'border-emerald-500/50 text-emerald-400' : 
                                log.color.includes('yellow') ? 'border-yellow-500/50 text-yellow-400' : 'border-zinc-700 text-zinc-400'
                            }`}>
                                {log.message}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EnginePanel;