import { Suspense } from 'react';
import BookPageClient from './client';
import { dbExecute, rowsToObjects } from '@/lib/db';

// Always render per-request so the price from the settings table is current.
export const dynamic = 'force-dynamic';

async function getPricePerTicket(): Promise<number> {
  try {
    const result = await dbExecute('SELECT value FROM settings WHERE key = ?', ['price_per_ticket']);
    const row = rowsToObjects(result)[0] as { value?: string } | undefined;
    return Number(row?.value) || 500;
  } catch (err: any) {
    console.error('[book/page] Failed to load settings:', err?.message || err);
    return 500;
  }
}

export default async function BookPage() {
  const initialPrice = await getPricePerTicket();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    }>
      <BookPageClient initialPrice={initialPrice} />
    </Suspense>
  );
}