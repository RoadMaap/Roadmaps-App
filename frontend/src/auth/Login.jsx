import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { cn } from '@/lib/utils';
import BlurOutUp from '@/components/ui/blur-out-up';
import { Button } from '@/components/ui/button';
import { Globe } from '@/components/animate-ui/icons/globe';
import { AnimateIcon } from '@animate-ui/react/icons';
import { ExternalLink } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
    const { t, lang, toggleLanguage } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

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
                    const plan = result.plan || result.profile?.plan || 'Basic';
                    setStatusMessage(lang === 'fa' ? "ورود موفق! در حال انتقال..." : "Login Successful! Redirecting...");
                    setTimeout(() => {
                        onLoginSuccess(plan);
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
            setTimeout(() => onLoginSuccess('Basic'), 1000);
        }
    };

    const handleLogoLogin = () => onLoginSuccess('Basic', { persist: false });

    return (
        <div
            className="relative h-screen overflow-y-auto bg-[#141318] px-2 py-4 font-sans text-[#FCFCFD] selection:bg-[#2A292F] sm:px-8 sm:py-6"
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
            <AnimatedGridPattern
                numSquares={30}
                maxOpacity={0.1}
                duration={3}
                repeatDelay={1}
                className={cn(
                    'login-grid-mask pointer-events-none fixed inset-x-0 inset-y-[-30%] h-[200%] skew-y-12',
                    'text-[#25C77A]'
                )}
            />

            <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[1120px] items-center">
                <div dir={lang === 'en' ? 'rtl' : 'ltr'} className="grid min-w-0 w-full items-center gap-8 min-[900px]:min-h-[560px] min-[900px]:grid-cols-[460px_minmax(0,1fr)] min-[900px]:gap-12">
                    <main dir={lang === 'fa' ? 'rtl' : 'ltr'} className="flex min-h-[540px] min-w-0 w-full max-w-[460px] flex-col justify-center justify-self-center rounded-xl border border-[#2F2E35] bg-[#1A191E]/90 px-3 pb-4 pt-6 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:px-8 sm:pb-5 sm:pt-8 lg:px-10 lg:pb-6 lg:pt-10">
                        <header className="mx-auto flex w-full max-w-[380px] items-start justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={handleLogoLogin}
                                    aria-label={lang === 'fa' ? 'ورود موقت به برنامه' : 'Enter app temporarily'}
                                    className="flex items-center gap-3 border-0 bg-transparent p-0 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25C77A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A191E]"
                                    dir="ltr"
                                >
                                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                                        <img src="/logo.png" alt="Trading App Logo" className="-translate-y-0.5 h-full w-full object-contain" />
                                    </span>
                                    <p className="text-base font-bold leading-tight text-[#FCFCFD]">
                                        Trading <span className="font-normal text-[#BDBABD]">App</span>
                                    </p>
                                </button>
                                <p className="translate-x-1 text-[10px] font-semibold uppercase text-[#7A797E]">
                                    {lang === 'fa' ? 'حساب کاربری / ورود' : 'Account / log in'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={toggleLanguage}
                                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[#BDBABD] transition-colors hover:bg-transparent hover:text-[#FCFCFD]"
                                title={lang === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
                                aria-label={lang === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
                            >
                                <AnimateIcon animateOnHover>
                                    <Globe size={16} className="text-[#F28C45]" />
                                </AnimateIcon>
                            </button>
                        </header>

                        <div className="mt-10 flex flex-1 flex-col">
                            <div className="mx-auto mt-auto w-full max-w-[380px] space-y-3">
                                <p aria-live="polite" className="flex items-center gap-2 text-xs leading-5 text-[#BDBABD]">
                                    <span>{isLoading
                                        ? lang === 'fa'
                                            ? 'ورود را در پنجره مرورگر بازشده کامل کنید.'
                                            : 'Complete login in the browser window that opens.'
                                        : lang === 'fa'
                                            ? 'برای ادامه، حساب کاربری خود را از طریق مرورگر متصل کنید.'
                                            : 'Connect your account through the browser to continue.'}</span>
                                    {isLoading && <ExternalLink className="h-4 w-4 shrink-0 text-[#F28C45]" aria-hidden="true" />}
                                </p>
                                <div className="flex justify-center">
                                    <Button
                                        type="button"
                                        onClick={handleWebLogin}
                                        disabled={isLoading}
                                        variant="default"
                                        size="sm"
                                        className="h-9 min-h-9 w-[380px] max-w-full rounded-lg bg-[#FCFCFD] px-3 py-2 text-xs font-bold text-[#141318] shadow-none hover:bg-[#BDBABD] disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {isLoading && (
                                            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        )}
                                        <span>{isLoading ? statusMessage || (lang === 'fa' ? 'در حال اتصال...' : 'Connecting...') : lang === 'fa' ? 'اتصال به حساب کاربری' : 'Connect to RoadMaps Web'}</span>
                                        {!isLoading && (
                                            <svg className={lang === 'fa' ? 'rotate-180' : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 12h14m-6-6 6 6-6 6" />
                                            </svg>
                                        )}
                                    </Button>
                                </div>

                                <div aria-live="polite" className="mt-3 min-h-12">
                                </div>

                                {errorMsg && (
                                    <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3" role="alert">
                                        <p className="text-xs font-medium text-rose-300">{errorMsg}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </main>

                    <section className="hidden min-h-[420px] min-w-0 items-center justify-center min-[900px]:flex" dir="ltr">
                        <h1 className="whitespace-nowrap text-4xl font-semibold leading-tight text-[#FCFCFD] lg:text-5xl xl:text-6xl">
                            <span className="inline-block">
                                <BlurOutUp delay={600} stagger={600}>Welcome back</BlurOutUp>
                            </span>
                        </h1>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Login;