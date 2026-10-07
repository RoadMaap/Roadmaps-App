import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import GlobalRiskProtections from './GlobalRiskProtections';
import SystemBrokerSettings from './SystemBrokerSettings';

const RiskPanel = ({ initialData, nextNews }) => {
    const { t } = useLanguage();
    const [isSaving, setIsSaving] = useState(false);
    const [marginEnabled, setMarginEnabled] = useState(false);
    const [marginLimit, setMarginLimit] = useState('50');
    const [wuEnabled, setWuEnabled] = useState(true);
    const [wuCandles, setWuCandles] = useState('500');
    const [nfEnabled, setNfEnabled] = useState(false);
    const [nfEur, setNfEur] = useState(true);
    const [nfUsd, setNfUsd] = useState(true);
    const [nfBefore, setNfBefore] = useState('30');
    const [nfAfter, setNfAfter] = useState('30');
    const [beEnabled, setBeEnabled] = useState(false);
    const [beTrigger, setBeTrigger] = useState('1.0');
    const [pcEnabled, setPcEnabled] = useState(false);
    const [pcVolume, setPcVolume] = useState('50');
    const [pcTrigger, setPcTrigger] = useState('2.0');
    const [tlEnabled, setTlEnabled] = useState(false);
    const [tlTrigger, setTlTrigger] = useState('10200.0');

    useEffect(() => {
        if (!initialData) return;
        setMarginEnabled(initialData?.margin_enabled || false);
        setMarginLimit(initialData?.margin_limit || '50');
        setWuEnabled(initialData?.wu_enabled !== undefined ? initialData.wu_enabled : true);
        setWuCandles(initialData?.wu_candles || '500');
        setNfEnabled(initialData?.nf_enabled || false);
        setNfEur(initialData?.nf_eur !== undefined ? initialData.nf_eur : true);
        setNfUsd(initialData?.nf_usd !== undefined ? initialData.nf_usd : true);
        setNfBefore(initialData?.nf_before || '30');
        setNfAfter(initialData?.nf_after || '30');
        setBeEnabled(initialData?.be_enabled || false);
        setBeTrigger(initialData?.be_trigger || '1.0');
        setPcEnabled(initialData?.pc_enabled || false);
        setPcVolume(initialData?.pc_volume || '50');
        setPcTrigger(initialData?.pc_trigger || '2.0');
        setTlEnabled(initialData?.tl_enabled || false);
        setTlTrigger(initialData?.tl_trigger || '10200.0');
    }, [initialData]);

    const handleSave = async () => {
        setIsSaving(true);
        const config = {
            mt5_path: initialData?.mt5_path || '',
            margin_enabled: marginEnabled,
            margin_limit: marginLimit,
            wu_enabled: wuEnabled,
            wu_candles: wuCandles,
            nf_enabled: nfEnabled,
            nf_eur: nfEur,
            nf_usd: nfUsd,
            nf_before: nfBefore,
            nf_after: nfAfter,
            be_enabled: beEnabled,
            be_trigger: beTrigger,
            pc_enabled: pcEnabled,
            pc_volume: pcVolume,
            pc_trigger: pcTrigger,
            tl_enabled: tlEnabled,
            tl_trigger: tlTrigger,
        };
        if (window.eel) await window.eel.save_user_config(config)();
        setTimeout(() => setIsSaving(false), 800);
    };

    const handleNewsToggle = async (event) => {
        const enabled = event.target.checked;
        setNfEnabled(enabled);
        if (window.eel) {
            try {
                await window.eel.save_user_config({ nf_enabled: enabled })();
            } catch (error) {
                console.error('Could not persist News Filter toggle:', error);
            }
        }
    };

    return (
        <div className="flex h-full min-h-[500px] flex-col overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E]">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 custom-scroll sm:p-6">
                <SystemBrokerSettings
                    marginEnabled={marginEnabled}
                    setMarginEnabled={setMarginEnabled}
                    marginLimit={marginLimit}
                    setMarginLimit={setMarginLimit}
                    wuEnabled={wuEnabled}
                    setWuEnabled={setWuEnabled}
                    wuCandles={wuCandles}
                    setWuCandles={setWuCandles}
                    nfEnabled={nfEnabled}
                    handleNewsToggle={handleNewsToggle}
                    nfEur={nfEur}
                    setNfEur={setNfEur}
                    nfUsd={nfUsd}
                    setNfUsd={setNfUsd}
                    nfBefore={nfBefore}
                    setNfBefore={setNfBefore}
                    nfAfter={nfAfter}
                    setNfAfter={setNfAfter}
                    nextNews={nextNews}
                />
                <div aria-hidden="true" className="h-px bg-[#2F2E35]" />
                <GlobalRiskProtections
                    beEnabled={beEnabled}
                    setBeEnabled={setBeEnabled}
                    beTrigger={beTrigger}
                    setBeTrigger={setBeTrigger}
                    pcEnabled={pcEnabled}
                    setPcEnabled={setPcEnabled}
                    pcVolume={pcVolume}
                    setPcVolume={setPcVolume}
                    pcTrigger={pcTrigger}
                    setPcTrigger={setPcTrigger}
                    tlEnabled={tlEnabled}
                    setTlEnabled={setTlEnabled}
                    tlTrigger={tlTrigger}
                    setTlTrigger={setTlTrigger}
                />
            </div>
            <footer className="shrink-0 border-t border-[#2F2E35] bg-[#1E1D22] p-4">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-white shadow-[0_4px_15px_rgba(16,185,129,0.25)] transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isSaving ? (
                        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : (
                        <svg className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1 4-3 3m0 0-3-3m3 3V4" />
                        </svg>
                    )}
                    <span>{t('save_config')}</span>
                </button>
            </footer>
        </div>
    );
};

export default RiskPanel;