import { SimulationState, RoomState } from './types';

const FAN_TIMER_SEC = 900;
const FA_TIMER_SEC = 900;
const HEAT_ADJUST_DEG = 10;

const BIG_SCHED = [
  ".....................HHHHHHHHHHHHHHHVCCCCHHHHHHVCCCCC...P....HHHHHHHHHHHHHHHHH..P...................", 
  ".................HHHHHH....HHHHHHHHHHHHHHHHHHHHVCCCCC...P...HHHHHHHHHHHHHVCCCC..P...................",   
  ".....................HHHHHH......HHHHHHHHHHHHHHVCCCCC...P....HHHHHHVCCCCHHHHH...P...................",  
  ".................HHHHHH....HHHHHHHHHHHHHHHHHHHHVCCCCC...P.....HHHHHPHHHHHHHHH...P...................",  
  ".....................HHHHHHHHHHH..HHHHHVCCCCHHHHVCCCC...P....HHHHHHHVCCCC.......P...................",  
  "..........................HHHHHHHHHHHHHHHHHHHHHHHH......P...........................................",   
  ".........................HHHHHH.VCCCCCCCHHHHHHHHHH......P........HHHHHHHHH......P...................",  
];

const SMALL_SCHED = [
  "....................WWWWWWW.....WWWWWWWWVCCCCCC.MMMM....P...SSSSSSSSWWWWVCCCCC..P..................", 
  "....................WWWWWWW.....SSSSSSSSVCCCCCC.MMMM....P...WWWWWWWWSSSSSWWWW...P..................",   
  "................WWWWWWWWWWWWWWWW.WWWWWWWVCCCCCCC........P...SSSSSSSSTWWWSSSSSS..P..................",  
  ".....................WWWWWW.....SSSSSSSSP...............P...SSSSSSSS....VCCCCC..P..................",  
  ".................WWWWWW..........MMMMMMMVCCCCCC.WWWW....P...SSSSSSSSVCCCCC......P..................",  
  "........................WWWWWWWSSSSSWWWWVCCCCCCVCCCC....P.......................P...................",   
  "............................WWWWWWWSSSSSTWWWW...........P.........SSSSSSSS......P..................",  
];

const REF_SCHED = [
  ".............................WWWW....WWWW....WWWW...............WWWWW...............................", 
  "...................WWWWWW....WWWW....WWWW....WWWW...............WWWWW...............................",  
  ".........................WWWW....WWWWWWWW....WWWW...............WWWWW...............................",  
  ".........................WWWW....WWWWWWWWWWWW...................WWWWWWWWWWWWW.......................", 
  "...................WWWWWW....WWWW....WWWW....WWWW...............WWWWWWWWW...........................", 
  "............................WWWWW....WWWW....WWWW...................................................",  
  "............................WWWWW....WWWW...........................................................",  
];

export function getScheduleChar(room: 'big' | 'small' | 'ref', day: number, timeInSeconds: number): string {
  const slotIndex = Math.floor(timeInSeconds / 900); // 15 min slots
  const sched = room === 'big' ? BIG_SCHED : room === 'small' ? SMALL_SCHED : REF_SCHED;
  return sched[day][slotIndex] || '.';
}

export function simulateStep(state: SimulationState): SimulationState {
  const nextState = JSON.parse(JSON.stringify(state)) as SimulationState;
  const { currentTime, currentDay, ambientTemp } = nextState;
  
  const hour = Math.floor(currentTime / 3600);
  const minute = Math.floor((currentTime % 3600) / 60);
  const second = currentTime % 60;
  const slotIndex = Math.floor(currentTime / 900);

  const heatAdj = ambientTemp > 95 ? HEAT_ADJUST_DEG : 0;

  // --- BIG ROOM ---
  const bigChar = BIG_SCHED[currentDay][slotIndex] || '.';
  processRoomLogic(nextState.bigRoom, bigChar, second, minute, heatAdj, nextState.bigPurgeReq, 'big');

  // --- SMALL ROOM ---
  const smallChar = SMALL_SCHED[currentDay][slotIndex] || '.';
  processRoomLogic(nextState.smallRoom, smallChar, second, minute, heatAdj, nextState.smallPurgeReq, 'small');

  // --- REFORMER ROOM ---
  const refChar = REF_SCHED[currentDay][slotIndex] || '.';
  processRoomLogic(nextState.reformerRoom, refChar, second, minute, heatAdj, false, 'ref');

  return nextState;
}

