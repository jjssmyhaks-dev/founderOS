"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from './Toast';
import { Building2, Globe, Mail, Lock, User, Loader2, Eye, EyeOff, Zap } from 'lucide-react';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney',
];

export default function Login() {
  const router = useRouter();
  const { login, signup, isLoading } = useAuthStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [timezone, setTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        if (!name.trim()) { toast('error', 'Name is required'); return; }
        if (password.length < 6) { toast('error', 'Password must be at least 6 characters'); return; }
        await signup(name, email, password, businessName || undefined, timezone);
        toast('success', 'Account created! Welcome to Helm.');
      } else {
        await login(email, password);
        toast('success', 'Welcome back!');
      }
      router.push('/');
    } catch (err: any) {
      toast('error', err.message || (isSignUp ? 'Signup failed' : 'Login failed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_60%)] opacity-[0.03]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--accent)]/5 blur-[100px] rounded-full" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Helm</span>
          </Link>
          <p className="text-[var(--text-muted)] text-sm">AI Operating System for Solo Founders</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 space-y-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" required />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" required />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Business Name <span className="text-gray-600">(optional)</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your company"
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Timezone</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-white focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none">
                      {TIMEZONES.map((tz) => (<option key={tz} value={tz}>{tz}</option>))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white rounded-lg font-medium transition-opacity flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--text-muted)]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            {' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-[var(--accent)] hover:underline">
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
