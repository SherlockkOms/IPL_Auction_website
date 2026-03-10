"use server"

import { supabase } from "@/lib/supabase"
import { redirect } from "next/navigation"
import Papa from "papaparse"
import { defaultPlayers } from "@/lib/defaultPlayers"

const IPL_TEAMS = [
  { name: "Chennai Super Kings", short: "CSK" },
  { name: "Mumbai Indians", short: "MI" },
  { name: "Royal Challengers Bangalore", short: "RCB" },
  { name: "Kolkata Knight Riders", short: "KKR" },
  { name: "Delhi Capitals", short: "DC" },
  { name: "Punjab Kings", short: "PBKS" },
  { name: "Rajasthan Royals", short: "RR" },
  { name: "Sunrisers Hyderabad", short: "SRH" },
  { name: "Gujarat Titans", short: "GT" },
  { name: "Lucknow Super Giants", short: "LSG" },
]

export async function createAuction(formData: FormData) {
  const rules = JSON.parse(formData.get("rules") as string)
  const csvFile = formData.get("csvFile") as File | null

  // 1. Generate random 6-letter room code
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 2. Create auction
  const { data: auction, error: auctionError } = await supabase
    .from("auctions")
    .insert({
      room_code: roomCode,
      rules: rules,
      status: "Lobby"
    })
    .select()
    .single()

  if (auctionError) {
    console.error("Auction Error:", auctionError)
    throw new Error("Failed to create auction")
  }

  // 3. Pre-populate teams
  const teamsToInsert = IPL_TEAMS.map(team => ({
    auction_id: auction.id,
    team_name: team.name,
    purse_remaining: rules.totalPurse,
    is_ready: false
  }))

  const { error: teamsError } = await supabase
    .from("teams")
    .insert(teamsToInsert)

  if (teamsError) {
    console.error("Teams Error:", teamsError)
    throw new Error("Failed to pre-populate teams")
  }

  // 4. Handle Players (CSV or Defaults)
  let playersToInsert = []

  if (csvFile && csvFile.size > 0) {
    const csvText = await csvFile.text()
    const parsedData = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    })

    playersToInsert = (parsedData.data as any[]).map(row => ({
      auction_id: auction.id,
      name: row.Name,
      nationality: row.Nationality,
      role: row.Role,
      team: row.Team,
      base_price: parseFloat(row["Base Price"]) || 0,
      status: "Unsold"
    }))
  } else {
    // Use Defaults
    playersToInsert = defaultPlayers.map(p => ({
      auction_id: auction.id,
      name: p.name,
      nationality: p.nationality,
      role: p.role,
      team: p.team,
      base_price: p.base_price,
      status: "Unsold"
    }))
  }

  const { error: playersError } = await supabase
    .from("players")
    .insert(playersToInsert)

  if (playersError) {
    console.error("Players Error:", playersError)
    throw new Error("Failed to insert players")
  }

  return { roomCode }
}

export async function startAuction(auctionId: string) {
  const { error } = await supabase
    .from("auctions")
    .update({ status: "Active" })
    .eq("id", auctionId)

  if (error) {
    throw new Error("Failed to start auction")
  }
}

export async function joinAuction(roomCode: string) {
  const { data: auction, error } = await supabase
    .from("auctions")
    .select("id, room_code, status")
    .eq("room_code", roomCode)
    .single()

  if (error || !auction) {
    throw new Error("Invalid room code")
  }

  return auction
}

export async function claimTeam(teamId: string, managerName: string) {
  const { data, error } = await supabase
    .from("teams")
    .update({ manager_name: managerName })
    .eq("id", teamId)
    .select()
    .single()

  if (error) {
    console.error("Claim Team Error:", error)
    throw new Error("Failed to claim team")
  }

  return data
}

export async function toggleReady(teamId: string, isReady: boolean) {
  const { data, error } = await supabase
    .from("teams")
    .update({ is_ready: isReady })
    .eq("id", teamId)
    .select()
    .single()

  if (error) {
    throw new Error("Failed to update ready status")
  }

  return data
}

export async function bringToHammer(auctionId: string, playerId: string) {
  // 1. Reset any currently active player to 'Unsold'
  await supabase
    .from("players")
    .update({ status: "Unsold" })
    .eq("auction_id", auctionId)
    .eq("status", "Active")

  // 2. Set the new player to 'Active' AND reset their bid state
  const { data, error } = await supabase
    .from("players")
    .update({ 
      status: "Active",
      current_bid: 0,
      winning_team_id: null 
    })
    .eq("id", playerId)
    .select()
    .single()

  if (error) {
    throw new Error("Failed to bring player to hammer")
  }

  return data
}

