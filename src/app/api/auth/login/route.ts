import { NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { verifyPassword, createAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const adminResult = await dbExecute('SELECT * FROM admin WHERE email = ?', [email]);
    const admin = rowToObject(adminResult);
    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password_hash as string);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await createAdminSession(email);
    return NextResponse.json({ message: 'Login successful' });
  } catch (err: any) {
    console.error('[API /auth/login] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