function processRoomLogic(
  room: RoomState, 
  char: string, 
  second: number, 
  minute: number, 
  heatAdj: number, 
  purgeReq: boolean,
  roomType: 'big' | 'small' | 'ref'
) {
  // 1. Thermostat Logic (Setpoint & Mode)
  if (char === '.') {
    room.mode = 'Off';
    room.setpoint = 60;
  } else if (char === 'H' || char === 'W' || char === 'M' || char === 'S' || char === 'T') {
    room.mode = 'Heat';
    let base = 90; // Default to 90 as per user's list
    if (roomType === 'small') {
        if (char === 'W') base = 90;
        else if (char === 'M') base = 95;
        else if (char === 'H') base = 115; // Mapping H to 115 in Small as per user's list
        else if (char === 'S') base = 115;
        else if (char === 'T') base = 90;
    } else if (roomType === 'big') {
        if (char === 'H') base = 90;
        else if (char === 'T') base = 90;
    } else if (roomType === 'ref') {
        base = 80;
    }
    room.setpoint = base - heatAdj;
  } else if (char === 'C' || char === 'V') {
    room.mode = 'Cool';
    room.setpoint = 73; // Use 73 as per user's list
  } else if (char === 'P') {
    room.mode = 'Off';
  }

  // 2. Timer Triggers (Edge of 15 min slot)
  if (second === 0 && (minute % 15) === 0) {
    if (char === 'P' || char === 'V' || char === 'T') {
      room.fanTimer = FAN_TIMER_SEC;
      room.faTimer = FA_TIMER_SEC;
    }
  }

  // 3. Timer Countdown
  if (room.fanTimer > 0) room.fanTimer--;
  if (room.faTimer > 0) room.faTimer--;

  // 4. Purge Active
  room.purgeActive = purgeReq;

  // 5. Run State Simulation
  // Use override if present, otherwise drift
  if (room.tempOverride !== undefined) {
    room.temp = room.tempOverride;
  }

  const diff = room.setpoint - room.temp;
  if (room.mode === 'Heat') {
    // Hysteresis: Turn ON if more than 1.0 degree below setpoint
    // Turn OFF if within 0.2 degrees of setpoint
    if (diff > 1.0) room.runState = 1; 
    else if (diff < 0.2) room.runState = 0;
    
    if (room.tempOverride === undefined && !room.tempLocked) {
      room.temp += room.runState === 1 ? 0.02 : -0.005;
    }
  } else if (room.mode === 'Cool') {
    // Hysteresis: Turn ON if more than 1.0 degree above setpoint
    // Turn OFF if within 0.2 degrees of setpoint
    if (diff < -1.0) room.runState = 2;
    else if (diff > -0.2) room.runState = 0;
    
    if (room.tempOverride === undefined && !room.tempLocked) {
      room.temp += room.runState === 2 ? -0.02 : 0.005;
    }
  } else {
    room.runState = 0;
    if (room.tempOverride === undefined && !room.tempLocked) {
      room.temp += (70 - room.temp) * 0.001;
    }
  }

  // 6. Outputs - STICK TO SCRIPT
  if (roomType === 'ref') {
    // Reformer room has NO outputs in the script
    room.fan = false;
    room.hum = false;
    room.fa = false;
    room.fanTimer = 0;
    room.faTimer = 0;
  } else {
    // Big and Small rooms have outputs
    room.fan = room.fanTimer > 0 || room.purgeActive;
    room.hum = room.runState === 1;
    room.fa = room.faTimer > 0 || room.purgeActive || room.runState === 2;
  }
}
