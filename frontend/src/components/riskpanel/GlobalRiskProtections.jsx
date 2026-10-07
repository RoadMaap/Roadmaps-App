import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ToggleSwitch from './ToggleSwitch';

const activeCard = 'border-emerald-500/30 bg-emerald-500/5';
const inactiveCard = 'border-[#2F2E35] bg-[#141318]';
const inputFrame = 'flex h-9 min-w-0 items-center rounded-md border border-[#2F2E35] bg-[#141318] px-2 transition-colors focus-within:border-emerald-500/60';
const numberInput = 'w-full min-w-0 border-none bg-transparent text-xs text-[#FCFCFD] outline-none';

const GlobalRiskProtections = ({
    beEnabled, setBeEnabled, beTrigger, setBeTrigger,
    pcEnabled, setPcEnabled, pcVolume, setPcVolume, pcTrigger, setPcTrigger,
    tlEnabled, setTlEnabled, tlTrigger, setTlTrigger,
}) => {
    const { t } = useLanguage();

    return (
        <section className="flex flex-col gap-4">
            <header className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </span>
                <div className="min-w-0">
                    <h3 className="text-sm font-bold tracking-tight text-[#FCFCFD]">{t('global_risk_protections') || 'Global Risk Management'}</h3>
                    <p className="text-[10px] font-medium text-[#7A797E]">{t('global_risk_desc')}</p>
                </div>
            </header>

            <div className="space-y-3 rounded-md border border-[#2F2E35] bg-[#141318] p-3 sm:p-4">
                <article className={`rounded-md border p-3 transition-colors ${beEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={beEnabled} onChange={(event) => setBeEnabled(event.target.checked)} label={t('auto_breakeven')} />
                        <span className={`text-xs font-semibold ${beEnabled ? 'text-[#FCFCFD]' : 'text-[#BDBABD]'}`}>{t('auto_breakeven')}</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-opacity ${beEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <span className="w-16 shrink-0 text-[10px] font-semibold uppercase text-[#7A797E]">{t('trigger')}</span>
                        <div className={`${inputFrame} flex-1`} dir="ltr">
                            <input type="number" value={beTrigger} onChange={(event) => setBeTrigger(event.target.value)} className={numberInput} />
                            <span className="ml-1 text-[9px] font-semibold text-[#7A797E]">R</span>
                        </div>
                    </div>
                </article>

                <article className={`rounded-md border p-3 transition-colors ${pcEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={pcEnabled} onChange={(event) => setPcEnabled(event.target.checked)} label={t('partial_close')} />
                        <span className={`text-xs font-semibold ${pcEnabled ? 'text-[#FCFCFD]' : 'text-[#BDBABD]'}`}>{t('partial_close')}</span>
                    </div>
                    <div className={`grid grid-cols-1 gap-2 transition-opacity sm:grid-cols-2 ${pcEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <label className={`${inputFrame} gap-2`} dir="ltr">
                            <span className="w-8 shrink-0 text-[9px] font-semibold text-[#7A797E]">{t('vol')}</span>
                            <input type="number" value={pcVolume} onChange={(event) => setPcVolume(event.target.value)} className={numberInput} />
                            <span className="text-[9px] font-semibold text-[#7A797E]">%</span>
                        </label>
                        <label className={`${inputFrame} gap-2`} dir="ltr">
                            <span className="w-8 shrink-0 text-[9px] font-semibold text-[#7A797E]">{t('at')}</span>
                            <input type="number" value={pcTrigger} onChange={(event) => setPcTrigger(event.target.value)} className={numberInput} />
                            <span className="text-[9px] font-semibold text-[#7A797E]">R</span>
                        </label>
                    </div>
                </article>

                <article className={`rounded-md border p-3 transition-colors ${tlEnabled ? activeCard : inactiveCard}`}>
                    <div className="mb-3 flex items-center gap-3">
                        <ToggleSwitch checked={tlEnabled} onChange={(event) => setTlEnabled(event.target.checked)} label={t('target_lock')} />
                        <span className={`text-xs font-semibold ${tlEnabled ? 'text-[#FCFCFD]' : 'text-[#BDBABD]'}`}>{t('target_lock')}</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-opacity ${tlEnabled ? 'opacity-100' : 'pointer-events-none opacity-35'}`}>
                        <span className="w-16 shrink-0 text-[10px] font-semibold uppercase text-[#7A797E]">{t('target_value')}</span>
                        <div className={`${inputFrame} flex-1`} dir="ltr">
                            <input type="number" value={tlTrigger} onChange={(event) => setTlTrigger(event.target.value)} placeholder="10200" className={numberInput} />
                            <span className="ml-2 text-[10px] font-semibold text-emerald-300">$</span>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    );
};

export default GlobalRiskProtections;