import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // ── Investor portal ────────────────────────────────────────────────────
    if (path.startsWith("/investor")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url))
      }
      // Sourcers / admins who hit /investor get redirected to their dashboard
      if (token.role === "admin" || token.role === "sourcer") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      // Investors are allowed through
      return NextResponse.next()
    }

    // ── Sourcer / Admin dashboard ──────────────────────────────────────────
    if (path.startsWith("/dashboard")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url))
      }

      // Investors cannot access the sourcer dashboard
      if (token.role === "investor") {
        return NextResponse.redirect(new URL("/investor/marketplace", req.url))
      }

      const isAdmin = token.role === "admin"
      const permissions: string[] = (token.permissions as string[]) ?? []

      if (
        path.startsWith("/dashboard/admin") ||
        path.startsWith("/dashboard/settings")
      ) {
        if (!isAdmin && !permissions.includes("admin")) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }

      if (path.startsWith("/dashboard/analytics")) {
        if (!isAdmin && !permissions.includes("finance")) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        if (path.startsWith("/investor")) {
          return !!token && token.role === "investor"
        }
        if (path.startsWith("/dashboard")) {
          return !!token && (token.role === "admin" || token.role === "sourcer")
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/investor/:path*"],
}
