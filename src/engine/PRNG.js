export function createMulberry32(seedInput) {
  let a = 0;
  if (typeof seedInput === 'string') {
    for (let i = 0; i < seedInput.length; i++) {
      a = ((a << 5) - a + seedInput.charCodeAt(i)) | 0;
    }
  } else {
    a = seedInput | 0;
  }

  // Mulberry32 32-bit generator
  const next = () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    rangeInt: (min, max) => Math.floor(min + next() * (max - min + 1)),
    choice: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }
  };
}

export function getTodaySeedString() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateDailySurvivalSpec(seedStr = getTodaySeedString()) {
  const prng = createMulberry32(seedStr);
  
  // Deterministic Arena Platform Layout
  // Virtual dimensions: width 800, height 360
  const platforms = [
    // Main solid ground
    { x: 400, y: 340, width: 840, height: 40, type: 'ground' },
    
    // Tier 1 platforms
    { x: 180, y: 260, width: 120, height: 16, type: 'ruins' },
    { x: 620, y: 260, width: 120, height: 16, type: 'ruins' },
    
    // Center floating terrace
    { x: 400, y: 200, width: 180, height: 16, type: 'ruins' },
    
    // Tier 2 high perches
    { x: 120, y: 140, width: 90, height: 16, type: 'ruins' },
    { x: 680, y: 140, width: 90, height: 16, type: 'ruins' },
  ];

  // Seeded crate spawns (3-4 breakables per arena)
  const crateCount = prng.rangeInt(3, 5);
  const crateSpots = [
    { x: 150, y: 240 },
    { x: 650, y: 240 },
    { x: 380, y: 180 },
    { x: 420, y: 180 },
    { x: 100, y: 120 },
    { x: 700, y: 120 },
  ];
  const shuffledSpots = prng.shuffle(crateSpots);
  const crates = shuffledSpots.slice(0, crateCount);

  // Deterministic wave schedule (every 12-16 seconds a new wave triggers)
  const waves = [
    {
      waveNumber: 1,
      title: 'Wave 1: The Shell Crawlers',
      spawns: [
        { type: 'snail', x: 80, y: 310, delay: 0 },
        { type: 'snail', x: 720, y: 310, delay: 1000 },
        { type: 'snail', x: 400, y: 180, delay: 2000 },
      ]
    },
    {
      waveNumber: 2,
      title: 'Wave 2: Tusks & Stingers',
      spawns: [
        { type: 'boar', x: 60, y: 310, delay: 0 },
        { type: 'boar', x: 740, y: 310, delay: 1500 },
        { type: 'bee', x: 200, y: 100, delay: 2500 },
      ]
    },
    {
      waveNumber: 3,
      title: 'Wave 3: Snail Shield Wall',
      spawns: [
        { type: 'snail', x: 250, y: 310, delay: 0 },
        { type: 'snail', x: 550, y: 310, delay: 500 },
        { type: 'bee', x: 600, y: 120, delay: 1500 },
        { type: 'bee', x: 200, y: 120, delay: 2500 },
      ]
    },
    {
      waveNumber: 4,
      title: 'Wave 4: Forest Stampede',
      spawns: [
        { type: 'boar', x: 60, y: 310, delay: 0 },
        { type: 'boar', x: 740, y: 310, delay: 1000 },
        { type: 'boar', x: 400, y: 180, delay: 2000 },
        { type: 'bee', x: 400, y: 80, delay: 3000 },
      ]
    },
    {
      waveNumber: 5,
      title: 'Wave 5: The Hive Swarm',
      spawns: [
        { type: 'bee', x: 150, y: 90, delay: 0 },
        { type: 'bee', x: 350, y: 80, delay: 800 },
        { type: 'bee', x: 650, y: 90, delay: 1600 },
        { type: 'snail', x: 100, y: 310, delay: 2200 },
        { type: 'snail', x: 700, y: 310, delay: 2600 },
      ]
    }
  ];

  return {
    seedStr,
    platforms,
    crates,
    waves
  };
}
