"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Trash2, Pencil, Check, X, StickyNote } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

// ─── types ────────────────────────────────────────────────────────────────────

interface LeadNote {
  id: string
  content: string
  createdById: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

interface LeadNotesTabProps {
  vendorLeadId: string
  currentUserId?: string | null
  currentUserRole?: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function NoteAvatar({ name }: { name: string | null | undefined }) {
  const colours = [
    "bg-blue-100 text-blue-700",
    "bg-violet-100 text-violet-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ]
  // Pick a stable colour based on the name string
  const idx = name ? name.charCodeAt(0) % colours.length : 0
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        colours[idx]
      )}
    >
      {initials(name)}
    </span>
  )
}

// ─── single note card ─────────────────────────────────────────────────────────

function NoteCard({
  note,
  canEdit,
  onDelete,
  onSave,
}: {
  note: LeadNote
  canEdit: boolean
  onDelete: (id: string) => void
  onSave: (id: string, content: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const handleSave = async () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await onSave(note.id, trimmed)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(note.id)
    } finally {
      setDeleting(false)
    }
  }

  const ago = (() => {
    try {
      return formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })
    } catch {
      return ""
    }
  })()

  const wasEdited = note.updatedAt !== note.createdAt

  return (
    <div className="ds-card overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <NoteAvatar name={note.createdByName} />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-gray-800 truncate">
                {note.createdByName ?? "Unknown"}
              </span>
              <span className="ml-2 text-[10px] text-gray-400">
                {ago}
                {wasEdited && " · edited"}
              </span>
            </div>
          </div>
          {canEdit && !editing && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => { setEditText(note.content); setEditing(true) }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={saving || !editText.trim()}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span className="ml-1">Save</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={saving}
                onClick={() => { setEditing(false); setEditText(note.content) }}
              >
                <X className="h-3.5 w-3.5" />
                <span className="ml-1">Cancel</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
            {note.content}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function LeadNotesTab({
  vendorLeadId,
  currentUserId,
  currentUserRole,
}: LeadNotesTabProps) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState("")
  const [posting, setPosting] = useState(false)

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/vendor-leads/${vendorLeadId}/notes`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setNotes(json.data ?? [])
      })
      .catch(() => toast.error("Failed to load notes"))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [vendorLeadId])

  // ── post ──────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    setPosting(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to post note")
      setNotes((prev) => [json.data, ...prev])
      setNewText("")
      toast.success("Note saved")
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save note")
    } finally {
      setPosting(false)
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (noteId: string) => {
    const res = await fetch(`/api/vendor-leads/${vendorLeadId}/notes/${noteId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error ?? "Delete failed")
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    toast.success("Note deleted")
  }

  // ── edit ──────────────────────────────────────────────────────────────────
  const handleSave = async (noteId: string, content: string) => {
    const res = await fetch(`/api/vendor-leads/${vendorLeadId}/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? "Update failed")
    setNotes((prev) => prev.map((n) => (n.id === noteId ? json.data : n)))
    toast.success("Note updated")
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Compose box */}
      <div className="ds-card overflow-hidden">
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Add a note
          </p>
          <Textarea
            placeholder="E.g. Vendor called — roof needs replacing, budgeting ~£8k. Said they'd accept offers from mid-Nov onwards."
            rows={4}
            className="resize-none text-sm"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd + Enter submits
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault()
                handlePost()
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Ctrl+Enter to submit</span>
            <Button
              size="sm"
              className="h-8 px-4 text-xs"
              disabled={posting || !newText.trim()}
              onClick={handlePost}
            >
              {posting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save Note
            </Button>
          </div>
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-gray-400">
          <StickyNote className="h-10 w-10 opacity-30" />
          <p className="text-sm">No notes yet — add the first one above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const canEdit =
              currentUserRole === "admin" || note.createdById === currentUserId
            return (
              <NoteCard
                key={note.id}
                note={note}
                canEdit={canEdit}
                onDelete={handleDelete}
                onSave={handleSave}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
