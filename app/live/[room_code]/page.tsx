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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  AlertTriangle,
  Download,
  Power,
  Crown,
  Zap
} from "lucide-react"

import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { bringToHammer, placeBid, sellPlayer, sendChat, endAuction, setCaptain, resetUnsoldPlayers } from "../../actions"
import Papa from "papaparse"

import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

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
  is_captain?: boolean
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
  { id: 3, name: "Jos Buttler", role: "Wicketkeeper", basePrice: "2 CR", nationality: "ENG" },
  { id: 4, name: "Jasprit Bumrah", role: "Bowler", basePrice: "2 CR", nationality: "IND" },
  { id: 5, name: "Cameron Green", role: "Allrounder", basePrice: "1.5 CR", nationality: "AUS" },
  { id: 6, name: "Suryakumar Yadav", role: "Batter", basePrice: "1.5 CR", nationality: "IND" },
  { id: 7, name: "Marcus Stoinis", role: "Allrounder", basePrice: "1 CR", nationality: "AUS" },
  { id: 8, name: "Yuzvendra Chahal", role: "Bowler", basePrice: "1 CR", nationality: "IND" },
  { id: 9, name: "Quinton de Kock", role: "Wicketkeeper", basePrice: "1.5 CR", nationality: "SA" },
  { id: 10, name: "Pat Cummins", role: "Bowler", basePrice: "2 CR", nationality: "AUS" },
  { id: 11, name: "Hardik Pandya", role: "Allrounder", basePrice: "1.5 CR", nationality: "IND" },
  { id: 12, name: "Glenn Maxwell", role: "Allrounder", basePrice: "1.5 CR", nationality: "AUS" },
  { id: 13, name: "Rishabh Pant", role: "Wicketkeeper", basePrice: "2 CR", nationality: "IND" },
  { id: 14, name: "Trent Boult", role: "Bowler", basePrice: "1 CR", nationality: "NZ" },
  { id: 15, name: "David Warner", role: "Batter", basePrice: "1.5 CR", nationality: "AUS" },
]

