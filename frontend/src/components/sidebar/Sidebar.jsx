import React, { useRef, useState } from 'react';
import chart2Linear from '@iconify-icons/solar/chart-2-linear';
import magicStick3Linear from '@iconify-icons/solar/magic-stick-3-linear';
import settingsLinear from '@iconify-icons/solar/settings-linear';
import widget5Linear from '@iconify-icons/solar/widget-5-linear';
import solarInfo from '@iconify-json/solar/info.json';
import { useLanguage } from '../../context/LanguageContext';

const Sidebar = ({ status, activeTab, onTabChange }) => {
    const { t, lang } = useLanguage();
    const markerAnimationRef = useRef(null);
    const [isCollapsed, setIsCollapsed] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    ));
    const isRtl = lang === 'fa';

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
            icon: widget5Linear,
        },
        {
            id: 'strategies',
            label: t('strategy_manager') || (isRtl ? 'مدیریت استراتژی' : 'Strategy manager'),
            icon: settingsLinear,
        },
        {
            id: 'education',
            label: t('education_tab') || (isRtl ? 'سازنده هوشمند' : 'AI Builder'),
            icon: magicStick3Linear,
        },
        {
            id: 'analyze',
            label: t('analyze_chart') || (isRtl ? 'تحلیل نمودار' : 'Chart analysis'),
            icon: chart2Linear,
        },
    ];

    const handleNavigationClick = (event, item) => {
        markerAnimationRef.current?.cancel();
        markerAnimationRef.current = null;

        const sourceButton = event.currentTarget;
        const nav = sourceButton.closest('nav');
        const sourceMarker = isCollapsed
            ? nav?.querySelector('button[aria-current="page"] [data-sidebar-active-marker]')
            : sourceButton.querySelector('[data-sidebar-hover-marker]');
        const sourceRect = sourceMarker?.getBoundingClientRect();

        onTabChange(item.id);

        if (!sourceRect || activeTab === item.id) return;

        requestAnimationFrame(() => {
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
            className={`relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-e border-[#2F2E35] bg-[#141318] font-sans text-[#FCFCFD] transition-[width] duration-300 ${isCollapsed ? 'w-[76px]' : 'w-[260px]'}`}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <div className="flex min-h-0 flex-1 flex-col p-4">
                <div dir={isRtl ? 'rtl' : 'ltr'} className="flex flex-col items-start px-0 pb-2 pt-0">
                    <div className="ms-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                        <img src="/logo.png" alt="RoadMaps Logo" className="-translate-y-0.5 h-full w-full object-cover" />
                    </div>
                </div>

                <nav className="mt-3 flex-1" aria-label={isRtl ? 'منوی اصلی' : 'Main navigation'}>
                    <div
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={`mb-2 flex h-8 items-center border-b border-[#2F2E35] ${isCollapsed ? 'justify-start' : 'justify-between'}`}
                    >
                        <button
                            type="button"
                            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                            aria-label={isCollapsed ? (isRtl ? 'باز کردن نوار کناری' : 'Expand sidebar') : (isRtl ? 'بستن نوار کناری' : 'Collapse sidebar')}
                            aria-expanded={!isCollapsed}
                            title={isCollapsed ? (isRtl ? 'باز کردن نوار کناری' : 'Expand sidebar') : (isRtl ? 'بستن نوار کناری' : 'Collapse sidebar')}
                            className="ms-1.5 -translate-y-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#7A797E] transition-colors hover:text-[#F28C45] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45]"
                        >
                            <svg
                                className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? (isRtl ? 'rotate-180' : '') : (isRtl ? '' : 'rotate-180')}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                        <p
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className={`ms-2 text-[10px] font-semibold uppercase text-[#7A797E] transition-colors hover:text-[#F28C45] ${isCollapsed ? 'hidden' : ''}`}
                        >
                            {t('menu') || (isRtl ? 'منو' : 'Menu')}
                        </p>
                    </div>
                    <div aria-hidden="true" className="mb-2 h-3" />
                    <div className="space-y-1">
                        {navigationItems.map((item) => {
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={(event) => handleNavigationClick(event, item)}
                                    aria-current={isActive ? 'page' : undefined}
                                    title={isCollapsed ? item.label : undefined}
                                    dir={isRtl ? 'rtl' : 'ltr'}
                                    className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-1.5 text-start transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45] ${
                                        isActive
                                            ? 'text-[#FCFCFD]'
                                            : 'text-[#BDBABD] hover:text-[#FCFCFD]'
                                    }`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${isActive ? 'text-[#F28C45]' : 'text-[#7A797E] group-hover:text-[#F28C45]'}`}>
                                        <span className="h-[18px] w-[18px]">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox={`${item.icon.left ?? 0} ${item.icon.top ?? 0} ${item.icon.width ?? solarInfo.height} ${item.icon.height ?? solarInfo.height}`}
                                                className="h-full w-full"
                                                aria-hidden="true"
                                                focusable="false"
                                                dangerouslySetInnerHTML={{ __html: item.icon.body }}
                                            />
                                        </span>
                                    </span>
                                    {!isCollapsed && <span className="min-w-0 flex-1">
                                        <span className="inline-flex max-w-full items-center gap-2 text-[13px] font-medium">
                                            <span className="truncate">{item.label}</span>
                                            {!isRtl && !isActive && (
                                                <span
                                                    aria-hidden="true"
                                                    data-sidebar-hover-marker
                                                    className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]"
                                                />
                                            )}
                                            {isRtl && !isActive && (
                                                <span
                                                    aria-hidden="true"
                                                    data-sidebar-hover-marker
                                                    className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]"
                                                />
                                            )}
                                        </span>
                                    </span>}
                                    {isActive && (
                                        <span
                                            aria-hidden="true"
                                            data-sidebar-active-marker
                                            style={{
                                                left: isCollapsed ? (isRtl ? '16px' : '18px') : isRtl ? '8px' : 'calc(100% - 16px)',
                                                top: isCollapsed ? 'calc(50% + 14px)' : 'calc(50% - 4px)',
                                            }}
                                            className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#F28C45] transition-[top,left] duration-300 ease-in-out"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <footer className="mt-5 border-t border-[#2F2E35] pt-3">
                    <div className="space-y-1">
                        <section
                            aria-label={connectionState.label}
                            title={isCollapsed ? `${t('connection_status') || (isRtl ? 'وضعیت اتصال' : 'Connection status')}: ${connectionState.label}` : undefined}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className="flex min-h-10 min-w-0 items-center rounded-lg hover:bg-[#1E1D22]"
                        >
                            <span className="flex h-10 w-11 shrink-0 items-center justify-center">
                                <span className={`h-2 w-2 rounded-full ${connectionState.indicator} ${status === 'Running' ? 'animate-pulse' : ''}`} />
                            </span>
                            {!isCollapsed && (
                                <div dir={isRtl ? 'rtl' : 'ltr'} className="ms-1.5 min-w-0">
                                    <p className="truncate text-[9px] font-semibold uppercase text-[#7A797E]">
                                        {t('connection_status') || (isRtl ? 'وضعیت اتصال' : 'Connection status')}
                                    </p>
                                    <p className={`truncate text-xs font-semibold ${connectionState.text}`}>
                                        {connectionState.label}
                                    </p>
                                </div>
                            )}
                        </section>
                        <a
                            href="https://roadmaps.ir"
                            target="_blank"
                            rel="noopener noreferrer"
                            title={isCollapsed ? 'Roadmaps.ir' : undefined}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            className="flex min-h-10 min-w-0 items-center rounded-lg text-[11px] font-medium text-[#7A797E] transition-colors hover:bg-[#1E1D22] hover:text-[#BDBABD]"
                        >
                            <span className="flex h-10 w-11 shrink-0 items-center justify-center">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M14 4h6v6m0-6-9 9" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
                                </svg>
                            </span>
                            {!isCollapsed && <span dir={isRtl ? 'rtl' : 'ltr'} className="ms-1.5 truncate">Roadmaps.ir</span>}
                        </a>
                    </div>
                </footer>
            </div>
        </aside>
    );
};

export default Sidebar;