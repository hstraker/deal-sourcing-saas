import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith("/dashboard")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url))
      }

      if (token.role === "investor") {
        return NextResponse.redirect(new URL("/", req.url))
      }

      const isAdmin = token.role === "admin"
      const permissions: string[] = (token.permissions as string[]) ?? []

      // Admin and settings routes require "admin" permission
      if (
        path.startsWith("/dashboard/admin") ||
        path.startsWith("/dashboard/settings")
      ) {
        if (!isAdmin && !permissions.includes("admin")) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }

      // Finance routes require "finance" permission
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
        if (req.nextUrl.pathname.startsWith("/dashboard")) {
          return !!token && (token.role === "admin" || token.role === "sourcer")
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*"],
}
