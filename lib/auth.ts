import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            investor: true,
          },
          // permissions is a scalar array, included automatically
        })

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password")
        }

        if (!user.isActive) {
          throw new Error("Account is inactive")
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValidPassword) {
          throw new Error("Invalid email or password")
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
          permissions: (user as any).permissions ?? [],
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.permissions = (user as any).permissions ?? []
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.permissions = (token.permissions as string[]) ?? []
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

