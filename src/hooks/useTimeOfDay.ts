import { useState, useEffect } from 'react';
import type { TimeOfDay, EnergyLevel } from '../types';

export interface TimeContext {
  timeOfDay: TimeOfDay;
  energy: EnergyLevel;
  hour: number;
  // Visual modifiers
  brightness: number;    // 0.7 - 1.0
  breathSpeed: number;   // multiplier on animation periods (0.6 - 1.4)
  nebulaHue: number;     // hue shift for background nebula (degrees)
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 4 && hour < 7)  return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getEnergy(hour: number): EnergyLevel {
  // Paul peaks at 7, 8, 9 (from mirror data)
  if (hour >= 7 && hour <= 10) return 'high';
  if (hour >= 14 && hour <= 16) return 'medium'; // afternoon dip
  if (hour >= 21 || hour < 4) return 'low';
  return 'medium';
}

function computeContext(hour: number): TimeContext {
  const tod = getTimeOfDay(hour);
  const energy = getEnergy(hour);

  // Brightness: peak at morning (1.0), lowest at night (0.7)
  const brightnessMap: Record<TimeOfDay, number> = {
    dawn: 0.82,
    morning: 1.0,
    afternoon: 0.92,
    evening: 0.88,
    night: 0.72,
  };

  // Breath speed: slower at night, faster in peak morning
  const breathMap: Record<TimeOfDay, number> = {
    dawn: 0.8,
    morning: 1.2,
    afternoon: 1.0,
    evening: 0.9,
    night: 0.6,
  };

  // Nebula hue: warm at dawn/morning, cooler at night
  const hueMap: Record<TimeOfDay, number> = {
    dawn: 25,    // warm amber
    morning: 0,  // neutral
    afternoon: -10, // slightly cool
    evening: 15, // warm again
    night: -25,  // cool blue-violet
  };

  return {
    timeOfDay: tod,
    energy,
    hour,
    brightness: brightnessMap[tod],
    breathSpeed: breathMap[tod],
    nebulaHue: hueMap[tod],
  };
}

export function useTimeOfDay(): TimeContext {
  const [ctx, setCtx] = useState<TimeContext>(() =>
    computeContext(new Date().getHours())
  );

  useEffect(() => {
    // Re-evaluate every 5 minutes
    const interval = setInterval(() => {
      setCtx(computeContext(new Date().getHours()));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return ctx;
}
