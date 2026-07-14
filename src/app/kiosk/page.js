"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, Search, Archive, Pointer } from "lucide-react";

function KioskContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedGrave, setSelectedGrave] = useState(null);
  const router = useRouter();

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSelectedGrave(null);
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
    ? [...(results.exact || []), ...(results.suggestions || [])]
    : [];

  return (
    <div className="kiosk-mode" style={{ minHeight: "100vh", padding: "var(--space-2xl)", position: "relative", overflow: "hidden", background: "var(--bg-base)" }}>
      <div className="landing-bg-pattern"></div>
      <div className="landing-bg-glow" style={{ top: "-10%", opacity: 0.6 }}></div>
      {/* Kiosk Header */}
      <div className="text-center" style={{ marginBottom: "var(--space-2xl)", position: "relative", zIndex: 10 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "var(--radius-lg)",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
            margin: "0 auto var(--space-md)",
            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.5)",
            color: "white"
          }}
        >
          <Landmark size={40} />
        </div>
        <h1 style={{ fontSize: "3rem", fontWeight: 900, letterSpacing: "-0.03em" }}>
          <span className="text-gradient">Smart Cemetery</span>
        </h1>
        <p className="text-lg text-secondary" style={{ marginTop: 4, fontWeight: 500 }}>
          Bolonsori Public Cemetery — Navigation Kiosk
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth: 700, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <form onSubmit={handleSearch} className="landing-search-input-wrapper">
          <Search className="landing-search-icon-left" size={24} />
          <input
            type="text"
            className="form-input landing-search-input"
            placeholder="Search by name, grave ID, or year..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{ fontSize: "1.2rem", padding: "1.2rem 1.5rem 1.2rem 4rem" }}
            id="kiosk-search-input"
          />
          <button type="submit" className="btn btn-primary flex items-center justify-center gap-xs" id="kiosk-search-btn">
             Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div style={{ maxWidth: 900, margin: "var(--space-2xl) auto 0" }}>
        {loading ? (
          <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : allResults.length > 0 ? (
          <div className="grid grid-2">
            {/* Result List */}
            <div className="flex flex-col gap-md">
              {results?.suggestions?.length > 0 && results?.exact?.length === 0 && (
                <div className="alert alert-info flex items-center gap-sm">
                  <Search size={16} /> Showing closest matches:
                </div>
              )}
              {allResults.map((grave) => (
                  <button
                  key={grave.id}
                  className="search-result"
                  onClick={() => setSelectedGrave(grave)}
                  style={{
                    background: "rgba(30, 41, 59, 0.4)",
                    backdropFilter: "blur(10px)",
                    border: selectedGrave?.id === grave.id
                      ? "2px solid var(--primary)"
                      : "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="search-result-icon" style={{ background: "var(--primary-glow)", color: "var(--primary-light)" }}>
                    <Archive size={24} />
                  </div>
                  <div className="search-result-info">
                    <div className="search-result-name" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {grave.deceasedName}
                    </div>
                    <div className="search-result-meta">
                      Plot {grave.plot?.plotNumber || "—"} ·{" "}
                      {grave.plot?.locationDetail?.location?.name || "Unknown"}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail Panel */}
            {selectedGrave ? (
              <div className="card" style={{ background: "rgba(30, 41, 59, 0.4)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.05)" }}>
                <h3 style={{ marginBottom: "var(--space-md)", fontSize: "1.5rem", fontWeight: 800 }}>
                  {selectedGrave.deceasedName}
                </h3>
                <div className="flex flex-col gap-md">
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                    <div className="form-label" style={{ marginBottom: "0.2rem" }}>Plot</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {selectedGrave.plot?.plotNumber || "—"}
                    </div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                    <div className="form-label" style={{ marginBottom: "0.2rem" }}>Location</div>
                    <div style={{ fontSize: "1.1rem" }}>
                      {selectedGrave.plot?.locationDetail?.location?.name || "—"}
                      {selectedGrave.plot?.locationDetail?.subsection &&
                        ` · Section ${selectedGrave.plot.locationDetail.subsection}`}
                    </div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                    <div className="form-label" style={{ marginBottom: "0.2rem" }}>Burial Date</div>
                    <div style={{ fontSize: "1.1rem" }}>
                      {selectedGrave.burialDate
                        ? new Date(selectedGrave.burialDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Not recorded"}
                    </div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                    <div className="form-label" style={{ marginBottom: "0.5rem" }}>Status</div>
                    <span
                      className={`badge ${
                        selectedGrave.status === "active" ? "badge-success" : "badge-muted"
                      }`}
                      style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                    >
                      {selectedGrave.status}
                    </span>
                  </div>
                  {selectedGrave.plot?.gpsLat && selectedGrave.plot?.gpsLng && (
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                      <div className="form-label" style={{ marginBottom: "0.2rem" }}>GPS Coordinates</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem" }}>
                        {Number(selectedGrave.plot.gpsLat).toFixed(6)},{" "}
                        {Number(selectedGrave.plot.gpsLng).toFixed(6)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card flex items-center justify-center" style={{ minHeight: 300, background: "rgba(30, 41, 59, 0.4)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="text-center text-muted">
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.5 }}>
                    <Pointer size={48} />
                  </div>
                  <p style={{ fontSize: "1.1rem" }}>Select a result to view details</p>
                </div>
              </div>
            )}
          </div>
        ) : results ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={48} />
            </div>
            <h3 className="empty-state-title">No Results Found</h3>
            <p className="empty-state-text">Try different keywords or check the spelling.</p>
          </div>
        ) : (
          <div className="text-center text-muted" style={{ padding: "var(--space-3xl)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-md)", opacity: 0.3 }}>
              <Search size={64} />
            </div>
            <p>Enter a name to search</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="text-center text-xs text-muted"
        style={{ marginTop: "var(--space-2xl)", padding: "var(--space-md)" }}
      >
        Smart Cemetery Navigation & Monitoring Platform — Bolonsori Public Cemetery
      </div>
    </div>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner spinner-lg" />
      </div>
    }>
      <KioskContent />
    </Suspense>
  );
}
