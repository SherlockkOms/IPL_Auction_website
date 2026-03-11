"use client"

import { useState, useEffect, useTransition } from "react"
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
import { createAuction, joinAuction, claimTeam, toggleReady } from "./actions"
import { supabase } from "@/lib/supabase"
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

type View = "gateway" | "host-setup" | "host-success" | "join-code" | "join-lobby"

interface Team {
  id: string
  auction_id: string
  team_name: string
  manager_name: string | null
  is_ready: boolean
  purse_remaining: number
}

const IPL_TEAMS = [
  { id: "csk", name: "Chennai Super Kings", short: "CSK", color: "#FDB913" },
  { id: "mi", name: "Mumbai Indians", short: "MI", color: "#004BA0" },
  { id: "rcb", name: "Royal Challengers", short: "RCB", color: "#EC1C24" },
  { id: "kkr", name: "Kolkata Knight Riders", short: "KKR", color: "#3A225D" },
  { id: "dc", name: "Delhi Capitals", short: "DC", color: "#17479E" },
  { id: "pbks", name: "Punjab Kings", short: "PBKS", color: "#DD1F2D" },
  { id: "rr", name: "Rajasthan Royals", short: "RR", color: "#EA1A85" },
  { id: "srh", name: "Sunrisers Hyderabad", short: "SRH", color: "#FF822A" },
  { id: "gt", name: "Gujarat Titans", short: "GT", color: "#1C1C1C" },
  { id: "lsg", name: "Lucknow Super Giants", short: "LSG", color: "#A72056" },
]

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
  const [roomCode, setRoomCode] = useState("")
  const [generatedRoomCode, setGeneratedRoomCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState("")
  const [isReady, setIsReady] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // DB States
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [dbTeams, setDbTeams] = useState<Team[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)

  // Realtime Subscription
  useEffect(() => {
    if (!auctionId || view !== "join-lobby") return

    const channel = supabase
      .channel(`teams-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          setDbTeams((current) =>
            current.map((t) => (t.id === (payload.new as Team).id ? (payload.new as Team) : t))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctionId, view])

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

  const handleClaimTeam = async (teamId: string) => {
    if (managerName.trim() && selectedTeamId === teamId) {
      try {
        await claimTeam(teamId, managerName)
        setMyTeamId(teamId)
        setSelectedTeamId(null)
        setManagerName("")
      } catch (error) {
        alert("Failed to claim team. It might already be taken.")
      }
    } else {
      setSelectedTeamId(teamId)
    }
  }

  const handleReady = async () => {
    if (myTeamId) {
      try {
        await toggleReady(myTeamId, true)
        setIsReady(true)
      } catch (error) {
        alert("Failed to set ready status")
      }
    }
  }

  const handleStartAuction = () => {
    router.push(`/live/${roomCode}`)
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

  // Join Lobby View - Franchise Selection
  if (view === "join-lobby") {
    const hasClaimedTeam = !!myTeamId

    return (
      <main className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
              <Users className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Room: {roomCode}</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">
              Choose Your Franchise
            </h1>
            <p className="text-muted-foreground text-lg mb-4">
              Claim a team and get ready for the auction
            </p>
          </div>

          {/* Team Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {dbTeams.map((team) => {
              const iplTeam = IPL_TEAMS.find(t => t.name === team.team_name) || IPL_TEAMS[0]
              const isClaimed = !!team.manager_name
              const isMine = myTeamId === team.id
              const isSelecting = selectedTeamId === team.id

              return (
                <div
                  key={team.id}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-300 ${
                    isMine
                      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                      : isClaimed
                      ? "border-border bg-secondary/30 opacity-60"
                      : isSelecting
                      ? "border-accent bg-accent/10 shadow-lg shadow-accent/20"
                      : "border-border bg-card/50 hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  {/* Team Badge */}
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: iplTeam.color }}
                  >
                    {iplTeam.short}
                  </div>
                  <h3 className="text-sm font-semibold text-foreground text-center mb-2 truncate">
                    {team.team_name}
                  </h3>

                  {isClaimed ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-accent text-xs mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{isMine ? "You" : "Claimed"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{team.manager_name}</p>
                      {team.is_ready && (
                        <Badge className="mt-2 bg-green-500/20 text-green-500 hover:bg-green-500/20 border-none text-[10px]">
                          READY
                        </Badge>
                      )}
                    </div>
                  ) : isSelecting ? (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Your name"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        className="h-8 text-xs bg-input border-border"
                        autoFocus
                      />
                      <Button
                        onClick={() => handleClaimTeam(team.id)}
                        disabled={!managerName.trim() || hasClaimedTeam}
                        size="sm"
                        className="w-full h-7 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        Confirm
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleClaimTeam(team.id)}
                      disabled={hasClaimedTeam}
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs"
                    >
                      Claim Team
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Ready Section */}
          <div className="flex justify-center">
            {isReady ? (
              <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-secondary/30 border border-border">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-lg font-medium text-foreground">Waiting for Admin to start the auction...</p>
                <p className="text-sm text-muted-foreground">You&apos;ll be redirected automatically</p>
              </div>
            ) : (
              <Button
                onClick={handleReady}
                disabled={!hasClaimedTeam}
                size="lg"
                className="h-14 px-12 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/25 disabled:opacity-50 disabled:shadow-none"
              >
                <Check className="mr-2 h-5 w-5" />
                Ready
              </Button>
            )}
          </div>
        </div>
      </main>
    )
  }

  return null
}
