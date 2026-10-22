import { useLanguage } from '../../../context/LanguageContext';
import { Activity01 } from '../../animate-ui/icons/hugeicons/activity-01';
import { AnimateIcon } from '@animate-ui/react/icons';

const ActivePositions = ({ positions, className = '' }) => {
    const { t, lang } = useLanguage();

    return (
        <AnimateIcon asChild animateOnHover>
            <section
                dir={lang === 'fa' ? 'rtl' : 'ltr'}
                className={`flex min-w-0 flex-col rounded-lg border border-[#2F2E35] bg-[#1A191E] p-4 sm:p-5 ${className}`}
                aria-label={t('open_positions')}
            >
                <div className="flex w-full items-center justify-between" dir="ltr">
                    <span dir={lang === 'fa' ? 'rtl' : 'ltr'} className="text-[12px] font-semibold uppercase text-foreground/45">{t('open_positions')}</span>
                    <Activity01 size={16} aria-hidden="true" className="shrink-0 text-[#F28C45]" />
                </div>
                <p className="mt-4 text-2xl font-bold tabular-nums text-[#FCFCFD]">{positions}</p>
                <span className={`mt-auto flex h-12 items-center gap-1.5 text-[10px] font-medium leading-tight ${positions > 0 ? 'text-emerald-300' : 'text-[#7A797E]'}`}>
                    <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${positions > 0 ? 'bg-emerald-400' : 'bg-[#7A797E]'}`} />
                    <span>{positions > 0 ? t('market_exposure_active') : t('no_exposure')}</span>
                </span>
            </section>
        </AnimateIcon>
    );
};

export default ActivePositions;