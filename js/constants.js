export const CONFIG = {
  MERCURY_DIST: 5.5,
  EARTH_DIST: 8.5,
  MOON_ORBIT_RADIUS: 1.6,
  SUN_POS: { x: -8, y: 0, z: 0 },
  EARTH_RADIUS: 0.85,
  MOON_RADIUS: 0.2,
  SUN_RADIUS: 1.8,
  DEFAULT_SUN_BULGE: 0.18,
  DEFAULT_MOON_BULGE: 0.09,
};

export const PRESETS = {
  mercury: {
    dist: CONFIG.MERCURY_DIST,
    bulge: 0.18,
    label: 'Mercury orbit',
    tidalForce: '17.6×',
    orbitText: '0.39 AU'
  },
  earth: {
    dist: CONFIG.EARTH_DIST,
    bulge: 0.04,
    label: 'Normal orbit',
    tidalForce: '1.0×',
    orbitText: '1.00 AU'
  },
  springTide: {
    label: 'Spring Tide',
    description: 'Sun and Moon aligned, maximizing tidal range.',
    sunBulge: 0.18,
    moonBulge: 0.15
  },
  neapTide: {
    label: 'Neap Tide',
    description: 'Sun and Moon at right angles, minimizing tidal range.',
    sunBulge: 0.18,
    moonBulge: 0.05
  }
};
