const CLANS = [
  { name: "CookHouse", members: 12, pnl: "+$4.1M", color: "#f97316", initials: "CH" },
  { name: "Dabal", members: 8, pnl: "+$2.8M", color: "#8b5cf6", initials: "DB" },
  { name: "AlphaDesk", members: 15, pnl: "+$1.9M", color: "#06b6d4", initials: "AD" },
  { name: "BridgeRun", members: 6, pnl: "+$980K", color: "#22c55e", initials: "BR" },
];

const LEADERBOARD = [
  { rank: 1, name: "unipcs", handle: "@unipcs", pnl: "+$4,811,629", avatar: "U" },
  { rank: 2, name: "orangie", handle: "@orangie", pnl: "+$2,276,663", avatar: "O" },
  { rank: 3, name: "kreo", handle: "@kreo", pnl: "+$1,826,795", avatar: "K" },
  { rank: 4, name: "Dentoshi", handle: "@Dentoshi", pnl: "+$1,610,355", avatar: "D" },
  { rank: 5, name: "clukz", handle: "@clukz", pnl: "+$1,391,350", avatar: "C" },
];

const HOLDERS = [
  {
    name: "Cooker.hl",
    handle: "@Cooker",
    badge: "Team",
    position: "74,349.49",
    pnlPct: "+13.5%",
    pnlUsd: "+$9,326.61",
    avgEntry: "$0.111",
    thesis: "Strong momentum after breakout",
  },
  {
    name: "unipcs",
    handle: "@unipcs",
    position: "52,120.00",
    pnlPct: "+22.1%",
    pnlUsd: "+$7,104.22",
    avgEntry: "$0.098",
    thesis: "Accumulating on dips",
  },
  {
    name: "orangie",
    handle: "@orangie",
    position: "31,880.12",
    pnlPct: "+8.4%",
    pnlUsd: "+$2,411.08",
    avgEntry: "$0.105",
    thesis: "Swing trade setup",
  },
  {
    name: "kreo",
    handle: "@kreo",
    position: "18,440.77",
    pnlPct: "+5.2%",
    pnlUsd: "+$991.44",
    avgEntry: "$0.109",
    thesis: "Bridge rotation play",
  },
];

const TICKER = [
  { symbol: "BTC", price: "$84,221", change: "+2.31%", up: true },
  { symbol: "ETH", price: "$2,241", change: "+1.84%", up: true },
  { symbol: "SOL", price: "$132.12", change: "-0.42%", up: false },
  { symbol: "BNB", price: "$612.40", change: "+0.91%", up: true },
  { symbol: "USDT", price: "$1.00", change: "+0.01%", up: true },
];

export { CLANS, HOLDERS, LEADERBOARD, TICKER };
