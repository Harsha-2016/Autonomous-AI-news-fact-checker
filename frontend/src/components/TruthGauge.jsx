import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const TruthGauge = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    setAnimatedScore(0);
    const duration = 1500;
    const steps = 60;
    const stepTime = Math.abs(Math.floor(duration / steps));
    const increment = score / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [score]);

  // Determine color based on score thresholds
  let color = "text-emerald-400";
  let strokeColor = "#34D399"; // emerald-400
  let label = "Verified True";

  if (score < 40) {
    color = "text-rose-500";
    strokeColor = "#F43F5E"; // rose-500
    label = "Highly Suspicious / Fake";
  } else if (score < 70) {
    color = "text-amber-400";
    strokeColor = "#FBBF24"; // amber-400
    label = "Mixed / Unverified";
  }

  const radius = 100;
  const stroke = 18;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-black/30 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      
      <div className="relative w-64 h-64 flex items-center justify-center z-10">
        <svg height={radius * 2} width={radius * 2} className="absolute inset-0 -rotate-90 transform drop-shadow-2xl">
          {/* Background circle track */}
          <circle
            stroke="rgba(255, 255, 255, 0.05)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <motion.circle
            stroke={strokeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`drop-shadow-[0_0_20px_${strokeColor}]`}
            color={strokeColor}
          />
        </svg>
        <div className="text-center z-20 flex flex-col items-center justify-center pt-2">
          <span className={`text-7xl font-black tracking-tighter ${color} tabular-nums drop-shadow-xl`}>
            {animatedScore}
          </span>
          <span className="text-gray-400 text-sm font-semibold uppercase tracking-widest mt-1">/ 100</span>
        </div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5, type: "spring" }}
        className={`mt-4 z-10 px-6 py-2 rounded-full border border-white/10 ${color} bg-white/5 backdrop-blur-lg shadow-lg font-bold tracking-wider uppercase text-sm`}
      >
        {label}
      </motion.div>
    </div>
  );
};

export default TruthGauge;
