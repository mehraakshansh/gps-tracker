#!/usr/bin/env python3
"""
BRCS Asset Seeder — spreads 60+ military assets across all Indian commands.
Usage:
    pip install requests python-dotenv
    python scripts/seed_assets.py

Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or environment.
"""

import os, json, sys, random, time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Config ────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SERVICE_ROLE_KEY", "")

if not URL or not KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in environment or .env")
    sys.exit(1)

# ── Helper ────────────────────────────────────────────────────────────────────
def pg(method: str, path: str, body=None):
    req = Request(f"{URL}/rest/v1/{path}", method=method)
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    data = json.dumps(body).encode() if body else None
    try:
        with urlopen(req, data=data, timeout=15) as r:
            return json.loads(r.read())
    except HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        return None

def jitter(base: float, spread: float) -> float:
    return base + random.uniform(-spread, spread)

# ── Asset definitions ─────────────────────────────────────────────────────────
# Each entry: (name, callsign, asset_type, service, icon, lat, lon, speed_kmh)
ASSETS = [
    # ── WESTERN COMMAND (Punjab, Chandimandir) ────────────────────────────
    ("Arjun Mk2 Battle Tank",       "ALPHA-01", "MBT",           "ARMY",          "🪖", 30.71, 76.88, 45),
    ("INS Talwar Patrol",           "BRAVO-01", "ARMORED IFV",   "ARMY",          "🪖", 31.22, 75.44, 55),
    ("T-90 Bhishma Squadron",       "BRAVO-02", "MBT",           "ARMY",          "🪖", 30.55, 76.15, 40),
    ("BMP-2 Sarath APC",            "BRAVO-03", "APC",           "ARMY",          "🪖", 29.80, 74.90, 70),

    # ── SOUTH WESTERN COMMAND (Jaipur, Rajasthan Desert) ──────────────────
    ("T-72 Desert Division",        "CHARLIE-01","MBT",          "ARMY",          "🪖", 26.92, 75.82, 42),
    ("Pinaka MLRS Battery",         "CHARLIE-02","ARTILLERY",    "ARMY",          "🪖", 26.50, 73.10, 30),
    ("Nag ATGM Vehicle",            "CHARLIE-03","ANTI-TANK",    "ARMY",          "🪖", 25.40, 71.30, 60),
    ("BrahMos Mobile Launcher",     "CHARLIE-04","MISSILE",      "ARMY",          "🪖", 27.00, 72.60, 35),

    # ── NORTHERN COMMAND (LOC, Kashmir, Siachen) ──────────────────────────
    ("Kashmir LOC Patrol Bn",       "DELTA-01", "INFANTRY",      "ARMY",          "🪖", 34.10, 74.02, 15),
    ("Siachen Glacier Post",        "DELTA-02", "FOB",           "ARMY",          "🪖", 35.42, 76.92, 5),
    ("LOC Surveillance Drone",      "DELTA-03", "MALE UAV",      "ARMY",          "🚁", 33.90, 75.10, 180),
    ("Bofors 155mm Artillery",      "DELTA-04", "ARTILLERY",     "ARMY",          "🪖", 34.50, 75.50, 20),
    ("Rustom-2 MALE UAV",           "DELTA-05", "MALE UAV",      "AIR_FORCE",     "🚁", 34.20, 74.80, 200),

    # ── EASTERN COMMAND (Arunachal, Assam, Bengal) ─────────────────────────
    ("17 Mtn Strike Corps",         "ECHO-01",  "INFANTRY",      "ARMY",          "🪖", 27.10, 93.62, 12),
    ("Tawang Forward Post",         "ECHO-02",  "FOB",           "ARMY",          "🪖", 27.58, 91.88, 8),
    ("Brahmaputra Patrol Bn",       "ECHO-03",  "INFANTRY",      "ARMY",          "🪖", 26.18, 91.73, 20),
    ("Kolkata HQ Signals",          "ECHO-04",  "COMMAND",       "ARMY",          "🪖", 22.57, 88.36, 10),

    # ── SOUTHERN COMMAND (Pune, South India) ──────────────────────────────
    ("1 Armoured Division",         "FOXTROT-01","MBT",          "ARMY",          "🪖", 18.52, 73.86, 50),
    ("Hyderabad Mountain Regt",     "FOXTROT-02","INFANTRY",     "ARMY",          "🪖", 17.38, 78.47, 18),
    ("IAF Bangalore Training",      "FOXTROT-03","TRAINER",      "AIR_FORCE",     "✈️", 12.97, 77.59, 450),

    # ── CENTRAL COMMAND (Lucknow, UP) ────────────────────────────────────
    ("21 Strike Corps HQ",          "GOLF-01",  "COMMAND",       "ARMY",          "🪖", 26.85, 80.95, 15),
    ("Agra Para Brigade",           "GOLF-02",  "PARA INFANTRY", "ARMY",          "🪖", 27.18, 78.00, 25),
    ("VI Corps Engineering",        "GOLF-03",  "ENGINEERING",   "ARMY",          "🪖", 25.44, 81.85, 30),

    # ── WESTERN AIR COMMAND (Delhi, Punjab) ───────────────────────────────
    ("Rafale 17 Sqn",               "HAWK-01",  "4.5-GEN FIGHTER","AIR_FORCE",   "✈️", 28.69, 77.10, 1800),
    ("Rafale 101 Sqn",              "HAWK-02",  "4.5-GEN FIGHTER","AIR_FORCE",   "✈️", 28.56, 77.32, 1850),
    ("Sukhoi-30 MKI",               "HAWK-03",  "4-GEN FIGHTER", "AIR_FORCE",    "✈️", 30.62, 76.78, 2100),
    ("MiG-29 Upgrade",              "HAWK-04",  "FIGHTER",       "AIR_FORCE",    "✈️", 28.72, 77.35, 2200),
    ("IL-76 Heavy Transport",       "HAWK-05",  "HEAVY TRANSPORT","AIR_FORCE",   "✈️", 28.56, 77.12, 850),
    ("C-17 Globemaster III",        "HAWK-06",  "STRATEGIC TRANSPORT","AIR_FORCE","✈️",28.58, 77.40, 800),
    ("AEW&CS Netra",                "HAWK-07",  "AWACS",         "AIR_FORCE",    "✈️", 28.65, 77.27, 650),
    ("Apache AH-64E",               "HAWK-08",  "ATTACK HELI",   "AIR_FORCE",    "🚁", 29.50, 75.90, 260),
    ("Dhruv ALH Attack Mk4",        "HAWK-09",  "ATTACK HELI",   "AIR_FORCE",    "🚁", 28.68, 77.20, 290),

    # ── SW AIR COMMAND (Gandhinagar) ──────────────────────────────────────
    ("Tejas Mk1A — 18 Sqn",        "INDIGO-01","LCA FIGHTER",   "AIR_FORCE",    "✈️", 23.02, 72.57, 1350),
    ("Tejas Mk1A — 45 Sqn",        "INDIGO-02","LCA FIGHTER",   "AIR_FORCE",    "✈️", 22.80, 72.40, 1380),
    ("Jaguar DARIN-III",            "INDIGO-03","STRIKE AIRCRAFT","AIR_FORCE",   "✈️", 24.58, 73.69, 1100),

    # ── EASTERN AIR COMMAND (Shillong) ────────────────────────────────────
    ("Sukhoi-30 MKI East",          "JULIET-01","4-GEN FIGHTER", "AIR_FORCE",    "✈️", 25.58, 91.88, 2100),
    ("Mi-17 Utility East",          "JULIET-02","UTILITY HELI",  "AIR_FORCE",    "🚁", 26.10, 91.60, 250),
    ("Rustom-1 MALE UAV",           "JULIET-03","MALE UAV",      "AIR_FORCE",    "🚁", 27.05, 93.45, 185),

    # ── SOUTHERN AIR COMMAND (Thiruvananthapuram) ─────────────────────────
    ("Sukhoi-30 SAC",               "KILO-01",  "4-GEN FIGHTER", "AIR_FORCE",    "✈️", 8.48,  76.95, 2100),
    ("AN-32 Transport South",       "KILO-02",  "TRANSPORT",     "AIR_FORCE",    "✈️", 9.99,  76.27, 530),

    # ── WESTERN NAVAL COMMAND (Mumbai, Arabian Sea) ───────────────────────
    ("INS Vikrant CVN",             "LIMA-01",  "CARRIER",       "NAVY",         "⚓", 18.97, 72.85, 28),
    ("INS Vishal Escort",           "LIMA-02",  "DESTROYER",     "NAVY",         "⚓", 18.40, 71.60, 32),
    ("INS Kolkata Frigate",         "LIMA-03",  "FRIGATE",       "NAVY",         "⚓", 17.80, 70.20, 35),
    ("INS Shivalik Frigate",        "LIMA-04",  "FRIGATE",       "NAVY",         "⚓", 19.20, 69.50, 35),
    ("INS Sindhughosh Sub",         "LIMA-05",  "SUBMARINE",     "NAVY",         "⚓", 20.50, 67.30, 18),
    ("INS Arihant SSBN",            "LIMA-06",  "BALLISTIC SUB", "NAVY",         "⚓", 16.80, 64.20, 20),
    ("Sea King ASW Heli",           "LIMA-07",  "ASW HELI",      "NAVY",         "🚁", 18.85, 72.82, 200),
    ("P-8I Poseidon MPA",           "LIMA-08",  "MARITIME PATROL","NAVY",        "✈️", 19.10, 72.97, 800),

    # ── EASTERN NAVAL COMMAND (Visakhapatnam, Bay of Bengal) ─────────────
    ("INS Vikramaditya CVN",        "MIKE-01",  "CARRIER",       "NAVY",         "⚓", 15.80, 83.80, 25),
    ("INS Ranvijay Destroyer",      "MIKE-02",  "DESTROYER",     "NAVY",         "⚓", 14.50, 82.00, 32),
    ("INS Trikand Frigate",         "MIKE-03",  "FRIGATE",       "NAVY",         "⚓", 13.00, 81.50, 34),
    ("INS Chakra SSN",              "MIKE-04",  "ATTACK SUB",    "NAVY",         "⚓", 12.80, 84.50, 22),
    ("Dornier 228 Maritime",        "MIKE-05",  "MARITIME PATROL","NAVY",        "✈️", 17.68, 83.22, 320),

    # ── SOUTHERN NAVAL COMMAND (Kochi, Lakshadweep) ───────────────────────
    ("INS Suvarna Patrol",          "NOVEMBER-01","CORVETTE",    "NAVY",         "⚓", 10.00, 75.50, 38),
    ("Kamov Ka-31 AEW",             "NOVEMBER-02","AEW HELI",    "NAVY",         "🚁", 9.94,  76.27, 220),

    # ── ANDAMAN & NICOBAR ─────────────────────────────────────────────────
    ("Andaman Joint Patrol",        "OSCAR-01", "CORVETTE",      "NAVY",         "⚓", 11.68, 92.73, 36),
    ("AN-32 Andaman Transport",     "OSCAR-02", "TRANSPORT",     "AIR_FORCE",    "✈️", 11.62, 92.75, 480),

    # ── SPECIAL FORCES COMMAND (Agra) ─────────────────────────────────────
    ("Para SF Team GHOST",          "PHANTOM-01","SF TEAM",      "SPECIAL_FORCES","🪖", 27.88, 77.97, 120),
    ("Para SF Team VIPER",          "PHANTOM-02","SF TEAM",      "SPECIAL_FORCES","🪖", 27.20, 78.10, 100),
    ("NSG Counter-Terror",          "PHANTOM-03","CT UNIT",      "SPECIAL_FORCES","🪖", 28.62, 77.21, 80),
    ("MARCOS Maritime SF",          "PHANTOM-04","MARITIME SF",  "SPECIAL_FORCES","🪖", 18.92, 72.84, 50),
    ("GHATAK SF Platoon",           "PHANTOM-05","SF TEAM",      "SPECIAL_FORCES","🪖", 26.90, 80.95, 90),

    # ── TAPAS / DRDO DRONES ───────────────────────────────────────────────
    ("TAPAS-BH-201 Drone",          "RAVEN-01", "MALE UAV",      "AIR_FORCE",    "🚁", 28.44, 77.60, 195),
    ("TAPAS Recce Flight",          "RAVEN-02", "MALE UAV",      "AIR_FORCE",    "🚁", 22.70, 75.82, 190),
    ("DRDO CATS Drone",             "RAVEN-03", "UCAV",          "AIR_FORCE",    "🚁", 13.20, 77.55, 350),
]

