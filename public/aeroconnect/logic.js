/**
 * AeroConnect Predictor — Physics Engine (logic.js)
 *
 * Depends on: config.js, geodata.js (must be loaded first)
 *
 * Exports (global):
 *   analyzeFlightPath(waypoints, airlineCode) → segments[]
 *   buildGanttBlocks(segments, totalMinutes) → blocks[]
 *   interpolateGreatCircle(lat1, lon1, lat2, lon2, n) → waypoints[]
 *   haversineDistance(p1, p2) → km
 *   extractAirlineCode(flightIdent) → string
 */

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

/**
 * Haversine distance between two lat/lon points in km.
 */
function haversineDistance(p1, p2) {
  const R = PHYSICS.EARTH_RADIUS_KM;
  const dLat = toRad(p2.latitude - p1.latitude);
  const dLon = toRad(p2.longitude - p1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Great-circle interpolation between two airports.
 * Returns n+1 waypoints along the shortest spherical path.
 */
function interpolateGreatCircle(lat1, lon1, lat2, lon2, n = 100) {
  const la1 = toRad(lat1), lo1 = toRad(lon1);
  const la2 = toRad(lat2), lo2 = toRad(lon2);
  const points = [];

  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((la2 - la1) / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2
  ));

  for (let i = 0; i <= n; i++) {
    const f = i / n;
    // Ramp altitude: 0 at ends, 35000ft in cruise
    let alt = 35000;
    if (i <= 4)      alt = Math.round(i / 4 * 35000);
    if (i >= n - 4)  alt = Math.round((n - i) / 4 * 35000);

    if (d === 0) { points.push({ latitude: lat1, longitude: lon1, altitude: alt }); continue; }

    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);

    points.push({
      latitude:  toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
      longitude: toDeg(Math.atan2(y, x)),
      altitude:  alt,
    });
  }
  return points;
}

/**
 * Extract 3-letter ICAO airline code from a flight ident string.
 * e.g. "CX830" → "CPA" (via IATA→ICAO map), "UAL123" → "UAL"
 */
const IATA_TO_ICAO = {
  CX: "CPA", UA: "UAL", AA: "AAL", DL: "DAL", SQ: "SIA",
  EK: "UAE", QR: "QTR", BA: "BAW", LH: "DLH", AF: "AFR",
  KE: "KAL", OZ: "AAR", JL: "JAL", NH: "ANA", CA: "CCA",
  MU: "CES", CZ: "CSN", QF: "QFA", AC: "ACA",
};

function extractAirlineCode(ident) {
  if (!ident) return "DEFAULT";
  const upper = ident.toUpperCase();
  // Try IATA 2-letter prefix first
  const iata2 = upper.slice(0, 2);
  if (IATA_TO_ICAO[iata2]) return IATA_TO_ICAO[iata2];
  // Try ICAO 3-letter prefix
  const icao3 = upper.slice(0, 3);
  if (PROVIDER_CONFIG[icao3]) return icao3;
  return "DEFAULT";
}

// ─────────────────────────────────────────────
// Core Physics Engine
// ─────────────────────────────────────────────

/**
 * Analyze a flight path and return colored segments.
 *
 * @param {Array<{latitude, longitude, altitude}>} waypoints
 * @param {string} airlineCode — ICAO 3-letter code
 * @returns {Array<Segment>}
 *
 * Segment shape:
 * {
 *   from: {latitude, longitude, altitude},
 *   to:   {latitude, longitude, altitude},
 *   status: 'green' | 'yellow' | 'handoff' | 'red',
 *   reason: string | null,
 *   distanceKm: number,          // segment length
 *   cumulativeKm: number,        // total distance at segment end
 *   progressFraction: number,    // 0–1 along route
 * }
 */
