import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Sidebar from './Sidebar';
import StatCard from './StatCard';
import Sparkline from './Sparkline';
import RiskPanel from './RiskPanel';
import EnginePanel from './EnginePanel';
import StrategyPanel from './StrategyPanel';
import EducationPanel from './EducationPanel';
import ChartAnalyzer from './ChartAnalyzer';

const Dashboard = ({ updateInfo, onStartOptionalUpdate }) => {
    const { t, toggleLanguage, lang } = useLanguage();
    
    // --- Refs ---
    const mainContentRef = useRef(null);
    
    // --- States ---
    const [mt5Path, setMt5Path] = useState("");
    const [initialData, setInitialData] = useState(null);
    const [logs, setLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [strategies, setStrategies] = useState({});
    const [userName, setUserName] = useState('');
    const [showOptionalModal, setShowOptionalModal] = useState(false);
    const [dismissedOptionalVersion, setDismissedOptionalVersion] = useState(null);
    
    // News Ticker State
    const [nextNews, setNextNews] = useState(null);

    // --- State Engine ---
    const [isRunning, setIsRunning] = useState(false);

    // Live Data
    const [profitHistory, setProfitHistory] = useState(Array(15).fill(0));
    const [initialEquity, setInitialEquity] = useState(null);
    const [liveData, setLiveData] = useState({
        profit: 0.00,
        equity: 0.00,
        positions: 0
    });

    useEffect(() => {
        const fetchInit = async () => {
            if(window.eel) {
                try {
                    const data = await window.eel.get_initial_data()();
                    if(data) {
                        setInitialData(data);
                        setMt5Path(data?.mt5_path || "");
                        if (data?.strategies) {
                            setStrategies(data.strategies);
                        }
                    }

                    const authStatus = await window.eel.get_auth_status()();
                    const profile = authStatus?.profile;
                    const authenticatedUserName = profile?.name
                        || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
                        || profile?.username
                        || profile?.email?.split('@')[0];
                    if (authenticatedUserName) setUserName(authenticatedUserName);
                } catch (error) {
                    console.error("Error fetching initial data from Eel:", error);
                }
            }
        };
        fetchInit();

        // Expose functions to python
        if(window.eel) {
            window.eel.expose(update_dashboard, 'update_dashboard');
            window.eel.expose(update_status, 'update_status');
            window.eel.expose(update_news_ticker, 'update_news_ticker'); 
        }
        
        return () => {
            if(window.eel) {
                delete window.update_dashboard;
                delete window.update_status;
                delete window.update_news_ticker;
            }
        };
    }, []);

    // Scroll to top when changing tabs
    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    useEffect(() => {
        const optionalVersion = updateInfo?.latest_version ?? 'available';
        if (updateInfo && updateInfo.is_force_update !== true && optionalVersion !== dismissedOptionalVersion) {
            setShowOptionalModal(true);
        }
    }, [updateInfo, dismissedOptionalVersion]);

    const dismissOptionalModal = () => {
        setDismissedOptionalVersion(updateInfo?.latest_version ?? 'available');
        setShowOptionalModal(false);
    };

    function update_news_ticker(newsData) {
        setNextNews(newsData);
    }

    function update_status(type, message) {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        let color = 'text-zinc-500';
        
        if (type === 'error') {
            color = 'text-rose-500';
            setIsRunning(false); 
        }
        else if (type === 'success') {
            color = 'text-emerald-500';
            if (message?.includes('فعال شد') || message?.includes('Active')) setIsRunning(true); 
        }
        else if (type === 'warning') {
            color = 'text-yellow-500';
            if (message?.includes('توقف') || message?.includes('Stop') || message?.includes('Halting')) setIsRunning(false); 
        }
        
        setLogs(prev => {
            const newLogs = [...(prev || []), { time, message: message || '', color }];
            return newLogs.length > 100 ? newLogs.slice(newLogs.length - 100) : newLogs;
        });
    }

    const handleToggleEngine = async () => {
        if (!mt5Path) {
            update_status('error', 'MT5 Path not selected!');
            return;
        }

        if (isRunning) {
            setIsRunning(false);
            if(window.eel) await window.eel.stop_robot()();
        } else {
            setIsRunning(true);
            if(window.eel) await window.eel.start_robot()();
        }
    };

    function update_dashboard(profit, equity, positions) {
        const p = parseFloat(profit) || 0.00;
        const e = parseFloat(equity) || 0.00;
        setLiveData({ profit: p, equity: e, positions: positions || 0 });
        setProfitHistory(prev => {
            const newHist = [...(prev || []), p];
            if(newHist.length > 20) newHist.shift();
            return newHist;
        });
        if (initialEquity === null && e > 0) setInitialEquity(e - p);
    }

    const getEquityBar = () => {
        if (!initialEquity || initialEquity <= 0) return { width: '0%', isProfit: true, percent: "0.0" };
        const current = liveData?.equity || 0;
        if (current >= initialEquity) {
            let basePercent = (initialEquity / current) * 100;
            let profitPercent = 100 - basePercent;
            return { width: `${profitPercent}%`, isProfit: true, percent: profitPercent.toFixed(1) };
        } else {
            let remainingPercent = (current / initialEquity) * 100;
            let lossPercent = 100 - remainingPercent;
            return { width: `${remainingPercent}%`, isProfit: false, percent: lossPercent.toFixed(1) };
        }
    };
    const eqBar = getEquityBar();

    const handleStrategyConfigUpdate = (strategyName, newConfig) => {
        setStrategies(prev => ({
            ...prev,
            [strategyName]: {
                ...(prev?.[strategyName] || {}),
                config: newConfig
            }
        }));
        if(window.eel) window.eel.update_strategy_config(strategyName, 'config', newConfig);
    };

    const transitionClass = "transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]";

    return (
        <div className={`flex flex-col h-screen bg-zinc-50 dark:bg-[#09090b] overflow-hidden text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-500/30 ${transitionClass}`}>
            <div className="flex flex-1 overflow-hidden relative">
                
                <Sidebar status={isRunning ? "Running" : (mt5Path ? "Ready" : "Disconnected")} activeTab={activeTab} onTabChange={setActiveTab} />

                <main 
                    ref={mainContentRef}
                    className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative"
                >
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                        <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] opacity-40"></div>
                        <div className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[100px] opacity-30"></div>
                    </div>

                    <header className={`h-20 shrink-0 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md flex items-center justify-between px-8 z-20 sticky top-0 ${transitionClass}`}>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-white tracking-tight flex items-center gap-3">
                                {activeTab === 'dashboard' ? (userName || t('RoadMaps App')) : activeTab === 'education' ? t('ai_builder_title') : activeTab === 'analyze' ? t('chart_analysis') || 'Chart Analysis' : t('strategy_management')}
                            </h2>
                            <p className="text-xs text-zinc-500 font-medium mt-0.5">
                                {activeTab === 'dashboard' ? t('real_time_monitoring') : activeTab === 'education' ? t('ai_builder_subtitle') : activeTab === 'analyze' ? t('upload_chart_screenshots') : t('strategy_config_subtitle')}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                             <div className={`hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#121215] border border-zinc-200 dark:border-white/5 shadow-sm ${transitionClass}`}>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('active_strategies')}</span>
                                <div className="h-4 w-px bg-zinc-300 dark:bg-white/10"></div>
                                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                    {Object.keys(strategies || {}).length.toString().padStart(2, '0')}
                                </span>
                            </div>

                            {updateInfo && (
                                <button
                                    type="button"
                                    onClick={() => setShowOptionalModal(true)}
                                    className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-blue-500/30 bg-[#121215] px-4 py-2.5 text-sm font-semibold text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all hover:border-blue-400/50 hover:text-white hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] active:scale-95"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5m-5 5V3" />
                                    </svg>
                                    <span className="relative z-10">{t('update_available')}</span>
                                </button>
                            )}
                            
                            <button 
                                onClick={toggleLanguage} 
                                className={`flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:scale-105 active:scale-95 shadow-sm ${transitionClass}`}
                                title="Switch Language"
                            >
                                <span className="text-xs font-bold">{lang === 'fa' ? 'EN' : 'FA'}</span>
                            </button>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <div className="flex-1 px-8 pt-10 pb-8 z-10 custom-scroll">
                        <div className="max-w-[1920px] mx-auto h-full flex flex-col">
                            
                            {/* TAB 1: DASHBOARD */}
                            <div className={`space-y-6 animate-fade-in ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <StatCard 
                                        title={t('net_profit_today')} 
                                        value={`$${(liveData?.profit || 0).toFixed(2)}`} 
                                            trend={(liveData?.profit || 0) > 0 ? 'up' : (liveData?.profit || 0) < 0 ? 'down' : 'neutral'} 
                                            subValue={(liveData?.profit || 0) !== 0 ? ((liveData?.profit || 0) > 0 ? `+${t('roi') || 'ROI'}` : `-${t('drawdown') || 'Drawdown'}`) : "0.0%"} 
                                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v20m5-15H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
                                        >
                                            <div className="h-16 w-full -mb-3 mt-3 opacity-80 group-hover:opacity-100 transition-all duration-500 scale-100 group-hover:scale-[1.02]">
                                                <Sparkline data={profitHistory || []} color={(liveData?.profit || 0) >= 0 ? "#10b981" : "#f43f5e"} />
                                            </div>
                                        </StatCard>
                                        
                                        <StatCard 
                                            title={t('account_balance')} 
                                            value={`$${(liveData?.equity || 0).toFixed(2)}`}
                                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                                        >
                                            <div className="w-full bg-zinc-200 dark:bg-zinc-800/50 h-2 rounded-full overflow-hidden flex justify-start relative mt-6 border border-zinc-300 dark:border-white/5">
                                                {eqBar.isProfit ? (
                                                    <>
                                                        <div className="h-full bg-zinc-400 dark:bg-zinc-600 w-full opacity-20"></div>
                                                        <div className="absolute h-full bg-emerald-500 transition-all duration-700 ease-out shadow-[0_0_10px_#10b981]" style={{width: eqBar.width, right: lang === 'fa' ? 'auto' : 0, left: lang === 'fa' ? 0 : 'auto'}}></div>
                                                    </>
                                                ) : (
                                                    <div className="h-full bg-rose-500 transition-all duration-700 ease-out shadow-[0_0_10px_#f43f5e]" style={{width: eqBar.width}}></div>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{t('equity_growth')}</span>
                                                <span className={`text-[10px] font-bold ${eqBar.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {eqBar.isProfit ? '+' : '-'}{eqBar.percent}%
                                                </span>
                                            </div>
                                        </StatCard>
                                        
                                        <StatCard 
                                            title={t('open_positions')} 
                                            value={liveData?.positions || 0}
                                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                                        >
                                             <div className="flex items-center gap-2 mt-4 p-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10">
                                                <span className="relative flex h-2 w-2">
                                                  {(liveData?.positions || 0) > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75"></span>}
                                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${(liveData?.positions || 0) > 0 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-zinc-600'}`}></span>
                                                </span>
                                                <span className={`text-[10px] font-medium uppercase tracking-wide ${(liveData?.positions || 0) > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>
                                                    {(liveData?.positions || 0) > 0 ? t('market_exposure_active') : t('no_exposure')}
                                                </span>
                                             </div>
                                        </StatCard>
                                </div>

                                {/* Control Panels */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 h-full min-h-[500px]">
                                    <div className="lg:col-span-8 flex flex-col gap-6 h-full">
                                        <RiskPanel initialData={initialData} nextNews={nextNews} />
                                    </div>
                                    
                                    <div className="lg:col-span-4 h-full">
                                        <EnginePanel 
                                            mt5Path={mt5Path} 
                                            onPathChange={setMt5Path} 
                                            logs={logs} 
                                            isRunning={isRunning}
                                            onToggle={handleToggleEngine}
                                            onClearLogs={() => setLogs([])}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* TAB 2: STRATEGY MANAGER */}
                            <div className={`h-full animate-fade-in ${activeTab === 'strategies' ? 'block' : 'hidden'}`}>
                                <StrategyPanel 
                                    strategies={strategies}
                                    onStrategiesChange={setStrategies} 
                                    onUpdateConfig={handleStrategyConfigUpdate}
                                />
                            </div>

                            {/* TAB 3: AI BUILDER / EDUCATION */}
                            <div className={`h-full animate-fade-in ${activeTab === 'education' ? 'block' : 'hidden'}`}>
                                <EducationPanel />
                            </div>

                            {/* TAB 4: CHART ANALYZER */}
                            <div className={`h-full animate-fade-in ${activeTab === 'analyze' ? 'block' : 'hidden'}`}>
                                <ChartAnalyzer />
                            </div>

                        </div>
                    </div>
                </main>
            </div>

            {/* --- PREMIUM OPTIONAL UPDATE MODAL --- */}
            {showOptionalModal && updateInfo && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5 backdrop-blur-md transition-all duration-300"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) dismissOptionalModal();
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="optional-update-title"
                        className="relative w-full max-w-lg animate-in zoom-in-95 duration-300 overflow-hidden rounded-3xl border border-white/10 bg-[#121215]/95 p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all"
                    >
                        {/* Background light effects inside modal */}
                        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-600/10 blur-[80px]"></div>
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-600/10 blur-[80px]"></div>
                        
                        {/* Top subtle highlight line */}
                        <div className="absolute left-0 right-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

                        <div className="relative z-10">
                            {/* Modal Header: Icon + Title */}
                            <div className="flex items-center gap-5">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative">
                                    <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl animate-pulse"></div>
                                    <svg className="relative z-10 h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">
                                        {t('update_version')} {updateInfo.latest_version}
                                    </p>
                                    <h2 id="optional-update-title" className="mt-1 text-2xl font-extrabold text-white tracking-tight">
                                        {t('update_modal_title')}
                                    </h2>
                                </div>
                            </div>

                            <p className="mt-5 text-sm leading-relaxed text-zinc-400 font-medium">
                                {t('update_modal_description')}
                            </p>

                            {/* Glassmorphism Changelog Box */}
                            <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/5 bg-[#09090b]/80 shadow-inner">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 opacity-50"></div>
                                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-relaxed text-zinc-300 custom-scroll">
                                    {updateInfo.changelog || t('update_changelog_fallback')}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-8 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={dismissOptionalModal}
                                    className="rounded-xl border border-white/5 bg-transparent px-5 py-3 text-sm font-semibold text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white active:scale-95"
                                >
                                    {t('update_remind_later')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDismissedOptionalVersion(updateInfo?.latest_version ?? 'available');
                                        setShowOptionalModal(false);
                                        onStartOptionalUpdate?.();
                                    }}
                                    className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-95 flex items-center gap-2 group"
                                >
                                    <span>{t('update_now')}</span>
                                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default Dashboard;