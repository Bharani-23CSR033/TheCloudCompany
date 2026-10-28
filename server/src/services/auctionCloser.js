import Listing from '../models/Listing.js'

const validBids = (listing) => (listing.bids || []).filter((bid) => bid.valid !== false && Number.isFinite(bid.amount) && bid.amount >= listing.startingPrice)

export async function processExpiredAuctions() {
  const expired = await Listing.find({ status: 'active', closingAt: { $lte: new Date() } }).populate({ path: 'bids', populate: { path: 'bidder', select: 'name' } })
  for (const listing of expired) {
    const bids = validBids(listing).sort((a, b) => b.amount - a.amount || new Date(b.createdAt) - new Date(a.createdAt))
    const winner = bids[0]
    const update = winner
      ? { status: 'awaiting_decision', provisionalWinner: winner.bidder._id, winningBid: winner._id, sellerDecision: 'pending', reservationStatus: 'pending' }
      : { status: 'unsold', sellerDecision: 'not_required', reservationStatus: 'not_applicable' }
    await Listing.updateOne({ _id: listing._id, status: 'active', closingAt: { $lte: new Date() } }, { $set: update })
  }
  return expired.length
}

export function startAuctionCloser(intervalMs = 30000) {
  const run = () => processExpiredAuctions().catch((error) => console.error(`Auction closing job failed: ${error.message}`))
  run()
  return setInterval(run, intervalMs)
}
