"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Landmark, Search, Archive, MapPin, ChevronRight, User } from "lucide-react";
import { PublicThemeToggle } from "@/components/ui/PublicThemeToggle";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const runSearch = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/graves?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      void Promise.resolve().then(() => runSearch(initialQuery));
    }
  }, [initialQuery, runSearch]);

  function handleSearch() {
    const searchTerm = query.trim();
    if (!searchTerm) return;
    router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
  }

  return (
    <div className="public-page-wrapper">
      <div className="premium-bg-mesh"></div>

      {/* Navigation */}
      <nav className={`premium-nav ${isScrolled ? "scrolled" : ""}`}>
        <Link href="/" className="premium-brand">
          <span>Bolonsori Public Cemetery</span>
        </Link>
        <div className="premium-nav-links">
          <PublicThemeToggle />
          <Link href="/login" className="btn btn-ghost" style={{ width: '44px', padding: 0 }} aria-label="Admin Login" title="Admin Login">
            <User size={20} />
          </Link>
        </div>
      </nav>

      {/* Header Area */}
      <div className="search-header-area fade-in-up" style={{ position: 'relative', zIndex: 10, marginTop: '80px' }}>
        <h1 className="premium-title" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          <span className="premium-title-highlight">Search Records</span>
        </h1>
        <p className="premium-subtitle" style={{ margin: '0 auto 2rem' }}>
          Find deceased name, grave ID, or year of burial in our comprehensive database
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="search-input-wrapper fade-in-up delay-100"
        >
          <Search className="search-icon" size={24} />
          <input
            type="text"
            className="form-input"
            placeholder="Enter name, ID, or year..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Results Area */}
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '0 5% 4rem', position: 'relative', zIndex: 10, minHeight: '50vh' }}>
        {loading ? (
          <div className="flex justify-center" style={{ padding: "3rem" }}>
            <div className="spinner spinner-lg" />
          </div>
        ) : results ? (
          <div className="fade-in-up delay-200">
            {/* Phonetic notice */}
            {results.suggestions?.length > 0 && results.exact?.length === 0 && (
              <div className="alert alert-info flex items-center gap-sm" style={{ marginBottom: "2rem", background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: '16px' }}>
                <Search size={18} /> <span>No exact match found. Showing the closest suggestions:</span>
              </div>
            )}

            {/* Exact matches */}
            {results.exact?.length > 0 && (
              <div className="flex flex-col gap-md" style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Exact Matches</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.exact.map((grave) => (
                    <GraveCard key={grave.id} grave={grave} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {results.suggestions?.length > 0 && (
              <div className="flex flex-col gap-md">
                <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Suggested Matches</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.suggestions.map((grave) => (
                    <GraveCard key={grave.id} grave={grave} showScore />
                  ))}
                </div>
              </div>
            )}

            {/* Nearby sections */}
            {results.nearby?.length > 0 && (
              <div className="flex flex-col gap-md" style={{ marginTop: "2rem" }}>
                <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem', paddingLeft: '0.5rem' }}>Nearby Sections</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.nearby.map((grave) => (
                    <GraveCard key={grave.id} grave={grave} />
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {results.exact?.length === 0 && results.suggestions?.length === 0 && results.nearby?.length === 0 && (
              <div className="empty-state" style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(16px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', padding: '4rem 2rem' }}>
                <div className="empty-state-icon" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '4rem', marginBottom: '1.5rem' }}>
                  <Search size={56} />
                </div>
                <h3 className="empty-state-title" style={{ color: '#fff', fontSize: '1.5rem' }}>No Results Found</h3>
                <p className="empty-state-text" style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                  We could not find any records matching your search. Please try different keywords or adjust the spelling.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <footer className="premium-footer">
        <p>© {new Date().getFullYear()} Bolonsori Public Cemetery Platform.</p>
      </footer>
    </div>
  );
}

function GraveCard({ grave, showScore }) {
  return (
    <div className="search-result-premium">
      <div className="search-result-icon-premium">
        <Archive size={24} />
      </div>
      <div className="search-result-content">
        <div className="search-result-title">
          {grave.deceasedName}
        </div>
        <div className="search-result-details">
          <div className="search-result-detail-item">
            <MapPin size={14} />
            <span>{grave.plot?.locationDetail?.location?.name || "Unknown Location"}</span>
          </div>
          {grave.plot?.locationDetail?.subsection && (
            <div className="search-result-detail-item">
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span>{grave.plot.locationDetail.subsection}</span>
            </div>
          )}
          <div className="search-result-detail-item">
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>Plot {grave.plot?.plotNumber || "—"}</span>
          </div>
          {grave.burialDate && (
            <div className="search-result-detail-item">
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span>{new Date(grave.burialDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
      <div className="search-result-badge-area">
        <span className={`badge ${grave.status === "active" ? "badge-success" : "badge-muted"}`} style={{ letterSpacing: '0.05em', padding: '0.35rem 0.75rem' }}>
          {grave.status}
        </span>
        {showScore && grave.score && (
          <span className="badge badge-info" style={{ fontSize: '0.7rem', opacity: 0.8 }}>Match {Math.round(grave.score * 100)}%</span>
        )}
        {grave.plot?.id && (
          <Link
            href={`/kiosk?grave=${encodeURIComponent(grave.id)}`}
            className="btn btn-primary btn-sm flex items-center gap-xs"
            aria-label={`Open map directions to ${grave.deceasedName}`}
          >
            <MapPin size={15} aria-hidden="true" /> Map route
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="public-page-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="premium-bg-mesh"></div>
        <div className="spinner spinner-lg" style={{ position: 'relative', zIndex: 10 }} />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
