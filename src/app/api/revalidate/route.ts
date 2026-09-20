import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json().catch(() => ({}));

    // Optional: protect this endpoint with a shared secret
    const expectedSecret = process.env.REVALIDATION_SECRET || 'suman-travels-revalidate';
    if (secret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    // Purge Next.js cache for documents-related routes
    revalidatePath('/admin/documents');
    revalidatePath('/api/documents');

    console.log('[Revalidate] Cache purged. Paths: /admin/documents, /api/documents');

    return NextResponse.json({ revalidated: true });
  } catch (err: any) {
    console.error('[Revalidate] Error:', err?.message || err);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}