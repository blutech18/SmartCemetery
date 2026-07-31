"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Landmark, Search, Map, BarChart3, ChevronRight, Fingerprint, User } from "lucide-react";
import { PublicThemeToggle } from "@/components/ui/PublicThemeToggle";

export default function LandingPage() {
  const [query, setQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="public-page-wrapper">
      {/* Background Mesh */}
      <div className="premium-bg-mesh"></div>

      {/* Navigation */}
      <nav className={`premium-nav ${isScrolled ? "scrolled" : ""}`}>
        <Link href="/" className="premium-brand fade-in-up">
          <span>Bolonsori Public Cemetery</span>
        </Link>
        <div className="premium-nav-links fade-in-up delay-100">
          <Link href="/search" className="btn btn-ghost">
            Search Directory
          </Link>
          <PublicThemeToggle />
          <Link href="/login" className="btn btn-ghost" style={{ width: '44px', padding: 0 }} aria-label="Admin Login" title="Admin Login">
            <User size={20} />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="premium-hero-content fade-in-up delay-200">
        <h1 className="premium-title">
          <span className="premium-title-highlight">Discover & Navigate</span>
        </h1>

        <p className="premium-subtitle">
          Experience the future of cemetery management. Digitalized burial records, interactive map navigation, smart search, and real-time monitoring tailored for seamless navigation.
        </p>

        <div className="premium-search-container">
          <form className="premium-search-form" onSubmit={handleSearch}>
            <Search className="premium-search-icon" size={20} />
            <input
              type="text"
              className="premium-search-input"
              placeholder="Search by deceased name, grave ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Locate <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="premium-features-grid fade-in-up delay-300">
        <div className="premium-feature-card">
          <div className="premium-feature-header">
            <div className="premium-feature-icon">
              <Map />
            </div>
            <h3 className="premium-feature-title">Interactive Map</h3>
          </div>
          <p className="premium-feature-desc">
            Navigate the cemetery with a fully interactive map, featuring highlighted plot markers, precise coordinates, and visual directions to your destination.
          </p>
        </div>

        <div className="premium-feature-card">
          <div className="premium-feature-header">
            <div className="premium-feature-icon">
              <Fingerprint />
            </div>
            <h3 className="premium-feature-title">Smart Directory</h3>
          </div>
          <p className="premium-feature-desc">
            Find loved ones instantly using our intelligent phonetic matching engine. Search by exact name, fuzzy matches, or unique grave identifiers effortlessly.
          </p>
        </div>

        <div className="premium-feature-card">
          <div className="premium-feature-header">
            <div className="premium-feature-icon">
              <BarChart3 />
            </div>
            <h3 className="premium-feature-title">Data Insights</h3>
          </div>
          <p className="premium-feature-desc">
            Gain complete visibility with real-time analytics. Monitor plot availability, analyze burial statistics, and oversee system operations in a unified view.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="premium-footer fade-in-up delay-300">
        <p>© {new Date().getFullYear()} Bolonsori Public Cemetery Platform. A premium digital heritage project.</p>
      </footer>
    </div>
  );
}
