import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Protect dashboard routes - only admin and sourcer in Phase 1
    if (path.startsWith("/dashboard")) {
      if (!token) {
        return NextResponse.redirect(new URL("/login", req.url))
      }
      
      if (token.role === "investor") {
        // Investors don't have access to dashboard in Phase 1
        return NextResponse.redirect(new URL("/", req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to dashboard only for admin and sourcer
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

