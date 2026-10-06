import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

// 🛠 کامپوننت ایزوله Tooltip که مشکل تداخل هاور را حل می‌کند
const InfoTooltip = ({ text }) => (
    <div className="relative flex items-center group/tip cursor-help ml-1.5 z-50">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500 group-hover/tip:text-white transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-zinc-800 text-zinc-200 text-[10px] leading-relaxed rounded-lg opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all shadow-2xl pointer-events-none border border-white/10 text-center">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800"></div>
        </div>
    </div>
);

const RiskPanel = ({ initialData, nextNews }) => {
    const { t, lang } = useLanguage();
    
    const [isSaving, setIsSaving] = useState(false);
    
    // --- State: System & Broker Settings (Synced with Python Keys) ---
    const [marginEnabled, setMarginEnabled] = useState(false);
    const [marginLimit, setMarginLimit] = useState('50');
    
    const [wuEnabled, setWuEnabled] = useState(true);
    const [wuCandles, setWuCandles] = useState('500');

    const [nfEnabled, setNfEnabled] = useState(false);
    const [nfEur, setNfEur] = useState(true);
    const [nfUsd, setNfUsd] = useState(true);
    const [nfBefore, setNfBefore] = useState('30');
    const [nfAfter, setNfAfter] = useState('30');

    // --- State: Global Risk Protections (Synced with Python Keys) ---
    const [beEnabled, setBeEnabled] = useState(false);
    const [beTrigger, setBeTrigger] = useState('1.0');
    
    const [pcEnabled, setPcEnabled] = useState(false);
    const [pcVolume, setPcVolume] = useState('50');
    const [pcTrigger, setPcTrigger] = useState('2.0');

    const [tlEnabled, setTlEnabled] = useState(false);
    const [tlTrigger, setTlTrigger] = useState('10200.0');

    useEffect(() => {
        if (initialData) {
            setMarginEnabled(initialData?.margin_enabled || false);
            setMarginLimit(initialData?.margin_limit || '50');

            setWuEnabled(initialData?.wu_enabled !== undefined ? initialData.wu_enabled : true);
            setWuCandles(initialData?.wu_candles || '500');

            setNfEnabled(initialData?.nf_enabled || false);
            setNfEur(initialData?.nf_eur !== undefined ? initialData.nf_eur : true);
            setNfUsd(initialData?.nf_usd !== undefined ? initialData.nf_usd : true);
            setNfBefore(initialData?.nf_before || '30');
            setNfAfter(initialData?.nf_after || '30');

            setBeEnabled(initialData?.be_enabled || false);
            setBeTrigger(initialData?.be_trigger || '1.0');
            
            setPcEnabled(initialData?.pc_enabled || false);
            setPcVolume(initialData?.pc_volume || '50');
            setPcTrigger(initialData?.pc_trigger || '2.0');
            
            setTlEnabled(initialData?.tl_enabled || false);
            setTlTrigger(initialData?.tl_trigger || '10200.0');
        }
    }, [initialData]);

    const handleSave = async () => {
        setIsSaving(true);
        const config = {
            mt5_path: initialData?.mt5_path || "",
            margin_enabled: marginEnabled,
            margin_limit: marginLimit,
            wu_enabled: wuEnabled,
            wu_candles: wuCandles,
            nf_enabled: nfEnabled,
            nf_eur: nfEur,
            nf_usd: nfUsd,
            nf_before: nfBefore,
            nf_after: nfAfter,
            be_enabled: beEnabled,
            be_trigger: beTrigger,
            pc_enabled: pcEnabled,
            pc_volume: pcVolume,
            pc_trigger: pcTrigger,
            tl_enabled: tlEnabled,
            tl_trigger: tlTrigger
        };
        
        if (window.eel) await window.eel.save_user_config(config)();
        setTimeout(() => setIsSaving(false), 800);
    };

    const handleNewsToggle = async (event) => {
        const enabled = event.target.checked;
        setNfEnabled(enabled);
        if (window.eel) {
            try {
                await window.eel.save_user_config({ nf_enabled: enabled })();
            } catch (error) {
                console.error('Could not persist News Filter toggle:', error);
            }
        }
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#121215] shadow-xl h-full min-h-[500px] flex flex-col group">
            <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>

            <div className="flex-1 p-6 overflow-y-auto custom-scroll relative z-10 flex flex-col gap-6">
                
                {/* ========================================== */}
                {/* SECTION 1: System & Broker Settings        */}
                {/* ========================================== */}
                <div className="flex flex-col gap-4">
                    {/* Header: System */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c1c20] to-black border border-white/10 flex items-center justify-center shadow-inner">
                            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-tight">{t('system_broker_settings') || 'System & Broker Settings'}</h3>
                            <p className="text-[10px] text-zinc-500 font-medium">{t('core_system_logic')}</p>
                        </div>
                    </div>

                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-4 shadow-inner space-y-3">
                        {/* 1. Margin Usage */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${marginEnabled ? 'bg-zinc-800/30 border-zinc-600/30' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={marginEnabled} onChange={(e) => setMarginEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <div className="flex items-center">
                                        <span className={`text-xs font-bold transition-colors ${marginEnabled ? 'text-white' : 'text-zinc-500'}`}>{t('margin_usage')}</span>
                                        <InfoTooltip text={t('margin_usage_desc')} />
                                    </div>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 transition-opacity duration-300 ${marginEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                <div className="flex-1 flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-zinc-500/50 transition-colors" dir="ltr">
                                    <input type="number" value={marginLimit} onChange={(e) => setMarginLimit(e.target.value)} placeholder="50" className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                    <span className="text-[10px] text-zinc-500 font-bold ml-2">%</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Warm-Up System */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${wuEnabled ? 'bg-violet-500/[0.03] border-violet-500/20' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={wuEnabled} onChange={(e) => setWuEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <div className="flex items-center">
                                        <span className={`text-xs font-bold transition-colors ${wuEnabled ? 'text-white' : 'text-zinc-500'}`}>{t('warmup_system')}</span>
                                        <InfoTooltip text={t('warmup_desc')} />
                                    </div>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 transition-opacity duration-300 ${wuEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                <span className="text-[10px] text-zinc-500 uppercase font-bold w-16">{t('candles')}</span>
                                <div className="flex-1 flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-violet-500/30 transition-colors" dir="ltr">
                                    <input type="number" value={wuCandles} onChange={(e) => setWuCandles(e.target.value)} placeholder="500" className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                </div>
                            </div>
                        </div>

                        {/* 3. Smart News Filter */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${nfEnabled ? 'bg-rose-500/[0.03] border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.05)]' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={nfEnabled} onChange={handleNewsToggle} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <div className="flex items-center">
                                        <span className={`text-xs font-bold transition-colors ${nfEnabled ? 'text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]' : 'text-zinc-500'}`}>
                                            {t('news_filter')}
                                        </span>
                                        <InfoTooltip text={t('news_filter_desc')} />
                                    </div>
                                </div>
                                {/* Animated Pulse indicator when active */}
                                {nfEnabled && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    </span>
                                )}
                            </div>
                            
                            <div className={`transition-opacity duration-300 ${nfEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                {/* EUR & USD Toggles */}
                                <div className="flex items-center gap-4 mb-3 px-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors border ${nfEur ? 'bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-transparent border-white/20 group-hover:border-white/40'}`}>
                                            {nfEur && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className={`text-[10px] font-bold font-mono transition-colors ${nfEur ? 'text-rose-200' : 'text-zinc-500'}`}>EUR</span>
                                        <input type="checkbox" className="hidden" checked={nfEur} onChange={(e) => setNfEur(e.target.checked)} />
                                    </label>
                                    
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors border ${nfUsd ? 'bg-rose-500 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-transparent border-white/20 group-hover:border-white/40'}`}>
                                            {nfUsd && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className={`text-[10px] font-bold font-mono transition-colors ${nfUsd ? 'text-rose-200' : 'text-zinc-500'}`}>USD</span>
                                        <input type="checkbox" className="hidden" checked={nfUsd} onChange={(e) => setNfUsd(e.target.checked)} />
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                     <div className="flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-rose-500/30 transition-colors" dir="ltr">
                                        <span className="text-[9px] text-zinc-500 uppercase font-bold mr-2 w-20 truncate">{t('mins_before')}</span>
                                        <input type="number" value={nfBefore} onChange={(e) => setNfBefore(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200 text-right" />
                                    </div>
                                    <div className="flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-rose-500/30 transition-colors" dir="ltr">
                                        <span className="text-[9px] text-zinc-500 uppercase font-bold mr-2 w-20 truncate">{t('mins_after')}</span>
                                        <input type="number" value={nfAfter} onChange={(e) => setNfAfter(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200 text-right" />
                                    </div>
                                </div>

                                {/* 🚨 Upcoming News Display Mini Banner */}
                                {nextNews && (
                                    <div className="mt-3 p-2.5 bg-[#09090b]/80 border border-rose-500/20 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="animate-pulse text-rose-500 text-xs">🔥</span>
                                            <span className="text-[10px] text-zinc-300 font-mono truncate">
                                                <strong className="text-white">{nextNews.currency}</strong> - {nextNews.title}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-mono font-bold shrink-0 ml-2 ${nextNews.countdown.includes('NOW') ? 'text-rose-400 animate-bounce' : 'text-rose-500'}`}>
                                            {nextNews.countdown}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full h-px bg-white/5 my-1"></div>

                {/* ========================================== */}
                {/* SECTION 2: Global Risk Protections         */}
                {/* ========================================== */}
                <div className="flex flex-col gap-4">
                    {/* Header: Risk Protections */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c1c20] to-black border border-emerald-500/20 flex items-center justify-center shadow-inner">
                            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-emerald-400 tracking-tight">{t('global_risk_protections') || 'Global Risk Management'}</h3>
                            <p className="text-[10px] text-zinc-500 font-medium">{t('global_risk_desc')}</p>
                        </div>
                    </div>

                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-4 shadow-inner space-y-3">
                        {/* 4. Auto Breakeven */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${beEnabled ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={beEnabled} onChange={(e) => setBeEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <span className={`text-xs font-bold transition-colors ${beEnabled ? 'text-white' : 'text-zinc-500'}`}>{t('auto_breakeven')}</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 transition-opacity duration-300 ${beEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                <span className="text-[10px] text-zinc-500 uppercase font-bold w-16">{t('trigger')}</span>
                                <div className="flex-1 flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-emerald-500/30 transition-colors" dir="ltr">
                                    <input type="number" value={beTrigger} onChange={(e) => setBeTrigger(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                    <span className="text-[9px] text-zinc-600 font-bold ml-1">R</span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Partial Close */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${pcEnabled ? 'bg-blue-500/[0.03] border-blue-500/20' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={pcEnabled} onChange={(e) => setPcEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <span className={`text-xs font-bold transition-colors ${pcEnabled ? 'text-white' : 'text-zinc-500'}`}>{t('partial_close')}</span>
                                </div>
                            </div>
                            <div className={`grid grid-cols-2 gap-3 transition-opacity duration-300 ${pcEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                 <div className="flex items-center bg-[#09090b] rounded-lg border border-white/10 px-3 h-9 focus-within:border-blue-500/30 transition-colors" dir="ltr">
                                    <span className="text-[9px] text-zinc-600 font-bold mr-2 w-6">{t('vol')}</span>
                                    <input type="number" value={pcVolume} onChange={(e) => setPcVolume(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                    <span className="text-[9px] text-zinc-600 font-bold ml-1">%</span>
                                </div>
                                <div className="flex items-center bg-[#09090b] rounded-lg border border-white/10 px-3 h-9 focus-within:border-blue-500/30 transition-colors" dir="ltr">
                                    <span className="text-[9px] text-zinc-600 font-bold mr-2 w-6">{t('at')}</span>
                                    <input type="number" value={pcTrigger} onChange={(e) => setPcTrigger(e.target.value)} className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                    <span className="text-[9px] text-zinc-600 font-bold ml-1">R</span>
                                </div>
                            </div>
                        </div>

                        {/* 6. Daily Target Lock */}
                        <div className={`p-4 rounded-xl border transition-all duration-300 ${tlEnabled ? 'bg-amber-500/[0.03] border-amber-500/20' : 'bg-[#151518] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={tlEnabled} onChange={(e) => setTlEnabled(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-white"></div>
                                    </label>
                                    <span className={`text-xs font-bold transition-colors ${tlEnabled ? 'text-white' : 'text-zinc-500'}`}>{t('target_lock')}</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 transition-opacity duration-300 ${tlEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none blur-[1px]'}`}>
                                <span className="text-[10px] text-zinc-500 uppercase font-bold w-16">{t('target_value')}</span>
                                <div className="flex-1 flex items-center bg-[#09090b] rounded-lg border border-white/10 px-2 h-9 focus-within:border-amber-500/30 transition-colors" dir="ltr">
                                    <input type="number" value={tlTrigger} onChange={(e) => setTlTrigger(e.target.value)} placeholder="10200" className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-200" />
                                    <span className="text-[10px] text-amber-600 font-bold ml-2">$</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>

            {/* Sticky Save Button */}
            <div className="p-4 border-t border-white/5 bg-[#0e0e11] z-20 shrink-0">
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full bg-white text-black hover:bg-zinc-200 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                    {isSaving ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0 -2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            <span>{t('save_config')}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default RiskPanel;