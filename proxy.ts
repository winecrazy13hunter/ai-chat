import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 全リクエストで userId cookie を確認し、未設定なら発行する
// この cookie が MongoDB でのユーザー識別子として機能する
export default function proxy(request: NextRequest) {
  if (request.cookies.get('userId')) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set('userId', crypto.randomUUID(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
