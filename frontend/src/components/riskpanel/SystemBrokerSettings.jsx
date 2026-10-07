import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import InfoTooltip from './InfoTooltip';
import ToggleSwitch from './ToggleSwitch';

const activeCard = 'border-emerald-500/30 bg-emerald-500/5';
const inactiveCard = 'border-[#2F2E35] bg-[#141318]';
const inputFrame = 'flex h-9 min-w-0 items-center rounded-md border border-[#2F2E35] bg-[#141318] px-2 transition-colors focus-within:border-emerald-500/60';
const numberInput = 'w-full min-w-0 border-none bg-transparent text-xs text-[#FCFCFD] outline-none';

const SystemBrokerSettings = ({
    marginEnabled, setMarginEnabled, marginLimit, setMarginLimit,
    wuEnabled, setWuEnabled, wuCandles, setWuCandles,
    nfEnabled, handleNewsToggle, nfEur, setNfEur, nfUsd, setNfUsd,
    nfBefore, setNfBefore, nfAfter, setNfAfter, nextNews,
}) => {
    const { t } = useLanguage();

    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </span>
                <div className="min-w-0">
                    <h3 className="text-sm font-bold tracking-tight text-[#FCFCFD]">{t('system_broker_settings') || 'System & Broker Settings'}</h3>
                    <p className="text-[10px] font-medium text-[#7A797E]">{t('core_system_logic')}</p>
                </div>
            </header>

            <div className="space-y-3 rounded-md border border-[#2F2E35] bg-[#141318] p-3 sm:p-4">
                <article className={`rounded-md border p-3 transition-colors ${marginEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={marginEnabled} onChange={(event) => setMarginEnabled(event.target.checked)} label={t('margin_usage')} />
                        <div className="flex min-w-0 items-center">
                            <span className={`text-xs font-semibold ${marginEnabled ? 'text-[#FCFCFD]' : 'text-[#BDBABD]'}`}>{t('margin_usage')}</span>
                            <InfoTooltip text={t('margin_usage_desc')} />
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 transition-opacity ${marginEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <div className={`${inputFrame} flex-1`} dir="ltr">
                            <input type="number" value={marginLimit} onChange={(event) => setMarginLimit(event.target.value)} placeholder="50" className={numberInput} />
                            <span className="ml-2 text-[10px] font-semibold text-[#7A797E]">%</span>
                        </div>
                    </div>
                </article>

                <article className={`rounded-md border p-3 transition-colors ${wuEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={wuEnabled} onChange={(event) => setWuEnabled(event.target.checked)} label={t('warmup_system')} />
                        <div className="flex min-w-0 items-center">
                            <span className={`text-xs font-semibold ${wuEnabled ? 'text-[#FCFCFD]' : 'text-[#BDBABD]'}`}>{t('warmup_system')}</span>
                            <InfoTooltip text={t('warmup_desc')} />
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 transition-opacity ${wuEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <span className="w-16 shrink-0 text-[10px] font-semibold uppercase text-[#7A797E]">{t('candles')}</span>
                        <div className={`${inputFrame} flex-1`} dir="ltr">
                            <input type="number" value={wuCandles} onChange={(event) => setWuCandles(event.target.value)} placeholder="500" className={numberInput} />
                        </div>
                    </div>
                </article>

                <article className={`rounded-md border p-3 transition-colors ${nfEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={nfEnabled} onChange={handleNewsToggle} label={t('news_filter')} />
                        <div className="flex min-w-0 flex-1 items-center">
                            <span className={`text-xs font-semibold ${nfEnabled ? 'text-emerald-300' : 'text-[#BDBABD]'}`}>{t('news_filter')}</span>
                            <InfoTooltip text={t('news_filter_desc')} />
                        </div>
                        {nfEnabled && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />}
                    </div>

                    <div className={`transition-opacity ${nfEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <div className="mb-3 flex items-center gap-4 px-1">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input type="checkbox" checked={nfEur} onChange={(event) => setNfEur(event.target.checked)} className="h-4 w-4 accent-[#F28C45]" />
                                <span className={`text-[10px] font-semibold ${nfEur ? 'text-emerald-300' : 'text-[#7A797E]'}`}>EUR</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input type="checkbox" checked={nfUsd} onChange={(event) => setNfUsd(event.target.checked)} className="h-4 w-4 accent-[#F28C45]" />
                                <span className={`text-[10px] font-semibold ${nfUsd ? 'text-emerald-300' : 'text-[#7A797E]'}`}>USD</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className={`${inputFrame} gap-2`} dir="ltr">
                                <span className="w-20 shrink-0 truncate text-[9px] font-semibold uppercase text-[#7A797E]">{t('mins_before')}</span>
                                <input type="number" value={nfBefore} onChange={(event) => setNfBefore(event.target.value)} className={`${numberInput} text-right`} />
                            </label>
                            <label className={`${inputFrame} gap-2`} dir="ltr">
                                <span className="w-20 shrink-0 truncate text-[9px] font-semibold uppercase text-[#7A797E]">{t('mins_after')}</span>
                                <input type="number" value={nfAfter} onChange={(event) => setNfAfter(event.target.value)} className={`${numberInput} text-right`} />
                            </label>
                        </div>
                        {nextNews && (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[#E47770]/20 bg-[#E47770]/5 p-2.5">
                                <span className="min-w-0 truncate text-[10px] text-[#BDBABD]">
                                    <strong className="text-[#FCFCFD]">{nextNews.currency}</strong> - {nextNews.title}
                                </span>
                                <span className={`shrink-0 text-[10px] font-semibold ${nextNews.countdown.includes('NOW') ? 'animate-pulse text-[#E47770]' : 'text-[#BDBABD]'}`}>
                                    {nextNews.countdown}
                                </span>
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </section>
    );
};

export default SystemBrokerSettings;