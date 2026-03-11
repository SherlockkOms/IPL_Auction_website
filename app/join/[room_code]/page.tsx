"use client"

import { useState, useEffect, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Users, 
  CheckCircle2, 
  Check, 
  Loader2, 
  Zap,
  ArrowLeft,
  Crown
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { joinAuction, claimTeam, toggleReady, startAuction } from "../../actions"

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
  { id: "rcb", name: "Royal Challengers Bangalore", short: "RCB", color: "#EC1C24" },
  { id: "kkr", name: "Kolkata Knight Riders", short: "KKR", color: "#3A225D" },
  { id: "dc", name: "Delhi Capitals", short: "DC", color: "#17479E" },
  { id: "pbks", name: "Punjab Kings", short: "PBKS" , color: "#DD1F2D" },
  { id: "rr", name: "Rajasthan Royals", short: "RR", color: "#EA1A85" },
  { id: "srh", name: "Sunrisers Hyderabad", short: "SRH", color: "#FF822A" },
  { id: "gt", name: "Gujarat Titans", short: "GT", color: "#1C1C1C" },
  { id: "lsg", name: "Lucknow Super Giants", short: "LSG", color: "#A72056" },
]

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const room_code = params.room_code as string
  
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [auctionStatus, setAuctionStatus] = useState<string>("Pending")
  const [dbTeams, setDbTeams] = useState<Team[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // 1. Initial Fetch and Admin Check
  useEffect(() => {
    async function init() {
      try {
        const auction = await joinAuction(room_code)
        setAuctionId(auction.id)
        setAuctionStatus(auction.status)
        
        // Admin Check
        const adminToken = localStorage.getItem(`is_admin_${room_code}`)
        const isAdminUser = adminToken === "true"
        if (isAdminUser) {
          setIsAdmin(true)
        }

        // Fetch Teams for this auction first to validate savedTeamId
        const { data: teamsData } = await supabase
          .from("teams")
          .select("*")
          .eq("auction_id", auction.id)
        
        if (teamsData) setDbTeams(teamsData)

        // Check if I already claimed a team in this session
        let savedTeamId = localStorage.getItem(`my_team_id_${room_code}`)
        
        // VALIDATION: Ensure the saved team actually exists in this SPECIFIC auction instance
        // This prevents issues when reusing room codes across different auctions.
        const teamInThisAuction = teamsData?.find(t => t.id === savedTeamId)
        if (!teamInThisAuction) {
          localStorage.removeItem(`my_team_id_${room_code}`)
          savedTeamId = null
        }

        if (savedTeamId) {
          setMyTeamId(savedTeamId)
          setIsReady(localStorage.getItem(`is_ready_${room_code}`) === "true")
        }

        // Direct Redirect if (user is admin OR already has a valid team)
        if (auction.status === "Active" || auction.status === "Completed") {
          if (isAdminUser || savedTeamId) {
            const isAdminStr = isAdminUser ? "admin=true" : ""
            router.push(`/live/${room_code}${isAdminStr ? `?${isAdminStr}` : ""}`)
            return
          }
          // If they don't have a team, they stay on this page to claim one or spectate.
        }
      } catch (error) {
        console.error("Init Error:", error)
        alert("Invalid room code")
        router.push("/")
      }
    }
    init()
  }, [room_code, router])

  // 2. Status Subscription (Teleport)
  useEffect(() => {
    if (!auctionId) return

    console.log("Setting up Status Subscription for:", auctionId)

    const channel = supabase
      .channel(`auction-status-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          console.log("Realtime Payload Received:", payload)
          const newStatus = payload.new.status
          setAuctionStatus(newStatus)
          
          if (newStatus === "Active" || newStatus === "Completed") {
            console.log("Auction is LIVE. Checking if user should be redirected...")
            
            // ONLY auto-teleport if the state confirms they have a role in this auction
            // This prevents the "instant redirect" for new joiners
            if (isAdmin || myTeamId) {
              console.log("User is Admin or has a Team. Teleporting...")
              const isAdminStr = isAdmin ? "admin=true" : ""
              router.push(`/live/${room_code}${isAdminStr ? `?${isAdminStr}` : ""}`)
            } else {
              console.log("User is a new joiner. Staying in lobby to let them pick.")
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Supabase Subscription Status (Status):", status)
      })

    return () => {
      console.log("Cleaning up Status Subscription")
      supabase.removeChannel(channel)
    }
  }, [auctionId, room_code, router, isAdmin, myTeamId]) // Added dependencies to keep subscription logic fresh

  // 3. Teams Realtime Subscription
  useEffect(() => {
    if (!auctionId) return

    const channel = supabase
      .channel(`teams-lobby-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          setDbTeams((current) => {
            const updatedTeam = payload.new as Team
            const index = current.findIndex(t => t.id === updatedTeam.id)
            if (index > -1) {
              const next = [...current]
              next[index] = updatedTeam
              return next
            }
            return [...current, updatedTeam]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [auctionId])

  const handleClaimTeam = async (teamId: string) => {
    if (managerName.trim() && selectedTeamId === teamId) {
      try {
        await claimTeam(teamId, managerName)
        setMyTeamId(teamId)
        localStorage.setItem(`my_team_id_${room_code}`, teamId)
        setSelectedTeamId(null)
        setManagerName("")

        // If the auction is already active, instantly teleport them after claiming!
        if (auctionStatus === "Active" || auctionStatus === "Completed") {
          router.push(`/live/${room_code}`)
        }
      } catch (error) {
        alert("Failed to claim team.")
      }
    } else {
      setSelectedTeamId(teamId)
    }
  }

  const handleSpectate = () => {
    router.push(`/live/${room_code}`)
  }

  const handleReady = async () => {
    if (myTeamId) {
      try {
        await toggleReady(myTeamId, true)
        setIsReady(true)
        localStorage.setItem(`is_ready_${room_code}`, "true")
      } catch (error) {
        alert("Failed to set ready status")
      }
    }
  }

  const handleStart = async () => {
    console.log("1. Button Clicked - Starting Auction")
    if (!auctionId) {
      console.error("No auctionId found")
      return
    }

    startTransition(async () => {
      try {
        console.log("Calling startAuction for ID:", auctionId)
        await startAuction(auctionId)
        console.log("2. Server Action called successfully. Redirecting Admin...")
        
        // Manual redirect for the admin who triggered it
        const isAdminStr = isAdmin ? "admin=true" : ""
        router.push(`/live/${room_code}${isAdminStr ? `?${isAdminStr}` : ""}`)
      } catch (error: any) {
        console.error("2. Supabase/Action Error:", error)
        alert(`Failed to start auction: ${error.message}`)
      }
    })
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Users className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Lobby: {room_code}</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2 text-balance">
            {isAdmin ? "Waiting for Participants" : "Choose Your Franchise"}
          </h1>
          <p className="text-muted-foreground text-lg mb-4">
            {isAdmin ? "Start the auction when everyone is ready" : "Claim a team and get ready"}
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
                      disabled={!managerName.trim() || !!myTeamId}
                      size="sm"
                      className="w-full h-7 text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleClaimTeam(team.id)}
                    disabled={!!myTeamId}
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

        {/* Action Section */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-4">
            {isAdmin && (
              <Button
                onClick={handleStart}
                disabled={isPending}
                size="lg"
                className="h-16 px-16 text-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/40 transition-all duration-300 hover:scale-105"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Teleporting...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-6 w-6" />
                    Start Auction (Teleport All)
                  </>
                )}
              </Button>
            )}

            {!isAdmin && !isReady && (
              <Button
                onClick={handleReady}
                disabled={!myTeamId}
                size="lg"
                className="h-14 px-12 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/25 disabled:opacity-50 disabled:shadow-none"
              >
                <Check className="mr-2 h-5 w-5" />
                Ready
              </Button>
            )}

            {!isAdmin && (auctionStatus === "Active" || auctionStatus === "Completed") && (
              <Button
                onClick={handleSpectate}
                variant="outline"
                size="lg"
                className="h-14 px-12 text-lg font-bold border-primary/50 text-primary hover:bg-primary/10"
              >
                Spectate Auction
              </Button>
            )}
          </div>

          {!isAdmin && isReady && (
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-secondary/30 border border-border">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-lg font-medium text-foreground">Waiting for Admin to start the auction...</p>
              <p className="text-sm text-muted-foreground">Everyone will be teleported automatically</p>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground italic">
            Total participants: {dbTeams.filter(t => !!t.manager_name).length} / 10
          </p>
        </div>
      </div>
    </main>
  )
}
