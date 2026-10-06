import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const OptionalUpdateModal = ({ updateInfo, onDismiss, onInstall }) => {
    const { t, lang } = useLanguage();

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onDismiss();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="optional-update-title"
                dir={lang === 'fa' ? 'rtl' : 'ltr'}
                className="w-full max-w-lg overflow-hidden rounded-lg border border-[#2F2E35] bg-[#1A191E] shadow-2xl"
            >
                <div className="flex items-center gap-4 border-b border-[#2F2E35] p-5 sm:p-6">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#F28C45]/30 bg-[#F28C45]/10 text-[#F28C45]">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold uppercase text-[#F28C45]">
                            {t('update_version')} {updateInfo.latest_version}
                        </p>
                        <h2 id="optional-update-title" className="mt-1 text-lg font-bold text-[#FCFCFD]">
                            {t('update_modal_title')}
                        </h2>
                    </div>
                </div>
                <div className="p-5 sm:p-6">
                    <p className="text-sm leading-6 text-[#BDBABD]">{t('update_modal_description')}</p>
                    <div className="mt-5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#2F2E35] bg-[#141318] p-4 text-sm leading-6 text-[#BDBABD] custom-scroll">
                        {updateInfo.changelog || t('update_changelog_fallback')}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onDismiss}
                            className="min-h-10 rounded-md border border-[#2F2E35] px-4 text-sm font-medium text-[#BDBABD] transition-colors hover:bg-[#2A292F] hover:text-[#FCFCFD]"
                        >
                            {t('update_remind_later')}
                        </button>
                        <button
                            type="button"
                            onClick={onInstall}
                            className="min-h-10 rounded-md bg-[#F28C45] px-4 text-sm font-semibold text-[#141318] transition-colors hover:bg-[#F5A36A]"
                        >
                            {t('update_now')}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default OptionalUpdateModal;