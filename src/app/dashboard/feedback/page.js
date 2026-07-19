"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, Star, Send, Activity, User, Calendar, Quote, CheckCircle2 } from "lucide-react";
import { PageHeader } from "../../../components/dashboard/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Badge } from "../../../components/ui/Badge";

function getErrorMessage(body, fallback) {
  return body?.error?.message || body?.error || fallback;
}

export default function FeedbackPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
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
      setError("Please select a star rating.");
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
      setRating(0);
      setComment("");
      setSuccess(`Thank you for your feedback! Submission ID: ${body.id}`);
    } catch (feedbackError) {
      setError(feedbackError.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Calculations for Admin Dashboard ---
  const averageRating = feedbacks.length
    ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1)
    : "—";
  
  const ratingDistribution = [5, 4, 3, 2, 1].map((value) => {
    const count = feedbacks.filter((f) => f.rating === value).length;
    return {
      rating: value,
      count,
      percentage: feedbacks.length ? Math.round((count / feedbacks.length) * 100) : 0,
    };
  });

  // --- USER VIEW (Submit Feedback) ---
  if (!isAdmin && sessionStatus !== "loading") {
    return (
      <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", paddingBottom: "var(--space-2xl)", maxWidth: 800, margin: "0 auto" }}>
        <PageHeader 
          title="Provide Feedback"
          description="We're constantly working to improve Smart Cemetery. Share your experience with us!"
        />

        {success && (
          <Panel style={{ border: "1px solid var(--primary)", background: "rgba(46, 204, 113, 0.05)" }}>
            <div className="flex items-center gap-md">
              <CheckCircle2 size={24} style={{ color: "var(--primary)" }} />
              <div>
                <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Feedback Submitted</h3>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>{success}</p>
              </div>
            </div>
          </Panel>
        )}
        
        {error && (
          <Panel style={{ border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.05)" }}>
            <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
          </Panel>
        )}

        <form onSubmit={handleSubmit}>
          <Panel className="flex flex-col gap-xl">
            <div className="flex flex-col items-center justify-center text-center gap-sm" style={{ padding: "var(--space-md) 0" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600 }}>How would you rate your experience?</h3>
              <div className="flex gap-xs" style={{ marginTop: "var(--space-sm)" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    type="button" 
                    key={star} 
                    onClick={() => setRating(star)} 
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: "0 4px", outline: "none" }}
                  >
                    <Star 
                      size={42} 
                      fill={(hoverRating || rating) >= star ? "var(--warning)" : "transparent"} 
                      color={(hoverRating || rating) >= star ? "var(--warning)" : "var(--border-default)"} 
                      style={{ transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', transform: (hoverRating || rating) >= star ? "scale(1.1)" : "scale(1)" }}
                    />
                  </button>
                ))}
              </div>
              <p className="text-muted text-sm" style={{ marginTop: 8 }}>
                {rating === 1 && "Very Poor"}
                {rating === 2 && "Poor"}
                {rating === 3 && "Average"}
                {rating === 4 && "Good"}
                {rating === 5 && "Excellent"}
                {!rating && "Select a star rating"}
              </p>
            </div>

            <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="form-label font-medium" htmlFor="feedback-comment" style={{ fontSize: "1rem" }}>
                Additional Comments (Optional)
              </label>
              <textarea
                id="feedback-comment"
                className="form-input"
                rows={5}
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Tell us what worked well or what we could improve..."
                style={{ 
                  background: "var(--bg-panel)", 
                  border: "1px solid var(--border-default)", 
                  borderRadius: "var(--radius-md)", 
                  padding: "16px",
                  fontSize: "0.95rem",
                  resize: "vertical"
                }}
              />
              <div className="text-xs text-muted" style={{ textAlign: "right" }}>{comment.length} / 1000 characters</div>
            </div>

            <div className="flex justify-end pt-sm" style={{ borderTop: "1px solid var(--border-default)" }}>
              <button 
                className="btn btn-primary flex items-center gap-xs" 
                type="submit" 
                disabled={submitting || rating === 0}
                style={{ padding: "10px 24px", fontSize: "1rem" }}
              >
                {submitting ? (
                  <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Submitting...</>
                ) : (
                  <><Send size={18} /> Submit Feedback</>
                )}
              </button>
            </div>
          </Panel>
        </form>
      </div>
    );
  }

  // --- ADMIN VIEW (Review Feedback) ---
  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", paddingBottom: "var(--space-2xl)" }}>
      <PageHeader 
        title="Feedback Responses"
        description="Review user satisfaction ratings and system feedback."
      />

      {error && (
        <Panel style={{ border: "1px solid var(--danger)", background: "rgba(239, 68, 68, 0.05)" }}>
          <p style={{ margin: 0, color: "var(--danger)" }}>{error}</p>
        </Panel>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-2 gap-lg">
        <Panel className="flex flex-col items-center justify-center text-center gap-md" style={{ padding: "32px" }}>
          <h3 style={{ margin: 0, color: "var(--text-secondary)", fontSize: "1.1rem", fontWeight: 500 }}>Average Rating</h3>
          <div style={{ fontSize: "4.5rem", fontWeight: 800, lineHeight: 1, color: "var(--text-primary)" }}>{averageRating}</div>
          <div aria-label={`${averageRating} out of 5 stars`} className="flex gap-xs" style={{ color: "var(--warning)" }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} size={28} fill={index < Math.round(Number(averageRating) || 0) ? "currentColor" : "transparent"} strokeWidth={1.5} />
            ))}
          </div>
          <Badge variant="default" style={{ marginTop: 8 }}>{feedbacks.length} total responses</Badge>
        </Panel>

        <Panel className="flex flex-col justify-center" style={{ padding: "32px" }}>
          <h3 style={{ margin: "0 0 20px 0", color: "var(--text-secondary)", fontSize: "1.1rem", fontWeight: 500 }}>Rating Distribution</h3>
          <div className="flex flex-col gap-sm">
            {ratingDistribution.map((item) => (
              <div key={item.rating} className="flex items-center gap-md">
                <span className="flex items-center gap-xs text-sm font-medium" style={{ width: 32, color: "var(--text-primary)" }}>
                  {item.rating} <Star size={14} fill="var(--warning)" color="var(--warning)" />
                </span>
                <div 
                  className="progress-bar" 
                  style={{ flex: 1, height: 8, background: "var(--border-default)", borderRadius: 4, overflow: "hidden" }} 
                >
                  <div 
                    className="progress-fill" 
                    style={{ width: `${item.percentage}%`, height: "100%", background: "var(--primary)", borderRadius: 4, transition: "width 0.5s ease" }} 
                  />
                </div>
                <span className="text-sm font-medium" style={{ width: 40, textAlign: "right", color: "var(--text-secondary)" }}>
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Feedback List */}
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: 8 }}>
          <MessageSquare size={20} className="text-primary" /> Recent Responses
        </h2>
        
        {loading || sessionStatus === "loading" ? (
          <div className="flex flex-col gap-md">
            {[1, 2, 3].map(i => (
              <Panel key={i} className="flex flex-col gap-sm">
                <Skeleton style={{ width: "100%", height: 40 }} />
              </Panel>
            ))}
          </div>
        ) : feedbacks.length ? (
          <Panel style={{ padding: 0, overflow: "hidden" }}>
            <div className="table-container" style={{ margin: 0 }}>
              <table className="table" style={{ width: "100%", minWidth: "600px" }}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Date</th>
                    <th style={{ textAlign: "center" }}>Rating</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((feedback) => (
                    <tr key={feedback.id}>
                      <td style={{ verticalAlign: "top", paddingTop: "16px" }}>
                        <div className="flex items-center gap-sm">
                          <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{feedback.user?.name || "Anonymous"}</span>
                        </div>
                      </td>
                      <td style={{ verticalAlign: "top", paddingTop: "16px", color: "var(--text-muted)", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                        {new Date(feedback.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ verticalAlign: "top", paddingTop: "16px", textAlign: "center" }}>
                        <div className="flex gap-xs justify-center" style={{ color: "var(--warning)" }}>
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} size={14} fill={index < feedback.rating ? "currentColor" : "transparent"} strokeWidth={index < feedback.rating ? 0 : 1.5} />
                          ))}
                        </div>
                      </td>
                      <td style={{ verticalAlign: "top", paddingTop: "16px", paddingBottom: "16px" }}>
                        {feedback.comment ? (
                          <div style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                            {feedback.comment}
                          </div>
                        ) : (
                          <span className="text-muted italic text-sm">No comment provided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel className="flex flex-col items-center justify-center text-center" style={{ padding: "48px 24px", borderStyle: "dashed" }}>
            <div style={{ background: "rgba(255, 255, 255, 0.05)", padding: 20, borderRadius: "50%", marginBottom: 16 }}>
              <MessageSquare size={32} className="text-muted" />
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem" }}>No Feedback Yet</h3>
            <p className="text-muted" style={{ margin: 0, maxWidth: 400 }}>When users submit ratings and feedback, they will appear here for you to review.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