# ── Statuses / threats ────────────────────────────────────────────────────────
STATUSES = ["ACTIVE","ACTIVE","ACTIVE","ACTIVE","ACTIVE","STANDBY","ENGAGED","HALTED"]
THREATS  = ["GREEN","GREEN","GREEN","GREEN","YELLOW","YELLOW","ORANGE","RED"]

def build_asset(row):
    name, callsign, asset_type, service, icon, lat, lon, speed = row
    status     = random.choice(STATUSES)
    threat     = random.choice(THREATS)
    heading    = random.uniform(0, 360)
    fuel       = random.uniform(40, 100)
    ammo       = random.uniform(20, 100) if service != "NAVY" or "SUB" not in asset_type else 85
    return {
        "name":            name,
        "callsign":        callsign,
        "asset_type":      asset_type,
        "service":         service,
        "icon":            icon,
        "current_lat":     jitter(lat, 0.18),
        "current_lon":     jitter(lon, 0.18),
        "current_speed":   jitter(speed * 0.6, speed * 0.1),
        "current_heading": round(heading, 1),
        "fuel_pct":        round(fuel, 1),
        "ammo_pct":        round(ammo, 1),
        "status":          status,
        "threat_level":    threat,
    }

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"Connecting to {URL}")
    print(f"Clearing existing assets...")

    # Delete all existing assets
    req = Request(f"{URL}/rest/v1/assets?id=gt.0", method="DELETE")
    req.add_header("apikey", KEY)
    req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urlopen(req, timeout=15): pass
    except Exception as e:
        print(f"  Warning (delete all): {e}")

    # Simpler: upsert all assets
    assets = [build_asset(row) for row in ASSETS]

    print(f"Inserting {len(assets)} assets...")
    result = pg("POST", "assets", assets)

    if result is None:
        print("  ERROR: Insert failed. Check Supabase connection and table schema.")
        sys.exit(1)

    inserted = len(result) if isinstance(result, list) else 0
    print(f"  ✓ Inserted {inserted} assets across all commands")
    print(f"\nAsset distribution:")
    from collections import Counter
    svc_count = Counter(a["service"] for a in assets)
    for svc, cnt in sorted(svc_count.items()):
        print(f"  {svc}: {cnt} units")

    print(f"\nGeographic spread:")
    lat_min = min(a["current_lat"] for a in assets)
    lat_max = max(a["current_lat"] for a in assets)
    lon_min = min(a["current_lon"] for a in assets)
    lon_max = max(a["current_lon"] for a in assets)
    print(f"  Lat: {lat_min:.2f}°N — {lat_max:.2f}°N")
    print(f"  Lon: {lon_min:.2f}°E — {lon_max:.2f}°E")
    print(f"\n✓ Seeding complete.")

if __name__ == "__main__":
    main()