function analyzeFlightPath(waypoints, airlineCode) {
  const providerCfg = getProviderConfig(airlineCode);
  const segments = [];

  // First pass: compute total route distance
  let totalKm = 0;
  const cumKm = [0];
  for (let i = 1; i < waypoints.length; i++) {
    totalKm += haversineDistance(waypoints[i - 1], waypoints[i]);
    cumKm.push(totalKm);
  }

  let lastHandoffKm = 0; // track distance of last handoff

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segKm = cumKm[i + 1] - cumKm[i];

    let status = "green";
    let reason = null;

    const alt = p1.altitude || 0;
    const lat = p1.latitude;
    const lon = p1.longitude;

    // ── Rule 1: Altitude floor ──────────────────
    if (alt < PHYSICS.MIN_ALTITUDE_FT && alt > 0) {
      status = "red";
      reason = "Below Operating Altitude (< 10,000 ft) — service not started";
    }

    // ── Rule 2: Polar connectivity gap (71° rule) ─
    else if (Math.abs(lat) > PHYSICS.POLAR_LAT_LIMIT) {
      status = "red";
      reason = `Polar Connectivity Gap — GEO satellite horizon limit at ${Math.abs(lat).toFixed(1)}° latitude`;
    }

    // ── Rule 3: Geopolitical restrictions ────────
    else {
      const zone = getRestrictedZone(lat, lon);
      if (zone) {
        // China special case: some providers have an agreement
        if (zone.id === "china" && providerCfg.chinaAllowed) {
          status = "green";
          reason = null; // All good — provider has CAC agreement
        } else if (zone.id === "russia_restricted") {
          // Spotty but not full blackout for most carriers
          status = "yellow";
          reason = `Degraded Coverage — ${zone.description}`;
        } else {
          status = "red";
          reason = `Regional Regulatory Restriction — ${zone.name}: ${zone.description}`;
        }
      }
    }

    // ── Rule 4: Satellite beam handoff (every 2000km) ─
    // Distinct from "spotty" — this is a brief 2-min blip, not sustained degradation.
    // Only apply if currently green (don't override red/yellow geopolitical zones).
    if (status === "green" && (cumKm[i] - lastHandoffKm) >= PHYSICS.HANDOFF_INTERVAL_KM) {
      status = "handoff";
      reason = `Satellite Beam Handoff (~2 min) — switching coverage zone at ${Math.round(cumKm[i])} km`;
      lastHandoffKm = cumKm[i];
    }

    segments.push({
      from:             { ...p1 },
      to:               { ...p2 },
      status,
      reason,
      distanceKm:       segKm,
      cumulativeKm:     cumKm[i + 1],
      progressFraction: cumKm[i + 1] / totalKm,
    });
  }

  return segments;
}

// ─────────────────────────────────────────────
// Gantt / Timeline Builder
// ─────────────────────────────────────────────

/**
 * Convert segments (distance-based) to time-based Gantt blocks.
 *
 * @param {Segment[]} segments
 * @param {number} totalMinutes — total flight duration
 * @returns {Array<{status, reason, startMin, endMin, widthPct}>}
 */
function buildGanttBlocks(segments, totalMinutes) {
  if (!segments.length) return [];

  const blocks = [];
  let currentStatus = segments[0].status;
  let currentReason = segments[0].reason;
  let blockStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const endMin = seg.progressFraction * totalMinutes;

    const isSameBlock =
      seg.status === currentStatus &&
      seg.reason === currentReason;

    if (!isSameBlock) {
      // Close previous block
      blocks.push({
        status:    currentStatus,
        reason:    currentReason,
        startMin:  blockStart,
        endMin:    endMin,
        widthPct:  ((endMin - blockStart) / totalMinutes) * 100,
      });
      currentStatus = seg.status;
      currentReason = seg.reason;
      blockStart = endMin;
    }
  }

  // Close final block
  blocks.push({
    status:   currentStatus,
    reason:   currentReason,
    startMin: blockStart,
    endMin:   totalMinutes,
    widthPct: ((totalMinutes - blockStart) / totalMinutes) * 100,
  });

  return blocks;
}

/**
 * Format minutes as "Xh Ym".
 */
function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Summarize connectivity statistics from Gantt blocks.
 * Tracks green / yellow (spotty) / handoff / red separately.
 */
function buildSummary(ganttBlocks, totalMinutes) {
  const totals = { green: 0, yellow: 0, handoff: 0, red: 0 };
  for (const b of ganttBlocks) {
    totals[b.status] = (totals[b.status] || 0) + (b.endMin - b.startMin);
  }
  return {
    totalMin:       totalMinutes,
    onlineMin:      totals.green,
    spottyMin:      totals.yellow,
    handoffMin:     totals.handoff,
    offlineMin:     totals.red,
    onlinePct:      Math.round((totals.green   / totalMinutes) * 100),
    spottyPct:      Math.round((totals.yellow  / totalMinutes) * 100),
    handoffPct:     Math.round((totals.handoff / totalMinutes) * 100),
    offlinePct:     Math.round((totals.red     / totalMinutes) * 100),
    onlineLabel:    formatMinutes(totals.green),
    spottyLabel:    formatMinutes(totals.yellow),
    handoffLabel:   formatMinutes(totals.handoff),
    offlineLabel:   formatMinutes(totals.red),
  };
}
