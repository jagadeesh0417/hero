'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface DateFile {
  date: string;
  booking_count: number;
}

export default function AdminDocuments() {
  const [files, setFiles] = useState<DateFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadFiles = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/documents?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('[Documents] loadFiles error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    // Aggressive polling every 5 seconds
    intervalRef.current = setInterval(() => loadFiles(true), 5000);
    // Refresh when tab becomes visible again
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadFiles(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadFiles]);

  const handleDownload = async (date: string) => {
    try {
      const res = await fetch(`/api/documents?download=${date}&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Document not found');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dateObj = new Date(date);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dd}-${mm}-${yyyy}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Documents] handleDownload error:', err);
      alert('Failed to download. No confirmed bookings for this date.');
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Date-wise Reports</h1>
          {refreshing && (
            <div className="w-4 h-4 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          onClick={() => loadFiles()}
          className="px-4 py-2 text-sm font-medium text-[#1e3a5f] bg-[#1e3a5f]/5 rounded-lg hover:bg-[#1e3a5f]/10 transition-colors flex items-center gap-2 self-start"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <p className="text-gray-500 mb-6">
        One Excel file per travel date, grouped by Exam Center and Slot. Auto-refreshes every 5 seconds.
      </p>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 font-medium">No confirmed bookings yet</p>
            <p className="text-gray-400 text-sm mt-1">Reports appear after successful payments.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {files.map((f) => {
              const dateObj = new Date(f.date);
              const dd = String(dateObj.getDate()).padStart(2, '0');
              const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
              const yyyy = dateObj.getFullYear();
              const label = dateObj.toLocaleDateString('en-IN', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={f.date}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {dd}-{mm}-{yyyy}.xlsx
                      </p>
                      <p className="text-sm text-gray-500">
                        {label} &middot; {f.booking_count} booking{f.booking_count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(f.date)}
                    className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold hover:bg-[#2a4f7f] transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}