"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "../ui/Button";

/**
 * "Locate a Grave or Plot" quick search, shared by every role's dashboard.
 * Submitting opens Search Graves with the term already searched, where each
 * result shows its row, column and tier and links to the map route.
 */
export function LocateGraveCard() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = searchQuery.trim();
    router.push(term ? `/dashboard/search?q=${encodeURIComponent(term)}` : "/dashboard/search");
  };

  return (
    <div
      className="staff-card mb-lg"
      style={{ background: "var(--theme-card-bg)", border: "1px solid var(--border-default)" }}
      id="locate-grave-card"
    >
      <div className="staff-card-body" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div className="staff-card-icon-badge primary">
            <Search size={28} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
              Locate a Grave or Plot
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
              Quickly search by deceased name, grave reference ID, or section number
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              className="form-input"
              placeholder="Enter deceased name (e.g. Maria Santos)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "2.5rem", height: "42px" }}
              aria-label="Locate a grave or plot"
              id="locate-grave-input"
            />
            <Search
              size={16}
              style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
          </div>
          <Button type="submit" variant="primary" style={{ height: "42px", padding: "0 1.25rem", gap: "0.5rem" }}>
            <span>Search Directory</span>
            <ArrowRight size={15} />
          </Button>
        </form>
      </div>
    </div>
  );
}
