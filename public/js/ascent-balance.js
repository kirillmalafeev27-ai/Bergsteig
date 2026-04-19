const LANE_IDS = ['Left', 'Center', 'Right'];
const LANE_WORLD_X = [-1.22, 0, 1.22];

const BASE_ASCENT_SEGMENTS = 1;
const EXTRA_MOVE_SEGMENTS = 2;
const AVALANCHE_SETBACK_SEGMENTS = 3;
const CLEAR_VIEW_RECOVERY = 45;
const CLEAR_VIEW_BUFF_MS = 8000;
const SHIELD_DURATION_MS = 180000;
const ROCK_HIT_RADIUS = 0.44;

const GAME_LEVELS = [
  {
    id: 1,
    name: 'Level 1: Entry Slope',
    subtitle: 'Blue snow and long telegraphs',
    segmentGoalRange: [3, 4],
    rockTelegraphMsRange: [2000, 2400],
    safeWindowMsRange: [1800, 2200],
    passiveObscurityPerSecondRange: [0.4, 0.8],
    singleChance: 0.9,
    doubleChance: 0.0,
    returnPunishChance: 0.05,
    avalancheChance: 0,
    stormStrength: 0.22,
    ashStrength: 0,
    biomeMix: 0
  },
  {
    id: 2,
    name: 'Level 2: Narrow Ridge',
    subtitle: 'Tighter reads and first camera dirt',
    segmentGoalRange: [4, 4],
    rockTelegraphMsRange: [1700, 2000],
    safeWindowMsRange: [1400, 1800],
    passiveObscurityPerSecondRange: [1.2, 1.8],
    singleChance: 0.62,
    doubleChance: 0.28,
    returnPunishChance: 0.12,
    avalancheChance: 0,
    stormStrength: 0.42,
    ashStrength: 0.04,
    biomeMix: 0.2
  },
  {
    id: 3,
    name: 'Level 3: Storm Belt',
    subtitle: 'Avalanches and white blindness',
    segmentGoalRange: [4, 5],
    rockTelegraphMsRange: [1400, 1800],
    safeWindowMsRange: [1100, 1400],
    passiveObscurityPerSecondRange: [2.0, 3.0],
    singleChance: 0.42,
    doubleChance: 0.34,
    returnPunishChance: 0.22,
    avalancheChance: 0.18,
    avalancheTelegraphMsRange: [2300, 2600],
    stormStrength: 0.72,
    ashStrength: 0.08,
    biomeMix: 0.52
  },
  {
    id: 4,
    name: 'Level 4: Volcanic Push',
    subtitle: 'Ash, late reads, and summit pressure',
    segmentGoalRange: [4, 5],
    rockTelegraphMsRange: [1150, 1450],
    safeWindowMsRange: [900, 1200],
    passiveObscurityPerSecondRange: [2.8, 4.0],
    singleChance: 0.26,
    doubleChance: 0.42,
    returnPunishChance: 0.3,
    avalancheChance: 0.26,
    avalancheTelegraphMsRange: [1800, 2200],
    stormStrength: 0.88,
    ashStrength: 0.52,
    biomeMix: 1
  }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pickRange(range) {
  if (!Array.isArray(range)) {
    return range;
  }
  if (range.length === 1) {
    return range[0];
  }
  if (Number.isInteger(range[0]) && Number.isInteger(range[1])) {
    return randomInt(range[0], range[1]);
  }
  return randomBetween(range[0], range[1]);
}

function laneName(index) {
  return LANE_IDS[clamp(index, 0, LANE_IDS.length - 1)];
}

function createLevelBlueprints() {
  return GAME_LEVELS.map((level) => ({
    ...level,
    segmentGoal: pickRange(level.segmentGoalRange)
  }));
}

function buildHazard(level, state) {
  if (level.avalancheChance && Math.random() < level.avalancheChance) {
    return buildAvalanche(level);
  }
  return buildRockHazard(level, state);
}

function buildAvalanche(level) {
  const telegraphMs = pickRange(level.avalancheTelegraphMsRange || [2200, 2500]);
  const safeWindowMs = pickRange(level.safeWindowMsRange);
  return {
    type: 'avalanche',
    name: 'Avalanche',
    description: 'A full snow wall covers all lanes. Only a strong swing or a snow shield can save the climber.',
    telegraphMs,
    safeWindowMs,
    passiveObscurityPerSecond: pickRange(level.passiveObscurityPerSecondRange),
    waves: [
      {
        kind: 'avalanche',
        lanes: [0, 1, 2],
        impactMs: telegraphMs,
        lingerMs: 520
      }
    ]
  };
}

function buildRockHazard(level, state) {
  const telegraphMs = pickRange(level.rockTelegraphMsRange);
  const safeWindowMs = pickRange(level.safeWindowMsRange);
  const roll = Math.random();
  let lanes;
  let kind = 'single';

  if (roll < level.doubleChance) {
    kind = 'double';
    const safeLane = randomInt(0, 2);
    lanes = [0, 1, 2].filter((lane) => lane !== safeLane);
  } else {
    lanes = [randomInt(0, 2)];
    if (roll > 1 - level.returnPunishChance) {
      kind = 'return';
    }
  }

  const lingerMs = kind === 'return' ? 420 : 160;
  const safeLanes = [0, 1, 2].filter((lane) => !lanes.includes(lane));
  const preferredSafeLane = safeLanes.length
    ? safeLanes.reduce((best, lane) => (
      Math.abs(lane - state.currentLane) < Math.abs(best - state.currentLane) ? lane : best
    ), safeLanes[0])
    : state.currentLane;

  return {
    type: 'rocks',
    kind,
    name: kind === 'double' ? 'Double-lane rockfall' : kind === 'return' ? 'Swing-back trap' : 'Single-lane rockfall',
    description: kind === 'double'
      ? 'Two lanes are unsafe. Read the only clean route before the stone line reaches you.'
      : kind === 'return'
        ? 'A late stone punishes the return swing. Over-committing can still get you killed.'
        : 'One lane is under direct rockfall. A clean sidestep is enough if you read it early.',
    telegraphMs,
    safeWindowMs,
    passiveObscurityPerSecond: pickRange(level.passiveObscurityPerSecondRange),
    preferredSafeLane,
    waves: [
      {
        kind: 'rock',
        lanes,
        impactMs: telegraphMs,
        lingerMs,
        hitRadius: ROCK_HIT_RADIUS
      }
    ]
  };
}

function describeVisibility(value) {
  if (value < 20) {
    return 'Clear';
  }
  if (value < 45) {
    return 'Light frost';
  }
  if (value < 70) {
    return 'Dirty lens';
  }
  if (value < 90) {
    return 'Heavy smear';
  }
  return 'Near blind';
}

function formatCooldown(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${seconds}s`;
}
