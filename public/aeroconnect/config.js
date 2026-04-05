/**
 * AeroConnect Predictor — Provider Configuration
 * Maps ICAO airline codes to Wi-Fi providers and their capabilities.
 */

const PROVIDER_CONFIG = {
  // Cathay Pacific — Intelsat 2Ku (has China regulatory agreement)
  CPA: { provider: "Intelsat_2Ku",    chinaAllowed: true,  label: "Cathay Pacific" },
  // United Airlines — Panasonic/Gogo
  UAL: { provider: "Panasonic_Gogo",  chinaAllowed: false, label: "United Airlines" },
  // American Airlines — Viasat
  AAL: { provider: "Viasat",          chinaAllowed: false, label: "American Airlines" },
  // Delta — Gogo/Viasat mix
  DAL: { provider: "Gogo_Viasat",     chinaAllowed: false, label: "Delta Air Lines" },
  // Singapore Airlines — Panasonic
  SIA: { provider: "Panasonic",       chinaAllowed: false, label: "Singapore Airlines" },
  // Emirates — Panasonic Avionics
  UAE: { provider: "Panasonic",       chinaAllowed: false, label: "Emirates" },
  // Qatar Airways — Ooredoo/Panasonic
  QTR: { provider: "Panasonic",       chinaAllowed: false, label: "Qatar Airways" },
  // British Airways — Inmarsat GX
  BAW: { provider: "Inmarsat_GX",     chinaAllowed: false, label: "British Airways" },
  // Lufthansa — Inmarsat GX
  DLH: { provider: "Inmarsat_GX",     chinaAllowed: false, label: "Lufthansa" },
  // Air France — Inmarsat GX
  AFR: { provider: "Inmarsat_GX",     chinaAllowed: false, label: "Air France" },
  // Korean Air — Panasonic
  KAL: { provider: "Panasonic",       chinaAllowed: false, label: "Korean Air" },
  // Asiana — Panasonic
  AAR: { provider: "Panasonic",       chinaAllowed: false, label: "Asiana Airlines" },
  // Japan Airlines — Panasonic
  JAL: { provider: "Panasonic",       chinaAllowed: false, label: "Japan Airlines" },
  // ANA — Panasonic
  ANA: { provider: "Panasonic",       chinaAllowed: false, label: "All Nippon Airways" },
  // Air China — Chinese provider (domestic agreement)
  CCA: { provider: "China_Ku",        chinaAllowed: true,  label: "Air China" },
  // China Eastern — Chinese provider
  CES: { provider: "China_Ku",        chinaAllowed: true,  label: "China Eastern" },
  // China Southern — Chinese provider
  CSN: { provider: "China_Ku",        chinaAllowed: true,  label: "China Southern" },
  // Qantas — Viasat/Inmarsat
  QFA: { provider: "Viasat",          chinaAllowed: false, label: "Qantas" },
  // Air Canada — Panasonic
  ACA: { provider: "Panasonic",       chinaAllowed: false, label: "Air Canada" },
  // Default fallback
  DEFAULT: { provider: "Unknown",     chinaAllowed: false, label: "Unknown Airline" },
};

/**
 * Resolve provider config from airline ICAO code.
 * Also accepts partial matches (first 3 chars of flight ident).
 */
function getProviderConfig(airlineCode) {
  if (!airlineCode) return PROVIDER_CONFIG.DEFAULT;
  const key = airlineCode.toUpperCase().slice(0, 3);
  return PROVIDER_CONFIG[key] || PROVIDER_CONFIG.DEFAULT;
}

/**
 * Physics constants used by the engine.
 */
const PHYSICS = {
  POLAR_LAT_LIMIT:     71,      // degrees — GEO satellite horizon cutoff
  MIN_ALTITUDE_FT:     10000,   // feet — below this = no service
  HANDOFF_INTERVAL_KM: 2000,    // km between satellite beam handoffs
  HANDOFF_DURATION_MIN: 2,      // minutes a handoff blip lasts
  EARTH_RADIUS_KM:     6371,    // km
};
