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
        <div
            className="relative h-screen overflow-y-auto bg-[#141318] px-4 py-4 font-sans text-[#FCFCFD] selection:bg-[#2A292F] sm:px-8 sm:py-6"
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 opacity-30"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                    maskImage: 'radial-gradient(ellipse at center, black 15%, transparent 85%)',
                }}
            />

            <div className="relative mx-auto flex min-h-full w-full max-w-[1120px] items-center">
                <div className="grid w-full overflow-hidden rounded-[22px] border border-[#2F2E35] bg-[#1A191E] shadow-[0_28px_100px_rgba(0,0,0,0.42)] md:min-h-[500px] md:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="flex flex-col justify-between gap-10 border-b border-[#2F2E35] bg-[#1E1D22] p-6 sm:p-8 md:border-b-0 md:border-e">
                        <div>
                            <div className="flex items-center gap-3">
                                <div
                                    onDoubleClick={handleDevBypass}
                                    className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[#2F2E35] bg-[#141318]"
                                    title="Double-Click to bypass (Dev Mode)"
                                >
                                    <img src="/logo.png" alt="RoadMaps Logo" className="-translate-y-0.5 h-full w-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold leading-tight text-[#FCFCFD]">
                                        {t('Roadmaps')} <span className="font-normal text-[#BDBABD]">{t('App')}</span>
                                    </p>
                                    <p className="mt-1 text-[11px] font-medium uppercase text-[#7A797E]">
                                        {lang === 'fa' ? 'نسخه دسکتاپ' : 'Desktop client'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-10 hidden border-t border-[#2F2E35] pt-6 sm:block lg:mt-16">
                                <p className="text-[10px] font-semibold uppercase text-[#7A797E]">
                                    {lang === 'fa' ? 'محیط کاری' : 'Workspace'}
                                </p>
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-[#BDBABD]">RoadMaps</span>
                                    <span
                                        className="rounded-md border border-[#2F2E35] bg-[#2A292F] px-2 py-1 font-mono text-[10px] text-[#BDBABD]"
                                        aria-label={lang === 'fa' ? `نسخه برنامه ${appVersion}` : `App version ${appVersion}`}
                                    >
                                        v{appVersion}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="hidden items-center justify-between border-t border-[#2F2E35] pt-4 text-[11px] text-[#7A797E] sm:flex">
                            <span>{lang === 'fa' ? 'حساب کاربری' : 'Account access'}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#7A797E]" />
                        </div>
                    </aside>

                    <main className="flex min-h-[500px] flex-col p-6 sm:p-8 lg:p-10">
                        <header className="flex items-center justify-between gap-4">
                            <p className="text-[10px] font-semibold uppercase text-[#7A797E]">
                                {lang === 'fa' ? 'حساب کاربری / ورود' : 'Account / Sign in'}
                            </p>
                            <button
                                type="button"
                                onClick={toggleLanguage}
                                className="flex h-9 min-w-11 items-center justify-center rounded-lg border border-[#2F2E35] bg-[#1E1D22] px-3 text-xs font-semibold text-[#BDBABD] transition-colors hover:bg-[#2A292F] hover:text-[#FCFCFD]"
                                title="Switch Language"
                            >
                                {lang === 'fa' ? 'EN' : 'FA'}
                            </button>
                        </header>

                        <div className="my-auto w-full max-w-[470px] py-8 md:py-6">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-[#2F2E35] bg-[#1E1D22] px-3 py-2 text-[11px] font-medium text-[#BDBABD]">
                                <svg className="h-4 w-4 text-[#7A797E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 3 5 6v5c0 4.6 2.9 8.1 7 10 4.1-1.9 7-5.4 7-10V6l-7-3Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="m9 12 2 2 4-4" />
                                </svg>
                                {lang === 'fa' ? 'ورود به حساب RoadMaps' : 'RoadMaps account access'}
                            </div>

                            <h1 className="text-3xl font-bold leading-tight text-[#FCFCFD] sm:text-4xl">
                                {lang === 'fa' ? 'خوش آمدید' : 'Welcome back'}
                            </h1>
                            <p className="mt-3 max-w-[420px] text-sm leading-7 text-[#BDBABD]">
                                {lang === 'fa'
                                    ? 'برای ادامه، حساب کاربری خود را از طریق مرورگر متصل کنید.'
                                    : 'Connect your account through the browser to continue.'}
                            </p>

                            <div className="mt-9 space-y-3">
                                <button
                                    onClick={handleWebLogin}
                                    disabled={isLoading}
                                    className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#FCFCFD] px-5 py-3 text-sm font-bold text-[#141318] transition-colors hover:bg-[#BDBABD] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isLoading ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            <span>{statusMessage || (lang === 'fa' ? 'در حال اتصال...' : 'Connecting...')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{lang === 'fa' ? 'اتصال به حساب کاربری' : 'Connect to RoadMaps Web'}</span>
                                            <svg className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${lang === 'fa' ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 12h14m-6-6 6 6-6 6" />
                                            </svg>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDevBypass}
                                    disabled={isLoading}
                                    className="min-h-11 w-full rounded-lg border border-[#2F2E35] bg-[#2A292F] px-4 py-2.5 text-sm font-medium text-[#BDBABD] transition-colors hover:border-[#7A797E] hover:text-[#FCFCFD] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {lang === 'fa' ? 'ورود موقت (حالت توسعه)' : 'Enter app temporarily (Dev Mode)'}
                                </button>
                            </div>

                            {isLoading && (
                                <p className="mt-4 text-xs leading-6 text-[#7A797E]">
                                    {lang === 'fa'
                                        ? 'لطفاً ورود را در مرورگری که باز می‌شود کامل کنید.'
                                        : 'Complete sign-in in the browser window that opens.'}
                                </p>
                            )}

                            {errorMsg && (
                                <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3" role="alert">
                                    <p className="text-xs font-medium text-rose-300">{errorMsg}</p>
                                </div>
                            )}
                        </div>

                        <footer className="border-t border-[#2F2E35] pt-4 text-[11px] text-[#7A797E] sm:hidden">
                            {lang === 'fa' ? `نسخه دسکتاپ · v${appVersion}` : `Desktop client · v${appVersion}`}
                        </footer>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Login;