export default function LiveDashboard() {
  const { toast } = useToast()
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
  const [activeCategory, setActiveCategory] = useState("All")
  const [squadAvailableCategory, setSquadAvailableCategory] = useState("All")
  const [auctionStatus, setAuctionStatus] = useState<string>("Active")
  const [selectedSquadTeamId, setSelectedSquadTeamId] = useState<string | null>(null)
  const [auctionRules, setAuctionRules] = useState<any>(null)

  // 1. Initial Fetch
  useEffect(() => {
    async function init() {
      const { data: auction } = await supabase
        .from("auctions")
        .select("id, status, rules")
        .eq("room_code", room_code)
        .single()
      
      if (auction) {
        setAuctionId(auction.id)
        setAuctionStatus(auction.status)
        setAuctionRules(auction.rules)
        
        // Fetch Teams
        const { data: teamsData } = await supabase.from("teams").select("*").eq("auction_id", auction.id)
        if (teamsData) {
          setTeams(teamsData)
          const savedTeamId = localStorage.getItem(`my_team_id_${room_code}`)
          if (savedTeamId) {
            const team = teamsData.find(t => t.id === savedTeamId) || null
            setMyTeam(team)
            setSelectedSquadTeamId(savedTeamId)
          }
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
        if (!updated || updated.auction_id !== auctionId) return
        
        console.log('Player Update Received:', updated.name || updated.id, updated.status)
        
        setPlayers(curr => curr.map(old => 
          old.id === updated.id ? { ...old, ...updated } : old
        ))

        if (updated.status === "Active") {
          setCountdown(30) // CRITICAL: Reset timer when a player is brought to hammer or bid on
          setActivePlayer(prev => (prev?.id === updated.id ? { ...prev, ...updated } : updated))
        } else {
          setActivePlayer(prev => (prev?.id === updated.id && updated.status !== "Active") ? null : prev)
        }
      })
      // Teams - Remove DB filter, filter in JS
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (p) => {
        const updated = p.new as Team
        if (!updated) return
        
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
        if (!p.new || p.new.auction_id !== auctionId) return
        console.log('Chat Webhook Fired:', p.new)
        setChatMessages(curr => [...curr, p.new as ChatMessage])
      })
      // Bid History
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bid_history" }, (p) => {
        if (!p.new || p.new.auction_id !== auctionId) return
        console.log('New Bid History (Resetting Timer):', p.new)
        setBidHistory(curr => [p.new as BidRecord, ...curr])
        setCountdown(30) 
      })
      // Auction Status
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions" }, (p) => {
        if (!p.new || p.new.id !== auctionId) return
        console.log('Auction Update:', p.new.status)
        setAuctionStatus(p.new.status)
      })
      .subscribe((status) => {
        console.log('Supabase Subscription Status (Live):', status)
      })

    return () => {
      console.log("Cleaning up Live listeners")
      supabase.removeChannel(channel)
    }
  }, [auctionId, room_code])

  const unsoldPlayers = players.filter(p => p.status === "Pending")
  const winningTeam = teams.find(t => t.id === activePlayer?.winning_team_id)

  // Filter unsold players based on search & category (Admin Pane)
  const filteredPlayers = unsoldPlayers.filter(player => {
    const searchLower = playerSearch.toLowerCase()
    const matchesSearch = player.name.toLowerCase().includes(searchLower) ||
                          player.role.toLowerCase().includes(searchLower)
    const matchesCategory = activeCategory === "All" || player.role === activeCategory
    return matchesSearch && matchesCategory
  })

  // Filter available players for Squad Drawer (Available Tab)
  const squadAvailablePlayers = players
    .filter(p => p.status === "Pending")
    .filter(p => squadAvailableCategory === "All" || p.role === squadAvailableCategory)

  // Countdown timer effect
  useEffect(() => {
    if (!activePlayer) return
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [activePlayer])

  // Auto-sell when timer hits 0 (Admin only)
  useEffect(() => {
    if (activePlayer && countdown === 0 && isAdmin) {
      handleForceSell()
    }
  }, [countdown, activePlayer, isAdmin])

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
      toast({
        variant: "destructive",
        title: "Bid Rejected",
        description: error.message || "Failed to place bid"
      })
    }
  }

  const handleSubmitBid = async () => {
    if (!activePlayer || !myTeam || !bidInput) return
    const newBid = parseFloat(bidInput)
    try {
      await placeBid(activePlayer.id, myTeam.id, newBid)
      setBidInput("")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Bid Rejected",
        description: error.message || "Failed to place bid"
      })
    }
  }

  const handleSendChat = async () => {
    if (chatInput.trim() && auctionId && myTeam) {
      try {
        await sendChat(auctionId, myTeam.team_name, chatInput.trim())
        setChatInput("")
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send message"
        })
      }
    }
  }

  const handleBringToHammer = async (player: Player) => {
    if (!auctionId) return
    try {
      await bringToHammer(auctionId, player.id)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to bring player to hammer"
      })
    }
  }

  const handleForceSell = async () => {
    if (!activePlayer || !auctionId) return
    try {
      await sellPlayer(activePlayer.id, auctionId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sell player"
      })
    }
  }

  const handleEndAuction = async () => {
    if (!auctionId) return
    if (!confirm("Are you sure you want to end the auction? This cannot be undone.")) return
    
    try {
      await endAuction(auctionId)
      toast({
        title: "Auction Completed",
        description: "The auction has been successfully closed.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to end auction",
      })
    }
  }

  const handleExportCSV = async (filterTeamId?: string | null) => {
    if (!auctionId) return
    
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'IPL Fantasy Auction';
      
      // 1. Fetch Sold Players
      let query = supabase
        .from("players")
        .select("*")
        .eq("auction_id", auctionId)
        .eq("status", "Sold")
      
      if (filterTeamId) {
        // Ensure we only use the ID string, not the object
        const idToFilter = typeof filterTeamId === 'object' ? (filterTeamId as any).id : filterTeamId;
        query = query.eq("winning_team_id", idToFilter)
      }

      const { data: soldPlayers, error: playersError } = await query
      
      if (playersError || !soldPlayers) throw new Error("Failed to fetch players")

      const targetTeam = filterTeamId ? teams.find(t => t.id === filterTeamId) : null

      // --- SHEET 1: PLAYER DATA ---
      const allSheet = workbook.addWorksheet(targetTeam ? `Squad - ${IPL_TEAM_META[targetTeam.team_name]?.short || "TEAM"}` : 'All Sold Players');
      allSheet.columns = [
        { header: 'Player', key: 'name', width: 25 },
        { header: 'Nationality', key: 'nationality', width: 15 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Original Team', key: 'team', width: 20 },
        { header: 'Buying Team', key: 'buyingTeam', width: 10 },
        { header: 'Manager', key: 'manager', width: 20 },
        { header: 'Final Price (CR)', key: 'price', width: 15 },
      ];

      allSheet.getRow(1).font = { bold: true };
      allSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

      const allDataRows = soldPlayers.map(p => {
        const team = teams.find(t => t.id === p.winning_team_id)
        return {
          name: p.name + (p.is_captain ? " (C)" : ""),
          nationality: p.nationality,
          role: p.role,
          team: p.team,
          buyingTeam: team ? (IPL_TEAM_META[team.team_name]?.short || team.team_name) : "???",
          manager: team?.manager_name || "N/A",
          price: p.current_bid
        }
      });
      allSheet.addRows(allDataRows);

      // --- SHEET 2: SUMMARY/STATS ---
      if (!filterTeamId) {
        const statsSheet = workbook.addWorksheet('Summary & Statistics');
        statsSheet.columns = [
          { header: 'Team', key: 'team', width: 25 },
          { header: 'Abbr', key: 'abbr', width: 10 },
          { header: 'Manager', key: 'manager', width: 20 },
          { header: 'Players Bought', key: 'count', width: 15 },
          { header: 'Total Spent (CR)', key: 'spent', width: 15 },
          { header: 'Budget Left (CR)', key: 'budget', width: 15 },
          { header: 'Batters', key: 'batters', width: 10 },
          { header: 'Bowlers', key: 'bowlers', width: 10 },
          { header: 'Allrounders', key: 'ar', width: 10 },
          { header: 'Wicketkeepers', key: 'wk', width: 15 },
          { header: 'Overseas', key: 'overseas', width: 10 },
          { header: 'Captain', key: 'captain', width: 20 },
        ];
        statsSheet.getRow(1).font = { bold: true };
        statsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        const teamStats = teams.filter(t => !!t.manager_name).map(team => {
          const teamPlayers = soldPlayers.filter(p => p.winning_team_id === team.id);
          const spent = teamPlayers.reduce((sum, p) => sum + (p.current_bid || 0), 0);
          const captain = teamPlayers.find(p => p.is_captain);
          return {
            team: team.team_name,
            abbr: IPL_TEAM_META[team.team_name]?.short || "",
            manager: team.manager_name || "N/A",
            count: teamPlayers.length,
            spent: Number(spent.toFixed(2)),
            budget: team.purse_remaining,
            batters: teamPlayers.filter(p => p.role === 'Batter').length,
            bowlers: teamPlayers.filter(p => p.role === 'Bowler').length,
            ar: teamPlayers.filter(p => p.role === 'Allrounder').length,
            wk: teamPlayers.filter(p => p.role === 'Wicketkeeper').length,
            overseas: teamPlayers.filter(p => p.nationality !== 'IND').length,
            captain: captain ? captain.name : "Not Assigned"
            }
            });        statsSheet.addRows(teamStats);
      }

      // 4. Download XLSX
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileName = targetTeam 
        ? `${IPL_TEAM_META[targetTeam.team_name]?.short || "Team"}_Squad_Results.xlsx`
        : `IPL_Auction_Results_${room_code}.xlsx`;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "The Excel report has been downloaded.",
      })
    } catch (error) {
      console.error("Export Error:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not generate results Excel file.",
      })
    }
  }

  const handleSetCaptain = async (playerId: string) => {
    if (!myTeam) return
    try {
      await setCaptain(playerId, myTeam.id)
      toast({
        title: "Captain Assigned",
        description: "Your team's captain has been updated.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to set captain"
      })
    }
  }

  const handleResetUnsold = async () => {
    if (!auctionId) return
    if (!window.confirm("Are you sure you want to bring all Unsold players back? This will set them to 'Pending' for the Accelerated Round.")) return

    try {
      await resetUnsoldPlayers(auctionId)
      toast({
        title: "Accelerated Round Started",
        description: "All unsold players have been moved to Pending.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset players"
      })
    }
  }

  const selectedTeamData = teams.find(t => t.id === selectedSquadTeamId)

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Exit
              </Button>
            </Link>
            {myTeam && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-primary/30 hover:border-primary">
                    <Users className="h-4 w-4 text-primary" />
                    View Squads
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full sm:max-w-[540px] md:max-w-[650px] bg-card border-r border-border flex flex-col p-0">
                  <Tabs defaultValue="squad" className="flex-1 flex flex-col min-h-0">
                    <div className="p-6 border-b border-border shrink-0">
                      <SheetHeader>
                        <SheetTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-accent" />
                            Strategy Hub
                          </div>
                          <div className="flex items-center gap-2">
                            <TabsList className="bg-secondary/50">
                              <TabsTrigger value="squad" className="text-xs">My Squad</TabsTrigger>
                              <TabsTrigger value="available" className="text-xs text-nowrap">Available Pool</TabsTrigger>
                            </TabsList>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleExportCSV(selectedSquadTeamId)}
                              className="text-xs h-8 gap-1.5 hover:bg-accent/10 hover:text-accent"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Export
                            </Button>
                          </div>
                        </SheetTitle>
                      </SheetHeader>
                    </div>

                    <TabsContent value="squad" className="flex-1 min-h-0 m-0 flex flex-col">
                      <div className="p-6 border-b border-border shrink-0 space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Select Team</label>
                          <select 
                            value={selectedSquadTeamId || ""}
                            onChange={(e) => setSelectedSquadTeamId(e.target.value)}
                            className="w-full h-10 bg-secondary/50 border border-border rounded-md px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                          >
                            {teams.filter(t => !!t.manager_name).map(t => (
                              <option key={t.id} value={t.id}>
                                {t.team_name} {t.id === myTeam.id ? "(My Team)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedTeamData && auctionRules && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              {(() => {
                                const squad = players.filter(p => p.winning_team_id === selectedTeamData.id && p.status === "Sold")
                                const overseas = squad.filter(p => p.nationality !== "IND").length
                                const localCount = squad.filter(p => p.team === IPL_TEAM_META[selectedTeamData.team_name]?.short).length
                                const isOverseasValid = overseas <= (auctionRules.maxOverseas || 8)
                                const isSquadValid = squad.length >= (auctionRules.minSquad || 15)

                                return (
                                  <>
                                    <div className={`p-2 rounded-lg border flex flex-col gap-0.5 ${overseas > 0 ? (isOverseasValid ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20") : "bg-secondary/30 border-border/50"}`}>
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Overseas</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${overseas > 0 && isOverseasValid ? "text-green-500" : ""}`}>{overseas}</span>
                                        <span className="text-[10px] text-muted-foreground">/{auctionRules.maxOverseas}</span>
                                      </div>
                                    </div>
                                    <div className={`p-2 rounded-lg border flex flex-col gap-0.5 ${localCount > 0 ? "bg-blue-500/10 border-blue-500/20" : "bg-secondary/30 border-border/50"}`}>
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Local</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${localCount > 0 ? "text-blue-400" : ""}`}>{localCount}</span>
                                        <span className="text-[10px] text-muted-foreground">Original</span>
                                      </div>
                                    </div>
                                    <div className={`p-2 rounded-lg border flex flex-col gap-0.5 ${squad.length > 0 ? (isSquadValid ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20") : "bg-secondary/30 border-border/50"}`}>
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Squad</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${isSquadValid ? "text-green-500" : ""}`}>{squad.length}</span>
                                        <span className="text-[10px] text-muted-foreground">/{auctionRules.maxSquad}</span>
                                      </div>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(() => {
                                const squad = players.filter(p => p.winning_team_id === selectedTeamData.id && p.status === "Sold")
                                const batters = squad.filter(p => p.role === "Batter").length
                                const bowlers = squad.filter(p => p.role === "Bowler").length
                                const keepers = squad.filter(p => p.role === "Wicketkeeper").length
                                return (
                                  <>
                                    <div className="p-2 rounded-lg border bg-secondary/30 border-border/50 flex flex-col gap-0.5">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Keepers</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${keepers > 0 ? "text-primary" : "text-muted-foreground"}`}>{keepers}</span>
                                        <span className="text-[10px] text-muted-foreground">WK</span>
                                      </div>
                                    </div>
                                    <div className="p-2 rounded-lg border bg-secondary/30 border-border/50 flex flex-col gap-0.5">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Batters</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${batters > 0 ? "text-primary" : "text-muted-foreground"}`}>{batters}</span>
                                        <span className="text-[10px] text-muted-foreground">BAT</span>
                                      </div>
                                    </div>
                                    <div className="p-2 rounded-lg border bg-secondary/30 border-border/50 flex flex-col gap-0.5">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Bowlers</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className={`text-lg font-bold ${bowlers > 0 ? "text-primary" : "text-muted-foreground"}`}>{bowlers}</span>
                                        <span className="text-[10px] text-muted-foreground">BOWL</span>
                                      </div>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                      <ScrollArea className="flex-1 h-full">
                        <div className="p-6 space-y-6">
                          {["Batter", "Bowler", "Allrounder", "Wicketkeeper"].map(role => {
                            const rolePlayers = players.filter(p => 
                              p.winning_team_id === selectedSquadTeamId && 
                              p.status === "Sold" && 
                              p.role === role
                            )
                            if (rolePlayers.length === 0) return null
                            return (
                              <div key={role} className="space-y-3">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                                  <div className="w-1 h-4 bg-primary rounded-full" />
                                  {role === "Wicketkeeper" ? "Wicketkeepers" : role === "Allrounder" ? "Allrounders" : `${role}s`}
                                  <Badge variant="secondary" className="ml-auto text-[10px]">{rolePlayers.length}</Badge>
                                </h3>
                                <div className="grid gap-2">
                                  {rolePlayers.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 group hover:border-primary/30 transition-all">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex flex-col min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold truncate">{p.name}</span>
                                            {p.is_captain && <Crown className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                                          </div>
                                          <span className="text-[10px] text-muted-foreground uppercase tracking-tighter truncate">
                                            {p.nationality} • {p.team} 
                                            {p.team === IPL_TEAM_META[selectedTeamData?.team_name || ""]?.short && (
                                              <span className="ml-1 text-blue-400 font-bold">(Local)</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0 ml-4">
                                        <span className="text-sm font-bold text-primary whitespace-nowrap">{p.current_bid} CR</span>
                                        {selectedSquadTeamId === myTeam.id && !p.is_captain && (
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleSetCaptain(p.id)}
                                            className="h-8 px-3 text-[11px] opacity-0 group-hover:opacity-100 bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all shrink-0"
                                          >
                                            Set Captain
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                          {(!selectedSquadTeamId || players.filter(p => p.winning_team_id === selectedSquadTeamId && p.status === "Sold").length === 0) && (
                            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                              <Users className="h-8 w-8 opacity-20" />
                              <p className="text-sm">No players bought yet</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                      {selectedTeamData && (
                        <div className="p-6 border-t border-border bg-secondary/20 shrink-0">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Budget Remaining</span>
                            <span className="font-bold text-lg text-primary">{selectedTeamData.purse_remaining} CR</span>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="available" className="flex-1 min-h-0 m-0 flex flex-col">
                      <div className="p-6 border-b border-border shrink-0 bg-secondary/10">
                        <Tabs value={squadAvailableCategory} onValueChange={setSquadAvailableCategory} className="w-full">
                          <TabsList className="grid w-full grid-cols-6 bg-secondary/50 h-10 p-1">
                            <TabsTrigger value="All" className="text-[10px]">All</TabsTrigger>
                            <TabsTrigger value="Batter" className="text-[10px]">BAT</TabsTrigger>
                            <TabsTrigger value="Bowler" className="text-[10px]">BOWL</TabsTrigger>
                            <TabsTrigger value="Allrounder" className="text-[10px] text-nowrap">AR</TabsTrigger>
                            <TabsTrigger value="Wicketkeeper" className="text-[10px]">WK</TabsTrigger>
                            <TabsTrigger value="Unsold" className="text-[10px] text-red-400">UNSOLD</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            {squadAvailableCategory === "Unsold" ? "Unsold Pool" : "Remaining Pool"} ({
                              squadAvailableCategory === "Unsold" 
                                ? players.filter(p => p.status === "Unsold").length
                                : squadAvailablePlayers.length
                            })
                          </span>
                        </div>
                      </div>
                      <ScrollArea className="flex-1 h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow className="border-border/50 hover:bg-transparent">
                              <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                              <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                              <TableHead className="text-muted-foreground text-xs text-right">Base</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(squadAvailableCategory === "Unsold" 
                              ? players.filter(p => p.status === "Unsold")
                              : squadAvailablePlayers
                            ).map((p) => (
                              <TableRow key={p.id} className="border-border/30 hover:bg-secondary/30">
                                <TableCell className="py-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground text-sm">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{p.nationality} • {p.team}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground">
                                  {p.role}
                                </TableCell>
                                <TableCell className="py-2 text-right text-sm font-medium text-primary">
                                  {p.base_price} CR
                                </TableCell>
                              </TableRow>
                            ))}
                            {(squadAvailableCategory === "Unsold" 
                              ? players.filter(p => p.status === "Unsold").length
                              : squadAvailablePlayers.length
                            ) === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="h-40 text-center text-muted-foreground">
                                  No players found in this category.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </SheetContent>
              </Sheet>
            )}
            {myTeam && (
              <div className="flex items-center gap-2 ml-2 border-l border-border pl-4">
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
                <span className="font-semibold text-foreground hidden sm:inline">{myTeam.team_name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            {/* Purse Remaining */}
            {myTeam && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-primary">
                  <IndianRupee className="h-4 w-4 md:h-6 md:w-6" />
                  <span className="text-xl md:text-3xl font-bold">{myTeam.purse_remaining}</span>
                  <span className="text-sm md:text-lg font-medium">CR</span>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Purse</p>
              </div>
            )}

            {/* Squad Size Progress */}
            {myTeam && (
              <div className="w-24 md:w-48 hidden xs:block">
                {(() => {
                  const playersCount = players.filter(p => p.winning_team_id === myTeam.id && p.status === "Sold").length
                  return (
                    <>
                      <div className="flex items-center justify-between text-[10px] md:text-sm mb-1">
                        <span className="text-muted-foreground">Squad</span>
                        <span className="font-semibold text-foreground">{playersCount}/20</span>
                      </div>
                      <Progress value={(playersCount / 20) * 100} className="h-1.5 md:h-2" />
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
                    <span className="hidden md:inline">Manage</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-[600px] md:max-w-[700px] bg-card border-l border-border">
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
                    {/* Search & Category Filter */}
                    <div className="space-y-4 mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or role..."
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          className="pl-10 bg-input border-border focus:border-primary"
                        />
                      </div>

                        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
                          <TabsList className="grid w-full grid-cols-5 bg-secondary/50 h-10 p-1">
                            <TabsTrigger value="All" className="text-xs">All</TabsTrigger>
                            <TabsTrigger value="Batter" className="text-xs">BAT</TabsTrigger>
                            <TabsTrigger value="Bowler" className="text-xs">BOWL</TabsTrigger>
                            <TabsTrigger value="Allrounder" className="text-xs">AR</TabsTrigger>
                            <TabsTrigger value="Wicketkeeper" className="text-xs">WK</TabsTrigger>
                          </TabsList>
                        </Tabs>
                    </div>

                    {/* Unsold Players Table */}
                    <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border/50 bg-background/50 flex flex-col">
                      <div className="p-3 border-b border-border/50 bg-secondary/30 flex items-center justify-between shrink-0">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {activeCategory === "All" ? "All Unsold" : `${activeCategory}s`} ({filteredPlayers.length})
                        </h4>
                        {playerSearch && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Filtered
                          </Badge>
                        )}
                      </div>
                      <ScrollArea className="flex-1 h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                            <TableRow className="border-border/50 hover:bg-transparent">
                              <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                              <TableHead className="text-muted-foreground text-xs hidden xs:table-cell">Role</TableHead>
                              <TableHead className="text-muted-foreground text-xs text-right">Base</TableHead>
                              <TableHead className="text-muted-foreground text-xs text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPlayers.length > 0 ? (
                              filteredPlayers.map((player) => (
                                <TableRow 
                                  key={player.id}
                                  className="border-border/30 hover:bg-secondary/30"
                                >
                                  <TableCell className="py-2">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-foreground text-sm truncate max-w-[120px] sm:max-w-none">
                                            {player.name}
                                          </span>
                                          {player.status === "Pending" && (
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-orange-500/50 text-orange-500">
                                              Pending
                                            </Badge>
                                          )}
                                        </div>
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span>{player.nationality}</span>
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                        <span className="font-semibold text-accent/80">{player.team}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-sm text-muted-foreground hidden xs:table-cell">
                                    {player.role}
                                  </TableCell>
                                  <TableCell className="py-2 text-right text-sm font-medium text-primary whitespace-nowrap">
                                    {player.base_price} CR
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <Button
                                      size="sm"
                                      onClick={() => handleBringToHammer(player)}
                                      className="h-8 px-3 text-xs font-semibold bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm shadow-accent/20"
                                    >
                                      <Play className="h-3 w-3 mr-1.5" />
                                      Bring to Hammer
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                  No {activeCategory.toLowerCase()}s found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    {/* Control Buttons */}
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <Button
                        variant="destructive"
                        onClick={handleForceSell}
                        disabled={auctionStatus === "Completed"}
                        className="w-full h-12 font-bold text-base gap-2 bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/25"
                      >
                        <AlertTriangle className="h-5 w-5" />
                        Force Sell / End Bid
                      </Button>

                      <Button
                        variant="outline"
                        onClick={handleResetUnsold}
                        disabled={auctionStatus === "Completed"}
                        className="w-full h-12 font-bold text-base gap-2 border-orange-500/50 hover:bg-orange-500/10 text-orange-500 shadow-lg shadow-orange-900/10"
                      >
                        <Zap className="h-5 w-5" />
                        Reset Unsold Players (Accelerated Round)
                      </Button>
                      {auctionStatus !== "Completed" ? (
                        <Button
                          variant="outline"
                          onClick={handleEndAuction}
                          className="w-full h-12 font-bold text-base gap-2 border-red-500/50 hover:bg-red-500/10 text-red-500"
                        >
                          <Power className="h-5 w-5" />
                          End Full Auction
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          onClick={handleExportCSV}
                          className="w-full h-12 font-bold text-base gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20"
                        >
                          <Download className="h-5 w-5" />
                          Download Final Results (CSV)
                        </Button>
                      )}
                      
                      <p className="text-xs text-muted-foreground text-center">
                        {auctionStatus === "Completed" 
                          ? "Auction is closed. You can now export the data."
                          : "Manage current player and overall auction status."}
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
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left Column - Competition Table */}
        <div className="lg:w-80 shrink-0 flex flex-col">
          <Card className="flex-1 border-border/50 bg-card/80 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-accent" />
                Competition
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
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
                                <span className="text-xs font-medium hidden xl:inline truncate max-w-[80px]">
                                  {team.team_name}
                                </span>
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
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto lg:overflow-visible">
          {/* Active Player Card */}
          <Card className="border-border/50 bg-card/80 shrink-0">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                {/* Player Image Placeholder */}
                <div className="w-24 h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 rounded-xl bg-secondary/50 border-2 border-border flex items-center justify-center shrink-0">
                  <User className="h-10 w-10 md:h-16 md:w-16 text-muted-foreground" />
                </div>
                
                {/* Player Info */}
                <div className="flex-1 text-center md:text-left min-w-0">
                  <Badge variant="outline" className="mb-2 border-accent text-accent">
                    {activePlayer ? "Active Player" : "Waiting for Player..."}
                  </Badge>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 truncate">
                    {activePlayer ? activePlayer.name : "Ready to Start"}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
                    <Badge className="bg-secondary text-secondary-foreground">
                      <Globe className="h-3 w-3 mr-1" /> {activePlayer ? activePlayer.nationality : "-"}
                    </Badge>
                    <Badge className="bg-secondary text-secondary-foreground">
                      <Target className="h-3 w-3 mr-1" /> {activePlayer ? activePlayer.role : "-"}
                    </Badge>
                    {activePlayer?.team && (
                      <Badge className="bg-accent/10 text-accent border border-accent/30 font-bold">
                        <Trophy className="h-3 w-3 mr-1" /> {activePlayer.team}
                      </Badge>
                    )}
                    <Badge className="bg-primary/20 text-primary border border-primary/30">
                      Base: {activePlayer ? activePlayer.base_price : 0} CR
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Bid Display */}
          <Card className="border-primary/30 bg-card/80 overflow-hidden relative shrink-0">
            <div className="absolute inset-0 bg-primary/5" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="text-center">
                <p className="text-muted-foreground text-xs md:text-sm mb-1 md:mb-2">Current Bid</p>
                <div className="flex items-center justify-center gap-2 mb-1 md:mb-2">
                  <IndianRupee className="h-8 w-8 md:h-10 md:w-10 text-neon-green drop-shadow-[0_0_10px_rgba(128,255,128,0.5)]" />
                  <span className="text-5xl md:text-6xl lg:text-7xl font-black text-neon-green drop-shadow-[0_0_20px_rgba(128,255,128,0.4)]">
                    {activePlayer ? (activePlayer.current_bid || activePlayer.base_price) : 0}
                  </span>
                  <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-neon-green">CR</span>
                </div>
                <p className="text-sm md:text-lg truncate px-4">
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
          <div className="flex items-center gap-4 shrink-0 px-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Progress 
                value={(countdown / 30) * 100} 
                className={`h-2 md:h-3 ${countdown <= 10 ? '[&>div]:bg-destructive' : '[&>div]:bg-neon-cyan'}`}
              />
            </div>
            <span className={`text-lg md:text-xl font-bold tabular-nums min-w-[3ch] ${countdown <= 10 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
              {countdown}s
            </span>
          </div>

          {/* Bid Controls */}
          <Card className="border-border/50 bg-card/80 shrink-0">
            <CardContent className="p-3 md:p-4">
              <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 md:gap-3">
                <Button 
                  onClick={() => handleQuickBid("+20L")}
                  variant="secondary"
                  disabled={activePlayer?.winning_team_id === myTeam?.id}
                  className="h-10 md:h-12 font-bold text-base md:text-lg bg-secondary hover:bg-secondary/80 border border-primary/30 hover:border-primary transition-colors disabled:opacity-50"
                >
                  {activePlayer?.winning_team_id === myTeam?.id ? "Winning..." : "+20L"}
                </Button>
                <Button 
                  onClick={() => handleQuickBid("+50L")}
                  variant="secondary"
                  disabled={activePlayer?.winning_team_id === myTeam?.id}
                  className="h-10 md:h-12 font-bold text-base md:text-lg bg-secondary hover:bg-secondary/80 border border-primary/30 hover:border-primary transition-colors disabled:opacity-50"
                >
                  {activePlayer?.winning_team_id === myTeam?.id ? "Winning..." : "+50L"}
                </Button>
                <Button 
                  onClick={() => handleQuickBid("+1CR")}
                  variant="secondary"
                  disabled={activePlayer?.winning_team_id === myTeam?.id}
                  className="h-10 md:h-12 font-bold text-base md:text-lg bg-secondary hover:bg-secondary/80 border border-accent/30 hover:border-accent transition-colors disabled:opacity-50"
                >
                  {activePlayer?.winning_team_id === myTeam?.id ? "Winning..." : "+1CR"}
                </Button>
                <div className="col-span-3 flex items-center gap-2 flex-1 min-w-0 mt-2 sm:mt-0">
                  <Input
                    type="number"
                    placeholder="Custom"
                    value={bidInput}
                    onChange={(e) => setBidInput(e.target.value)}
                    disabled={activePlayer?.winning_team_id === myTeam?.id}
                    className="h-10 md:h-12 bg-input border-border focus:border-primary disabled:opacity-50"
                  />
                  <Button 
                    onClick={handleSubmitBid}
                    disabled={activePlayer?.winning_team_id === myTeam?.id}
                    className="h-10 md:h-12 px-4 md:px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 disabled:bg-primary/50 whitespace-nowrap"
                  >
                    <Gavel className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    <span className="hidden xs:inline">{activePlayer?.winning_team_id === myTeam?.id ? "Winning..." : "Submit Bid"}</span>
                    <span className="xs:hidden">Bid</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Social & Logs */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-4">
          {/* Bid History */}
          <Card className="flex-1 border-border/50 bg-card/80 flex flex-col overflow-hidden min-h-[150px]">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gavel className="h-5 w-5 text-primary" />
                Bid History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
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
                  {bidHistory.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">No bids yet</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Live Chat */}
          <Card className="flex-1 border-border/50 bg-card/80 flex flex-col overflow-hidden min-h-[250px]">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-accent" />
                Live Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
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
              <div className="p-3 border-t border-border/50 shrink-0">
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
      <Toaster />
    </main>
  )
}
