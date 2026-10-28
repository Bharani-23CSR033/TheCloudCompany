import Listing, { categories, conditions } from '../models/Listing.js'

const MAX_RESULTS = 12
const stopWords = new Set([
  'a', 'an', 'and', 'are', 'available', 'auction', 'auctions', 'can', 'cse',
  'find', 'for', 'item', 'items', 'me', 'my', 'need', 'of', 'on', 'please',
  'recommend', 'second', 'show', 'student', 'suitable', 'the', 'to', 'under',
  'want', 'with',
])

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseAssistantMessage(message) {
  const text = message.trim()
  const lower = text.toLowerCase()
  const filters = { keyword: '', category: '', condition: '', maximumPrice: undefined, availableOnly: true }

  filters.category = categories.find((item) => lower.includes(item.toLowerCase())) || ''
  filters.condition = conditions.find((item) => lower.includes(item.toLowerCase())) || ''

  const budgetMatch = lower.match(/(?:under|below|less than|up to|upto|maximum|max|within|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i)
    || lower.match(/₹\s*([\d,]+(?:\.\d+)?)/i)
  if (budgetMatch) filters.maximumPrice = Number(budgetMatch[1].replace(/,/g, ''))

  const unavailableRequest = /\b(closed|expired|ended|sold|cancelled|cancelled auctions)\b/i.test(lower)
  filters.availableOnly = !unavailableRequest

  const keywords = lower
    .replace(/(?:under|below|less than|up to|upto|maximum|max|within|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d+)?/gi, ' ')
    .replace(/₹\s*[\d,]+(?:\.\d+)?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word) && !categories.some((item) => item.toLowerCase() === word) && !conditions.some((item) => item.toLowerCase() === word))
  filters.keyword = [...new Set(keywords)].join(' ')
  return filters
}

function listingQuery(filters) {
  const query = {}
  if (filters.availableOnly) {
    query.status = 'active'
    query.closingAt = { $gt: new Date() }
  }
  if (filters.category) query.category = filters.category
  if (filters.condition) query.condition = filters.condition
  if (filters.maximumPrice !== undefined) query.startingPrice = { $lte: filters.maximumPrice }
  if (filters.keyword) {
    query.$and = filters.keyword.split(' ').map((word) => {
      const regex = new RegExp(escapeRegex(word), 'i')
      return { $or: [{ title: regex }, { description: regex }] }
    })
  }
  return query
}

function fallbackMessage(filters, listings) {
  if (!listings.length) {
    const criteria = [
      filters.keyword && `"${filters.keyword}"`,
      filters.category,
      filters.condition,
      filters.maximumPrice !== undefined && `under ₹${filters.maximumPrice.toLocaleString('en-IN')}`,
    ].filter(Boolean).join(', ')
    return `I could not find currently available listings matching ${criteria || 'that request'}. Try removing a filter or increasing your budget.`
  }
  const criteria = [
    filters.category,
    filters.condition,
    filters.maximumPrice !== undefined && `under ₹${filters.maximumPrice.toLocaleString('en-IN')}`,
  ].filter(Boolean).join(', ')
  return `I found ${listings.length} real listing${listings.length === 1 ? '' : 's'}${criteria ? ` matching ${criteria}` : ''}. These are available auctions; prices and closing times come from the marketplace.`
}

async function providerMessage(message, filters, listings) {
  if (!process.env.AI_API_KEY || !process.env.AI_API_URL) return null
  const response = await fetch(process.env.AI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Explain only the supplied marketplace results. Never invent listings, prices, sellers, bids, dates, or actions. Do not place bids.' },
        { role: 'user', content: JSON.stringify({ message, filters, listings: listings.map(({ _id, title, category, condition, startingPrice, currentPrice, closingAt }) => ({ _id, title, category, condition, startingPrice, currentPrice, closingAt })) }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}.`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || null
}

export async function answerAssistantMessage(message) {
  const filters = parseAssistantMessage(message)
  const listings = await Listing.find(listingQuery(filters))
    .sort({ currentPrice: 1, createdAt: -1 })
    .limit(MAX_RESULTS)
    .lean()
  const publicListings = listings.map((listing) => ({
    _id: listing._id,
    title: listing.title,
    category: listing.category,
    condition: listing.condition,
    description: listing.description,
    images: listing.images,
    startingPrice: listing.startingPrice,
    currentPrice: listing.currentPrice ?? listing.startingPrice,
    bidCount: listing.bids?.length || 0,
    status: listing.status,
    closingAt: listing.closingAt,
    matchReason: 'Matches the requested marketplace filters.',
  }))
  const bidRequest = /\b(bid|place a bid|offer)\b/i.test(message)
  let response = `${bidRequest ? 'I cannot place or confirm bids from chat. Open a listing to review the server-calculated minimum and confirm it there. ' : ''}${fallbackMessage(filters, publicListings)}`
  let providerUsed = false
  if (process.env.AI_API_KEY && process.env.AI_API_URL) {
    try {
      const generated = await providerMessage(message, filters, publicListings)
      if (generated) response = `${bidRequest ? 'I cannot place or confirm bids from chat. Open a listing to review the server-calculated minimum and confirm it there. ' : ''}${generated}`
      providerUsed = true
    } catch (error) {
      console.error(`AI provider unavailable: ${error.message}`)
    }
  }
  return { response, listings: publicListings, filters, providerUsed }
}
