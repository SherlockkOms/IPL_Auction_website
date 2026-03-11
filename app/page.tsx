"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Zap, 
  Trophy, 
  IndianRupee, 
  CheckCircle2, 
  Copy, 
  Users, 
  Crown,
  ArrowLeft,
  Loader2,
  Check,
  Upload,
  FileSpreadsheet,
  X
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { createAuction } from "./actions"
import { z } from "zod"

const rulesSchema = z.object({
  totalPurse: z.number().gt(0, "Total Purse must be greater than 0"),
  minSquad: z.number().gt(0, "Min Squad must be greater than 0"),
  maxSquad: z.number().gt(0, "Max Squad must be greater than 0"),
  maxOverseas: z.number().min(0, "Max Overseas cannot be negative"),
  minLocal: z.number().min(0, "Min Local cannot be negative"),
}).refine((data) => data.maxSquad >= data.minSquad, {
  message: "Max Squad Size cannot be smaller than Min Squad Size",
  path: ["maxSquad"],
}).refine((data) => data.maxOverseas <= data.maxSquad, {
  message: "Max Overseas cannot exceed Max Squad Size",
  path: ["maxOverseas"],
}).refine((data) => data.minLocal <= data.maxSquad, {
  message: "Min Local cannot exceed Max Squad Size",
  path: ["minLocal"],
})

type RuleErrors = Partial<Record<keyof typeof rulesSchema._type, string>>

type View = "gateway" | "host-setup" | "host-success" | "join-code"

