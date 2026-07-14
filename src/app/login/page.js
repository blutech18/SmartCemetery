"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Landmark, AlertTriangle, ArrowRight, Lock, Mail, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { resolveCallback } from "@/lib/route-access";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        // Honor only safe internal /dashboard callbacks; otherwise fall back
        // to the default /dashboard (Req 1.5).
        const target = resolveCallback(searchParams.get("callbackUrl"));
        router.push(target);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* Sidebar Area (Hidden on mobile) */}
      <div className="auth-sidebar-premium">
        <div className="auth-sidebar-mesh"></div>
        <div className="auth-sidebar-content-premium">
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#fff', textDecoration: 'none', marginBottom: '3rem', opacity: 0.8, transition: 'opacity 0.2s ease' }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.8}>
            <ChevronLeft size={20} /> Return to Public Portal
          </Link>

          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '1.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Bolonsori<br/>Digital Management
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '400px' }}>
            Experience a new era of cemetery administration. Streamline records, navigate intuitively, and manage operations with our state-of-the-art platform.
          </p>
        </div>
      </div>

      {/* Form Area */}
      <div className="auth-form-container">
        <div className="auth-card-premium">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-light)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <Landmark size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.01em", color: '#fff' }}>Smart Cemetery</div>
              <div style={{ fontSize: "0.65rem", color: "var(--primary-light)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                Admin Portal
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>Sign in to access your secure dashboard</p>

          {error && (
            <div className="alert alert-error flex items-center gap-sm" style={{ marginBottom: "1.5rem", animation: "fadeInUp 0.3s ease-out", background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger-light)', borderRadius: '12px', padding: '1rem' }}>
              <AlertTriangle size={18} /> <span style={{ fontSize: '0.9rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  id="login-email"
                  className="form-input"
                  placeholder="admin@cemetery.gov.ph"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="login-password">Password</label>
              <div className="input-with-icon" style={{ position: 'relative' }}>
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="login-submit"
              style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Mobile Back Link */}
          <div style={{ marginTop: '2.5rem', textAlign: 'center', display: 'block' }} className="mobile-only-link">
            <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textDecoration: 'none', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = '#fff'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              ← Return to public portal
            </Link>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @media (min-width: 992px) {
              .mobile-only-link { display: none !important; }
            }
          `}} />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
