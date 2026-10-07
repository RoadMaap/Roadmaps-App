import React from 'react';

const ToggleSwitch = ({ checked, onChange, label }) => (
    <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            aria-label={label}
            className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-[#2F2E35] transition-colors peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-emerald-400 peer-checked:bg-emerald-500 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:content-[''] after:rounded-full after:border after:border-[#7A797E] after:bg-[#BDBABD] after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:border-white peer-checked:after:bg-white" />
    </label>
);

export default ToggleSwitch;