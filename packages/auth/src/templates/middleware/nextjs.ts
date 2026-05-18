// middleware.ts
// ── Next.js middleware ────────────────────────────────────────
// Runs on every request matching the config.matcher pattern.
// Redirects unauthenticated users away from protected routes.
//
// This file intentionally does NOT make DB calls — it only checks
// cookie presence for performance. This is the correct Next.js pattern:
// edge middleware cannot reach your database. Full session validation
// (including expiry and DB lookup) happens in Server Components and
// Route Handlers via getSession(authConfig).
//
// Edit PROTECTED_ROUTES and AUTH_ROUTES to match your app's route structure.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── Edit these to match your app ──────────────────────────────
// Routes that require the user to be logged in
const PROTECTED_ROUTES = ['/dashboard', '/settings', '/profile']
// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ['/login', '/signup']
// Where to redirect after login
const POST_LOGIN_REDIRECT = '/dashboard'
// ─────────────────────────────────────────────────────────────

const COOKIE_NAME = '{{COOKIE_NAME}}'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get(COOKIE_NAME)
  const isAuthenticated = !!sessionCookie?.value

  if (isAuthenticated && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL(POST_LOGIN_REDIRECT, request.url))
  }

  if (!isAuthenticated && PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
