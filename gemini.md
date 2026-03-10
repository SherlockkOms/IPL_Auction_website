# Project Context: Live IPL Fantasy Auction Platform

## Tech Stack
* Frontend: Next.js (App Router), React, Tailwind CSS, shadcn/ui.
* Backend/Database: Supabase (PostgreSQL, Realtime WebSockets).
* CSV Parsing: Papaparse.

## Core Architecture & User Flow
This is a real-time multiplayer application with a strict 10-team IPL format.
1.  **Gateway (`/`):** Users choose to Host or Join.
2.  **Host Flow (Data Ingestion):** Admin sets rules (Total Purse, Squad Limits) and uploads a CSV of players (`Name, Nationality, Role, Team, Base Price`). The system generates a 6-letter `room_code`, saves the rules to `auctions`, and bulk-inserts the CSV into `players`. Admin is routed to `/live/[room_code]`.
3.  **Join Flow:** Player enters `room_code` -> Routes to Lobby -> Views 10 IPL franchises -> Claims an available team (updates `teams` table) -> Clicks Ready.
4.  **Live Dashboard (`/live/[room_code]`):** The main arena. Uses Supabase Realtime to broadcast bids and chat messages.
5.  **Auctioneer Controls:** Admin has a slide-out drawer to view `Unsold` players and click "Bring to Hammer" to change a player's status to `Active`, syncing the center stage for all 10 clients.

## Database Schema (Supabase)
1.  `auctions`: id (UUID), room_code (Text, unique), rules (JSON), status (Text), created_at.
2.  `teams`: id (UUID), auction_id (FK), team_name (Text), manager_name (Text), purse_remaining (Float), is_ready (Boolean).
3.  `players`: id (UUID), auction_id (FK), name (Text), nationality (Text), role (Text), team (Text), base_price (Float), current_bid (Float), winning_team_id (FK), status (Text: Unsold/Active/Sold).
4.  `chat_messages`: id (UUID), auction_id (FK), team_name (Text), message (Text), created_at.

## Development Rules for AI
* Always use `@supabase/supabase-js`. 
* Ensure all code is strictly typed TypeScript.
* Use Next.js Server Actions for secure database writes (creating rooms, joining).
* Use Supabase Realtime (WebSockets) on the client side for the live bidding, player status changes, and chat to ensure zero-latency updates.
* When evaluating bids, validate against the team's `purse_remaining` and squad limits defined in the `auctions` table rules.