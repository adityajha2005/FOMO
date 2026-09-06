const CLANS = [
  {
    id: "mock-cookhouse",
    name: "CookHouse",
    members: 12,
    pnl: "+$4.1M",
    pnlRaw: 4_100_000,
    avatarUrl: null,
    initials: "CH",
  },
  {
    id: "mock-dabal",
    name: "Dabal",
    members: 8,
    pnl: "+$2.8M",
    pnlRaw: 2_800_000,
    avatarUrl: null,
    initials: "DB",
  },
  {
    id: "mock-alphadesk",
    name: "AlphaDesk",
    members: 15,
    pnl: "+$1.9M",
    pnlRaw: 1_900_000,
    avatarUrl: null,
    initials: "AD",
  },
  {
    id: "mock-bridgerun",
    name: "BridgeRun",
    members: 6,
    pnl: "+$980K",
    pnlRaw: 980_000,
    avatarUrl: null,
    initials: "BR",
  },
];

const LEADERBOARD = [
  {
    id: "mock-unipcs",
    rank: 1,
    name: "unipcs",
    handle: "@unipcs",
    pnl: "+$4,811,629",
    pnlRaw: 4_811_629,
    avatarUrl: null,
    initials: "U",
  },
  {
    id: "mock-orangie",
    rank: 2,
    name: "orangie",
    handle: "@orangie",
    pnl: "+$2,276,663",
    pnlRaw: 2_276_663,
    avatarUrl: null,
    initials: "O",
  },
  {
    id: "mock-kreo",
    rank: 3,
    name: "kreo",
    handle: "@kreo",
    pnl: "+$1,826,795",
    pnlRaw: 1_826_795,
    avatarUrl: null,
    initials: "K",
  },
  {
    id: "mock-dentoshi",
    rank: 4,
    name: "Dentoshi",
    handle: "@Dentoshi",
    pnl: "+$1,610,355",
    pnlRaw: 1_610_355,
    avatarUrl: null,
    initials: "D",
  },
  {
    id: "mock-clukz",
    rank: 5,
    name: "clukz",
    handle: "@clukz",
    pnl: "+$1,391,350",
    pnlRaw: 1_391_350,
    avatarUrl: null,
    initials: "C",
  },
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

const TRENDING_TOKENS = [
  { symbol: "PONS", name: "Pons", price: "$0.934", change: "+12.98%", changePositive: true },
  { symbol: "BTC", name: "Bitcoin", price: "$84,221", change: "+2.31%", changePositive: true },
  { symbol: "ETH", name: "Ethereum", price: "$2,241", change: "+1.84%", changePositive: true },
  { symbol: "SOL", name: "Solana", price: "$132.12", change: "-0.42%", changePositive: false },
];

export { CLANS, HOLDERS, LEADERBOARD, TICKER, TRENDING_TOKENS };
