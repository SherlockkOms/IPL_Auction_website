"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { 
  Gavel, 
  Users, 
  IndianRupee, 
  Trophy, 
  Clock, 
  Send, 
  ArrowLeft,
  Globe,
  User,
  Target,
  Settings2,
  Search,
  Play,
  AlertTriangle
} from "lucide-react"

import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { bringToHammer, placeBid, sellPlayer, sendChat } from "../../actions"

interface Player {
  id: string
  name: string
  nationality: string
  role: string
  team: string
  base_price: number
  current_bid: number | null
  winning_team_id: string | null
  status: string
}

interface Team {
  id: string
  team_name: string
  manager_name: string | null
  purse_remaining: number
  is_ready: boolean
}

interface ChatMessage {
  id: string
  team_name: string
  message: string
  created_at: string
}

interface BidRecord {
  id: string
  team_id: string
  amount: number
  created_at: string
}

const IPL_TEAM_META: Record<string, { short: string; color: string }> = {
  "Chennai Super Kings": { short: "CSK", color: "#FDB913" },
  "Mumbai Indians": { short: "MI", color: "#004BA0" },
  "Royal Challengers Bangalore": { short: "RCB", color: "#EC1C24" },
  "Kolkata Knight Riders": { short: "KKR", color: "#3A225D" },
  "Delhi Capitals": { short: "DC", color: "#17479E" },
  "Punjab Kings": { short: "PBKS" },
  "Rajasthan Royals": { short: "RR", color: "#EA1A85" },
  "Sunrisers Hyderabad": { short: "SRH", color: "#FF822A" },
  "Gujarat Titans": { short: "GT", color: "#1C1C1C" },
  "Lucknow Super Giants": { short: "LSG" , color: "#A72056" },
}

// Mock bid history
const BID_HISTORY = [
  { time: "14:02", team: "MI", amount: "12 CR" },
  { time: "14:01", team: "RCB", amount: "11.5 CR" },
  { time: "14:01", team: "CSK", amount: "11 CR" },
  { time: "14:00", team: "MI", amount: "10.5 CR" },
  { time: "13:59", team: "KKR", amount: "10 CR" },
  { time: "13:59", team: "RCB", amount: "9 CR" },
  { time: "13:58", team: "DC", amount: "8 CR" },
  { time: "13:57", team: "MI", amount: "7 CR" },
  { time: "13:56", team: "CSK", amount: "6 CR" },
  { time: "13:55", team: "RCB", amount: "5 CR" },
]

// Mock chat messages
const CHAT_MESSAGES = [
  { user: "CSK_Manager", message: "He's too expensive now!", time: "14:02" },
  { user: "MI_Owner", message: "We need him for our lineup", time: "14:01" },
  { user: "RCB_Admin", message: "Let's go! All in!", time: "14:00" },
  { user: "KKR_Boss", message: "Good luck everyone", time: "13:59" },
  { user: "DC_Chief", message: "Saving purse for later rounds", time: "13:58" },
]

// Mock unsold players for admin panel
const UNSOLD_PLAYERS = [
  { id: 1, name: "Shubman Gill", role: "Batter", basePrice: "2 CR", nationality: "IND" },
  { id: 2, name: "Rashid Khan", role: "Bowler", basePrice: "2 CR", nationality: "AFG" },
  { id: 3, name: "Jos Buttler", role: "WK-Batter", basePrice: "2 CR", nationality: "ENG" },
  { id: 4, name: "Jasprit Bumrah", role: "Bowler", basePrice: "2 CR", nationality: "IND" },
  { id: 5, name: "Cameron Green", role: "All-rounder", basePrice: "1.5 CR", nationality: "AUS" },
  { id: 6, name: "Suryakumar Yadav", role: "Batter", basePrice: "1.5 CR", nationality: "IND" },
  { id: 7, name: "Marcus Stoinis", role: "All-rounder", basePrice: "1 CR", nationality: "AUS" },
  { id: 8, name: "Yuzvendra Chahal", role: "Bowler", basePrice: "1 CR", nationality: "IND" },
  { id: 9, name: "Quinton de Kock", role: "WK-Batter", basePrice: "1.5 CR", nationality: "SA" },
  { id: 10, name: "Pat Cummins", role: "Bowler", basePrice: "2 CR", nationality: "AUS" },
  { id: 11, name: "Hardik Pandya", role: "All-rounder", basePrice: "1.5 CR", nationality: "IND" },
  { id: 12, name: "Glenn Maxwell", role: "All-rounder", basePrice: "1.5 CR", nationality: "AUS" },
  { id: 13, name: "Rishabh Pant", role: "WK-Batter", basePrice: "2 CR", nationality: "IND" },
  { id: 14, name: "Trent Boult", role: "Bowler", basePrice: "1 CR", nationality: "NZ" },
  { id: 15, name: "David Warner", role: "Batter", basePrice: "1.5 CR", nationality: "AUS" },
]

