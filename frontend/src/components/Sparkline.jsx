import React, { useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_DATA = [];

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

const Sparkline = ({ data = EMPTY_DATA, color = "#10b981", centered = false }) => {
  const [animatedData, setAnimatedData] = useState(data);
  const animatedDataRef = useRef(data);
  // ابعاد viewBox
  const width = 100;
  const height = 45; // کمی ارتفاع را بیشتر کردم تا جا بازتر باشد
  const colorId = color.replace('#', '');
  const gradientId = `sparkGradient-${colorId}`;
  const blurId = `sparkBlur-${colorId}`;

  useEffect(() => {
    const targetData = Array.isArray(data) ? data : EMPTY_DATA;
    const startingData = animatedDataRef.current;
    if (targetData.length === 0) {
      animatedDataRef.current = targetData;
      setAnimatedData(targetData);
      return undefined;
    }

    const pointCount = Math.max(startingData.length, targetData.length);
    const padData = (values, fallback) => [
      ...Array(Math.max(0, pointCount - values.length)).fill(values[0] ?? fallback),
      ...values,
    ];
    const from = padData(startingData, targetData[0]);
    const to = padData(targetData, targetData[0]);
    const startedAt = performance.now();
    const duration = 360;
    let animationFrame;

    const animate = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextData = to.map((value, index) => from[index] + (value - from[index]) * easedProgress);
      animatedDataRef.current = nextData;
      setAnimatedData(nextData);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        animatedDataRef.current = targetData;
        setAnimatedData(targetData);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [data]);

  const { pathD, fillD } = useMemo(() => {
    if (!animatedData || animatedData.length < 2) return { pathD: "", fillD: "" };
    const d = getPath(animatedData, width, height, centered);
    return {
      pathD: d,
      // بستن ناحیه پر شده به کف نمودار
      fillD: `${d} V ${height} H 0 Z`
    };
  }, [animatedData, height, centered]);

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
      <path d={fillD} fill={`url(#${gradientId})`} stroke="none" filter={`url(#${blurId})`} />
      <path d={pathD} stroke={color} strokeWidth="7" fill="none" opacity="0.3" filter={`url(#${blurId})`} />
      {/* خط اصلی نمودار با ضخامت 2 */}
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default Sparkline;