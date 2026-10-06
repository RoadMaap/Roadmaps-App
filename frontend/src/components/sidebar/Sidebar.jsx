import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { callOptionalEel } from '../../services/eelApi';

const Sidebar = ({ status, activeTab, onTabChange }) => {
    const { t, lang } = useLanguage();
    const [appVersion, setAppVersion] = useState('0.0.0');
    const markerAnimationRef = useRef(null);
    const isRtl = lang === 'fa';

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

    const connectionState = status === 'Running'
        ? {
            label: t('running') || 'RUNNING',
            indicator: 'bg-emerald-400',
            text: 'text-emerald-300',
        }
        : status === 'Ready'
            ? {
                label: t('ready') || 'READY',
                indicator: 'bg-blue-400',
                text: 'text-blue-300',
            }
            : {
                label: t('stopped') || 'STOPPED',
                indicator: 'bg-[#7A797E]',
                text: 'text-[#BDBABD]',
            };

    const navigationItems = [
        {
            id: 'dashboard',
            label: t('overview') || (isRtl ? 'نمای کلی' : 'Overview'),
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                </svg>
            ),
        },
        {
            id: 'strategies',
            label: t('strategy_manager') || (isRtl ? 'مدیریت استراتژی' : 'Strategy manager'),
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
                </svg>
            ),
        },
        {
            id: 'education',
            label: t('education_tab') || (isRtl ? 'سازنده هوشمند' : 'AI Builder'),
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6m-5 0v6.2L5.6 17a2.7 2.7 0 0 0 2.3 4h8.2a2.7 2.7 0 0 0 2.3-4L14 9.2V3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 15h8" />
                </svg>
            ),
        },
        {
            id: 'analyze',
            label: t('analyze_chart') || (isRtl ? 'تحلیل نمودار' : 'Chart analysis'),
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.8 12s3.2-6.5 9.2-6.5 9.2 6.5 9.2 6.5-3.2 6.5-9.2 6.5S2.8 12 2.8 12Z" />
                    <circle cx="12" cy="12" r="2.7" />
                </svg>
            ),
        },
    ];

    const handleNavigationClick = (event, item) => {
        markerAnimationRef.current?.cancel();
        markerAnimationRef.current = null;

        const sourceButton = event.currentTarget;
        const sourceMarker = sourceButton.querySelector('[data-sidebar-hover-marker]');
        const sourceRect = sourceMarker?.getBoundingClientRect();

        onTabChange(item.id);

        if (!sourceRect || activeTab === item.id) return;

        requestAnimationFrame(() => {
            const nav = sourceButton.closest('nav');
            const targetButton = nav?.querySelector('button[aria-current="page"]');
            const targetMarker = targetButton?.querySelector('[data-sidebar-active-marker]');
            if (!targetButton || !targetMarker) return;

            const targetButtonRect = targetButton.getBoundingClientRect();
            const targetRect = targetMarker.getBoundingClientRect();
            const sourceCenterX = sourceRect.left + sourceRect.width / 2;
            const sourceCenterY = sourceRect.top + sourceRect.height / 2;
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;

            const animation = targetMarker.animate(
                [
                    {
                        translate: `${sourceCenterX - targetCenterX}px ${sourceCenterY - targetCenterY}px`,
                        scale: `${sourceRect.width / targetRect.width} ${sourceRect.height / targetRect.height}`,
                        borderRadius: '999px',
                    },
                    {
                        translate: '0px 0px',
                        scale: '1 1',
                        borderRadius: '50%',
                    },
                ],
                { duration: 180, easing: 'ease-in-out' },
            );

            markerAnimationRef.current = animation;
            animation.onfinish = () => {
                if (markerAnimationRef.current === animation) {
                    markerAnimationRef.current = null;
                    animation.cancel();
                }
            };
            animation.oncancel = () => {
                if (markerAnimationRef.current === animation) {
                    markerAnimationRef.current = null;
                }
            };
        });
    };

    return (
        <aside
            className="relative z-30 flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-e border-[#2F2E35] bg-[#141318] font-sans text-[#FCFCFD]"
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="flex items-center gap-3 border-b border-[#2F2E35] px-1 pb-4">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1E1D22]">
                        <img src="/logo.png" alt="RoadMaps Logo" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-lg font-bold leading-tight text-[#FCFCFD]">
                            Trading <span className="font-normal text-[#BDBABD]">App</span>
                        </h1>
                        <p className="mt-1 text-[10px] font-medium text-[#7A797E]">
                            {isRtl ? 'نسخه' : 'VERSION'} v{appVersion}
                        </p>
                    </div>
                </div>

                <section className="mt-5 rounded-lg border border-[#2F2E35] bg-[#1E1D22] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase text-[#7A797E]">
                            {t('connection_status') || (isRtl ? 'وضعیت اتصال' : 'Connection status')}
                        </p>
                        <span className={`h-2 w-2 rounded-full ${connectionState.indicator} ${status === 'Running' ? 'animate-pulse' : ''}`} />
                    </div>
                    <p className={`mt-2 text-sm font-semibold ${connectionState.text}`}>
                        {connectionState.label}
                    </p>
                </section>

                <nav className="mt-7 flex-1" aria-label={isRtl ? 'منوی اصلی' : 'Main navigation'}>
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase text-[#7A797E]">
                        {t('menu') || (isRtl ? 'منو' : 'Menu')}
                    </p>
                    <div className="space-y-1">
                        {navigationItems.map((item) => {
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={(event) => handleNavigationClick(event, item)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-3 text-start transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45] ${
                                        isActive
                                            ? 'text-[#FCFCFD]'
                                            : 'text-[#BDBABD] hover:text-[#FCFCFD]'
                                    }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${isActive ? 'text-[#F28C45]' : 'text-[#7A797E] group-hover:text-[#F28C45]'}`}>
                                        <span className="h-[18px] w-[18px] [&>svg]:h-full [&>svg]:w-full [&>svg]:stroke-[1.6]">
                                            {item.icon}
                                        </span>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="inline-flex max-w-full items-center gap-2 text-[13px] font-medium">
                                            {isRtl && !isActive && (
                                                <span
                                                    aria-hidden="true"
                                                    data-sidebar-hover-marker
                                                    className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]"
                                                />
                                            )}
                                            <span className="truncate">{item.label}</span>
                                            {!isRtl && !isActive && (
                                                <span
                                                    aria-hidden="true"
                                                    data-sidebar-hover-marker
                                                    className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]"
                                                />
                                            )}
                                        </span>
                                    </span>
                                    {isActive && (
                                        <span
                                            aria-hidden="true"
                                            data-sidebar-active-marker
                                            style={{
                                                left: isRtl ? '8px' : 'calc(100% - 16px)',
                                                top: 'calc(50% - 4px)',
                                            }}
                                            className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#F28C45]"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <footer className="mt-5 border-t border-[#2F2E35] pt-3">
                    <a
                        href="https://roadmaps.ir"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-10 items-center justify-between rounded-lg px-3 text-xs font-medium text-[#7A797E] transition-colors hover:bg-[#1E1D22] hover:text-[#BDBABD]"
                    >
                        <span>Roadmaps.ir</span>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M14 4h6v6m0-6-9 9" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
                        </svg>
                    </a>
                </footer>
            </div>
        </aside>
    );
};

export default Sidebar;