import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sumantravels.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await db.execute({
      sql: 'SELECT id FROM admin WHERE email = ?',
      args: [adminEmail],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ message: 'Admin already exists' });
    }

    const passwordHash = await hashPassword(adminPassword);
    await db.execute({
      sql: 'INSERT INTO admin (email, password_hash) VALUES (?, ?)',
      args: [adminEmail, passwordHash],
    });

    return NextResponse.json({ message: 'Admin created successfully' });
  } catch {
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 });
  }
}
