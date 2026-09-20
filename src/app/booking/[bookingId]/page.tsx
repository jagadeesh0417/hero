'use client';

import { useEffect, useState, use, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingButton from '@/components/ui/LoadingButton';
import { getISTComponents } from '@/lib/dates';

interface BookingStatus {
  status: string;
  booking_id: string;
  serial_number?: number;
  message?: string;
}

async function fireEvent(bookingId: string, event: string, detail?: string) {
  try {
    await fetch('/api/debug/checkout-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, event, detail }),
    });
  } catch {}
}

export default function BookingStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ t: string }>;
}) {
  const { bookingId } = use(params);
  const { t: token } = use(searchParams);
  const router = useRouter();
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [polling, setPolling] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status?t=${token}`, { cache: 'no-store' });

      if (res.status === 404) {
        console.log(`[StatusPage] Booking ${bookingId} not found (404)`);
        stopPolling();
        setError('Booking not found. It may have been removed or the link is invalid.');
        return;
      }

      if (!res.ok) {
        console.log(`[StatusPage] Status check returned ${res.status} for ${bookingId}`);
        return;
      }

      const data: BookingStatus = await res.json();
      setStatus(data);

      switch (data.status) {
        case 'confirmed':
          console.log(`[StatusPage] Booking ${bookingId} confirmed, serial=${data.serial_number}`);
          stopPolling();
          fireEvent(bookingId, 'status_confirmed', `serial=${data.serial_number}`);
          break;
        case 'failed':
          console.log(`[StatusPage] Booking ${bookingId} payment failed`);
          stopPolling();
          fireEvent(bookingId, 'status_failed', '');
          break;
        case 'cancelled':
          console.log(`[StatusPage] Booking ${bookingId} payment cancelled`);
          stopPolling();
          fireEvent(bookingId, 'status_cancelled', '');
          break;
        case 'expired':
          console.log(`[StatusPage] Booking ${bookingId} payment expired`);
          stopPolling();
          fireEvent(bookingId, 'status_expired', '');
          break;
        case 'paid_detected':
          // Payment detected but not yet confirmed by webhook — keep polling
          fireEvent(bookingId, 'paid_detected', '');
          break;
        default:
          // pending, created, etc — keep polling
          break;
      }
    } catch (err: any) {
      console.error(`[StatusPage] checkStatus error for ${bookingId}:`, err?.message || err);
    }
  }, [bookingId, token, stopPolling]);

  useEffect(() => {
    fireEvent(bookingId, 'status_page_loaded', `token_present=${!!token}`);

    if (!token) {
      router.replace('/');
      return;
    }

    checkStatus();

    // Poll every 3s for up to 2 minutes
    pollingRef.current = setInterval(checkStatus, 3000);
    timeoutRef.current = setTimeout(() => {
      console.log(`[StatusPage] Polling timed out for ${bookingId}`);
      stopPolling();
      setError('Payment verification timed out. Please contact support if your payment was deducted.');
    }, 120000);

    return () => {
      stopPolling();
    };
  }, [bookingId, token, checkStatus, router, stopPolling]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/receipt?t=${token}`, { cache: 'no-store' });
      if (res.status === 409) {
        fireEvent(bookingId, 'download_attempt_pending', '');
        setDownloading(false);
        return;
      }
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${bookingId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      fireEvent(bookingId, 'receipt_downloaded', '');
    } catch {
      fireEvent(bookingId, 'download_error', '');
    } finally {
      setDownloading(false);
    }
  };

  const isConfirmed = status?.status === 'confirmed';
  const isFailed = status?.status === 'failed';
  const isCancelled = status?.status === 'cancelled';
  const isExpired = status?.status === 'expired';

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Booking Status</h1>
          <p className="text-gray-500 mt-2">Booking ID: <span className="font-mono font-medium">{bookingId}</span></p>
        </div>

        <div className="glass-card p-8 text-center">
          {isConfirmed ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Booking Confirmed!</h2>
              {status?.serial_number && (
                <p className="text-sm text-gray-500 mb-4">Serial No: <span className="font-bold text-[#1e3a5f]">{status.serial_number}</span></p>
              )}
              <p className="text-gray-500 mb-6">Your booking has been confirmed. You can now download your receipt.</p>

              <LoadingButton onClick={handleDownload} loading={downloading} loadingText="Downloading..." variant="primary" className="w-full justify-center mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Receipt (Word)
              </LoadingButton>

              <Link href="/" className="btn-outline w-full justify-center">
                Return Home
              </Link>
            </>
          ) : isFailed ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h2>
              <p className="text-gray-500 mb-2">{status?.message || 'Your payment was not successful.'}</p>
              <p className="text-sm text-gray-400 mb-6">Please try booking again. If money was deducted, contact support.</p>
              <Link href="/book" className="btn-primary w-full justify-center mb-3">
                Try Again
              </Link>
              <Link href="/" className="btn-outline w-full justify-center">
                Return Home
              </Link>
            </>
          ) : isCancelled ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-600 mb-2">Payment Cancelled</h2>
              <p className="text-gray-500 mb-6">You cancelled the payment. No charges were made.</p>
              <Link href="/book" className="btn-primary w-full justify-center mb-3">
                Book Again
              </Link>
              <Link href="/" className="btn-outline w-full justify-center">
                Return Home
              </Link>
            </>
          ) : isExpired ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-yellow-600 mb-2">Payment Session Expired</h2>
              <p className="text-gray-500 mb-6">Your payment session expired. Please try booking again.</p>
              <Link href="/book" className="btn-primary w-full justify-center mb-3">
                Book Again
              </Link>
              <Link href="/" className="btn-outline w-full justify-center">
                Return Home
              </Link>
            </>
          ) : error ? (
            <>
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
              <p className="text-gray-500 mb-4">{error}</p>
              <p className="text-sm text-gray-400 mb-6">
                Call <a href="tel:+919010532226" className="text-[#1e3a5f] font-medium">+91 9010532226</a> for assistance.
              </p>
              <Link href="/book" className="btn-primary w-full justify-center mb-3">
                Book Again
              </Link>
              <Link href="/" className="btn-outline w-full justify-center">
                Return Home
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4">
                <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
              <h2 className="text-xl font-bold text-[#1e3a5f] mb-2">
                {status?.status === 'paid_detected' ? 'Payment Confirmed, Finalizing...' : 'Confirming your booking\u2026'}
              </h2>
              <p className="text-xs text-gray-400">{bookingId}</p>
              {status?.status === 'paid_detected' && (
                <p className="text-sm text-green-600 mt-2">Payment received! Finalizing your booking...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}