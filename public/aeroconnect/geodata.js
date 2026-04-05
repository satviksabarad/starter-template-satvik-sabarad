/**
 * AeroConnect Predictor — Restricted Airspace GeoData
 * Polygon coordinates [lon, lat] (GeoJSON convention).
 * Polygons are simplified but geopolitically accurate.
 */

const RESTRICTED_ZONES = [
  {
    id: "china",
    name: "China",
    description: "People's Republic of China — Wi-Fi restricted for most providers",
    // Providers with agreements bypass this: Intelsat_2Ku (Cathay), China_Ku
    requiresAgreement: true,
    color: "#ff4444",
    // Simplified mainland China + airspace bounding polygon
    polygon: [
      [73.5, 18.2], [73.5, 26.0], [79.0, 28.5], [80.5, 30.0],
      [82.0, 31.5], [84.5, 33.0], [88.0, 35.5], [91.0, 36.5],
      [97.0, 37.5], [100.5, 38.5], [103.5, 40.5], [106.0, 41.5],
      [110.0, 42.0], [115.5, 43.5], [119.0, 45.0], [122.5, 46.5],
      [124.0, 48.0], [125.0, 49.5], [126.0, 52.0], [130.0, 52.5],
      [134.5, 48.5], [134.7, 45.0], [131.0, 42.0], [130.5, 40.0],
      [129.5, 38.0], [125.5, 33.5], [122.0, 30.0], [121.0, 26.5],
      [120.0, 23.5], [117.0, 21.5], [110.0, 18.5], [105.5, 18.0],
      [103.0, 19.5], [102.0, 21.0], [100.5, 22.0], [99.0, 22.5],
      [97.5, 23.0], [95.5, 23.5], [93.0, 24.0], [91.5, 24.5],
      [89.5, 26.0], [87.0, 27.0], [84.0, 27.5], [80.0, 26.5],
      [78.0, 24.0], [76.0, 22.0], [74.0, 20.5], [73.5, 18.2],
    ],
  },
  {
    id: "north_korea",
    name: "North Korea",
    description: "DPRK — No civilian Wi-Fi permitted over airspace",
    requiresAgreement: false,
    color: "#ff0000",
    polygon: [
      [124.0, 37.7], [124.0, 38.5], [124.7, 39.5], [125.0, 40.2],
      [125.8, 41.0], [126.5, 41.8], [127.0, 42.0], [127.5, 42.3],
      [128.0, 42.5], [129.0, 42.8], [129.5, 42.5], [130.2, 42.2],
      [130.7, 41.5], [130.3, 40.5], [129.7, 39.5], [129.2, 38.5],
      [128.8, 38.0], [128.2, 37.8], [127.5, 37.5], [126.5, 37.5],
      [125.5, 37.7], [124.5, 37.7], [124.0, 37.7],
    ],
  },
  {
    id: "russia_restricted",
    name: "Russia (Eastern Siberia)",
    description: "Russian airspace — Avoid for Western carriers; spotty coverage",
    requiresAgreement: false,
    color: "#ff8800",
    polygon: [
      [60.0, 55.0], [60.0, 72.0], [100.0, 72.0], [140.0, 72.0],
      [170.0, 72.0], [180.0, 68.0], [180.0, 55.0], [170.0, 50.0],
      [150.0, 48.0], [130.0, 42.0], [120.0, 42.0], [100.0, 50.0],
      [80.0, 55.0], [60.0, 55.0],
    ],
  },
  {
    id: "iran",
    name: "Iran",
    description: "Islamic Republic of Iran — Wi-Fi service unavailable",
    requiresAgreement: false,
    color: "#ff4444",
    polygon: [
      [44.0, 37.0], [44.5, 39.5], [46.0, 40.0], [48.0, 40.5],
      [50.0, 40.0], [52.0, 40.5], [54.5, 40.0], [56.0, 38.0],
      [58.0, 37.5], [60.5, 37.0], [63.0, 36.5], [63.5, 35.0],
      [63.0, 33.0], [62.0, 30.0], [61.0, 27.5], [60.5, 25.5],
      [58.0, 23.0], [56.5, 24.0], [55.0, 25.5], [53.5, 26.5],
      [52.0, 27.5], [50.5, 29.0], [49.0, 30.0], [48.0, 31.0],
      [46.5, 31.5], [45.5, 32.5], [45.0, 33.5], [44.5, 35.0],
      [44.0, 37.0],
    ],
  },
  {
    id: "cuba",
    name: "Cuba",
    description: "Cuba — US-provider Wi-Fi restrictions apply",
    requiresAgreement: false,
    color: "#ff4444",
    polygon: [
      [-85.0, 22.5], [-84.0, 23.2], [-82.5, 23.2], [-80.5, 23.0],
      [-79.5, 22.5], [-75.0, 20.0], [-74.5, 19.7], [-74.0, 20.0],
      [-74.5, 20.5], [-75.5, 21.0], [-79.5, 22.0], [-82.0, 22.5],
      [-85.0, 22.5],
    ],
  },
];

/**
 * Ray-casting point-in-polygon test.
 * @param {number} lat
 * @param {number} lon
 * @param {Array<[number,number]>} polygon  - [[lon, lat], ...]
 * @returns {boolean}
 */
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Check which restricted zone (if any) a point falls in.
 * @returns {object|null} the matching zone or null
 */
function getRestrictedZone(lat, lon) {
  for (const zone of RESTRICTED_ZONES) {
    if (pointInPolygon(lat, lon, zone.polygon)) {
      return zone;
    }
  }
  return null;
}
