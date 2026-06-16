import { NextResponse } from 'next/server';
import { dbExecute } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sumantravels.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await dbExecute('SELECT id FROM admin WHERE email = ?', [adminEmail]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ message: 'Admin already exists' });
    }

    const passwordHash = await hashPassword(adminPassword);
    await dbExecute('INSERT INTO admin (email, password_hash) VALUES (?, ?)', [adminEmail, passwordHash]);

    return NextResponse.json({ message: 'Admin created successfully' });
  } catch (err: any) {
    console.error('[API /seed] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
