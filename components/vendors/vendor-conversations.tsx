"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Send, ArrowRight, ArrowLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface VendorConversation {
  id: string
  direction: "inbound" | "outbound"
  message: string
  aiResponse: string | null
  intent: string | null
  confidence: number | null
  videoSent: boolean
  videoUrl: string | null
  messageId: string | null
  provider: string | null
  createdAt: string
}

interface VendorConversationsProps {
  vendorId: string
}

export function VendorConversations({ vendorId }: VendorConversationsProps) {
  const [conversations, setConversations] = useState<VendorConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound")
  const [message, setMessage] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [intent, setIntent] = useState("")
  const [confidence, setConfidence] = useState("")
  const [videoSent, setVideoSent] = useState(false)
  const [videoUrl, setVideoUrl] = useState("")
  const [messageId, setMessageId] = useState("")
  const [provider, setProvider] = useState("")

  const fetchConversations = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/conversations`)
      if (!response.ok) throw new Error("Failed to fetch conversations")
      const data = await response.json()
      setConversations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [vendorId])

  const handleCreateConversation = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendors/${vendorId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          message,
          aiResponse: aiResponse || undefined,
          intent: intent || undefined,
          confidence: confidence ? parseFloat(confidence) : undefined,
          videoSent,
          videoUrl: videoUrl || undefined,
          messageId: messageId || undefined,
          provider: provider || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create conversation")
      }

      await fetchConversations()
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create conversation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setDirection("outbound")
    setMessage("")
    setAiResponse("")
    setIntent("")
    setConfidence("")
    setVideoSent(false)
    setVideoUrl("")
    setMessageId("")
    setProvider("")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>AI Conversations</CardTitle>
          <CardDescription>Track all SMS conversations with this vendor</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Conversation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Conversation Entry</DialogTitle>
              <DialogDescription>
                Log a new SMS conversation with this vendor
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <Select value={direction} onValueChange={(value: "inbound" | "outbound") => setDirection(value)}>
                  <SelectTrigger id="direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound (We sent)</SelectItem>
                    <SelectItem value="inbound">Inbound (Vendor sent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter the message content..."
                  rows={4}
                  required
                />
              </div>

              {direction === "outbound" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="aiResponse">AI Response</Label>
                    <Textarea
                      id="aiResponse"
                      value={aiResponse}
                      onChange={(e) => setAiResponse(e.target.value)}
                      placeholder="AI-generated response..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="intent">Intent</Label>
                      <Input
                        id="intent"
                        value={intent}
                        onChange={(e) => setIntent(e.target.value)}
                        placeholder="price_inquiry, more_info, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confidence">Confidence (0-100)</Label>
                      <Input
                        id="confidence"
                        type="number"
                        min="0"
                        max="100"
                        value={confidence}
                        onChange={(e) => setConfidence(e.target.value)}
                        placeholder="85"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">Video URL</Label>
                    <Input
                      id="videoUrl"
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="videoSent"
                      checked={videoSent}
                      onChange={(e) => setVideoSent(e.target.checked)}
                    />
                    <Label htmlFor="videoSent">Video Sent</Label>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="messageId">Message ID</Label>
                  <Input
                    id="messageId"
                    value={messageId}
                    onChange={(e) => setMessageId(e.target.value)}
                    placeholder="SMS service message ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="messagebird">MessageBird</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateConversation} disabled={isSubmitting || !message}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Add Conversation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No conversations recorded yet. Click "Add Conversation" to log one.
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`rounded-lg border p-4 ${
                  conv.direction === "outbound"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {conv.direction === "outbound" ? (
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ArrowLeft className="h-4 w-4 text-gray-600" />
                    )}
                    <span className="font-medium capitalize">{conv.direction}</span>
                    {conv.intent && (
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                        {conv.intent}
                      </span>
                    )}
                    {conv.confidence && (
                      <span className="text-xs text-muted-foreground">
                        {conv.confidence.toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(conv.createdAt)}
                  </span>
                </div>

                <p className="text-sm mb-2">{conv.message}</p>

                {conv.aiResponse && (
                  <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-1">AI Response:</p>
                    <p className="text-xs text-blue-800">{conv.aiResponse}</p>
                  </div>
                )}

                {(conv.videoSent || conv.videoUrl) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>📹</span>
                    {conv.videoUrl ? (
                      <a href={conv.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Video Link
                      </a>
                    ) : (
                      <span>Video sent</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

