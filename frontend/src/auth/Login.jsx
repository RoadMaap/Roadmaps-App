import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { cn } from '@/lib/utils';
import BlurOutUp from '@/components/ui/blur-out-up';
import { Button } from '@/components/ui/button';
import { Globe } from '@/components/animate-ui/icons/globe';
import { AnimateIcon } from '@animate-ui/react/icons';
import { ExternalLink } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import TextMorph from '@/components/ui/text-morph';
import { Spinner } from '@/components/kibo-ui/spinner';

const Login = ({ onLoginSuccess }) => {
    const { t, lang, toggleLanguage } = useLanguage();
    const shouldReduceMotion = useReducedMotion();
    const mainRef = useRef(null);
    const previousMainX = useRef(null);
    const [isWideLayout, setIsWideLayout] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches
    ));
    const [isLoading, setIsLoading] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 900px)');
        const handleLayoutChange = (event) => {
            previousMainX.current = mainRef.current?.getBoundingClientRect().x ?? null;
            setIsWideLayout(event.matches);
        };
        mediaQuery.addEventListener('change', handleLayoutChange);
        return () => mediaQuery.removeEventListener('change', handleLayoutChange);
    }, []);

    useLayoutEffect(() => {
        const main = mainRef.current;
        const previousX = previousMainX.current;
        previousMainX.current = null;
        if (!main || previousX === null || shouldReduceMotion) return;

        const offsetX = previousX - main.getBoundingClientRect().x;
        if (Math.abs(offsetX) < 1) return;

        const animation = main.animate(
            [{ transform: `translateX(${offsetX}px)` }, { transform: 'translateX(0)' }],
            { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
        return () => animation.cancel();
    }, [isWideLayout, shouldReduceMotion]);

    const handleWebLogin = async () => {
        setIsLoading(true);
        setIsCancelling(false);
        setErrorMsg("");
        
        // پیامی برای کاربر که بداند باید به مرورگر برود
        setStatusMessage(lang === 'fa' ? "در حال انتقال به مرورگر..." : "Redirecting to browser...");

        if (window.eel) {
            try {
                // این تابع در پایتون، مرورگر را باز می‌کند و تا لاگین کاربر منتظر می‌ماند
                const result = await window.eel.attempt_login()();

                if (result?.cancelled) {
                    setStatusMessage("");
                    setErrorMsg("");
                    setIsCancelling(false);
                    setIsLoading(false);
                    return;
                }
                
                if (result.success) {
                    const plan = result.plan || result.profile?.plan || 'Basic';
                    setStatusMessage(lang === 'fa' ? "ورود موفق! در حال انتقال..." : "Login Successful! Redirecting...");
                    setTimeout(() => {
                        onLoginSuccess(plan);
                    }, 1000);
                } else {
                    setErrorMsg(result.message || (lang === 'fa' ? "زمان ورود به پایان رسید یا خطا رخ داد." : "Login failed or timed out."));
                    setStatusMessage("");
                    setIsCancelling(false);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Login Error:", err);
                setErrorMsg(lang === 'fa' ? "خطا در ارتباط با سیستم." : "Core system connection error.");
                setStatusMessage("");
                setIsCancelling(false);
                setIsLoading(false);
            }
        } else {
            // برای تست در محیط مرورگر (بدون پایتون)
            setTimeout(() => onLoginSuccess('Basic'), 1000);
        }
    };

    const handleCancelLogin = async () => {
        if (typeof window.eel?.cancel_login !== 'function') {
            setErrorMsg(lang === 'fa' ? 'لغو ورود در دسترس نیست.' : 'Login cancellation is unavailable.');
            return;
        }

        setIsCancelling(true);
        setStatusMessage(lang === 'fa' ? 'در حال لغو...' : 'Cancelling...');
        try {
            await window.eel.cancel_login()();
        } catch (error) {
            console.error('Login cancellation failed:', error);
            setErrorMsg(lang === 'fa' ? 'لغو ورود انجام نشد.' : 'Could not cancel login.');
            setStatusMessage(lang === 'fa' ? 'در حال انتقال به مرورگر...' : 'Redirecting to browser...');
            setIsCancelling(false);
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
                <div
                    dir={lang === 'en' ? 'rtl' : 'ltr'}
                    className={cn(
                        'grid min-w-0 w-full items-center',
                        isWideLayout
                            ? 'min-h-[560px] grid-cols-[460px_minmax(0,1fr)] gap-12'
                            : 'grid-cols-1 gap-8'
                    )}
                >
                    <main
                        ref={mainRef}
                        dir={lang === 'fa' ? 'rtl' : 'ltr'}
                        className="flex min-h-[540px] min-w-0 w-full max-w-[460px] flex-col justify-center justify-self-center rounded-xl border border-[#2F2E35] bg-[#1A191E]/90 px-3 pb-4 pt-6 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:px-8 lg:px-10"
                    >
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
                            <HoverCard>
                                <HoverCardTrigger
                                    delay={180}
                                    render={
                                        <button
                                            type="button"
                                            onClick={toggleLanguage}
                                            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[#BDBABD] transition-colors hover:bg-transparent hover:text-[#FCFCFD]"
                                            aria-label={lang === 'fa' ? 'تغییر زبان به انگلیسی' : 'Switch to Persian'}
                                        />
                                    }
                                >
                                    <AnimateIcon animateOnHover>
                                        <Globe size={16} className="text-[#F28C45]" />
                                    </AnimateIcon>
                                </HoverCardTrigger>
                                <HoverCardContent side="left" align="center" className="login-language-hover-card w-auto max-w-[220px] border border-[#2F2E35] bg-[#1A191E] px-3 py-2 text-xs text-[#FCFCFD] shadow-lg">
                                    {lang === 'fa' ? 'تغییر زبان به انگلیسی' : 'Switch to Persian'}
                                </HoverCardContent>
                            </HoverCard>
                        </header>

                        {!isWideLayout && (
                            <h1 className="mx-auto w-full max-w-[380px] pt-8 text-center text-2xl font-semibold leading-tight text-[#FCFCFD]">
                                <span className="inline-block">
                                    <BlurOutUp delay={600} stagger={600}>Welcome back</BlurOutUp>
                                </span>
                            </h1>
                        )}

                        <div className="mt-10 flex flex-1 flex-col">
                            <div className="mx-auto mt-auto w-full max-w-[380px] space-y-3">
                                <p aria-live="polite" className="flex items-center gap-2 text-xs leading-5 text-[#BDBABD]">
                                    <TextMorph
                                        mode="words"
                                        duration={300}
                                        stagger={12}
                                        text={isLoading
                                            ? lang === 'fa'
                                                ? 'ورود را در پنجره مرورگر بازشده کامل کنید.'
                                                : 'Complete login in the browser window that opens.'
                                            : lang === 'fa'
                                                ? 'برای ادامه، حساب کاربری خود را از طریق مرورگر متصل کنید.'
                                                : 'Connect your account through the browser to continue.'}
                                    />
                                    {isLoading && <ExternalLink className="h-3 w-3 shrink-0 text-[#F28C45]" aria-hidden="true" />}
                                </p>
                                <div className="flex justify-center">
                                    <div className="relative w-[380px] max-w-full" dir="ltr">
                                        <Button
                                            type="button"
                                            onClick={handleWebLogin}
                                            disabled={isLoading}
                                            variant="default"
                                            size="sm"
                                            dir={lang === 'fa' ? 'rtl' : 'ltr'}
                                            className={cn(
                                                'group h-9 min-h-9 w-full rounded-lg bg-[#FCFCFD] px-3 py-2 text-xs font-bold text-[#141318] shadow-none hover:bg-[#BDBDBD] disabled:cursor-not-allowed disabled:opacity-70',
                                                isLoading && 'pr-[76px]'
                                            )}
                                        >
                                            <TextMorph
                                                align="center"
                                                mode="words"
                                                duration={240}
                                                stagger={10}
                                                text={isLoading ? statusMessage || (lang === 'fa' ? 'در حال اتصال...' : 'Connecting...') : lang === 'fa' ? 'اتصال به حساب کاربری' : 'Connect to RoadMaps Web'}
                                            />
                                            <span className={cn('relative inline-flex size-3.5 shrink-0 items-center justify-center', lang === 'fa' && 'order-first')}>
                                                <AnimatePresence initial={false} mode="wait">
                                                    {isLoading ? (
                                                        <motion.span
                                                            key="bars"
                                                            className="absolute inset-0 inline-flex items-center justify-center"
                                                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
                                                            transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                                                        >
                                                            <Spinner variant="bars" size={14} className="size-3.5 shrink-0 text-[#141318]" aria-hidden="true" />
                                                        </motion.span>
                                                    ) : (
                                                        <motion.svg
                                                            key="arrow"
                                                            className={cn('absolute inset-0 size-3.5', lang === 'fa' && 'rotate-180')}
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            aria-hidden="true"
                                                            initial={false}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={shouldReduceMotion ? undefined : { opacity: 0, x: 8 }}
                                                            whileHover={shouldReduceMotion ? undefined : { x: 2 }}
                                                            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 12h14m-6-6 6 6-6 6" />
                                                        </motion.svg>
                                                    )}
                                                </AnimatePresence>
                                            </span>
                                        </Button>
                                        <AnimatePresence initial={false}>
                                            {isLoading && (
                                                <motion.div
                                                    key="cancel-login"
                                                    className="absolute inset-y-0 right-1 z-10 flex items-center"
                                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
                                                    transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                                                >
                                                    <Button
                                                        type="button"
                                                        onClick={handleCancelLogin}
                                                        disabled={isCancelling}
                                                        variant="destructive"
                                                        size="sm"
                                                        className="h-7 min-h-7 shrink-0 rounded-md border border-red-500 bg-red-600 px-2 text-[10px] font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
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

                    <section
                        className={cn('min-h-[420px] min-w-0 items-center justify-center', isWideLayout ? 'flex' : 'hidden')}
                        dir="ltr"
                    >
                        <h1 className="whitespace-nowrap text-4xl font-semibold leading-tight text-[#FCFCFD] min-[900px]:text-[42px] lg:text-5xl xl:text-6xl">
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