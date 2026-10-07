import React from 'react';

const InfoTooltip = ({ text }) => (
    <span className="group/tip relative ml-1.5 inline-flex shrink-0 cursor-help items-center">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-3.5 w-3.5 text-[#7A797E] transition-colors group-hover/tip:text-emerald-400"
            aria-hidden="true"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <span className="invisible absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-md border border-[#2F2E35] bg-[#1E1D22] p-2.5 text-center text-[10px] leading-relaxed text-[#BDBABD] opacity-0 shadow-xl transition-all group-hover/tip:visible group-hover/tip:opacity-100">
            {text}
        </span>
    </span>
);

export default InfoTooltip;