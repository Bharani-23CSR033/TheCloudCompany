import SavedSearch from '../models/SavedSearch.js'
import { createNotification } from './notifications.js'

const matchesKeyword = (listing, keyword) => {
  if (!keyword) return true
  const value = keyword.trim().toLowerCase()
  return `${listing.title} ${listing.description}`.toLowerCase().includes(value)
}

export async function notifyMatchingSavedSearches(listing) {
  const candidates = await SavedSearch.find({
    $and: [
      { $or: [{ category: { $exists: false } }, { category: null }, { category: '' }, { category: listing.category }] },
      { $or: [{ condition: { $exists: false } }, { condition: null }, { condition: '' }, { condition: listing.condition }] },
      { $or: [{ minimumPrice: { $exists: false } }, { minimumPrice: null }, { minimumPrice: { $lte: listing.startingPrice } }] },
      { $or: [{ maximumPrice: { $exists: false } }, { maximumPrice: null }, { maximumPrice: { $gte: listing.startingPrice } }] },
    ],
  }).limit(5000)

  const matching = candidates.filter((search) => matchesKeyword(listing, search.keyword) && !search.userId.equals(listing.seller))
  await Promise.all(matching.map((search) => createNotification({
    recipient: search.userId,
    type: 'saved_search_match',
    message: `A new listing matches your saved search${search.name ? ` "${search.name}"` : ''}: "${listing.title}".`,
    listing: listing._id,
    eventKey: `saved-search:${search._id}:listing:${listing._id}`,
  })))
  return matching.length
}
