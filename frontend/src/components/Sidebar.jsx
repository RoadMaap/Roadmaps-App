import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { callOptionalEel } from '../services/eelApi';

/**
 * Sidebar Component
 * Re-designed with a premium dark theme, improved spacing,
 * enhanced interactive states, and better visual hierarchy.
 */
const Sidebar = ({ status, activeTab, onTabChange }) => {
    const { t, lang } = useLanguage();
    const [appVersion, setAppVersion] = useState('0.0.0');

    useEffect(() => {
        let isMounted = true;

        callOptionalEel('get_app_version').then((versionInfo) => {
            const version = versionInfo?.version;
            if (isMounted && typeof version === 'string' && version.trim()) {
                setAppVersion(version.trim());
            }
        });

        return () => {
            isMounted = false;
        };
    }, []);

    // Determine the layout direction based on the current language
    const isRtl = lang === 'fa';

    /**
     * Generate dynamic configuration for the connection status indicator.
     * Incorporates subtle glassmorphism and animated glows.
     */
    const getStatusConfig = () => {
        if (status === "Running") {
            return {
                wrapper: "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]",
                text: "text-emerald-400",
                dotCore: "bg-emerald-400",
                dotPing: "bg-emerald-400",
                label: t('running') || "RUNNING",
                icon: (
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                )
            };
        } else if (status === "Ready") {
            return {
                wrapper: "bg-blue-500/10 border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]",
                text: "text-blue-400",
                dotCore: "bg-blue-400",
                dotPing: "hidden",
                label: t('ready') || "READY",
                icon: (
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                )
            };
        }
        return {
            wrapper: "bg-zinc-900/50 border-zinc-800",
            text: "text-zinc-500",
            dotCore: "bg-zinc-600",
            dotPing: "hidden",
            label: t('stopped') || "STOPPED",
            icon: (
                <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
                </svg>
            )
        };
    };

    const statusConfig = getStatusConfig();

    return (
        <aside 
            className="w-[320px] h-full bg-[#09090b] border-r border-white/5 flex flex-col relative z-30 shrink-0 overflow-hidden font-sans"
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent pointer-events-none blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none blur-3xl"></div>

            <div className="p-4 relative z-10 flex flex-col h-full overflow-hidden">
                
                {/* Branding & Logo Section */}
                <div className="flex items-center gap-4 mb-4 group cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
                    <div className="group relative w-12 h-12 overflow-hidden rounded-2xl flex items-center justify-center shadow-[0_8px_16px_rgba(16,185,129,0.2)] transition-all duration-500 group-hover:shadow-[0_8px_24px_rgba(16,185,129,0.4)] group-hover:rotate-3">
                        <div className="absolute inset-0 rounded-2xl border-2 border-white/10 transition-transform duration-500 group-hover:scale-105"></div>
                        <img src="/logo.png" alt="RoadMaps Logo" className="relative z-10 block h-full w-full object-cover" />
                        {status === "Running" && (
                            <span className={`absolute -top-1.5 ${isRtl ? '-left-1.5' : '-right-1.5'} w-3.5 h-3.5 bg-white rounded-full animate-ping opacity-80`}></span>
                        )}
                        {status === "Running" && (
                            <span className={`absolute -top-1.5 ${isRtl ? '-left-1.5' : '-right-1.5'} w-3.5 h-3.5 bg-emerald-200 rounded-full border-2 border-emerald-600`}></span>
                        )}
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                            {t('RoadMaps')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">{t('App')}</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                {lang === 'fa' ? 'نسخه' : 'Version'} v{appVersion}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Refined Connection Status Card */}
                <div className="mb-4">
                    <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2 px-1 flex items-center gap-2">
                        {t('connection_status') || 'Connection Status'}
                        <div className="h-px bg-zinc-800 flex-1"></div>
                    </div>
                    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border backdrop-blur-md transition-all duration-500 ${statusConfig.wrapper}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-black/20">
                                {statusConfig.icon}
                            </div>
                            <span className={`text-sm font-bold tracking-wide ${statusConfig.text}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                        <div className="relative flex items-center justify-center h-3 w-3">
                            {statusConfig.dotPing !== "hidden" && (
                                <span className={`animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-75 ${statusConfig.dotPing}`}></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 shadow-sm ${statusConfig.dotCore}`}></span>
                        </div>
                    </div>
                </div>

                {/* Primary Navigation Menu with increased spacing and rich hover states */}
                <nav className="flex-1">
                    <div className="text-xs text-zinc-600 font-bold uppercase tracking-widest mb-2 px-1">
                        {t('menu') || 'Main Menu'}
                    </div>
                    {/* Increased vertical spacing between items using gap-4 */}
                    <div className="flex flex-col gap-1">
                        
                        {/* 1. Dashboard Tab */}
                        <button 
                            onClick={() => onTabChange('dashboard')}
                            className={`group relative w-full flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-300 overflow-hidden ${
                                activeTab === 'dashboard' 
                                    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 text-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.15)]' 
                                    : 'bg-transparent border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                            }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors duration-300 ${activeTab === 'dashboard' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800/80 text-zinc-500 group-hover:bg-zinc-700/80 group-hover:text-zinc-200'}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <span className="text-[15px] font-semibold tracking-wide">{t('overview')}</span>
                            {activeTab === 'dashboard' && (
                                <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-0' : 'left-0'} w-1.5 h-8 bg-emerald-500 ${isRtl ? 'rounded-l-full' : 'rounded-r-full'} shadow-[0_0_10px_rgba(16,185,129,0.5)]`}></div>
                            )}
                        </button>

                        {/* 2. Strategy Manager Tab */}
                        <button 
                            onClick={() => onTabChange('strategies')}
                            className={`group relative w-full flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-300 overflow-hidden ${
                                activeTab === 'strategies' 
                                    ? 'bg-gradient-to-r from-zinc-800 to-zinc-800/50 border border-zinc-600 text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)]' 
                                    : 'bg-transparent border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                            }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors duration-300 ${activeTab === 'strategies' ? 'bg-zinc-700 text-white' : 'bg-zinc-800/80 text-zinc-500 group-hover:bg-zinc-700/80 group-hover:text-zinc-200'}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <span className="text-[15px] font-semibold tracking-wide">{t('strategy_manager')}</span>
                            {activeTab === 'strategies' && (
                                <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-0' : 'left-0'} w-1.5 h-8 bg-zinc-400 ${isRtl ? 'rounded-l-full' : 'rounded-r-full'} shadow-[0_0_10px_rgba(161,161,170,0.3)]`}></div>
                            )}
                        </button>

                        {/* 3. AI Builder Tab */}
                        <button 
                            onClick={() => onTabChange('education')}
                            className={`group relative w-full flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-300 overflow-hidden ${
                                activeTab === 'education' 
                                    ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 border border-indigo-500/30 text-indigo-400 shadow-[0_4px_20px_rgba(99,102,241,0.15)]' 
                                    : 'bg-transparent border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                            }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors duration-300 ${activeTab === 'education' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800/80 text-zinc-500 group-hover:bg-zinc-700/80 group-hover:text-zinc-200'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                            </div>
                            <span className="text-[15px] font-semibold tracking-wide flex-1 text-left">{t('education_tab') || 'AI Builder'}</span>
                            
                            {/* Decorative Icon for AI Tab */}
                            <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-300 ${activeTab === 'education' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-600 group-hover:bg-indigo-500/10 group-hover:text-indigo-400'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${activeTab === 'education' ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M11.64 5.93h1.43v4.28h4.28v1.43h-4.28v4.28h-1.43v-4.28H7.36v-1.43h4.28V5.93z"/>
                                </svg>
                            </div>

                            {activeTab === 'education' && (
                                <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-0' : 'left-0'} w-1.5 h-8 bg-indigo-500 ${isRtl ? 'rounded-l-full' : 'rounded-r-full'} shadow-[0_0_10px_rgba(99,102,241,0.5)]`}></div>
                            )}
                        </button>

                        {/* 4. Analyze Chart Tab */}
                        <button 
                            onClick={() => onTabChange('analyze')}
                            className={`group relative w-full flex items-center gap-3 px-4 py-2 rounded-2xl transition-all duration-300 overflow-hidden ${
                                activeTab === 'analyze' 
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 text-cyan-400 shadow-[0_4px_20px_rgba(6,182,212,0.15)]' 
                                    : 'bg-transparent border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 hover:border-zinc-700/50'
                            }`}
                        >
                            <div className={`p-2 rounded-xl transition-colors duration-300 ${activeTab === 'analyze' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800/80 text-zinc-500 group-hover:bg-zinc-700/80 group-hover:text-zinc-200'}`}>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                            <span className="text-[15px] font-semibold tracking-wide">{t('analyze_chart') || 'Analyze Chart'}</span>
                            {activeTab === 'analyze' && (
                                <div className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-0' : 'left-0'} w-1.5 h-8 bg-cyan-500 ${isRtl ? 'rounded-l-full' : 'rounded-r-full'} shadow-[0_0_10px_rgba(6,182,212,0.5)]`}></div>
                            )}
                        </button>

                    </div>
                </nav>

                {/* Footer Link Area */}
                <div className="pt-2 mt-auto">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-2 opacity-50"></div>
                    <div className="flex flex-col items-center justify-center gap-2">
                        <a
                            href="https://roadmaps.ir"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-zinc-800/50 transition-all duration-300"
                        >
                            <span className="text-sm font-bold text-zinc-500 group-hover:text-emerald-400 transition-colors">
                                Roadmaps.ir
                            </span>
                            <svg className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                        <p className="text-[10px] text-zinc-600 text-center font-medium">
                            Designed with precision
                        </p>
                    </div>
                </div>
                
            </div>
        </aside>
    );
};

export default Sidebar;