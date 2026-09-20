'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LoadingButton from '@/components/ui/LoadingButton';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    setError('');
    setLoading(true);
    busyRef.current = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ? `${data.error}: ${data.detail}` : (data.error || 'Login failed'));
        setLoading(false);
        busyRef.current = false;
        return;
      }

      router.push('/admin/dashboard');
    } catch {
      setError('Connection error');
      setLoading(false);
      busyRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#1e3a5f] rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" viewBox="0 0 32 32" fill="none">
              <path d="M16 6L6 12v4l10-6 10 6v-4L16 6z" fill="currentColor" />
              <path d="M6 16v4l10 6 10-6v-4L16 22 6 16z" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Admin Login</h1>
          <p className="text-gray-500 mt-1">Suman Travels Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Signing in..."
            variant="primary"
            className="w-full justify-center"
          >
            Sign In
          </LoadingButton>
        </form>
      </div>
    </div>
  );
}
