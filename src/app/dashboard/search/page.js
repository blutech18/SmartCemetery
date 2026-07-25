"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Archive, MapPin } from "lucide-react";

export default function DashboardSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/graves?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const allResults = results
    ? [...(results.exact || []), ...(results.suggestions || []), ...(results.nearby || [])]
        .filter((grave, index, items) => items.findIndex((item) => item.id === grave.id) === index)
    : [];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Search Graves</h1>
          <p className="page-subtitle">
            Find burial records with smart phonetic matching
          </p>
        </div>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="card"
        style={{ marginBottom: "var(--space-xl)" }}
      >
        <div className="flex gap-md items-center">
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search
              size={16}
              className="text-muted"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              aria-hidden="true"
            />
            <input
              type="text"
              className="form-input"
              placeholder="Enter deceased name, grave ID, or year..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              style={{ paddingLeft: 36 }}
              id="dashboard-search-input"
              aria-label="Search burial records"
            />
          </div>
          <button type="submit" className="btn btn-primary flex items-center justify-center gap-xs" id="dashboard-search-btn">
            <Search size={18} /> Search
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : allResults.length > 0 ? (
        <>
          {results?.suggestions?.length > 0 && results?.exact?.length === 0 && (
            <div className="alert alert-info flex items-center gap-sm" style={{ marginBottom: "var(--space-md)" }}>
              <Search size={16} /> No exact match found. Showing closest phonetic suggestions:
            </div>
          )}
          <div className="flex flex-col gap-md">
            {allResults.map((grave) => (
              <div key={grave.id} className="search-result">
                <div className="search-result-icon">
                  <Archive size={24} />
                </div>
                <div className="search-result-info">
                  <div className="search-result-name">{grave.deceasedName}</div>
                  <div className="search-result-meta">
                    {grave.plot?.locationDetail?.location?.name || "Unknown"} ·{" "}
                    Plot {grave.plot?.plotNumber || "—"}
                    {grave.burialDate &&
                      ` · ${new Date(grave.burialDate).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-sm">
                  <span
                    className={`badge ${
                      grave.status === "active" ? "badge-success" : "badge-muted"
                    }`}
                  >
                    {grave.status}
                  </span>
                  {grave.score && (
                    <span className="badge badge-info">
                      {Math.round(grave.score * 100)}% match
                    </span>
                  )}
                  {grave.plot?.id && (
                    <Link
                      href={`/dashboard/map?plot=${encodeURIComponent(grave.plot.id)}`}
                      className="btn btn-primary btn-sm flex items-center gap-xs"
                      aria-label={`Open map directions to ${grave.deceasedName}`}
                    >
                      <MapPin size={15} aria-hidden="true" /> Map route
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : results ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={48} />
          </div>
          <h3 className="empty-state-title">No Results Found</h3>
          <p className="empty-state-text">
            Try different keywords or check the spelling.
          </p>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={48} />
          </div>
          <h3 className="empty-state-title">Search Grave Records</h3>
          <p className="empty-state-text">
            Enter a name to find burial records. The smart search engine will
            suggest closest matches even with misspellings.
          </p>
        </div>
      )}
    </div>
  );
}
