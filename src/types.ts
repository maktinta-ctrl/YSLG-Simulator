export type ClassType = string;

export interface RoomState {
  temp: number;
  setpoint: number;
  mode: 'Off' | 'Heat' | 'Cool' | 'Auto';
  fan: boolean;
  fa: boolean;
  hum: boolean;
  fanTimer: number;
  faTimer: number;
  purgeActive: boolean;
  runState: 0 | 1 | 2; // 0=Idle, 1=Heat, 2=Cool
  tempOverride?: number; // Manual override for testing
  tempLocked?: boolean; // Lock temperature at current value
}

export interface SimulationState {
  currentTime: number; // Seconds from start of day (0 - 86399)
  currentDay: number; // 0 (Mon) - 6 (Sun)
  ambientTemp: number;
  bigRoom: RoomState;
  smallRoom: RoomState;
  reformerRoom: RoomState;
  bigPurgeReq: boolean;
  smallPurgeReq: boolean;
}

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export const COLOR_MAP: Record<string, string> = {
  '.': 'bg-zinc-800', // Off
  'H': 'bg-orange-600', // Heat 90 (Big) / 115 (Small - mapped to S)
  'C': 'bg-blue-400',   // Cool 73
  'P': 'bg-emerald-500', // Purge
  'V': 'bg-blue-500',   // Cool 73 + Fans
  'T': 'bg-orange-700', // Heat 90 + Fans
  'W': 'bg-orange-500', // Heat 80 (Ref) / 90 (Small)
  'M': 'bg-orange-800', // Heat 95 (Small)
  'S': 'bg-red-600',    // Heat 115 (Small)
};

export const TEMP_LABELS: Record<string, string> = {
  'H': '90°',
  'C': '73°',
  'P': 'PRG',
  'V': '73°*',
  'T': '90°*',
  'W': '80°',
  'M': '95°',
  'S': '115°',
};
