"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    if (typeof window === "undefined") return
    const stored = (window.localStorage.getItem("dealstack-theme") as Theme) || "light"
    setThemeState(stored)
    document.documentElement.classList.toggle("dark", stored === "dark")
  }, [])

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return
    document.documentElement.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem("dealstack-theme", theme)
  }, [theme, isMounted])

  const setTheme = (value: Theme) => setThemeState(value)
  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}