export default function LiveDashboard() {
  const params = useParams()
  const searchParams = useSearchParams()
  const room_code = params.room_code as string
  const isAdmin = searchParams.get("admin") === "true"
  
  const [auctionId, setAuctionId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [activePlayer, setActivePlayer] = useState<Player | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [myTeam, setMyTeam] = useState<Team | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [bidHistory, setBidHistory] = useState<BidRecord[]>([])
  const [countdown, setCountdown] = useState(30)
  const [chatInput, setChatInput] = useState("")
  const [bidInput, setBidInput] = useState("")
  const [playerSearch, setPlayerSearch] = useState("")

  // 1. Initial Fetch
  useEffect(() => {
    async function init() {
      const { data: auction } = await supabase
        .from("auctions")
        .select("id")
        .eq("room_code", room_code)
        .single()
      
      if (auction) {
        setAuctionId(auction.id)
        
        // Fetch Teams
        const { data: teamsData } = await supabase.from("teams").select("*").eq("auction_id", auction.id)
        if (teamsData) {
          setTeams(teamsData)
          const savedTeamId = localStorage.getItem(`my_team_id_${room_code}`)
          if (savedTeamId) setMyTeam(teamsData.find(t => t.id === savedTeamId) || null)
        }

        // Fetch Players
        const { data: playersData } = await supabase.from("players").select("*").eq("auction_id", auction.id)
        if (playersData) {
          setPlayers(playersData)
          setActivePlayer(playersData.find(p => p.status === "Active") || null)
        }

        // Fetch Chat
        const { data: chatData } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("auction_id", auction.id)
          .order("created_at", { ascending: true })
        if (chatData) setChatMessages(chatData)

        // Fetch Bids
        const { data: bidData } = await supabase
          .from("bid_history")
          .select("*")
          .eq("auction_id", auction.id)
          .order("created_at", { ascending: false })
        if (bidData) setBidHistory(bidData)
      }
    }
    init()
  }, [room_code])

  // 2. Realtime Listeners
  useEffect(() => {
    if (!auctionId) return

    console.log("Setting up Live Realtime listeners for:", auctionId)

    const channel = supabase
      .channel(`live-dashboard-${auctionId}`)
      // Players - Remove DB filter, filter in JS
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (p) => {
        const updated = p.new as Player
        // Only process if it belongs to our auction
        if (updated.auction_id !== auctionId) return
        
        console.log('Player Update Received:', updated.name || updated.id, updated.status)
        
        setPlayers(curr => curr.map(old => 
          old.id === updated.id ? { ...old, ...updated } : old
        ))

        if (updated.status === "Active") {
          setActivePlayer(prev => (prev?.id === updated.id ? { ...prev, ...updated } : updated))
        } else if (activePlayer?.id === updated.id && updated.status !== "Active") {
          setActivePlayer(null)
        }
      })
      // Teams - Remove DB filter, filter in JS
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (p) => {
        const updated = p.new as Team
        // Only process if it belongs to our auction (or if we find it in our current list)
        setTeams(curr => {
          const exists = curr.find(t => t.id === updated.id)
          if (!exists) return curr // Not one of our teams

          console.log('Budget Update Received for:', exists.team_name, '->', updated.purse_remaining)
          
          const next = curr.map(old => 
            old.id === updated.id ? { ...old, ...updated } : old
          )
          return next
        })
        
        // Update myTeam if it was the one that changed
        setMyTeam(prev => {
          if (prev?.id === updated.id) {
            return { ...prev, ...updated }
          }
          return prev
        })
      })
      // Chat
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        if (p.new.auction_id !== auctionId) return
        console.log('Chat Webhook Fired:', p.new)
        setChatMessages(curr => [...curr, p.new as ChatMessage])
      })
      // Bid History
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bid_history" }, (p) => {
        if (p.new.auction_id !== auctionId) return
        console.log('New Bid History (Resetting Timer):', p.new)
        setBidHistory(curr => [p.new as BidRecord, ...curr])
        setCountdown(30) 
      })
      .subscribe((status) => {
        console.log('Supabase Subscription Status (Live):', status)
      })

    return () => {
      console.log("Cleaning up Live listeners")
      supabase.removeChannel(channel)
    }
  }, [auctionId, activePlayer?.id, myTeam?.id, room_code])

  const unsoldPlayers = players.filter(p => p.status === "Unsold")
  const winningTeam = teams.find(t => t.id === activePlayer?.winning_team_id)

  // Filter unsold players based on search
  const filteredPlayers = unsoldPlayers.filter(player =>
    player.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    player.role.toLowerCase().includes(playerSearch.toLowerCase())
  )

  // Countdown timer effect
  useEffect(() => {
    if (!activePlayer) return
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [activePlayer])

  const handleQuickBid = async (increment: string) => {
    if (!activePlayer || !myTeam) return
    
    let amountToAdd = 0
    if (increment === "+20L") amountToAdd = 0.2
    else if (increment === "+50L") amountToAdd = 0.5
    else if (increment === "+1CR") amountToAdd = 1.0

    const currentAmount = activePlayer.current_bid || activePlayer.base_price
    const newBid = parseFloat((currentAmount + amountToAdd).toFixed(2))

    try {
      await placeBid(activePlayer.id, myTeam.id, newBid)
    } catch (error: any) {
      alert(error.message || "Failed to place bid")
    }
  }

  const handleSubmitBid = async () => {
    if (!activePlayer || !myTeam || !bidInput) return
    const newBid = parseFloat(bidInput)
    try {
      await placeBid(activePlayer.id, myTeam.id, newBid)
      setBidInput("")
    } catch (error: any) {
      alert(error.message || "Failed to place bid")
    }
  }

  const handleSendChat = async () => {
    if (chatInput.trim() && auctionId && myTeam) {
      try {
        await sendChat(auctionId, myTeam.team_name, chatInput.trim())
        setChatInput("")
      } catch (error) {
        alert("Failed to send message")
      }
    }
  }

  const handleBringToHammer = async (player: Player) => {
    if (!auctionId) return
    try {
      await bringToHammer(auctionId, player.id)
    } catch (error) {
      alert("Failed to bring player to hammer")
    }
  }

  const handleForceSell = async () => {
    if (!activePlayer) return
    try {
      await sellPlayer(activePlayer.id)
    } catch (error) {
      alert("Failed to sell player")
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Exit
              </Button>
            </Link>
            {myTeam && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                  style={{ 
                    backgroundColor: `${IPL_TEAM_META[myTeam.team_name]?.color}20`,
                    color: IPL_TEAM_META[myTeam.team_name]?.color,
                    border: `2px solid ${IPL_TEAM_META[myTeam.team_name]?.color}`
                  }}
                >
                  {IPL_TEAM_META[myTeam.team_name]?.short}
                </div>
                <span className="font-semibold text-foreground">{myTeam.team_name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-8">
            {/* Purse Remaining */}
            {myTeam && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-primary">
                  <IndianRupee className="h-6 w-6" />
                  <span className="text-3xl font-bold">{myTeam.purse_remaining}</span>
                  <span className="text-lg font-medium">CR</span>
                </div>
                <p className="text-xs text-muted-foreground">Purse Remaining</p>
              </div>
            )}

            {/* Squad Size Progress */}
            {myTeam && (
              <div className="w-48">
                {(() => {
                  const playersCount = players.filter(p => p.winning_team_id === myTeam.id && p.status === "Sold").length
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Squad Size</span>
                        <span className="font-semibold text-foreground">{playersCount}/20</span>
                      </div>
                      <Progress value={(playersCount / 20) * 100} className="h-2" />
                    </>
                  )
                })()}
              </div>
            )}

            {/* Admin Panel Trigger */}
            {isAdmin && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/10 text-foreground"
                  >
                    <Settings2 className="h-4 w-4" />
                    Manage Auction
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px] bg-card border-l border-border">
                  <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2 text-xl text-foreground">
                      <Gavel className="h-5 w-5 text-primary" />
                      Auctioneer Control Panel
                    </SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                      Manage players and control the auction flow
                    </SheetDescription>
                  </SheetHeader>

                  <div className="flex flex-col h-[calc(100vh-140px)]">
                    {/* Search Input */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search players..."
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="pl-10 bg-input border-border focus:border-primary"
                      />
                    </div>

                    {/* Unsold Players Table */}
                    <div className="flex-1 overflow-hidden rounded-lg border border-border/50 bg-background/50">
                      <div className="p-3 border-b border-border/50 bg-secondary/30">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          Unsold Players ({filteredPlayers.length})
                        </h4>
                      </div>
                      <ScrollArea className="h-[calc(100%-52px)]">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/50 hover:bg-transparent">
                              <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                              <TableHead className="text-muted-foreground text-xs text-right">Base</TableHead>
                              <TableHead className="text-muted-foreground text-xs text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPlayers.map((player) => (
                              <TableRow 
                                key={player.id}
                                className="border-border/30 hover:bg-secondary/30"
                              >
                                <TableCell className="py-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground text-sm">{player.name}</span>
                                    <span className="text-xs text-muted-foreground">{player.nationality}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-muted-foreground">
                                  {player.role}
                                </TableCell>
                                <TableCell className="py-2 text-right text-sm font-medium text-primary">
                                  {player.base_price} CR
                                </TableCell>
                                <TableCell className="py-2 text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => handleBringToHammer(player)}
                                    className="h-7 px-2 text-xs font-semibold bg-accent hover:bg-accent/90 text-accent-foreground"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Bring to Hammer
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    {/* Force Sell Button */}
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <Button
                        variant="destructive"
                        onClick={handleForceSell}
                        className="w-full h-12 font-bold text-base gap-2 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/25"
                      >
                        <AlertTriangle className="h-5 w-5" />
                        Force Sell / End Bid
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        Awards current player to highest bidder immediately
                      </p>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-72px)]">
        {/* Left Column - Competition Table */}
        <div className="lg:w-72 shrink-0">
          <Card className="h-full border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-accent" />
                Competition
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Team</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Purse</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-center">
                        <Users className="h-3 w-3 inline" />
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs text-center">
                        <Globe className="h-3 w-3 inline" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams
                      .filter(t => !!t.manager_name) // Only show teams actively being used
                      .map((team) => {
                        const meta = IPL_TEAM_META[team.team_name]
                        const teamPlayers = players.filter(p => p.winning_team_id === team.id && p.status === "Sold")
                        const overseasCount = teamPlayers.filter(p => p.nationality !== "IND").length

                        return (
                          <TableRow 
                            key={team.id}
                            className={`border-border/30 ${team.id === myTeam?.id ? 'bg-primary/10' : 'hover:bg-secondary/30'}`}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                  style={{ 
                                    backgroundColor: `${meta?.color}30`,
                                    color: meta?.color
                                  }}
                                >
                                  {meta?.short}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-right text-sm font-medium">
                              {team.purse_remaining}
                            </TableCell>
                            <TableCell className="py-2 text-center text-sm">
                              {teamPlayers.length}
                            </TableCell>
                            <TableCell className="py-2 text-center text-sm">
                              {overseasCount}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Action Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Active Player Card */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Player Image Placeholder */}
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl bg-secondary/50 border-2 border-border flex items-center justify-center">
                  <User className="h-16 w-16 text-muted-foreground" />
                </div>
                
                {/* Player Info */}
                <div className="flex-1 text-center md:text-left">
                  <Badge variant="outline" className="mb-2 border-accent text-accent">
                    {activePlayer ? "Active Player" : "Waiting for Player..."}
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                    {activePlayer ? activePlayer.name : "Ready to Start"}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <Badge className="bg-secondary text-secondary-foreground">
                      <Globe className="h-3 w-3 mr-1" /> {activePlayer ? activePlayer.nationality : "-"}
                    </Badge>
                    <Badge className="bg-secondary text-secondary-foreground">
                      <Target className="h-3 w-3 mr-1" /> {activePlayer ? activePlayer.role : "-"}
                    </Badge>
                    <Badge className="bg-primary/20 text-primary border border-primary/30">
                      Base: {activePlayer ? activePlayer.base_price : 0} CR
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Bid Display */}
          <Card className="border-primary/30 bg-card/80 overflow-hidden relative">
            <div className="absolute inset-0 bg-primary/5" />
            <CardContent className="p-6 relative">
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-2">Current Bid</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <IndianRupee className="h-10 w-10 text-neon-green drop-shadow-[0_0_10px_rgba(128,255,128,0.5)]" />
                  <span className="text-6xl md:text-7xl font-black text-neon-green drop-shadow-[0_0_20px_rgba(128,255,128,0.4)]">
                    {activePlayer ? (activePlayer.current_bid || activePlayer.base_price) : 0}
                  </span>
                  <span className="text-3xl md:text-4xl font-bold text-neon-green">CR</span>
                </div>
                <p className="text-lg">
                  {winningTeam ? (
                    <>
                      held by{" "}
                      <span className="font-bold text-primary">
                        {winningTeam.team_name}
                      </span>
                    </>
                  ) : (
                    "No bids yet"
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Countdown Timer */}
          <div className="flex items-center gap-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Progress 
                value={(countdown / 30) * 100} 
                className={`h-3 ${countdown <= 10 ? '[&>div]:bg-destructive' : '[&>div]:bg-neon-cyan'}`}
              />
            </div>
            <span className={`text-xl font-bold tabular-nums min-w-[3ch] ${countdown <= 10 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
              {countdown}s
            </span>
          </div>

          {/* Bid Controls */}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  onClick={() => handleQuickBid("+20L")}
                  variant="secondary"
                  className="flex-1 min-w-[80px] h-12 font-bold text-lg bg-secondary hover:bg-secondary/80 border border-primary/30 hover:border-primary transition-colors"
                >
                  +20L
                </Button>
                <Button 
                  onClick={() => handleQuickBid("+50L")}
                  variant="secondary"
                  className="flex-1 min-w-[80px] h-12 font-bold text-lg bg-secondary hover:bg-secondary/80 border border-primary/30 hover:border-primary transition-colors"
                >
                  +50L
                </Button>
                <Button 
                  onClick={() => handleQuickBid("+1CR")}
                  variant="secondary"
                  className="flex-1 min-w-[80px] h-12 font-bold text-lg bg-secondary hover:bg-secondary/80 border border-accent/30 hover:border-accent transition-colors"
                >
                  +1CR
                </Button>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Input
                    type="number"
                    placeholder="Custom amount"
                    value={bidInput}
                    onChange={(e) => setBidInput(e.target.value)}
                    className="h-12 bg-input border-border focus:border-primary"
                  />
                  <Button 
                    onClick={handleSubmitBid}
                    className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25"
                  >
                    <Gavel className="h-5 w-5 mr-2" />
                    Submit Bid
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Social & Logs */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-4">
          {/* Bid History */}
          <Card className="flex-1 border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gavel className="h-5 w-5 text-primary" />
                Bid History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-48">
                <div className="p-4 space-y-2">
                  {bidHistory.map((bid) => {
                    const team = teams.find(t => t.id === bid.team_id)
                    const teamMeta = team ? IPL_TEAM_META[team.team_name] : null
                    return (
                      <div 
                        key={bid.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="text-muted-foreground font-mono text-[10px]">
                          [{new Date(bid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                        </span>
                        <span className="font-semibold text-primary">{teamMeta?.short || "???"}</span>
                        <span className="text-muted-foreground">bid</span>
                        <span className="font-bold text-foreground">{bid.amount} CR</span>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Live Chat */}
          <Card className="flex-1 border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-accent" />
                Live Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[calc(100%-60px)]">
              <ScrollArea className="flex-1 h-40">
                <div className="p-4 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-accent">{msg.team_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground bg-secondary/30 rounded-lg px-3 py-2">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border/50">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    className="h-9 bg-input border-border focus:border-primary text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSendChat}
                    className="h-9 px-3 bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