export async function placeBid(playerId: string, teamId: string, bidAmount: number) {
  const incomingBid = Number(bidAmount);

  // 1. Fetch current player state
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("base_price, current_bid, status, auction_id")
    .eq("id", playerId)
    .single();

  if (playerError || !player) throw new Error("Player not found");
  if (player.status !== "Active") throw new Error("This player is no longer active");

  // 2. Safe Math & Logic
  const currentDbBid = player.current_bid === null ? 0 : Number(player.current_bid);
  const basePrice = Number(player.base_price);

  console.log('Processed Bid:', { incomingBid, currentDbBid, basePrice });

  // Logical Validation
  if (incomingBid <= currentDbBid) {
    throw new Error(`Bid must be higher than current bid (${currentDbBid} CR)`);
  }
  if (currentDbBid === 0 && incomingBid < basePrice) {
    throw new Error(`Opening bid must be at least the base price (${basePrice} CR)`);
  }

  // 3. Fetch team's purse
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("purse_remaining")
    .eq("id", teamId)
    .single();

  if (teamError || !team) throw new Error("Team not found");
  if (incomingBid > Number(team.purse_remaining)) throw new Error("Insufficient purse remaining!");

  // 4. Compare-and-Swap Update
  // We lock the update to the exact current_bid value we fetched.
  // If it changed between the fetch and this call, the update will fail.
  let query = supabase
    .from("players")
    .update({
      current_bid: incomingBid,
      winning_team_id: teamId
    })
    .eq("id", playerId)
    .eq("status", "Active");

  if (player.current_bid === null) {
    query = query.is("current_bid", null);
  } else {
    query = query.eq("current_bid", player.current_bid);
  }

  const { data: updatedPlayer, error: updateError } = await query.select().single();

  if (updateError || !updatedPlayer) {
    console.error("CAS Update Failed:", updateError);
    throw new Error("Bid was too slow! Someone else already updated the price.");
  }

  // 5. Log to history on success
  const { error: historyError } = await supabase
    .from("bid_history")
    .insert({
      auction_id: player.auction_id,
      player_id: playerId,
      team_id: teamId,
      amount: incomingBid
    });

  if (historyError) {
    console.error("Bid History Supabase Error:", historyError);
  }

  return updatedPlayer;
}

export async function sellPlayer(playerId: string) {
  // 1. Fetch player
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single()

  if (playerError || !player) throw new Error("Player not found")
  if (player.status !== "Active") throw new Error("Player is not active")
  
  if (!player.winning_team_id || !player.current_bid) {
    // No one bid, reset to Unsold
    await supabase.from("players").update({ status: "Unsold", current_bid: 0, winning_team_id: null }).eq("id", playerId)
    return
  }

  // 2. Update player to Sold
  const { error: updatePlayerError } = await supabase
    .from("players")
    .update({ status: "Sold" })
    .eq("id", playerId)

  if (updatePlayerError) throw new Error("Failed to sell player")

  // 3. Subtract from team purse
  const { data: team, error: teamFetchError } = await supabase
    .from("teams")
    .select("purse_remaining")
    .eq("id", player.winning_team_id)
    .single()

  if (teamFetchError || !team) {
    console.error("Team fetch error during sale:", teamFetchError)
    return
  }

  const currentPurse = Number(team.purse_remaining)
  const finalPrice = Number(player.current_bid)
  const newPurse = Number((currentPurse - finalPrice).toFixed(2))

  console.log(`Finalizing Sale: Team ${player.winning_team_id} bought ${player.name} for ${finalPrice}. New Purse: ${newPurse}`)

  const { error: purseUpdateError } = await supabase
    .from("teams")
    .update({ purse_remaining: newPurse })
    .eq("id", player.winning_team_id)

  if (purseUpdateError) {
    console.error("Purse Update Failed:", purseUpdateError)
  }
}

export async function sendChat(auctionId: string, teamName: string, message: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      auction_id: auctionId,
      team_name: teamName,
      message: message
    })
    .select()
    .single()

  if (error) throw new Error("Failed to send message")
  return data
}
