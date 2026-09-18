/**
 * Pure aggregation helpers for the role dashboards.
 *
 * These take raw API payloads (plots, requests) and shape them for the
 * dashboard charts so the UI never renders placeholder/mock data.
 */

/** Group plots by location name into occupied vs available counts. */
export function buildOccupancyByLocation(plots, limit = 6) {
  if (!Array.isArray(plots) || plots.length === 0) return [];

  const groups = new Map();
  for (const plot of plots) {
    const locName = plot?.locationDetail?.location?.name;
    const subName = plot?.locationDetail?.subsection;
    const name = locName || (subName ? `Section ${subName}` : "Unassigned");
    const entry = groups.get(name) || { name, occupied: 0, available: 0 };
    if (plot.status === "occupied") entry.occupied += 1;
    else if (plot.status === "available") entry.available += 1;
    groups.set(name, entry);
  }

  return [...groups.values()]
    .sort((a, b) => b.occupied + b.available - (a.occupied + a.available))
    .slice(0, limit);
}

/**
 * Build a daily received-vs-completed series for the trailing `days` window.
 * "Completed" counts requests whose status left `pending`, keyed on updatedAt.
 */
export function buildRequestTrend(requests, days = 30) {
  const series = [];
  const index = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const point = { key, date: String(day.getDate()), received: 0, completed: 0 };
    index.set(key, point);
    series.push(point);
  }

  if (!Array.isArray(requests)) return series;

  for (const request of requests) {
    const createdKey = dayKey(request?.createdAt);
    if (createdKey && index.has(createdKey)) index.get(createdKey).received += 1;

    if (request?.status && request.status !== "pending") {
      const closedKey = dayKey(request?.updatedAt || request?.createdAt);
      if (closedKey && index.has(closedKey)) index.get(closedKey).completed += 1;
    }
  }

  return series;
}

/** Count plots by status. */
export function countPlotStatuses(plots) {
  const counts = { available: 0, occupied: 0, reserved: 0, maintenance: 0, unpinned: 0 };
  if (!Array.isArray(plots)) return counts;
  for (const plot of plots) {
    if (plot.status in counts) counts[plot.status] += 1;
    if (plot.gpsLat == null || plot.gpsLng == null) counts.unpinned += 1;
  }
  return counts;
}

/** Relative "time ago" label used by dashboard queues. */
export function timeAgo(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor(Math.max(0, Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function dayKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}
