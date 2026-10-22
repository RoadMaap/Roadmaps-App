import React, { useRef, useState } from 'react';
import chart2Linear from '@iconify-icons/solar/chart-2-linear';
import magicStick3Linear from '@iconify-icons/solar/magic-stick-3-linear';
import settingsLinear from '@iconify-icons/solar/settings-linear';
import widget5Linear from '@iconify-icons/solar/widget-5-linear';
import solarInfo from '@iconify-json/solar/info.json';
import { CandlestickChart } from 'lucide-react';
import { AnimateIcon } from '@animate-ui/react/icons';
import { useLanguage } from '../../context/LanguageContext';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card';
import MorphIcon from '../smoothui/morph-icon';

const Sidebar = ({ status, activeTab, appMode = 'live', hasUnreadBacktestResult = false, onTabChange }) => {
    const { t, lang } = useLanguage();
    const markerAnimationRef = useRef(null);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const isRtl = lang === 'fa';
    const sidebarToggleLabel = isCollapsed
        ? (isRtl ? 'باز کردن نوار کناری' : 'Expand sidebar')
        : (isRtl ? 'بستن نوار کناری' : 'Collapse sidebar');

    const connectionState = status === 'Running'
        ? {
            label: t('running') || 'RUNNING',
            indicator: 'bg-emerald-400',
            text: 'text-emerald-300',
        }
        : status === 'Ready'
            ? {
                label: t('ready') || 'READY',
                indicator: 'bg-emerald-400',
                text: 'text-emerald-300',
            }
            : {
                label: t('stopped') || 'STOPPED',
                indicator: 'bg-rose-500',
                text: 'text-rose-400',
            };

    const liveNavigationItems = [
        { id: 'dashboard', label: t('overview') || (isRtl ? 'نمای کلی' : 'Overview'), icon: widget5Linear },
        { id: 'strategies', label: t('strategy_manager') || (isRtl ? 'مدیریت استراتژی' : 'Strategy manager'), icon: settingsLinear },
        { id: 'education', label: t('education_tab') || (isRtl ? 'سازنده هوشمند' : 'AI Builder'), icon: magicStick3Linear },
        { id: 'analyze', label: t('analyze_chart') || (isRtl ? 'تحلیل نمودار' : 'Chart analysis'), icon: chart2Linear },
    ];

    const backtestNavigationItems = [
        { id: 'bt_overview', label: t('overview') || (isRtl ? 'مرور کلی' : 'Overview'), icon: widget5Linear },
        { id: 'bt_strategies', label: t('strategy_manager') || (isRtl ? 'مدیریت استراتژی' : 'Strategy Manager'), icon: settingsLinear },
        { id: 'bt_analytics', label: t('bt_analytics') || (isRtl ? 'تحلیل و گزارش کوانت' : 'Quant Analytics'), icon: chart2Linear },
        { id: 'bt_plot', label: t('bt_plot') || (isRtl ? 'پلات نمودار' : 'Chart Plot'), iconComponent: CandlestickChart },
        { id: 'education', label: t('education_tab') || (isRtl ? 'ربات‌سازی با هوش مصنوعی' : 'AI Builder'), icon: magicStick3Linear },
    ];

    const navigationItems = appMode === 'backtest' ? backtestNavigationItems : liveNavigationItems;

    const handleSidebarToggle = () => {
        markerAnimationRef.current?.cancel();
        markerAnimationRef.current = null;

        const marker = document.querySelector('nav button[aria-current="page"] [data-sidebar-active-marker]');
        const startRect = marker?.getBoundingClientRect();
        setIsCollapsed((collapsed) => !collapsed);

        if (!startRect) return;

        requestAnimationFrame(() => {
            const targetMarker = document.querySelector('nav button[aria-current="page"] [data-sidebar-active-marker]');
            if (!targetMarker) return;

            const targetRect = targetMarker.getBoundingClientRect();
            const animation = targetMarker.animate(
                [
                    { translate: `${startRect.left - targetRect.left}px ${startRect.top - targetRect.top}px` },
                    { translate: '0px 0px' },
                ],
                { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            );
            markerAnimationRef.current = animation;
            animation.onfinish = () => {
                if (markerAnimationRef.current === animation) {
                    markerAnimationRef.current = null;
                    animation.cancel();
                }
            };
        });
    };

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
                    { translate: '0px 0px', scale: '1 1', borderRadius: '50%' },
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
        <aside className={`absolute inset-y-0 start-0 z-30 flex h-full shrink-0 flex-col overflow-hidden border-e border-[#2F2E35] bg-[#141318] font-sans text-[#FCFCFD] transition-[width] duration-300 ${isCollapsed ? 'w-[76px]' : 'w-[260px]'}`} dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex min-h-0 flex-1 flex-col p-4">
                <div dir={isRtl ? 'rtl' : 'ltr'} className="flex items-center justify-start pb-2 pt-0">
                    <div className="ms-1.5 h-8 w-8 shrink-0 overflow-hidden rounded-lg">
                        <img src="/img/trading-app-logo.png" alt="Trading App Logo" className="h-full w-full object-contain" />
                    </div>
                </div>

                <nav className="mt-3 flex-1" aria-label={isRtl ? 'منوی اصلی' : 'Main navigation'}>
                    <div dir={isRtl ? 'rtl' : 'ltr'} className="mb-2 flex h-8 items-center justify-between border-b border-[#2F2E35]">
                        <HoverCard>
                            <HoverCardTrigger
                                delay={180}
                                render={(
                                    <button type="button" onClick={handleSidebarToggle} aria-label={sidebarToggleLabel} aria-expanded={!isCollapsed} className="ms-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#7A797E] transition-colors hover:text-[#F28C45] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45]">
                                        <MorphIcon variant="sidebar" active={!isCollapsed} size={18} />
                                    </button>
                                )}
                            />
                            {isCollapsed && (
                                <HoverCardContent side={isRtl ? 'left' : 'right'} sideOffset={8} align="center" className="login-language-hover-card w-auto max-w-[220px] border border-[#2F2E35] bg-[#1A191E] px-3 py-2 text-xs text-[#FCFCFD] shadow-lg">
                                    {sidebarToggleLabel}
                                </HoverCardContent>
                            )}
                        </HoverCard>
                        <p dir={isRtl ? 'rtl' : 'ltr'} className={`text-[10px] font-semibold uppercase text-[#7A797E] transition-colors hover:text-[#F28C45] ${isCollapsed ? 'hidden' : ''}`}>
                            {t('menu') || (isRtl ? 'منو' : 'Menu')}
                        </p>
                    </div>
                    <div aria-hidden="true" className="mb-2 h-3" />
                    <div className="space-y-1">
                        {navigationItems.map((item) => {
                            const isActive = activeTab === item.id;
                            const button = (
                                <button key={item.id} type="button" onClick={(event) => handleNavigationClick(event, item)} aria-label={isCollapsed ? item.label : undefined} aria-current={isActive ? 'page' : undefined} dir={isRtl ? 'rtl' : 'ltr'} className={`group relative flex min-h-11 w-full items-center gap-3 rounded-lg border border-transparent px-1.5 text-start transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#F28C45] ${isActive ? 'text-[#FCFCFD]' : 'text-[#BDBABD] hover:text-[#FCFCFD]'}`}>
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${isActive ? 'text-[#F28C45]' : 'text-[#7A797E] group-hover:text-[#F28C45]'}`}>
                                        <span className="flex h-[18px] w-[18px] items-center justify-center">
                                            <AnimateIcon animateOnHover>
                                                {item.iconComponent
                                                    ? <item.iconComponent className="h-[18px] w-[18px]" aria-hidden="true" />
                                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${item.icon.left ?? 0} ${item.icon.top ?? 0} ${item.icon.width ?? solarInfo.height} ${item.icon.height ?? solarInfo.height}`} className="h-full w-full" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: item.icon.body }} />}
                                            </AnimateIcon>
                                        </span>
                                    </span>
                                    <span className={`min-w-0 flex-1 ${isCollapsed ? 'hidden' : ''}`}><span className="inline-flex max-w-full items-center gap-2 text-[13px] font-medium"><span className="truncate">{item.label}</span>{appMode === 'backtest' && item.id === 'bt_analytics' && hasUnreadBacktestResult && <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-bold leading-none text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.3)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />{isRtl ? 'جدید' : 'NEW'}</span>}{!isRtl && !isActive && <span aria-hidden="true" data-sidebar-hover-marker className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]" />}{isRtl && !isActive && <span aria-hidden="true" data-sidebar-hover-marker className="h-[2px] w-3 shrink-0 rounded-full bg-[#F28C45] transition-[clip-path] duration-[240ms] ease-in-out [clip-path:inset(0_0_0_100%)] group-hover:[clip-path:inset(0)] group-focus-visible:[clip-path:inset(0)]" />}</span></span>
                                    {appMode === 'backtest' && item.id === 'bt_analytics' && hasUnreadBacktestResult && <span aria-label={isRtl ? 'گزارش جدید' : 'New report'} className={`absolute end-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.85)] ${isCollapsed ? '' : 'hidden'}`} />}
                                    {isActive && <span key="active-marker" aria-hidden="true" data-sidebar-active-marker style={{ left: isCollapsed ? (isRtl ? '16px' : '18px') : isRtl ? '8px' : 'calc(100% - 16px)', top: isCollapsed ? 'calc(50% + 14px)' : 'calc(50% - 4px)' }} className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#F28C45]" />}
                                </button>
                            );
                            if (!isCollapsed) return button;
                            return (
                                <HoverCard key={item.id}>
                                    <HoverCardTrigger delay={180} render={button} />
                                    <HoverCardContent side={isRtl ? 'left' : 'right'} sideOffset={8} align="center" className="login-language-hover-card w-auto max-w-[220px] border border-[#2F2E35] bg-[#1A191E] px-3 py-2 text-xs text-[#FCFCFD] shadow-lg">
                                        {item.label}
                                    </HoverCardContent>
                                </HoverCard>
                            );
                        })}
                    </div>
                </nav>

                <footer className="mt-5 border-t border-[#2F2E35] pt-3">
                    <div className="space-y-1">
                        <section aria-label={connectionState.label} title={isCollapsed ? `${t('connection_status') || (isRtl ? 'وضعیت اتصال' : 'Connection status')}: ${connectionState.label}` : undefined} dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-10 min-w-0 items-center rounded-lg hover:bg-[#1E1D22]">
                            <span className="flex h-10 w-11 shrink-0 items-center justify-center"><span className={`h-2 w-2 rounded-full ${connectionState.indicator} ${status !== 'Disconnected' ? 'animate-pulse' : ''}`} /></span>
                            {!isCollapsed && <div dir={isRtl ? 'rtl' : 'ltr'} className="ms-1.5 min-w-0"><p className="truncate text-[9px] font-semibold uppercase text-[#7A797E]">{t('connection_status') || (isRtl ? 'وضعیت اتصال' : 'Connection status')}</p><p className={`truncate text-xs font-semibold ${connectionState.text}`}>{connectionState.label}</p></div>}
                        </section>
                        <a href="https://roadmaps.ir" target="_blank" rel="noopener noreferrer" title={isCollapsed ? 'Roadmaps.ir' : undefined} dir={isRtl ? 'rtl' : 'ltr'} className="flex min-h-10 min-w-0 items-center rounded-lg text-[11px] font-medium text-[#7A797E] transition-colors hover:bg-[#1E1D22] hover:text-[#BDBABD]">
                            <span className="flex h-10 w-11 shrink-0 items-center justify-center"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M14 4h6v6m0-6-9 9" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></svg></span>
                            {!isCollapsed && <span dir={isRtl ? 'rtl' : 'ltr'} className="ms-1.5 truncate">Roadmaps.ir</span>}
                        </a>
                    </div>
                </footer>
            </div>
        </aside>
    );
};

export default Sidebar;