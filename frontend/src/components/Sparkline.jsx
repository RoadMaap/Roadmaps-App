import React, { useMemo } from 'react';

const getPath = (data, width, height, centered) => {
  if (data.length === 0) return "";
  let min = Math.min(...data, 0);
  let max = Math.max(...data, 0);
  if (centered) {
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    const radius = Math.max(...data.map((value) => Math.abs(value - average)), 1);
    min = average - radius;
    max = average + radius;
  } else if (min === max) {
    max += 1;
  }
  const range = max - min;

  // تغییر مهم: اضافه کردن پدینگ داخلی برای اینکه ضخامت خط بریده نشود
  const paddingY = 4; // 4 پیکسل فاصله از بالا و پایین
  const usableHeight = height - (paddingY * 2);

  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    
    // محاسبه دقیق Y:
    // نمودار بین (paddingY) تا (height - paddingY) رسم می‌شود
    const normalizedVal = (val - min) / range; // عددی بین 0 تا 1
    const y = (height - paddingY) - (normalizedVal * usableHeight);
    
    return [x, y];
  });

  return points.reduce((acc, [x, y], i, arr) => {
    if (i === 0) return `M ${x},${y}`;
    const [x0, y0] = arr[i - 1];
    const [x1, y1] = [x, y];
    // تنظیم نرمی نمودار
    const controlPointX = (x1 - x0) * 0.35;
    return `${acc} C ${x0 + controlPointX},${y0} ${x1 - controlPointX},${y1} ${x1},${y1}`;
  }, "");
};

const Sparkline = ({ data = [], color = "#10b981", centered = false }) => {
  // ابعاد viewBox
  const width = 100;
  const height = 45; // کمی ارتفاع را بیشتر کردم تا جا بازتر باشد
  const colorId = color.replace('#', '');
  const gradientId = `sparkGradient-${colorId}`;
  const blurId = `sparkBlur-${colorId}`;

  const { pathD, fillD } = useMemo(() => {
    if (!data || data.length < 2) return { pathD: "", fillD: "" };
    const d = getPath(data, width, height, centered);
    return {
      pathD: d,
      // بستن ناحیه پر شده به کف نمودار
      fillD: `${d} V ${height} H 0 Z`
    };
  }, [data, height, centered]); // height به وابستگی‌ها اضافه شد

  return (
    // overflow-visible می‌گذاریم تا اگر احیاناً پیکسلی بیرون زد، دیده شود
    // اما چون محاسبات را درست کردیم، نباید بیرون بزند.
    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={blurId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {/* ناحیه پر شده زیر نمودار */}
      <path d={fillD} fill={`url(#${gradientId})`} stroke="none" filter={`url(#${blurId})`} className="transition-[d] duration-500 ease-out" />
      <path d={pathD} stroke={color} strokeWidth="7" fill="none" opacity="0.3" filter={`url(#${blurId})`} />
      {/* خط اصلی نمودار با ضخامت 2 */}
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="transition-[d] duration-500 ease-out" />
    </svg>
  );
};

export default Sparkline;