# Cemetery pedestrian routing deployment

The application now proxies routing through `POST /api/routing`; browsers never receive the provider URL. Production conformance still requires a **surveyed Bolonsori walkway graph** and a managed or self-hosted OSRM-compatible pedestrian endpoint. Do not fabricate paths from grave coordinates.

## Dataset contract

Store the approved survey export as `cemetery-walkways.geojson` (intentionally not supplied because no authoritative survey was available). It must validate against `cemetery-walkways.schema.json` and contain only walkable `LineString` features. Required properties are `pathId`, `access`, and `surface`; do not include deceased names, contacts, or other burial-record data.

Survey requirements:

1. Capture entrances, intersections, ramps, stairs, paved lanes, and safe footpaths with municipal approval.
2. Snap connected endpoints to the same coordinate and record inaccessible/restricted segments explicitly.
3. Verify every routable plot connects to an entrance; disconnected plots must remain marked as unavailable for directions.
4. Review accessibility and seasonal closures before each provider import.
5. Version and checksum each approved export for rollback.

## Provider deployment

1. Convert/merge the approved GeoJSON into the provider's pedestrian graph input (typically OSM/PBF for OSRM-compatible services).
2. Build with a pedestrian profile that honors `access`, stairs, and restricted segments.
3. Deploy behind HTTPS with request limits, health monitoring, and no client-side credentials.
4. Configure `ROUTING_BASE_URL`, `ROUTING_PROFILE=foot`, `ROUTING_TIMEOUT_MS`, and `ROUTING_MAX_RADIUS_METERS`.
5. Run synthetic entrance-to-plot routes, denied/out-of-bounds requests, timeout checks, and disconnected-path checks before enabling production traffic.

Public OSRM and public OpenStreetMap tiles are development fallbacks only. The repository cannot complete the physical survey or provision provider infrastructure without the approved walkway coordinates, target host, and credentials.