import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, SkipBack, SkipForward, Thermometer, Fan, Wind, 
  Droplets, Clock, Calendar, Settings2, AlertCircle, ChevronRight,
  Activity, Zap, Info
} from 'lucide-react';
import { SimulationState, RoomState, DAYS, COLOR_MAP, TEMP_LABELS } from './types';
import { simulateStep, getScheduleChar } from './logic';

const INITIAL_ROOM_STATE: RoomState = {
  temp: 70,
  setpoint: 60,
  mode: 'Off',
  fan: false,
  fa: false,
  hum: false,
  fanTimer: 0,
  faTimer: 0,
  purgeActive: false,
  runState: 0,
};

const INITIAL_STATE: SimulationState = {
  currentTime: 0,
  currentDay: 0,
  ambientTemp: 75,
  bigRoom: { ...INITIAL_ROOM_STATE },
  smallRoom: { ...INITIAL_ROOM_STATE },
  reformerRoom: { ...INITIAL_ROOM_STATE },
  bigPurgeReq: false,
  smallPurgeReq: false,
};

export default function App() {
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 10x, 60x, etc.
  const [showSettings, setShowSettings] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation Loop
  useEffect(() => {
    if (isPlaying) {
      let lastTick = Date.now();
      let accumulator = 0;

      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTick) / 1000; // seconds passed
        lastTick = now;

        accumulator += delta * playbackSpeed;

        if (accumulator >= 1) {
          const steps = Math.floor(accumulator);
          accumulator -= steps;

          setState(prev => {
            let next = prev;
            // Limit steps per frame to avoid freezing (max 1 hour of sim per frame)
            const safeSteps = Math.min(steps, 3600); 
            for (let i = 0; i < safeSteps; i++) {
              next = simulateStep(next);
              next.currentTime = (next.currentTime + 1) % 86400;
              if (next.currentTime === 0) {
                next.currentDay = (next.currentDay + 1) % 7;
              }
            }
            return { ...next };
          });
        }
      }, 1000 / 30); // 30fps UI update is plenty
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseInt(e.target.value);
    setState(prev => ({ ...prev, currentTime: newTime }));
  };

  const togglePurge = (room: 'big' | 'small') => {
    setState(prev => ({
      ...prev,
      [room === 'big' ? 'bigPurgeReq' : 'smallPurgeReq']: !prev[room === 'big' ? 'bigPurgeReq' : 'smallPurgeReq']
    }));
  };

  const setAmbient = (temp: number) => {
    setState(prev => ({ ...prev, ambientTemp: temp }));
  };

  return (
    <div className="min-h-screen bg-[#151619] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#1a1b1e] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">YOGA SOURCE LG</h1>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Revision K2 • Debug Environment</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 text-orange-500 font-mono text-xl font-bold">
              <Clock className="w-5 h-5" />
              {formatTime(state.currentTime)}
            </div>
            <div className="text-[10px] text-zinc-500 font-bold tracking-tighter uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {DAYS[state.currentDay]} • DAY {state.currentDay + 1}
            </div>
          </div>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isPlaying ? 'bg-orange-600 hover:bg-orange-500' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
            </button>
            
            <select 
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
              className="bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value={1}>1x (Real)</option>
              <option value={10}>10x</option>
              <option value={60}>60x (1m/s)</option>
              <option value={600}>600x (10m/s)</option>
              <option value={3600}>3600x (1h/s)</option>
            </select>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto grid grid-cols-12 gap-6">
        
        {/* Color Index Legend */}
        <section className="col-span-12 bg-[#1a1b1e] rounded-2xl border border-white/5 p-4 shadow-xl flex items-center justify-between">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Info className="w-4 h-4" />
            Temperature Legend
          </div>
          <div className="flex gap-6">
            <LegendItem color="bg-blue-400" label="73°F (Cool)" />
            <LegendItem color="bg-orange-500" label="80°F (Heat)" />
            <LegendItem color="bg-orange-600" label="90°F (Heat)" />
            <LegendItem color="bg-orange-800" label="95°F (Heat)" />
            <LegendItem color="bg-red-600" label="115°F (Heat)" />
            <LegendItem color="bg-emerald-500" label="Purge" />
            <LegendItem color="bg-zinc-800" label="Off" />
          </div>
        </section>

        {/* Timeline Scrubber */}
        <section className="col-span-12 bg-[#1a1b1e] rounded-2xl border border-white/5 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Daily Schedule Timeline
            </h2>
            <div className="flex gap-4">
              {DAYS.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => setState(prev => ({ ...prev, currentDay: idx }))}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    state.currentDay === idx ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-24 bg-zinc-900/50 rounded-xl overflow-hidden border border-white/5">
            {/* Schedule Tracks */}
            <div className="absolute inset-0 flex flex-col">
              <ScheduleTrack label="BIG" room="big" day={state.currentDay} />
              <ScheduleTrack label="SML" room="small" day={state.currentDay} />
              <ScheduleTrack label="REF" room="ref" day={state.currentDay} />
            </div>

            {/* Scrubber Input */}
            <input 
              type="range" 
              min="0" 
              max="86399" 
              value={state.currentTime}
              onChange={handleScrub}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />

            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10 pointer-events-none transition-all duration-75"
              style={{ left: `${(state.currentTime / 86400) * 100}%` }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-white rounded-full" />
            </div>
          </div>
          
          <div className="mt-2 flex justify-between text-[10px] font-mono text-zinc-600">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>23:59</span>
          </div>
        </section>

        {/* Room Status Cards */}
        <div className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-6">
          <RoomCard 
            title="Tulum" 
            state={state.bigRoom} 
            onTempChange={(t) => setState(prev => ({ ...prev, bigRoom: { ...prev.bigRoom, tempOverride: t } }))}
            onResetTemp={() => setState(prev => ({ ...prev, bigRoom: { ...prev.bigRoom, tempOverride: undefined } }))}
            onToggleLock={() => setState(prev => ({ ...prev, bigRoom: { ...prev.bigRoom, tempLocked: !prev.bigRoom.tempLocked } }))}
          />
          <RoomCard 
            title="Bali" 
            state={state.smallRoom} 
            onTempChange={(t) => setState(prev => ({ ...prev, smallRoom: { ...prev.smallRoom, tempOverride: t } }))}
            onResetTemp={() => setState(prev => ({ ...prev, smallRoom: { ...prev.smallRoom, tempOverride: undefined } }))}
            onToggleLock={() => setState(prev => ({ ...prev, smallRoom: { ...prev.smallRoom, tempLocked: !prev.smallRoom.tempLocked } }))}
          />
          <RoomCard 
            title="Reformer" 
            state={state.reformerRoom} 
            isReformer
            onTempChange={(t) => setState(prev => ({ ...prev, reformerRoom: { ...prev.reformerRoom, tempOverride: t } }))}
            onResetTemp={() => setState(prev => ({ ...prev, reformerRoom: { ...prev.reformerRoom, tempOverride: undefined } }))}
            onToggleLock={() => setState(prev => ({ ...prev, reformerRoom: { ...prev.reformerRoom, tempLocked: !prev.reformerRoom.tempLocked } }))}
          />
        </div>

        {/* Controls & Overrides */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          <div className="bg-[#1a1b1e] rounded-2xl border border-white/5 p-6 shadow-xl">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Environment Overrides
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-3">Ambient Temperature</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="60" 
                    max="110" 
                    value={state.ambientTemp}
                    onChange={(e) => setAmbient(parseInt(e.target.value))}
                    className="flex-1 accent-orange-600"
                  />
                  <span className="font-mono font-bold text-lg w-12">{state.ambientTemp}°</span>
                </div>
                {state.ambientTemp > 95 && (
                  <div className="mt-2 text-[10px] text-orange-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    HEAT ADJUSTMENT ACTIVE (-10°F)
                  </div>
                )}
              </div>

              <div className="h-px bg-white/5" />

              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500 uppercase block">Manual Purge Requests</label>
                <button 
                  onClick={() => togglePurge('big')}
                  className={`w-full py-3 rounded-xl border transition-all flex items-center justify-between px-4 ${
                    state.bigPurgeReq ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-zinc-900 border-white/5 text-zinc-500'
                  }`}
                >
                  <span className="text-xs font-bold">Big Room Purge</span>
                  <div className={`w-2 h-2 rounded-full ${state.bigPurgeReq ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                </button>
                <button 
                  onClick={() => togglePurge('small')}
                  className={`w-full py-3 rounded-xl border transition-all flex items-center justify-between px-4 ${
                    state.smallPurgeReq ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-zinc-900 border-white/5 text-zinc-500'
                  }`}
                >
                  <span className="text-xs font-bold">Small Room Purge</span>
                  <div className={`w-2 h-2 rounded-full ${state.smallPurgeReq ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-orange-600/10 rounded-2xl border border-orange-600/20 p-6">
            <h3 className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Simulation Notes
            </h3>
            <p className="text-[11px] text-orange-200/60 leading-relaxed">
              This simulator replicates the Modbus traffic control logic. Writes are staggered every 4 seconds to prevent bus flooding. Temperature drift is simulated based on active heating/cooling calls.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-sm ${color}`} />
      <span className="text-[10px] font-bold text-zinc-400">{label}</span>
    </div>
  );
}

function ScheduleTrack({ label, room, day }: { label: string, room: 'big' | 'small' | 'ref', day: number }) {
  const slots = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 96; i++) {
      arr.push(getScheduleChar(room, day, i * 900));
    }
    return arr;
  }, [room, day]);

  return (
    <div className="flex-1 flex items-center border-b border-white/5 last:border-0 group">
      <div className="w-12 text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors pl-4">{label}</div>
      <div className="flex-1 h-full flex">
        {slots.map((char, i) => (
          <div 
            key={i} 
            className={`flex-1 h-full border-r border-black/20 relative group/slot ${COLOR_MAP[char] || 'bg-transparent'}`}
          >
            {char !== '.' && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 bg-black/40 text-[8px] font-bold pointer-events-none">
                {TEMP_LABELS[char]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomCard({ title, state, isReformer, onTempChange, onResetTemp, onToggleLock }: { 
  title: string, 
  state: RoomState, 
  isReformer?: boolean,
  onTempChange: (t: number) => void,
  onResetTemp: () => void,
  onToggleLock: () => void
}) {
  const isHeating = state.runState === 1;
  const isCooling = state.runState === 2;

  return (
    <div className="bg-[#1a1b1e] rounded-2xl border border-white/5 overflow-hidden shadow-xl flex flex-col">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-bold text-zinc-400 uppercase tracking-widest text-xs">{title}</h3>
        <div className="flex gap-2">
          <button 
            onClick={onToggleLock}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1 transition-colors ${
              state.tempLocked ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-400'
            }`}
          >
            {state.tempLocked ? <Zap className="w-3 h-3 fill-current" /> : <Activity className="w-3 h-3" />}
            {state.tempLocked ? 'Locked' : 'Live'}
          </button>
          <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter ${
            state.mode === 'Off' ? 'bg-zinc-800 text-zinc-500' : 
            state.mode === 'Heat' ? 'bg-orange-600/20 text-orange-500' : 'bg-blue-600/20 text-blue-500'
          }`}>
            {state.mode}
          </div>
        </div>
      </div>

      <div className="p-8 flex flex-col items-center justify-center relative">
        {/* Animated Background Glow */}
        <AnimatePresence mode="wait">
          {isHeating && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.15, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 bg-orange-600 blur-3xl rounded-full"
            />
          )}
          {isCooling && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.15, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 bg-blue-600 blur-3xl rounded-full"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 text-center">
          <div className="text-5xl font-bold tracking-tighter mb-1 flex items-baseline justify-center">
            {state.temp.toFixed(1)}
            <span className="text-xl text-zinc-500 ml-1">°F</span>
          </div>
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
            <Zap className={`w-3 h-3 ${state.runState !== 0 ? 'text-orange-500 animate-pulse' : ''}`} />
            Setpoint: {state.setpoint}°F
          </div>
        </div>
      </div>

      {/* Room Temp Bar (Manual Override) */}
      <div className="px-6 pb-6 space-y-2">
        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase">
          <span>Room Temp Override</span>
          {state.tempOverride !== undefined && (
            <button onClick={onResetTemp} className="text-orange-500 hover:text-orange-400">Reset</button>
          )}
        </div>
        <input 
          type="range" 
          min="60" 
          max="120" 
          step="0.1"
          value={state.temp}
          onChange={(e) => onTempChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
        />
        <div className="flex justify-between text-[8px] font-mono text-zinc-600">
          <span>60°</span>
          <span>90°</span>
          <span>120°</span>
        </div>
      </div>

      <div className={`mt-auto grid ${isReformer ? 'grid-cols-1' : 'grid-cols-3'} border-t border-white/5 bg-zinc-900/30`}>
        {!isReformer && (
          <>
            <StatusIndicator 
              icon={<Fan className="w-4 h-4" />} 
              label="Fan" 
              active={state.fan} 
              timer={state.fanTimer}
            />
            <StatusIndicator 
              icon={<Wind className="w-4 h-4" />} 
              label="Fresh Air" 
              active={state.fa} 
              timer={state.faTimer}
            />
            <StatusIndicator 
              icon={<Droplets className="w-4 h-4" />} 
              label="Humid" 
              active={state.hum} 
            />
          </>
        )}
        {isReformer && (
          <div className="p-4 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            No Scripted Outputs
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ icon, label, active, timer }: { icon: React.ReactNode, label: string, active: boolean, timer?: number }) {
  return (
    <div className={`p-4 flex flex-col items-center justify-center gap-2 border-r border-white/5 last:border-0 transition-colors ${
      active ? 'bg-orange-600/5' : ''
    }`}>
      <div className={`transition-all duration-500 ${active ? 'text-orange-500 scale-110' : 'text-zinc-700'}`}>
        {icon}
      </div>
      <div className="flex flex-col items-center">
        <span className={`text-[9px] font-bold uppercase tracking-tighter ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>
          {label}
        </span>
        {timer !== undefined && timer > 0 && (
          <span className="text-[8px] font-mono text-orange-500 font-bold">
            {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  );
}
