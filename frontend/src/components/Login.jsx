import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { callOptionalEel } from '../services/eelApi';

const Login = ({ onLoginSuccess }) => {
    const { t, lang, toggleLanguage } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
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

    const handleWebLogin = async () => {
        setIsLoading(true);
        setErrorMsg("");
        
        // پیامی برای کاربر که بداند باید به مرورگر برود
        setStatusMessage(lang === 'fa' ? "در حال انتقال به مرورگر..." : "Redirecting to browser...");

        if (window.eel) {
            try {
                // این تابع در پایتون، مرورگر را باز می‌کند و تا لاگین کاربر منتظر می‌ماند
                const result = await window.eel.attempt_login()();
                
                if (result.success) {
                    setStatusMessage(lang === 'fa' ? "ورود موفق! در حال انتقال..." : "Login Successful! Redirecting...");
                    setTimeout(() => {
                        onLoginSuccess();
                    }, 1000);
                } else {
                    setErrorMsg(result.message || (lang === 'fa' ? "زمان ورود به پایان رسید یا خطا رخ داد." : "Login failed or timed out."));
                    setStatusMessage("");
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Login Error:", err);
                setErrorMsg(lang === 'fa' ? "خطا در ارتباط با سیستم." : "Core system connection error.");
                setStatusMessage("");
                setIsLoading(false);
            }
        } else {
            // برای تست در محیط مرورگر (بدون پایتون)
            setTimeout(() => onLoginSuccess(), 1000);
        }
    };

    // 👈 FIX: دولوپر بای‌پس بسیار ساده شد. فقط ۲ بار کلیک روی لوگو
    const handleDevBypass = () => {
        console.log("Dev Bypass Triggered!");
        onLoginSuccess();
    };

    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden font-sans selection:bg-emerald-500/30" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            
            {/* دکمه تغییر زبان */}
            <div className="absolute top-8 right-8 z-20">
                <button 
                    onClick={toggleLanguage} 
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all shadow-sm backdrop-blur-md"
                    title="Switch Language"
                >
                    <span className="text-xs font-bold font-mono">{lang === 'fa' ? 'EN' : 'FA'}</span>
                </button>
            </div>

            {/* پس‌زمینه افکت‌دار (Ambient Glow) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] opacity-50 pointer-events-none"></div>

            <div className="w-full max-w-md p-8 relative z-10">
                <div className="bg-[#121215]/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-10 shadow-2xl flex flex-col items-center text-center">
                    
                    {/* لوگو (با قابلیت ورود سریع با ۲ بار کلیک) */}
                    <div 
                        onDoubleClick={handleDevBypass}
                        className="w-20 h-20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.3)] mb-6 relative group cursor-pointer"
                        title="Double-Click to bypass (Dev Mode)"
                    >
                        <img src="/logo.png" alt="RoadMaps Logo" className="-translate-y-1 w-full h-full object-cover" />
                        <div className="absolute inset-0 rounded-2xl border-2 border-white/10 group-hover:scale-105 transition-transform duration-500"></div>
                    </div>

                    {/* پیام خوش‌آمدگویی */}
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        {t('Roadmaps')} <span className="text-emerald-500 font-light">App</span>
                    </h1>
                    <span
                        className="mb-5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] font-medium text-zinc-400"
                        aria-label={lang === 'fa' ? `نسخه برنامه ${appVersion}` : `App version ${appVersion}`}
                    >
                        v{appVersion}
                    </span>
                    <p className="text-sm text-zinc-400 mb-10 max-w-[280px] leading-relaxed">
                        {lang === 'fa' 
                            ? "سلام خوش آمدید! برای ادامه دکمه زیر را بزنید و مراحل را در مرورگر سیستم خود کامل کنید."
                            : "Hello and welcome! To proceed, tap the button below, continue in your browser, and enter the site."}
                    </p>

                    {/* دکمه اصلی اتصال به سایت */}
                    <div className="w-full">
                        <button
                            onClick={handleWebLogin}
                            disabled={isLoading}
                            className={`w-full relative group overflow-hidden rounded-xl bg-white text-black font-bold text-sm py-4 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-emerald-700 animate-pulse">
                                        {statusMessage || (lang === 'fa' ? "در حال انتظار..." : "Waiting...")}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span>{lang === 'fa' ? "اتصال به حساب کاربری" : "Connect to RoadMaps Web"}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 ${lang === 'fa' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleDevBypass}
                            disabled={isLoading}
                            className="mt-3 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {lang === 'fa' ? 'ورود موقت به برنامه (حالت توسعه)' : 'Enter app temporarily (Dev Mode)'}
                        </button>

                        {/* راهنما زیر دکمه در زمان لودینگ */}
                        {isLoading && (
                            <p className="text-[11px] text-zinc-500 mt-4 animate-fade-in">
                                {lang === 'fa' 
                                    ? "لطفاً در صفحه‌ای که در مرورگر باز شد لاگین کنید. این پنجره به‌طور خودکار بسته خواهد شد." 
                                    : "Please complete the login in your browser. This window will advance automatically."}
                            </p>
                        )}
                        
                        {/* نمایش ارور */}
                        {errorMsg && (
                            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg animate-fade-in-down">
                                <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Login;