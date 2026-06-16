import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, createAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const adminResult = await db.execute({
      sql: 'SELECT * FROM admin WHERE email = ?',
      args: [email],
    });
    if (adminResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const admin = adminResult.rows[0];
    const valid = await verifyPassword(password, admin.password_hash as string);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await createAdminSession(email);
    return NextResponse.json({ message: 'Login successful' });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
