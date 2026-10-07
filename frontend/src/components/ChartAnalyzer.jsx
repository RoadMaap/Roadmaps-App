import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

// -----------------------------------------------------------------------------
// CUSTOM SELECT COMPONENT
// -----------------------------------------------------------------------------
const CustomSelect = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = (options || []).find(opt => opt.value === value)?.label || value;

    return (
        <div className="relative w-full h-full group" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-full flex items-center justify-between bg-transparent rounded-xl px-4 py-2 text-sm text-zinc-300 transition-all outline-none hover:bg-white/5 focus:bg-white/5 ${isOpen ? 'text-emerald-400' : ''}`}
            >
                <span className="truncate pr-2 font-medium" dir="ltr">{selectedLabel}</span>
                <svg className={`w-4 h-4 text-zinc-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            
            {/* Z-index high to ensure dropdown floats above everything */}
            <div className={`absolute left-0 top-full mt-2 w-full min-w-[180px] bg-[#18181b] border border-white/10 rounded-xl shadow-[0_15px_50px_-10px_rgba(0,0,0,0.8)] z-[999999] origin-top transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 visible translate-y-0' : 'opacity-0 scale-95 invisible -translate-y-2'}`}>
                <div className="max-h-48 overflow-y-auto custom-scroll py-2">
                    {(options || []).map((opt) => (
                        <div 
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-4 py-3 text-xs cursor-pointer flex items-center gap-3 transition-colors ${value === opt.value ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                            dir="ltr"
                        >
                            <div className={`w-2 h-2 rounded-full bg-emerald-500 transition-opacity ${value === opt.value ? 'opacity-100' : 'opacity-0'}`}></div>
                            {opt.label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
const ChartAnalyzer = () => {
    const { t, lang } = useLanguage();
    
    // Core States
    const [imagePreview, setImagePreview] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const isCancelledRef = useRef(false);
    
    // Execution & Settings States
    const [apiKey, setApiKey] = useState("");
    const lastSavedApiKey = useRef("");
    const [symbol, setSymbol] = useState("XAUUSD");
    const [riskMode, setRiskMode] = useState('percentage');
    const [riskValue, setRiskValue] = useState('1.0');
    const [isDeploying, setIsDeploying] = useState(false);

    // Toast Modal State
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });

    const riskModeOptions = [
        { label: t('risk_percent') || 'Percentage (%)', value: 'percentage' },
        { label: t('risk_fixed_usd') || 'Fixed USD', value: 'fixed_usd' },
        { label: t('risk_fixed_lot') || 'Fixed Lot', value: 'fixed_lot' },
    ];

    useEffect(() => {
        if (window.eel) {
            window.eel.get_initial_data()().then(data => {
                if (data && data.gemini_api_key) {
                    setApiKey(data.gemini_api_key);
                    lastSavedApiKey.current = data.gemini_api_key;
                }
            });
        }
    }, []);

    const saveApiKey = () => {
        if (apiKey !== lastSavedApiKey.current) {
            if (window.eel) {
                window.eel.save_user_config({ gemini_api_key: apiKey })();
                lastSavedApiKey.current = apiKey; 
                showToast(lang === 'fa' ? "کلید API با موفقیت ذخیره شد." : "API Key saved successfully.", "success");
            }
        }
    };

    const showToast = (message, type = 'error') => {
        setToast({ show: true, message, type });
        if (type === 'success') {
            setTimeout(() => {
                setToast(prev => prev.message === message ? { show: false, message: '', type: 'error' } : prev);
            }, 4000);
        }
    };

    const handleImageFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
            setResult(null); 
            setIsAnalyzing(false);
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                handleImageFile(file);
                break;
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    };

    const cancelAnalysis = () => {
        isCancelledRef.current = true;
        setIsAnalyzing(false);
        showToast(lang === 'fa' ? "تحلیل توسط کاربر لغو شد." : "Analysis cancelled by user.", "error");
    };

    const runAnalysis = async () => {
        if (!imagePreview || !window.eel) return;
        
        setIsAnalyzing(true);
        setResult(null);
        isCancelledRef.current = false;
        
        try {
            const fetchPromise = window.eel.analyze_uploaded_chart(imagePreview, lang)();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), 90000)
            );

            const data = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (isCancelledRef.current) return;
            
            if (data?.market_state && data.market_state.includes('ERROR')) {
                showToast(data.price_action_analysis || (lang === 'fa' ? "خطای سیستمی یا شبکه رخ داد." : "System or network error occurred."), 'error');
            }
            
            setResult(data);
            
        } catch (err) {
            if (isCancelledRef.current) return;

            console.error("Backend connection failed:", err);
            if (err.message === 'TIMEOUT') {
                showToast(lang === 'fa' ? "زمان درخواست به پایان رسید (Timeout). لطفا دوباره تلاش کنید." : "Analysis timed out after 90 seconds.", 'error');
            } else {
                showToast(t('connection_error') || "Connection to Python Backend failed.", 'error');
            }
        } finally {
            if (!isCancelledRef.current) {
                setIsAnalyzing(false);
            }
        }
    };

    const handleDeployToMT5 = async () => {
        if (!result || isDeploying || !symbol) return;
        setIsDeploying(true);
        try {
            const deployRes = await window.eel.deploy_ai_trade_to_mt5(symbol, result, riskMode, parseFloat(riskValue))();
            
            if (deployRes && deployRes.success) {
                showToast(deployRes.message, 'success');
            } else {
                showToast(deployRes.message || "Failed to place order.", 'error');
            }
        } catch (error) {
            console.error("Deploy failed:", error);
            showToast("System error during execution.", 'error');
        }
        setIsDeploying(false);
    };

    const getBiasColor = (bias) => {
        if (bias === 'BUY') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
        if (bias === 'SELL') return 'text-rose-400 bg-rose-400/10 border-rose-400/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]';
        return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    };

    const isTradeable = result && result.trade_bias !== 'NEUTRAL' && result.trade_bias !== 'WAIT' && !(result.market_state?.includes('ERROR')) && symbol.trim().length > 0;

    return (
        <div className="relative flex h-full w-full flex-col overflow-y-auto bg-transparent p-6 font-sans text-zinc-300 custom-scroll" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            
            {/* Toast Notification Modal */}
            {toast.show && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`flex flex-col items-center gap-4 px-6 py-8 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.5)] border max-w-[480px] w-full text-center bg-[#121215] animate-in zoom-in-95 duration-200 ${toast.type === 'success' ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
                        <div className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center shadow-inner ${toast.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'}`}>
                            {toast.type === 'success' ? (
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            )}
                        </div>
                        <div className="w-full max-h-[50vh] overflow-y-auto custom-scroll px-4 pb-2">
                            <p className={`text-[13px] font-bold leading-relaxed break-words break-all whitespace-pre-wrap ${toast.type === 'success' ? 'text-emerald-100' : 'text-rose-100'}`} dir="auto">
                                {toast.message}
                            </p>
                        </div>
                        <button onClick={() => setToast({ show: false, message: '', type: 'error' })} className={`mt-2 px-8 py-2.5 rounded-xl font-bold text-xs transition-colors ${toast.type === 'error' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 hover:bg-white/10 text-zinc-300'}`}>
                            {lang === 'fa' ? 'بستن پیام' : 'Close'}
                        </button>
                    </div>
                </div>
            )}

            {/* Page Header & API Key */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
                        <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </div>
                        {t('vision_trade_engine')}
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">{t('vision_engine_desc')}</p>
                </div>
                <div className="flex items-center gap-2 bg-[#151518] border border-white/5 focus-within:border-cyan-500/30 rounded-xl p-1.5 px-3 transition-all max-w-sm w-full shadow-inner z-10">
                    <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)}
                        onBlur={saveApiKey}
                        placeholder="Google Gemini API Key..."
                        dir="ltr"
                        className="w-full bg-transparent border-none outline-none text-xs font-mono text-zinc-300 placeholder-zinc-700 py-1"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative flex-1 min-h-0">
                
                {/* ----------------------------------------------------------------- */}
                {/* Left Column: Uploader & Preview */}
                {/* ----------------------------------------------------------------- */}
                <div className="xl:col-span-5 flex flex-col gap-4 relative z-20">
                    
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 shrink-0">
                        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex flex-col">
                            <span className="text-amber-500 text-xs font-bold mb-1">{t('note_label')}</span>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed font-medium" dir="auto">
                                {t('chart_tips')}
                            </p>
                        </div>
                    </div>

                    {!imagePreview ? (
                        <div 
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer shrink-0 ${isDragging ? 'border-cyan-500 bg-cyan-500/5 shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'border-white/10 hover:border-white/20 bg-[#121215]'}`}
                        >
                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                <svg className="w-10 h-10 mb-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm font-medium text-zinc-300">{t('drag_drop_text')}</p>
                                <p className="text-xs text-zinc-500 mt-1">{t('paste_screenshot') || t('paste_text')}</p>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageFile(e.target.files[0])} />
                            </label>
                        </div>
                    ) : (
                        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#09090b] group shadow-xl flex items-center justify-center min-h-[250px] shrink-0">
                            <img src={imagePreview} alt="Chart to analyze" className="w-full h-auto object-contain max-h-[400px]" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <button 
                                    onClick={() => {setImagePreview(null); setResult(null); setIsAnalyzing(false);}}
                                    className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"
                                >
                                    {t('clear_image')}
                                </button>
                            </div>
                        </div>
                    )}

                    {isAnalyzing ? (
                        <button 
                            onClick={cancelAnalysis}
                            className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(244,63,94,0.3)] bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500 hover:text-white active:scale-[0.98] shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {lang === 'fa' ? 'لغو عملیات' : 'Cancel Analysis'}
                        </button>
                    ) : (
                        <button 
                            onClick={runAnalysis}
                            disabled={!imagePreview || !apiKey}
                            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shrink-0 ${!imagePreview || !apiKey ? 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5' : 'bg-cyan-600 text-white hover:bg-cyan-500 border border-cyan-400 active:scale-[0.98]'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            {t('run_deep_analysis')}
                        </button>
                    )}
                    {!apiKey && <p className="text-center text-[10px] text-rose-500 font-bold -mt-3">API Key Required</p>}
                </div>

                {/* ----------------------------------------------------------------- */}
                {/* Right Column: AI Analysis Results & Execution Panels */}
                {/* ----------------------------------------------------------------- */}
                <div className="xl:col-span-7 flex flex-col gap-4 h-full relative z-10 min-h-0 pb-4">
                    {!result ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-[#121215] p-8 text-center min-h-[300px]">
                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center animate-fade-in">
                                    <div className="relative w-20 h-20 mb-6">
                                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                        <svg className="absolute inset-0 m-auto w-8 h-8 text-cyan-500/80 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-cyan-400 font-bold text-lg tracking-wide mb-2">{t('analyzing_chart')}</h3>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 rounded-full bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center mb-6">
                                        <svg className="w-10 h-10 text-cyan-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-zinc-300 font-bold text-lg tracking-wide">{t('awaiting_chart')}</h3>
                                    <p className="text-zinc-500 text-sm mt-2 max-w-sm leading-relaxed">{t('awaiting_chart_desc')}</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Panel 1: Analysis Details (Takes available space, scrolls if needed) */}
                            <div className="flex-1 flex flex-col bg-[#121215] border border-white/10 rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative min-h-0">
                                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                                    <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] opacity-10 ${result.trade_bias === 'BUY' ? 'bg-emerald-500' : result.trade_bias === 'SELL' ? 'bg-rose-500' : 'bg-zinc-500'}`}></div>
                                </div>

                                {/* Top Stats Row */}
                                <div className="grid grid-cols-3 gap-3 relative z-10 shrink-0">
                                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">{t('trade_bias')}</span>
                                        <span className={`text-sm font-bold border px-3 py-1 rounded-lg ${getBiasColor(result.trade_bias)}`}>
                                            {result.trade_bias}
                                        </span>
                                    </div>
                                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">{t('market_state')}</span>
                                        <span className={`text-sm font-bold truncate w-full px-2 ${result.market_state?.includes('ERROR') ? 'text-rose-500' : 'text-blue-400'}`}>
                                            {result.market_state?.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">{t('ai_confidence')}</span>
                                        <span className={`text-lg font-bold ${result.confidence_score >= 70 ? 'text-emerald-400' : result.confidence_score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {result.confidence_score}%
                                        </span>
                                    </div>
                                </div>

                                {/* Signal Execution Zones */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10 shrink-0">
                                    <div className="bg-[#09090b] border border-blue-500/20 rounded-xl p-3 flex flex-col justify-center shadow-inner">
                                        <span className="text-[9px] text-blue-400/80 uppercase font-bold tracking-widest block mb-1">{t('entry_zone')}</span>
                                        <span className="text-sm text-white font-mono font-bold truncate" dir="ltr">{result.entry_zone || 'N/A'}</span>
                                    </div>
                                    <div className="bg-[#09090b] border border-rose-500/20 rounded-xl p-3 flex flex-col justify-center shadow-inner">
                                        <span className="text-[9px] text-rose-400/80 uppercase font-bold tracking-widest block mb-1">{t('stop_loss')}</span>
                                        <span className="text-sm text-rose-400 font-mono font-bold truncate" dir="ltr">{result.stop_loss || 'N/A'}</span>
                                    </div>
                                    <div className="bg-[#09090b] border border-emerald-500/20 rounded-xl p-3 flex flex-col justify-center shadow-inner">
                                        <span className="text-[9px] text-emerald-400/80 uppercase font-bold tracking-widest block mb-1">{t('take_profit_1')}</span>
                                        <span className="text-sm text-emerald-400 font-mono font-bold truncate" dir="ltr">{result.take_profit_1 || 'N/A'}</span>
                                    </div>
                                    <div className="bg-[#09090b] border border-emerald-500/20 rounded-xl p-3 flex flex-col justify-center shadow-inner">
                                        <span className="text-[9px] text-emerald-400/80 uppercase font-bold tracking-widest block mb-1">{t('take_profit_2')}</span>
                                        <span className="text-sm text-emerald-400 font-mono font-bold truncate" dir="ltr">{result.take_profit_2 || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Scrollable Analysis Details */}
                                <div className="flex flex-col gap-3 mt-4 relative z-10 flex-1 overflow-y-auto pr-2 custom-scroll">
                                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                                        <h4 className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_#a855f7]"></span>
                                            {t('price_action_logic')}
                                        </h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed" dir="auto">{result.price_action_analysis}</p>
                                    </div>
                                    
                                    <div className="bg-[#0e0e11] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                                        <h4 className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#06b6d4]"></span>
                                            {t('indicators_confluence')}
                                        </h4>
                                        <p className="text-xs text-zinc-300 leading-relaxed" dir="auto">{result.indicators_analysis}</p>
                                    </div>

                                    {result.risk_note && result.risk_note !== "N/A" && (
                                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3 mt-auto shrink-0">
                                            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            <p className="text-[11px] text-amber-200/80 leading-relaxed font-medium" dir="auto">
                                                <span className="text-amber-500 font-bold mr-1">{t('risk_warning') || 'Warning:'}</span>{result.risk_note}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Panel 2: Execution Setup (Standalone Card at the Bottom) */}
                            <div className="shrink-0 bg-[#0c0c0e] border border-rose-500/20 rounded-2xl p-5 shadow-[0_10px_40px_-15px_rgba(244,63,94,0.15)] relative z-20 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">
                                
                                {/* Disclaimer / Warning Message */}
                                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3 mb-5">
                                    <svg className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex flex-col">
                                        <span className="text-rose-500 text-xs font-bold mb-1">{lang === 'fa' ? 'سلب مسئولیت مهم:' : 'Important Disclaimer:'}</span>
                                        <p className="text-[11px] text-rose-200/80 leading-relaxed font-medium" dir="auto">
                                            {lang === 'fa' 
                                                ? 'بازارهای مالی همواره با ریسک بالای از دست رفتن سرمایه همراه هستند. سیستم هوش مصنوعی تنها یک ابزار دستیار است و هیچ‌گونه مسئولیتی در قبال زیان‌های احتمالی شما ندارد. لطفاً پیش از زدن دکمه اجرای معامله، از صحت تحلیل، نماد و حجم انتخابی خود کاملاً اطمینان حاصل کنید.' 
                                                : 'Financial markets carry a high risk of capital loss. The AI system is solely an assistive tool and assumes no liability for potential losses. Please ensure the accuracy of your analysis, symbol, and selected risk volume before clicking the execute button.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-50">
                                    
                                    {/* Symbol Box */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase mx-1">{t('symbol_label') || 'Symbol'}</label>
                                        <div className="h-12 bg-[#151518] rounded-xl border border-white/5 focus-within:border-cyan-500/50 transition-colors shadow-inner flex items-center px-4 relative overflow-hidden">
                                            <input 
                                                type="text" 
                                                value={symbol} 
                                                onChange={(e) => setSymbol(e.target.value)}
                                                dir="ltr"
                                                className="w-full h-full bg-transparent border-none outline-none text-white font-mono font-bold text-base placeholder-zinc-700 tracking-widest"
                                                placeholder="XAUUSD"
                                            />
                                        </div>
                                    </div>

                                    {/* Risk Mode Dropdown */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase mx-1">{t('risk_mode') || 'Risk Type'}</label>
                                        <div className="h-12 bg-[#151518] rounded-xl border border-white/5 hover:border-white/10 transition-colors shadow-inner relative z-50">
                                            <CustomSelect 
                                                value={riskMode}
                                                options={riskModeOptions}
                                                onChange={setRiskMode}
                                            />
                                        </div>
                                    </div>

                                    {/* Risk Value Input */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-zinc-500 font-bold uppercase mx-1">{t('risk_value') || 'Risk Value'}</label>
                                        <div className="h-12 bg-[#151518] rounded-xl border border-white/5 hover:border-white/10 focus-within:border-emerald-500/50 transition-all shadow-inner flex items-center relative overflow-hidden group">
                                            <input 
                                                type="number"
                                                step="any"
                                                value={riskValue} 
                                                onChange={(e) => setRiskValue(e.target.value)}
                                                dir="ltr"
                                                className="w-full h-full bg-transparent border-none outline-none text-emerald-400 font-mono font-bold text-lg px-4 placeholder-zinc-700 focus:text-white transition-colors"
                                                placeholder="1.0"
                                            />
                                            {/* Absolute positioning to prevent flexbox collapsing issues */}
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <span className="text-[10px] font-bold text-zinc-500 group-focus-within:text-emerald-400/70 transition-colors bg-[#151518] pl-2">
                                                    {riskMode === 'percentage' ? '%' : riskMode === 'fixed_lot' ? 'LOT' : 'USD'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deploy Button */}
                                    <div className="flex flex-col justify-end mt-1 lg:mt-0">
                                        <button 
                                            onClick={handleDeployToMT5}
                                            disabled={!isTradeable || isDeploying}
                                            className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden shadow-lg ${
                                                !isTradeable 
                                                ? 'bg-[#151518] text-zinc-600 cursor-not-allowed border border-white/5 shadow-none' 
                                                : isDeploying 
                                                ? 'bg-emerald-500 text-white cursor-wait'
                                                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 border border-emerald-400/50'
                                            }`}
                                        >
                                            {isDeploying ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    <span className="truncate">{t('executing')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                    <span className="tracking-wide uppercase truncate">{t('deploy_mt5')}</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChartAnalyzer;