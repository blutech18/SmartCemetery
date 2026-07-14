"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, Star } from "lucide-react";

function getErrorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function FeedbackPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchFeedback = useCallback(async () => {
    if (sessionStatus !== "authenticated" || !isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/feedback");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to load feedback."));
      setFeedbacks(Array.isArray(body) ? body : []);
    } catch (feedbackError) {
      setFeedbacks([]);
      setError(feedbackError.message || "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAdmin) {
      void Promise.resolve().then(fetchFeedback);
    }
  }, [fetchFeedback, isAdmin, sessionStatus]);


  async function handleSubmit(event) {
    event.preventDefault();
    const numericRating = Number(rating);
    const trimmedComment = comment.trim();
    setError("");
    setSuccess("");

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      setError("Select a rating from 1 to 5.");
      return;
    }
    if (trimmedComment.length > 1000) {
      setError("Comment must be 1000 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: numericRating, ...(trimmedComment && { comment: trimmedComment }) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getErrorMessage(body, "Failed to submit feedback."));
      setRating("");
      setComment("");
      setSuccess(`Thank you for your feedback. Submission ID: ${body.id}`);
    } catch (feedbackError) {
      setError(feedbackError.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  const averageRating = feedbacks.length
    ? (feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0) / feedbacks.length).toFixed(1)
    : "—";
  const ratingDistribution = [5, 4, 3, 2, 1].map((value) => {
    const count = feedbacks.filter((feedback) => feedback.rating === value).length;
    return {
      rating: value,
      count,
      percentage: feedbacks.length ? Math.round((count / feedbacks.length) * 100) : 0,
    };
  });

  if (!isAdmin && sessionStatus !== "loading") {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Feedback</h1>
            <p className="page-subtitle">Share your experience with the Smart Cemetery platform</p>
          </div>
        </div>

        {success && <div className="card" role="status" aria-live="polite" style={{ marginBottom: "var(--space-lg)", color: "var(--accent)" }}>{success}</div>}
        {error && <div className="card" role="alert" style={{ marginBottom: "var(--space-lg)", color: "var(--danger)" }}>{error}</div>}
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "var(--space-md)" }}>
            <label className="form-label" htmlFor="feedback-rating">Rating</label>
            <select id="feedback-rating" className="form-select" required value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">Select a rating</option>
              <option value="5">5 — Excellent</option>
              <option value="4">4 — Good</option>
              <option value="3">3 — Average</option>
              <option value="2">2 — Poor</option>
              <option value="1">1 — Very poor</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: "var(--space-md)" }}>
            <label className="form-label" htmlFor="feedback-comment">Comment (optional)</label>
            <textarea
              id="feedback-comment"
              className="form-input"
              rows={6}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell us what worked well or what we can improve..."
            />
            <div className="text-xs text-muted" style={{ textAlign: "right" }}>{comment.length}/1000</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feedback</h1>
          <p className="page-subtitle">User satisfaction and system feedback</p>
        </div>
      </div>

      {error && <div className="card" role="alert" style={{ marginBottom: "var(--space-lg)", color: "var(--danger)" }}>{error}</div>}

      <div className="grid grid-2" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card">
          <div className="text-center">
            <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1 }}>{averageRating}</div>
            <div aria-label={`${averageRating} out of 5 stars`} style={{ fontSize: "1.5rem", margin: "4px 0", display: "flex", justifyContent: "center", gap: 2, color: "var(--warning)" }}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} size={24} aria-hidden="true" fill={index < Math.round(Number(averageRating) || 0) ? "currentColor" : "transparent"} />
              ))}
            </div>
            <div className="text-sm text-muted">{feedbacks.length} total responses</div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Rating Distribution</h2>
          {ratingDistribution.map((item) => (
            <div key={item.rating} className="flex items-center gap-sm" style={{ marginBottom: 6 }}>
              <span className="text-sm flex items-center gap-xs" style={{ width: 30 }}>{item.rating} <Star size={12} aria-hidden="true" fill="currentColor" color="var(--warning)" /></span>
              <div className="progress-bar" style={{ flex: 1 }} role="progressbar" aria-label={`${item.rating} star ratings`} aria-valuenow={item.percentage} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
              </div>
              <span className="text-xs text-muted" style={{ width: 40, textAlign: "right" }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {loading || sessionStatus === "loading" ? (
        <div className="flex justify-center" style={{ padding: "var(--space-3xl)" }} role="status" aria-label="Loading feedback">
          <div className="spinner spinner-lg" />
        </div>
      ) : feedbacks.length ? (
        <div className="flex flex-col gap-md">
          {feedbacks.map((feedback) => (
            <div key={feedback.id} className="card">
              <div className="flex justify-between items-center" style={{ marginBottom: 8, flexWrap: "wrap", gap: "var(--space-sm)" }}>
                <div className="flex items-center gap-md">
                  <div className="avatar" aria-hidden="true" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>
                    {feedback.user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{feedback.user?.name || "Anonymous"}</div>
                    <div className="text-xs text-muted">{new Date(feedback.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div aria-label={`${feedback.rating} out of 5 stars`} style={{ color: "var(--warning)", display: "flex", gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={16} aria-hidden="true" fill={index < feedback.rating ? "currentColor" : "transparent"} />)}
                </div>
              </div>
              {feedback.comment && <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>{feedback.comment}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><MessageSquare size={48} aria-hidden="true" /></div>
          <h3 className="empty-state-title">No Feedback Yet</h3>
          <p className="empty-state-text">Feedback from users will appear here.</p>
        </div>
      )}
    </div>
  );
}
