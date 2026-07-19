function day(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function entries(map, keyName) {
  return [...map.entries()]
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));
}

export function aggregateOperationsAnalytics(logs = [], navigations = []) {
  const actionMap = new Map();
  const dailyMap = new Map();
  const channelMap = new Map();
  const destinationMap = new Map();

  for (const log of logs) {
    const action = String(log.action || "unknown").split(":", 1)[0].slice(0, 100);
    increment(actionMap, action);
  }
  for (const navigation of navigations) {
    increment(dailyMap, day(navigation.createdAt));
    increment(channelMap, navigation.channel || "unknown");
    increment(
      destinationMap,
      Number.isInteger(navigation.plotId) ? `Plot ${navigation.plotId}` : "Unassigned plot"
    );
  }

  return {
    totals: { auditActions: logs.length, navigations: navigations.length },
    auditActions: [...actionMap.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action)),
    navigation: {
      daily: entries(dailyMap, "date"),
      channels: entries(channelMap, "channel"),
      destinations: entries(destinationMap, "destination")
        .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination)),
    },
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function analyticsToCsv(analytics, period) {
  const rows = [
    ["Smart Cemetery Operations Analytics"],
    ["From", period.from],
    ["To", period.to],
    [],
    ["Audit action", "Count"],
    ...analytics.auditActions.map((row) => [row.action, row.count]),
    [],
    ["Navigation date", "Count"],
    ...analytics.navigation.daily.map((row) => [row.date, row.count]),
    [],
    ["Navigation channel", "Count"],
    ...analytics.navigation.channels.map((row) => [row.channel, row.count]),
    [],
    ["Destination group", "Count"],
    ...analytics.navigation.destinations.map((row) => [row.destination, row.count]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