export default function Gateway() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<View>("gateway")
  const [rules, setRules] = useState({
    totalPurse: 80,
    minSquad: 15,
    maxSquad: 20,
    maxOverseas: 6,
    minLocal: 3,
  })
  const [errors, setErrors] = useState<RuleErrors>({})
  const [generatedRoomCode, setGeneratedRoomCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleRuleChange = (key: keyof typeof rules, value: string) => {
    setRules(prev => ({ ...prev, [key]: parseInt(value) || 0 }))
  }

  const handleCreateRoom = async () => {
    const result = rulesSchema.safeParse(rules)
    if (!result.success) {
      const formattedErrors: RuleErrors = {}
      result.error.issues.forEach((issue) => {
        formattedErrors[issue.path[0] as keyof typeof rulesSchema._type] = issue.message
      })
      setErrors(formattedErrors)
      return
    }
    setErrors({})

    startTransition(async () => {
      const formData = new FormData()
      formData.append("rules", JSON.stringify(rules))
      if (csvFile) {
        formData.append("csvFile", csvFile)
      }
      
      try {
        const result = await createAuction(formData)
        if (result && result.roomCode) {
          setGeneratedRoomCode(result.roomCode)
          localStorage.setItem(`is_admin_${result.roomCode}`, "true")
          setView("host-success")
        }
      } catch (error) {
        if (error instanceof Error && error.message === "NEXT_REDIRECT") {
          throw error;
        }
        console.error(error)
        alert("Failed to create auction.")
      }
    })
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedRoomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleJoinWithCode = async () => {
    if (joinCode.length >= 6) {
      router.push(`/join/${joinCode.toUpperCase()}`)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === "text/csv") {
      setCsvFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
    }
  }

  const handleRemoveFile = () => {
    setCsvFile(null)
  }

  // Gateway View - Host or Join
  if (view === "gateway") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Fantasy Auction</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 text-balance">
              IPL Auction Arena
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              Build your dream team in a live multiplayer auction
            </p>
          </div>

          {/* Two Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Host Card */}
            <button
              onClick={() => setView("host-setup")}
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card/50 p-8 text-left transition-all duration-300 hover:border-primary hover:bg-card hover:shadow-2xl hover:shadow-primary/10 hover:scale-[1.02]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-colors" />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Crown className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Host Auction</h2>
                <p className="text-muted-foreground mb-4">
                  Create a new auction room and invite your friends to join
                </p>
                <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Create Room</span>
                  <ArrowLeft className="h-4 w-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            {/* Join Card */}
            <button
              onClick={() => setView("join-code")}
              className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card/50 p-8 text-left transition-all duration-300 hover:border-accent hover:bg-card hover:shadow-2xl hover:shadow-accent/10 hover:scale-[1.02]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent/20 transition-colors" />
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                  <Users className="h-8 w-8 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Join Auction</h2>
                <p className="text-muted-foreground mb-4">
                  Enter a room code to join an existing auction lobby
                </p>
                <div className="flex items-center gap-2 text-accent font-medium">
                  <span>Enter Code</span>
                  <ArrowLeft className="h-4 w-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Host Setup View
  if (view === "host-setup") {
    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => setView("gateway")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Host Mode</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">
              Configure Your Auction
            </h1>
            <p className="text-muted-foreground text-lg">
              Set the rules for your auction room
            </p>
          </div>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy className="h-5 w-5 text-accent" />
                Rule Engine
              </CardTitle>
              <CardDescription>
                Set the auction parameters for all franchises
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalPurse" className="text-sm text-muted-foreground">
                    Total Purse (CR)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="totalPurse"
                      type="number"
                      value={rules.totalPurse}
                      onChange={(e) => handleRuleChange("totalPurse", e.target.value)}
                      className={`pl-9 bg-input border-border focus:border-primary focus:ring-primary ${errors.totalPurse ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.totalPurse && <p className="text-[10px] text-destructive font-medium">{errors.totalPurse}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minSquad" className="text-sm text-muted-foreground">
                    Min Squad
                  </Label>
                  <Input
                    id="minSquad"
                    type="number"
                    value={rules.minSquad}
                    onChange={(e) => handleRuleChange("minSquad", e.target.value)}
                    className={`bg-input border-border focus:border-primary focus:ring-primary ${errors.minSquad ? "border-destructive" : ""}`}
                  />
                  {errors.minSquad && <p className="text-[10px] text-destructive font-medium">{errors.minSquad}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxSquad" className="text-sm text-muted-foreground">
                    Max Squad
                  </Label>
                  <Input
                    id="maxSquad"
                    type="number"
                    value={rules.maxSquad}
                    onChange={(e) => handleRuleChange("maxSquad", e.target.value)}
                    className={`bg-input border-border focus:border-primary focus:ring-primary ${errors.maxSquad ? "border-destructive" : ""}`}
                  />
                  {errors.maxSquad && <p className="text-[10px] text-destructive font-medium">{errors.maxSquad}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOverseas" className="text-sm text-muted-foreground">
                    Max Overseas
                  </Label>
                  <Input
                    id="maxOverseas"
                    type="number"
                    value={rules.maxOverseas}
                    onChange={(e) => handleRuleChange("maxOverseas", e.target.value)}
                    className={`bg-input border-border focus:border-primary focus:ring-primary ${errors.maxOverseas ? "border-destructive" : ""}`}
                  />
                  {errors.maxOverseas && <p className="text-[10px] text-destructive font-medium">{errors.maxOverseas}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minLocal" className="text-sm text-muted-foreground">
                    Min Local
                  </Label>
                  <Input
                    id="minLocal"
                    type="number"
                    value={rules.minLocal}
                    onChange={(e) => handleRuleChange("minLocal", e.target.value)}
                    className={`bg-input border-border focus:border-primary focus:ring-primary ${errors.minLocal ? "border-destructive" : ""}`}
                  />
                  {errors.minLocal && <p className="text-[10px] text-destructive font-medium">{errors.minLocal}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CSV Upload Dropzone */}
          <Card className="border-border/50 bg-card/80 backdrop-blur mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Player Database
              </CardTitle>
              <CardDescription>
                Upload your player list for the auction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!csvFile ? (
                <label
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                    isDragging
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                      : "border-border hover:border-primary/50 hover:bg-card hover:shadow-[0_0_15px_rgba(var(--primary),0.15)]"
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${
                    isDragging ? "bg-primary/20" : "bg-secondary"
                  }`}>
                    <Upload className={`h-6 w-6 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className={`text-sm font-medium transition-colors ${isDragging ? "text-primary" : "text-foreground"}`}>
                    (Optional) Upload Player Database (CSV)
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center px-4">
                    Expected columns: <span className="text-primary/80 font-mono">Name, Nationality, Role (Batter/Bowler/Allrounder/Wicketkeeper), Team, Base Price</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 text-center px-4 italic">
                    Leave blank to use the default 2026 IPL roster
                  </p>
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{csvFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Room Button */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleCreateRoom}
              disabled={isPending}
              size="lg"
              className="h-14 px-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Create Room
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // Host Success View
  if (view === "host-success") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="pt-10 pb-10">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mb-6 ring-4 ring-accent/10">
                <CheckCircle2 className="h-10 w-10 text-accent" />
              </div>
              
              <h2 className="text-2xl font-bold text-foreground mb-2">Room Created!</h2>
              <p className="text-muted-foreground mb-8">
                Share this code with your friends to join
              </p>

              {/* Massive Room Code */}
              <div className="bg-secondary/50 rounded-2xl p-6 mb-6 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Room Code</p>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl md:text-5xl font-mono font-black text-primary tracking-wider">
                    {generatedRoomCode}
                  </span>
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    size="icon"
                    className={`shrink-0 h-12 w-12 ${copied ? "bg-accent/20 border-accent text-accent" : ""}`}
                  >
                    {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              {/* Room Rules Summary */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary font-medium">
                  {rules.totalPurse} CR Purse
                </span>
                <span className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent font-medium">
                  Max {rules.maxSquad} Players
                </span>
                <span className="px-3 py-1 rounded-full bg-neon-yellow/10 border border-neon-yellow/20 text-sm text-neon-yellow font-medium">
                  {rules.maxOverseas} Overseas
                </span>
              </div>

              {/* Start Auction Button */}
              <Button
                onClick={() => router.push(`/join/${generatedRoomCode}`)}
                size="lg"
                className="h-14 px-12 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all duration-300 hover:scale-105"
              >
                <Zap className="mr-2 h-5 w-5" />
                Go to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Join Code Entry View
  if (view === "join-code") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <button
            onClick={() => setView("gateway")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-2xl">Join Auction Room</CardTitle>
              <CardDescription>
                Enter the room code shared by your host
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="roomCode" className="text-sm text-muted-foreground">
                    Room Code
                  </Label>
                  <Input
                    id="roomCode"
                    type="text"
                    placeholder="IPL-XXX"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="bg-input border-border focus:border-accent focus:ring-accent text-center text-2xl font-mono tracking-widest h-14"
                    maxLength={7}
                  />
                </div>
                <Button
                  onClick={() => startTransition(handleJoinWithCode)}
                  disabled={joinCode.length < 6 || isPending}
                  className="w-full h-12 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Join Lobby"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return null
}
