'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold text-[#1e3a5f]"
          >
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" className="fill-[#1e3a5f]" />
              <path
                d="M16 6L6 12v4l10-6 10 6v-4L16 6z"
                className="fill-white"
              />
              <path
                d="M6 16v4l10 6 10-6v-4L16 22 6 16z"
                className="fill-white"
              />
            </svg>
            SUMAN TRAVELS
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className="text-gray-600 hover:text-[#1e3a5f] font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              href="/book"
              className="bg-[#1e3a5f] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#152d4a] transition-all hover:shadow-lg"
            >
              Book Now
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-fade-in">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-gray-600 hover:text-[#1e3a5f] font-medium"
            >
              Home
            </Link>
            <Link
              href="/book"
              onClick={() => setMenuOpen(false)}
              className="block py-2 mt-2 bg-[#1e3a5f] text-white px-4 rounded-lg font-semibold text-center"
            >
              Book Now
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
