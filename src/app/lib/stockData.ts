export interface StockQuote {
  symbol: string
  name: string
  sector?: string
  price: number
  change: number
  changePercent: number
  open: number
  high: number
  low: number
  prevClose: number
  volume: number
  avgVolume: number
  marketCap?: number
  pe?: number
  forwardPe?: number
  eps?: number
  beta?: number
  dividendYield?: number
  dividendAmount?: number
  week52High?: number
  week52Low?: number
  floatShares?: number
  shortRatio?: number
  shortFloat?: number
  analystRating?: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
  priceTarget?: number
  history: {
    timestamp: number
    time: string
    price: number
    volume: number
    open?: number
    high?: number
    low?: number
  }[]
}

export type ChartTimeframe = '5m' | '15m' | '1h' | '1d'
export interface StockChoice {
  symbol: string
  name: string
}

const MOCK_BASE: Omit<StockQuote, 'history'>[] = [
  // TECH
  { symbol: 'AAPL',  name: 'Apple Inc.',            sector: 'Technology',     price: 189.30, change: 2.14,  changePercent: 1.14,  open: 187.50, high: 190.10, low: 186.90, prevClose: 187.16, volume: 54_230_000, avgVolume: 58_100_000, marketCap: 2_940_000_000_000, pe: 31.2, forwardPe: 28.4, eps: 6.07,  beta: 1.24, dividendYield: 0.51, dividendAmount: 0.96,  week52High: 199.62, week52Low: 164.08, floatShares: 15_440_000_000, shortRatio: 1.2, shortFloat: 0.71, analystRating: 'Buy',        priceTarget: 210 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',        sector: 'Technology',     price: 415.80, change: -1.20, changePercent: -0.29, open: 417.00, high: 418.50, low: 414.20, prevClose: 417.00, volume: 22_100_000, avgVolume: 24_800_000, marketCap: 3_090_000_000_000, pe: 36.8, forwardPe: 31.2, eps: 11.30, beta: 0.90, dividendYield: 0.73, dividendAmount: 3.00,  week52High: 468.35, week52Low: 362.90, floatShares: 7_430_000_000,  shortRatio: 1.8, shortFloat: 0.54, analystRating: 'Strong Buy', priceTarget: 470 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',          sector: 'Technology',     price: 172.45, change: 3.22,  changePercent: 1.90,  open: 169.30, high: 173.10, low: 168.80, prevClose: 169.23, volume: 18_400_000, avgVolume: 22_300_000, marketCap: 2_140_000_000_000, pe: 24.1, forwardPe: 20.3, eps: 7.15,  beta: 1.06, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 208.70, week52Low: 155.63, floatShares: 12_200_000_000, shortRatio: 1.5, shortFloat: 0.82, analystRating: 'Strong Buy', priceTarget: 215 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',           sector: 'Technology',     price: 875.40, change: 22.30, changePercent: 2.62,  open: 853.00, high: 879.20, low: 851.10, prevClose: 853.10, volume: 41_800_000, avgVolume: 45_600_000, marketCap: 2_160_000_000_000, pe: 68.4, forwardPe: 38.1, eps: 12.80, beta: 1.72, dividendYield: 0.03, dividendAmount: 0.16,  week52High: 974.00, week52Low: 461.20, floatShares: 2_460_000_000,  shortRatio: 1.0, shortFloat: 1.12, analystRating: 'Strong Buy', priceTarget: 1050 },
  { symbol: 'META',  name: 'Meta Platforms',         sector: 'Technology',     price: 512.60, change: 8.90,  changePercent: 1.77,  open: 503.70, high: 514.30, low: 502.80, prevClose: 503.70, volume: 15_300_000, avgVolume: 18_200_000, marketCap: 1_300_000_000_000, pe: 27.3, forwardPe: 22.1, eps: 18.78, beta: 1.21, dividendYield: 0.40, dividendAmount: 2.00,  week52High: 602.95, week52Low: 414.50, floatShares: 2_540_000_000,  shortRatio: 1.3, shortFloat: 0.65, analystRating: 'Strong Buy', priceTarget: 620 },
  { symbol: 'TSLA',  name: 'Tesla Inc.',             sector: 'Consumer Disc.', price: 248.50, change: -6.40, changePercent: -2.51, open: 254.90, high: 255.80, low: 246.20, prevClose: 254.90, volume: 89_500_000, avgVolume: 102_000_000,marketCap: 793_000_000_000,  pe: 62.1, forwardPe: 44.8, eps: 4.00,  beta: 2.31, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 300.00, week52Low: 138.80, floatShares: 3_160_000_000,  shortRatio: 0.9, shortFloat: 3.20, analystRating: 'Hold',       priceTarget: 235 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',        sector: 'Consumer Disc.', price: 198.70, change: -0.85, changePercent: -0.43, open: 199.55, high: 200.20, low: 197.30, prevClose: 199.55, volume: 28_700_000, avgVolume: 35_400_000, marketCap: 2_090_000_000_000, pe: 60.2, forwardPe: 36.5, eps: 3.30,  beta: 1.17, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 242.52, week52Low: 161.02, floatShares: 10_400_000_000, shortRatio: 1.1, shortFloat: 0.60, analystRating: 'Strong Buy', priceTarget: 250 },
  { symbol: 'AMD',   name: 'Advanced Micro Devices', sector: 'Technology',     price: 162.30, change: 4.10,  changePercent: 2.59,  open: 158.20, high: 163.40, low: 157.80, prevClose: 158.20, volume: 38_200_000, avgVolume: 44_100_000, marketCap: 262_000_000_000,  pe: 287.0,forwardPe: 24.6, eps: 0.57,  beta: 1.65, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 227.30, week52Low: 144.20, floatShares: 1_600_000_000,  shortRatio: 1.4, shortFloat: 2.10, analystRating: 'Buy',        priceTarget: 210 },
  { symbol: 'INTC',  name: 'Intel Corp.',            sector: 'Technology',     price: 31.20,  change: -0.45, changePercent: -1.42, open: 31.65,  high: 31.90,  low: 30.95,  prevClose: 31.65,  volume: 42_100_000, avgVolume: 50_300_000, marketCap: 132_000_000_000,  pe: undefined, forwardPe: 22.3, eps: -4.22, beta: 1.02, dividendYield: 2.56, dividendAmount: 0.50, week52High: 51.28,  week52Low: 18.84,  floatShares: 4_270_000_000,  shortRatio: 2.1, shortFloat: 4.50, analystRating: 'Hold',       priceTarget: 30 },
  { symbol: 'CRM',   name: 'Salesforce Inc.',        sector: 'Technology',     price: 298.40, change: 1.80,  changePercent: 0.61,  open: 296.60, high: 299.80, low: 295.40, prevClose: 296.60, volume: 4_800_000,  avgVolume: 6_100_000,  marketCap: 288_000_000_000,  pe: 48.2, forwardPe: 26.4, eps: 6.19,  beta: 1.31, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 369.00, week52Low: 212.00, floatShares: 960_000_000,    shortRatio: 2.6, shortFloat: 1.30, analystRating: 'Buy',        priceTarget: 340 },
  { symbol: 'NFLX',  name: 'Netflix Inc.',           sector: 'Technology',     price: 628.50, change: 9.30,  changePercent: 1.50,  open: 619.20, high: 630.80, low: 618.00, prevClose: 619.20, volume: 4_100_000,  avgVolume: 5_200_000,  marketCap: 272_000_000_000,  pe: 46.2, forwardPe: 34.8, eps: 13.60, beta: 1.28, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 741.00, week52Low: 480.00, floatShares: 431_000_000,    shortRatio: 1.8, shortFloat: 1.80, analystRating: 'Buy',        priceTarget: 720 },
  { symbol: 'UBER',  name: 'Uber Technologies',      sector: 'Technology',     price: 74.60,  change: 1.40,  changePercent: 1.91,  open: 73.20,  high: 75.10,  low: 72.90,  prevClose: 73.20,  volume: 16_200_000, avgVolume: 19_400_000, marketCap: 157_000_000_000,  pe: 28.4, forwardPe: 20.6, eps: 2.63,  beta: 1.42, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 87.00,  week52Low: 56.81,  floatShares: 2_100_000_000,  shortRatio: 1.7, shortFloat: 1.90, analystRating: 'Strong Buy', priceTarget: 95 },
  { symbol: 'SHOP',  name: 'Shopify Inc.',           sector: 'Technology',     price: 86.20,  change: 2.40,  changePercent: 2.86,  open: 83.80,  high: 86.80,  low: 83.50,  prevClose: 83.80,  volume: 7_400_000,  avgVolume: 9_100_000,  marketCap: 111_000_000_000,  pe: 82.5, forwardPe: 48.3, eps: 1.05,  beta: 1.83, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 109.88, week52Low: 50.33,  floatShares: 1_290_000_000,  shortRatio: 1.2, shortFloat: 2.80, analystRating: 'Buy',        priceTarget: 110 },
  // FINANCIALS
  { symbol: 'JPM',   name: 'JPMorgan Chase',         sector: 'Financials',     price: 220.40, change: -1.60, changePercent: -0.72, open: 222.00, high: 222.50, low: 219.80, prevClose: 222.00, volume: 9_800_000,  avgVolume: 11_200_000, marketCap: 635_000_000_000,  pe: 12.8, forwardPe: 11.4, eps: 17.22, beta: 1.11, dividendYield: 2.27, dividendAmount: 5.00,  week52High: 260.00, week52Low: 183.29, floatShares: 2_880_000_000,  shortRatio: 2.0, shortFloat: 0.50, analystRating: 'Buy',        priceTarget: 250 },
  { symbol: 'BAC',   name: 'Bank of America',        sector: 'Financials',     price: 43.80,  change: -0.30, changePercent: -0.68, open: 44.10,  high: 44.30,  low: 43.60,  prevClose: 44.10,  volume: 38_400_000, avgVolume: 42_000_000, marketCap: 346_000_000_000,  pe: 14.6, forwardPe: 11.8, eps: 3.00,  beta: 1.39, dividendYield: 2.28, dividendAmount: 1.00,  week52High: 47.08,  week52Low: 31.56,  floatShares: 7_860_000_000,  shortRatio: 2.2, shortFloat: 0.70, analystRating: 'Buy',        priceTarget: 50 },
  { symbol: 'GS',    name: 'Goldman Sachs',          sector: 'Financials',     price: 548.20, change: 3.40,  changePercent: 0.62,  open: 544.80, high: 550.10, low: 543.20, prevClose: 544.80, volume: 2_100_000,  avgVolume: 2_500_000,  marketCap: 184_000_000_000,  pe: 15.2, forwardPe: 12.6, eps: 36.06, beta: 1.36, dividendYield: 2.19, dividendAmount: 12.00, week52High: 601.00, week52Low: 389.58, floatShares: 325_000_000,    shortRatio: 3.1, shortFloat: 0.90, analystRating: 'Buy',        priceTarget: 610 },
  { symbol: 'V',     name: 'Visa Inc.',              sector: 'Financials',     price: 295.80, change: 0.90,  changePercent: 0.30,  open: 294.90, high: 296.40, low: 293.50, prevClose: 294.90, volume: 6_100_000,  avgVolume: 7_300_000,  marketCap: 599_000_000_000,  pe: 32.5, forwardPe: 27.2, eps: 9.10,  beta: 0.93, dividendYield: 0.81, dividendAmount: 2.40,  week52High: 316.49, week52Low: 252.70, floatShares: 2_020_000_000,  shortRatio: 2.8, shortFloat: 0.62, analystRating: 'Strong Buy', priceTarget: 340 },
  { symbol: 'MA',    name: 'Mastercard Inc.',        sector: 'Financials',     price: 488.60, change: 2.10,  changePercent: 0.43,  open: 486.50, high: 490.20, low: 485.80, prevClose: 486.50, volume: 3_200_000,  avgVolume: 3_800_000,  marketCap: 460_000_000_000,  pe: 36.8, forwardPe: 30.1, eps: 13.28, beta: 1.07, dividendYield: 0.57, dividendAmount: 2.76,  week52High: 537.37, week52Low: 415.11, floatShares: 935_000_000,    shortRatio: 2.5, shortFloat: 0.55, analystRating: 'Strong Buy', priceTarget: 560 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway',    sector: 'Financials',     price: 434.20, change: 1.10,  changePercent: 0.25,  open: 433.10, high: 435.80, low: 432.40, prevClose: 433.10, volume: 3_200_000,  avgVolume: 3_900_000,  marketCap: 952_000_000_000,  pe: 21.4, forwardPe: 19.8, eps: 20.30, beta: 0.88, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 454.87, week52Low: 352.00, floatShares: 2_190_000_000,  shortRatio: 3.0, shortFloat: 0.30, analystRating: 'Buy',        priceTarget: 480 },
  { symbol: 'PYPL',  name: 'PayPal Holdings',        sector: 'Financials',     price: 68.40,  change: -1.20, changePercent: -1.72, open: 69.60,  high: 69.90,  low: 68.10,  prevClose: 69.60,  volume: 9_800_000,  avgVolume: 12_400_000, marketCap: 71_400_000_000,   pe: 17.4, forwardPe: 11.2, eps: 3.93,  beta: 1.50, dividendYield: 0.00, dividendAmount: 0.00,  week52High: 90.27,  week52Low: 57.87,  floatShares: 1_040_000_000,  shortRatio: 2.0, shortFloat: 3.40, analystRating: 'Hold',       priceTarget: 80 },
  // HEALTHCARE
  { symbol: 'JNJ',   name: 'Johnson & Johnson',      sector: 'Healthcare',     price: 147.20, change: -0.80, changePercent: -0.54, open: 148.00, high: 148.40, low: 146.90, prevClose: 148.00, volume: 7_600_000,  avgVolume: 9_100_000,  marketCap: 353_000_000_000,  pe: 22.3, forwardPe: 14.8, eps: 6.60,  beta: 0.54, dividendYield: 3.26, dividendAmount: 4.80,  week52High: 168.85, week52Low: 143.13, floatShares: 2_400_000_000,  shortRatio: 3.2, shortFloat: 0.80, analystRating: 'Hold',       priceTarget: 165 },
  { symbol: 'UNH',   name: 'UnitedHealth Group',     sector: 'Healthcare',     price: 492.30, change: 5.60,  changePercent: 1.15,  open: 486.70, high: 493.80, low: 485.50, prevClose: 486.70, volume: 3_400_000,  avgVolume: 4_100_000,  marketCap: 454_000_000_000,  pe: 20.4, forwardPe: 17.6, eps: 24.14, beta: 0.59, dividendYield: 1.54, dividendAmount: 7.52,  week52High: 630.73, week52Low: 430.00, floatShares: 923_000_000,    shortRatio: 2.9, shortFloat: 1.10, analystRating: 'Buy',        priceTarget: 590 },
  { symbol: 'LLY',   name: 'Eli Lilly and Co.',      sector: 'Healthcare',     price: 812.40, change: 14.20, changePercent: 1.78,  open: 798.20, high: 815.60, low: 796.40, prevClose: 798.20, volume: 2_800_000,  avgVolume: 3_300_000,  marketCap: 771_000_000_000,  pe: 112.4,forwardPe: 42.6, eps: 7.23,  beta: 0.44, dividendYield: 0.72, dividendAmount: 5.20,  week52High: 972.53, week52Low: 673.54, floatShares: 948_000_000,    shortRatio: 1.6, shortFloat: 0.80, analystRating: 'Strong Buy', priceTarget: 1000 },
  { symbol: 'PFE',   name: 'Pfizer Inc.',            sector: 'Healthcare',     price: 28.40,  change: -0.20, changePercent: -0.70, open: 28.60,  high: 28.75,  low: 28.20,  prevClose: 28.60,  volume: 28_900_000, avgVolume: 35_200_000, marketCap: 161_000_000_000,  pe: undefined, forwardPe: 10.2, eps: -0.42, beta: 0.62, dividendYield: 6.62, dividendAmount: 1.68, week52High: 31.54,  week52Low: 25.20,  floatShares: 5_670_000_000,  shortRatio: 3.6, shortFloat: 1.20, analystRating: 'Hold',       priceTarget: 32 },
  // CONSUMER
  { symbol: 'WMT',   name: 'Walmart Inc.',           sector: 'Consumer Stap.', price: 85.60,  change: 0.40,  changePercent: 0.47,  open: 85.20,  high: 85.90,  low: 84.90,  prevClose: 85.20,  volume: 14_200_000, avgVolume: 16_800_000, marketCap: 688_000_000_000,  pe: 33.4, forwardPe: 29.6, eps: 2.56,  beta: 0.52, dividendYield: 1.12, dividendAmount: 0.83,  week52High: 105.30, week52Low: 64.15,  floatShares: 8_040_000_000,  shortRatio: 3.8, shortFloat: 0.40, analystRating: 'Buy',        priceTarget: 100 },
  { symbol: 'KO',    name: 'Coca-Cola Co.',          sector: 'Consumer Stap.', price: 62.40,  change: 0.30,  changePercent: 0.48,  open: 62.10,  high: 62.60,  low: 61.90,  prevClose: 62.10,  volume: 12_600_000, avgVolume: 14_300_000, marketCap: 269_000_000_000,  pe: 23.2, forwardPe: 20.8, eps: 2.69,  beta: 0.56, dividendYield: 3.08, dividendAmount: 1.94,  week52High: 73.53,  week52Low: 58.55,  floatShares: 4_310_000_000,  shortRatio: 4.1, shortFloat: 0.50, analystRating: 'Hold',       priceTarget: 68 },
  { symbol: 'MCD',   name: "McDonald's Corp.",       sector: 'Consumer Disc.', price: 294.10, change: -1.20, changePercent: -0.41, open: 295.30, high: 295.80, low: 293.20, prevClose: 295.30, volume: 3_100_000,  avgVolume: 3_600_000,  marketCap: 213_000_000_000,  pe: 24.8, forwardPe: 22.1, eps: 11.86, beta: 0.72, dividendYield: 2.38, dividendAmount: 7.08,  week52High: 317.90, week52Low: 243.54, floatShares: 724_000_000,    shortRatio: 3.5, shortFloat: 0.90, analystRating: 'Buy',        priceTarget: 330 },
  { symbol: 'NKE',   name: 'Nike Inc.',              sector: 'Consumer Disc.', price: 74.20,  change: -1.80, changePercent: -2.37, open: 76.00,  high: 76.30,  low: 73.90,  prevClose: 76.00,  volume: 11_400_000, avgVolume: 10_200_000, marketCap: 113_000_000_000,  pe: 22.0, forwardPe: 19.4, eps: 3.38,  beta: 1.06, dividendYield: 2.16, dividendAmount: 1.40,  week52High: 115.19, week52Low: 70.75,  floatShares: 1_520_000_000,  shortRatio: 2.7, shortFloat: 2.30, analystRating: 'Hold',       priceTarget: 90 },
  { symbol: 'DIS',   name: 'Walt Disney Co.',        sector: 'Consumer Disc.', price: 112.80, change: -0.60, changePercent: -0.53, open: 113.40, high: 114.00, low: 112.20, prevClose: 113.40, volume: 8_900_000,  avgVolume: 10_600_000, marketCap: 206_000_000_000,  pe: 38.2, forwardPe: 19.4, eps: 2.95,  beta: 1.44, dividendYield: 0.89, dividendAmount: 1.00,  week52High: 123.74, week52Low: 83.91,  floatShares: 1_820_000_000,  shortRatio: 2.2, shortFloat: 1.60, analystRating: 'Buy',        priceTarget: 130 },
  // ENERGY
  { symbol: 'XOM',   name: 'Exxon Mobil Corp.',      sector: 'Energy',         price: 112.30, change: 1.10,  changePercent: 0.99,  open: 111.20, high: 112.80, low: 110.90, prevClose: 111.20, volume: 14_800_000, avgVolume: 17_100_000, marketCap: 451_000_000_000,  pe: 14.0, forwardPe: 12.8, eps: 8.02,  beta: 0.85, dividendYield: 3.56, dividendAmount: 3.80,  week52High: 123.75, week52Low: 98.11,  floatShares: 3_970_000_000,  shortRatio: 2.3, shortFloat: 0.55, analystRating: 'Buy',        priceTarget: 130 },
  { symbol: 'CVX',   name: 'Chevron Corp.',          sector: 'Energy',         price: 154.80, change: 0.80,  changePercent: 0.52,  open: 154.00, high: 155.40, low: 153.50, prevClose: 154.00, volume: 8_200_000,  avgVolume: 9_800_000,  marketCap: 289_000_000_000,  pe: 15.2, forwardPe: 13.6, eps: 10.18, beta: 0.84, dividendYield: 4.26, dividendAmount: 6.52,  week52High: 171.77, week52Low: 135.37, floatShares: 1_860_000_000,  shortRatio: 2.6, shortFloat: 0.60, analystRating: 'Buy',        priceTarget: 175 },
  // INDUSTRIALS
  { symbol: 'BA',    name: 'Boeing Co.',             sector: 'Industrials',    price: 188.40, change: -3.20, changePercent: -1.67, open: 191.60, high: 192.10, low: 187.80, prevClose: 191.60, volume: 7_100_000,  avgVolume: 9_300_000,  marketCap: 117_000_000_000,  pe: undefined, forwardPe: 28.6, eps: -9.76, beta: 1.28, dividendYield: 0.00, dividendAmount: 0.00, week52High: 267.54, week52Low: 159.70, floatShares: 621_000_000,    shortRatio: 2.8, shortFloat: 3.10, analystRating: 'Hold',       priceTarget: 215 },
]

function generateHistory(basePrice: number, changePercent: number) {
  const points = 78
  const history = []
  let price = basePrice - (changePercent / 100) * basePrice * 0.8
  const now = new Date()
  now.setHours(9, 30, 0, 0)

  for (let i = 0; i < points; i++) {
    const t = new Date(now.getTime() + i * 5 * 60 * 1000)
    const noise = (Math.random() - 0.48) * 0.8
    price = Math.max(price + noise, price * 0.97)
    history.push({
      timestamp: Math.floor(t.getTime() / 1000),
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 500_000 + 100_000),
    })
  }
  history[history.length - 1].price = basePrice
  return history
}

export function getMockStocks(): StockQuote[] {
  return MOCK_BASE.map(s => ({ ...s, history: generateHistory(s.price, s.changePercent) }))
}

export async function fetchStockQuotes(symbols: string[], timeframe: ChartTimeframe = '5m'): Promise<StockQuote[]> {
  try {
    const res = await fetch(`/api/quotes?symbols=${symbols.join(',')}&timeframe=${timeframe}`)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    return normalizeApiQuotes(data, symbols)
  } catch {
    return getMockStocks().filter(s => symbols.includes(s.symbol))
  }
}

function normalizeApiQuotes(raw: any, symbols: string[]): StockQuote[] {
  const list = Array.isArray(raw) ? raw : []
  const fallbackMap = new Map(getMockStocks().map((s) => [s.symbol, s]))

  const normalized = list
    .filter((q: any) => {
      if (!q || !symbols.includes(q.symbol)) return false
      const hasHistory = Array.isArray(q.history) && q.history.length > 0
      return q.found !== false || hasHistory
    })
    .map((q: any): StockQuote => {
      const fallback = fallbackMap.get(q.symbol)
      const historyRaw = Array.isArray(q.history) ? q.history : []
      const history = historyRaw
        .map((h: any) => {
          const ts = Number(h?.timestamp ?? h?.ts)
          if (!Number.isFinite(ts)) return null
          const price = Number(h?.price)
          return {
            timestamp: ts,
            time: typeof h?.time === 'string' ? h.time : new Date(ts * 1000).toLocaleString(),
            price: Number.isFinite(price) ? price : Number(q?.price ?? fallback?.price ?? 0),
            volume: Number(h?.volume ?? 0),
            open: Number.isFinite(Number(h?.open)) ? Number(h.open) : undefined,
            high: Number.isFinite(Number(h?.high)) ? Number(h.high) : undefined,
            low: Number.isFinite(Number(h?.low)) ? Number(h.low) : undefined,
          }
        })
        .filter(Boolean) as StockQuote['history']
      history.sort((a, b) => a.timestamp - b.timestamp)
      const latestHistoryPrice = history.length > 0 ? history[history.length - 1].price : undefined

      return {
        symbol: String(q.symbol),
        name: q.name ?? fallback?.name ?? q.symbol,
        sector: fallback?.sector ?? 'Market',
        price: Number(q.price ?? latestHistoryPrice ?? fallback?.price ?? 0),
        change: Number(q.change ?? fallback?.change ?? 0),
        changePercent: Number(q.changePercent ?? fallback?.changePercent ?? 0),
        open: Number(q.open ?? fallback?.open ?? 0),
        high: Number(q.high ?? fallback?.high ?? 0),
        low: Number(q.low ?? fallback?.low ?? 0),
        prevClose: Number(q.prevClose ?? fallback?.prevClose ?? 0),
        volume: Number(q.volume ?? fallback?.volume ?? 0),
        avgVolume: Number(q.avgVolume ?? fallback?.avgVolume ?? 0),
        marketCap: q.marketCap ?? fallback?.marketCap,
        pe: q.pe ?? fallback?.pe,
        forwardPe: q.forwardPe ?? fallback?.forwardPe,
        eps: q.eps ?? fallback?.eps,
        beta: q.beta ?? fallback?.beta,
        dividendYield: q.dividendYield ?? fallback?.dividendYield,
        dividendAmount: q.dividendAmount ?? fallback?.dividendAmount,
        week52High: q.week52High ?? fallback?.week52High,
        week52Low: q.week52Low ?? fallback?.week52Low,
        floatShares: q.floatShares ?? fallback?.floatShares,
        shortRatio: q.shortRatio ?? fallback?.shortRatio,
        shortFloat: q.shortFloat ?? fallback?.shortFloat,
        analystRating: q.analystRating ?? fallback?.analystRating,
        priceTarget: q.priceTarget ?? fallback?.priceTarget,
        history: history.length > 0 ? history : fallback?.history ?? [],
      }
    })

  const missing = symbols
    .filter((s) => !normalized.some((q) => q.symbol === s))
    .map((s) => fallbackMap.get(s))
    .filter(Boolean) as StockQuote[]

  return [...normalized, ...missing]
}

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function formatMarketCap(v?: number): string {
  if (!v) return '-'
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  return `$${(v / 1_000_000).toFixed(0)}M`
}

export const TOP_32_STOCKS: StockChoice[] = MOCK_BASE.slice(0, 32).map((s) => ({
  symbol: s.symbol,
  name: s.name,
}))
export const TOP_32_SYMBOLS = TOP_32_STOCKS.map((s) => s.symbol)
export const DEFAULT_WATCHLIST = TOP_32_SYMBOLS.slice(0, 6)

