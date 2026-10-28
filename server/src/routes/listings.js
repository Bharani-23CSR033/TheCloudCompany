import { Router } from 'express'
import mongoose from 'mongoose'
import Listing, { categories, conditions } from '../models/Listing.js'
import Bid from '../models/Bid.js'
import { requireAuth } from '../middleware/auth.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { uploadImages } from '../middleware/upload.js'
import { processExpiredAuctions } from '../services/auctionCloser.js'
import { createNotification } from '../services/notifications.js'

const router = Router()
const imageUrl = (req, file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const parseNumber = (value) => typeof value === 'number' ? value : Number(value)
const isValidDate = (value) => Number.isFinite(new Date(value).getTime())
const isOpen = (listing) => listing.status === 'active' && isValidDate(listing.closingAt) && new Date(listing.closingAt) > new Date()
const validBids = (listing) => (listing.bids || []).filter((bid) => bid.valid !== false && Number.isFinite(bid.amount) && bid.amount >= listing.startingPrice)
const currentPrice = (listing) => {
  const bids = validBids(listing)
  return bids.length ? bids.reduce((highest, bid) => Math.max(highest, bid.amount), listing.startingPrice) : (Number.isFinite(listing.currentPrice) ? listing.currentPrice : listing.startingPrice)
}

const serializeBid = (bid) => ({
  id: bid._id,
  bidder: { name: bid.bidder?.name || 'Student' },
  amount: bid.amount,
  createdAt: bid.createdAt,
})

const serialize = (listing, { includeBids = false, includeLifecycle = false } = {}) => {
  const item = listing.toObject()
  item.seller = item.seller && typeof item.seller === 'object' && item.seller.name
    ? { name: item.seller.name }
    : item.seller
  item.status = item.status === 'active' && (!isValidDate(item.closingAt) || new Date(item.closingAt) <= new Date()) ? 'closed' : item.status
  const bids = validBids(item).sort((a, b) => b.amount - a.amount || new Date(b.createdAt) - new Date(a.createdAt))
  item.currentPrice = currentPrice(item)
  item.bidCount = bids.length
  if (includeBids) item.bids = bids.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(serializeBid)
  else delete item.bids
  if (!includeLifecycle) {
    delete item.provisionalWinner
    delete item.winningBid
    delete item.sellerDecision
    delete item.sellerDecisionAt
    delete item.reservationStatus
    delete item.handover
    delete item.sellerCancellation
  }
  return item
}

const validateFields = (body) => {
  const { title, category, description, condition, startingPrice, minimumBidIncrement, closingAt } = body
  if (!title?.trim() || !category || !description?.trim() || !condition || startingPrice === undefined || minimumBidIncrement === undefined || !closingAt) return 'Title, category, description, condition, prices and closing time are required.'
  if (!categories.includes(category)) return `Category must be one of: ${categories.join(', ')}.`
  if (!conditions.includes(condition)) return `Condition must be one of: ${conditions.join(', ')}.`
  const price = parseNumber(startingPrice); const increment = parseNumber(minimumBidIncrement)
  if (!Number.isFinite(price) || price <= 0) return 'Starting price must be greater than zero.'
  if (!Number.isFinite(increment) || increment <= 0) return 'Minimum bid increment must be greater than zero.'
  if (!isValidDate(closingAt) || new Date(closingAt) <= new Date()) return 'Auction closing time must be in the future.'
  if (title.trim().length < 3 || description.trim().length < 10) return 'Title must have 3 characters and description must have 10 characters.'
  return null
}

const handleUpload = (req, res, next) => uploadImages(req, res, (error) => {
  if (!error) return next()
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Each image must be 5 MB or smaller.' })
  if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ message: 'You can upload at most 6 images.' })
  if (error.code === 'INVALID_FILE_TYPE') return res.status(400).json({ message: error.message })
  return res.status(400).json({ message: 'Unable to process the uploaded images.' })
})
const findOwned = async (id, seller) => Listing.findOne({ _id: id, seller })
const authenticateIfMine = (req, res, next) => req.query.mine === 'true' ? requireAuth(req, res, next) : next()

router.post('/', requireAuth, handleUpload, async (req, res, next) => {
  try {
    const error = validateFields(req.body)
    if (error) return res.status(400).json({ message: error })
    if (!req.files?.length) return res.status(400).json({ message: 'Add at least one item photo.' })
    const listing = await Listing.create({
      title: req.body.title, category: req.body.category, description: req.body.description,
      condition: req.body.condition, startingPrice: parseNumber(req.body.startingPrice),
      currentPrice: parseNumber(req.body.startingPrice),
      minimumBidIncrement: parseNumber(req.body.minimumBidIncrement), closingAt: new Date(req.body.closingAt),
      seller: req.student._id, images: req.files.map((file) => imageUrl(req, file)),
    })
    res.status(201).json({ listing: serialize(listing) })
  } catch (error) { next(error) }
})

router.get('/', authenticateIfMine, async (req, res, next) => {
  try {
    const { q, category, condition, minPrice, maxPrice, closingSoon, sort = 'newest' } = req.query
    const page = Number(req.query.page || 1); const limit = Number(req.query.limit || 12)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: 'Page must be a positive integer and limit must be between 1 and 50.' })
    if (category && !categories.includes(category)) return res.status(400).json({ message: `Category must be one of: ${categories.join(', ')}.` })
    if (condition && !conditions.includes(condition)) return res.status(400).json({ message: `Condition must be one of: ${conditions.join(', ')}.` })
    const minimum = minPrice === undefined || minPrice === '' ? undefined : Number(minPrice)
    const maximum = maxPrice === undefined || maxPrice === '' ? undefined : Number(maxPrice)
    if (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0) || maximum !== undefined && (!Number.isFinite(maximum) || maximum < 0) || minimum !== undefined && maximum !== undefined && minimum > maximum) return res.status(400).json({ message: 'Price range must contain valid non-negative values, with minimum no greater than maximum.' })
    if (closingSoon !== undefined && !['true', 'false'].includes(closingSoon)) return res.status(400).json({ message: 'closingSoon must be true or false.' })
    if (!['newest', 'lowestPrice', 'closingSoon'].includes(sort)) return res.status(400).json({ message: 'sort must be newest, lowestPrice, or closingSoon.' })

    const query = req.query.mine === 'true' ? { seller: req.student._id } : { status: 'active', closingAt: { $gt: new Date() } }
    if (q?.trim()) { const search = new RegExp(escapeRegex(q.trim()), 'i'); query.$or = [{ title: search }, { description: search }] }
    if (category) query.category = category
    if (condition) query.condition = condition
    if (closingSoon === 'true') query.closingAt = { $gt: new Date(), $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    if (minimum !== undefined || maximum !== undefined) query.startingPrice = { ...(minimum !== undefined && { $gte: minimum }), ...(maximum !== undefined && { $lte: maximum }) }

    const sortMap = { newest: { createdAt: -1 }, closingSoon: { closingAt: 1 }, lowestPrice: { currentPrice: 1, startingPrice: 1, createdAt: -1 } }
    const [listings, total] = await Promise.all([
      Listing.find(query).populate('seller', 'name').populate({ path: 'bids', populate: { path: 'bidder', select: 'name' } }).sort(sortMap[sort]).skip((page - 1) * limit).limit(limit),
      Listing.countDocuments(query),
    ])
    res.json({ listings: listings.map((listing) => serialize(listing)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.get('/:id/bids', async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate({ path: 'bids', match: { valid: true }, populate: { path: 'bidder', select: 'name' }, options: { sort: { createdAt: -1 } } })
    if (!listing) return res.status(404).json({ message: 'Listing not found.' })
    res.json({ bids: validBids(listing).map(serializeBid), currentPrice: currentPrice(listing) })
  } catch (error) { next(error) }
})

router.post('/:id/bids', requireAuth, async (req, res, next) => {
  const amount = parseNumber(req.body?.amount)
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Bid amount must be greater than zero.' })
  let session
  try {
    session = await mongoose.startSession()
    let acceptedBid
    await session.withTransaction(async () => {
      const listing = await Listing.findById(req.params.id).session(session)
      if (!listing) {
        const error = new Error('Listing not found.')
        error.status = 404
        throw error
      }
      if (listing.seller.equals(req.student._id)) {
        const error = new Error('You cannot bid on your own listing.')
        error.status = 403
        throw error
      }
      if (!isOpen(listing)) {
        const error = new Error(listing.status === 'cancelled' ? 'This auction has been cancelled.' : 'This auction is closed and no longer accepts bids.')
        error.status = 400
        throw error
      }
      const previousPrice = currentPrice(listing)
      const previousLeader = await Bid.findOne({ listing: listing._id, valid: true }).sort({ amount: -1, createdAt: -1 }).session(session)
      const firstBid = listing.bids.length === 0
      const minimum = firstBid ? listing.startingPrice : previousPrice + listing.minimumBidIncrement
      if (amount < minimum) {
        const error = new Error(`Bid must be at least ₹${minimum.toFixed(2)}.`)
        error.status = 400
        throw error
      }
      const bidId = new mongoose.Types.ObjectId()
      const priceCondition = firstBid && listing.currentPrice === undefined
        ? { $or: [{ currentPrice: { $exists: false } }, { currentPrice: null }] }
        : { currentPrice: previousPrice }
      const updated = await Listing.findOneAndUpdate(
        { _id: listing._id, status: 'active', closingAt: { $gt: new Date() }, seller: { $ne: req.student._id }, ...priceCondition },
        { $set: { currentPrice: amount }, $push: { bids: bidId } },
        { new: true, session },
      )
      if (!updated) {
        const error = new Error('This auction changed while your bid was being placed. Refresh and try again.')
        error.status = 409
        throw error
      }
      const [bid] = await Bid.create([{ _id: bidId, listing: listing._id, bidder: req.student._id, amount }], { session })
      acceptedBid = bid
      if (previousLeader && !previousLeader.bidder.equals(req.student._id)) {
        await createNotification({
          recipient: previousLeader.bidder,
          type: 'outbid',
          message: `You were outbid on "${listing.title}".`,
          listing: listing._id,
          eventKey: `outbid:${listing._id}:${bidId}`,
          session,
        })
      }
    })
    res.status(201).json({ bid: serializeBid({ ...acceptedBid.toObject(), bidder: { name: req.student.name } }), currentPrice: amount })
  } catch (error) {
    if (error.code === 20 || error.codeName === 'IllegalOperation') {
      error.status = 503
      error.message = 'Bidding requires MongoDB replica-set mode. Configure the local MongoDB server as a single-node replica set and restart the API.'
    }
    next(error)
  } finally {
    if (session) await session.endSession()
  }
})

router.get('/decisions', requireAuth, async (req, res, next) => {
  try {
    await processExpiredAuctions()
    const listings = await Listing.find({ seller: req.student._id, status: 'awaiting_decision' }).populate('provisionalWinner', 'name').populate('winningBid')
    res.json({ listings: listings.map((listing) => serialize(listing, { includeLifecycle: true })) })
  } catch (error) { next(error) }
})

router.get('/my-sales', requireAuth, async (req, res, next) => {
  try {
    const listings = await Listing.find({ $or: [{ seller: req.student._id }, { provisionalWinner: req.student._id }], status: { $in: ['awaiting_decision', 'reserved', 'completed', 'failed_pickup', 'seller_cancelled', 'rejected', 'unsold'] } }).populate('seller', 'name').populate('provisionalWinner', 'name').populate('winningBid')
    res.json({ listings: listings.map((listing) => serialize(listing, { includeLifecycle: true })) })
  } catch (error) { next(error) }
})

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name').populate('provisionalWinner', 'name').populate('winningBid').populate({ path: 'bids', populate: { path: 'bidder', select: 'name' } })
    if (!listing) return res.status(404).json({ message: 'Listing not found.' })
    const canViewLifecycle = req.student && (listing.seller._id.equals(req.student._id) || listing.provisionalWinner?._id.equals(req.student._id))
    res.json({ listing: serialize(listing, { includeBids: true, includeLifecycle: canViewLifecycle }) })
  } catch (error) { next(error) }
})

router.post('/:id/decision', requireAuth, async (req, res, next) => {
  try {
    const { decision } = req.body
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ message: 'Decision must be approve or reject.' })
    const listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, seller: req.student._id, status: 'awaiting_decision' },
      { $set: { sellerDecision: decision === 'approve' ? 'approved' : 'rejected', sellerDecisionAt: new Date(), status: decision === 'approve' ? 'reserved' : 'rejected', reservationStatus: decision === 'approve' ? 'reserved' : 'released' } },
      { new: true },
    ).populate('provisionalWinner', 'name').populate('winningBid')
    if (!listing) return res.status(400).json({ message: 'Auction was not found or is no longer awaiting a seller decision.' })
    await createNotification({
      recipient: listing.provisionalWinner?._id,
      type: 'seller_decision',
      message: decision === 'approve' ? `The seller approved your winning price for "${listing.title}".` : `The seller rejected the winning price for "${listing.title}".`,
      listing: listing._id,
      eventKey: `seller-decision:${listing._id}:${decision}`,
    })
    res.json({ listing: serialize(listing, { includeLifecycle: true }) })
  } catch (error) { next(error) }
})

const findParticipant = async (id, studentId) => Listing.findOne({ _id: id, $or: [{ seller: studentId }, { provisionalWinner: studentId }] }).populate('seller', 'name').populate('provisionalWinner', 'name').populate('winningBid')

router.post('/:id/handover/confirm', requireAuth, async (req, res, next) => {
  try {
    const listing = await findParticipant(req.params.id, req.student._id)
    if (!listing) return res.status(404).json({ message: 'Sale not found or you are not a participant.' })
    if (listing.status !== 'reserved') return res.status(400).json({ message: 'Only reserved sales can be confirmed.' })
    const isSeller = listing.seller._id.equals(req.student._id)
    if (isSeller) { listing.handover.sellerConfirmed = true; listing.handover.sellerConfirmedAt = new Date() }
    else { listing.handover.buyerConfirmed = true; listing.handover.buyerConfirmedAt = new Date() }
    if (listing.handover.sellerConfirmed && listing.handover.buyerConfirmed) listing.status = 'completed'
    await listing.save()
    if (listing.status === 'completed') {
      await createNotification({
        recipient: isSeller ? listing.provisionalWinner?._id : listing.seller?._id,
        type: 'handover_completed',
        message: `Handover for "${listing.title}" is complete.`,
        listing: listing._id,
        eventKey: `handover-completed:${listing._id}`,
      })
    }
    res.json({ listing: serialize(listing, { includeLifecycle: true }) })
  } catch (error) { next(error) }
})

router.post('/:id/handover/fail', requireAuth, async (req, res, next) => {
  try {
    const listing = await findParticipant(req.params.id, req.student._id)
    if (!listing) return res.status(404).json({ message: 'Sale not found or you are not a participant.' })
    if (listing.status !== 'reserved') return res.status(400).json({ message: 'Only reserved sales can be marked as failed pickup.' })
    if (!req.body.reason?.trim()) return res.status(400).json({ message: 'A failed pickup reason is required.' })
    listing.status = 'failed_pickup'; listing.reservationStatus = 'released'; listing.handover.failedAt = new Date(); listing.handover.failedBy = req.student._id; listing.handover.failedReason = req.body.reason.trim()
    await listing.save()
    await createNotification({
      recipient: listing.seller._id.equals(req.student._id) ? listing.provisionalWinner?._id : listing.seller._id,
      type: 'pickup_failed',
      message: `Pickup failed for "${listing.title}".`,
      listing: listing._id,
      eventKey: `pickup-failed:${listing._id}`,
    })
    res.json({ listing: serialize(listing, { includeLifecycle: true }) })
  } catch (error) { next(error) }
})

router.post('/:id/seller-cancel', requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.student._id }).populate('provisionalWinner', 'name').populate('winningBid')
    if (!listing) return res.status(404).json({ message: 'Sale not found or you are not the seller.' })
    if (listing.status !== 'reserved') return res.status(400).json({ message: 'Only reserved sales can be cancelled by the seller.' })
    if (!req.body.reason?.trim()) return res.status(400).json({ message: 'A cancellation reason is required.' })
    listing.status = 'seller_cancelled'; listing.reservationStatus = 'released'; listing.sellerCancellation = { reason: req.body.reason.trim(), cancelledAt: new Date() }
    await listing.save()
    await createNotification({ recipient: listing.provisionalWinner?._id, type: 'auction_cancelled', message: `The seller cancelled the reserved sale for "${listing.title}".`, listing: listing._id, eventKey: `auction-cancelled:${listing._id}` })
    res.json({ listing: serialize(listing, { includeLifecycle: true }) })
  } catch (error) { next(error) }
})

router.put('/:id', requireAuth, handleUpload, async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.student._id }).populate('bids')
    if (!listing) return res.status(404).json({ message: 'Listing not found or you are not the seller.' })
    if (listing.status !== 'active') return res.status(400).json({ message: 'Only active listings can be edited.' })
    if (listing.bids.length) return res.status(400).json({ message: 'This listing cannot be edited because it already has bids.' })
    const error = validateFields(req.body)
    if (error) return res.status(400).json({ message: error })
    const startingPrice = parseNumber(req.body.startingPrice)
    Object.assign(listing, { title: req.body.title, category: req.body.category, description: req.body.description, condition: req.body.condition, startingPrice, currentPrice: listing.bids.length ? listing.currentPrice : startingPrice, minimumBidIncrement: parseNumber(req.body.minimumBidIncrement), closingAt: new Date(req.body.closingAt) })
    if (req.files?.length) listing.images = req.files.map((file) => imageUrl(req, file))
    await listing.save()
    res.json({ listing: serialize(listing) })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.student._id }).populate('bids')
    if (!listing) return res.status(404).json({ message: 'Listing not found or you are not the seller.' })
    if (listing.status === 'cancelled') return res.status(400).json({ message: 'Listing is already cancelled.' })
    listing.status = 'cancelled'; await listing.save()
    const winner = validBids(listing).sort((a, b) => b.amount - a.amount)[0]
    if (winner) await createNotification({ recipient: winner.bidder, type: 'auction_cancelled', message: `The auction "${listing.title}" was cancelled by the seller.`, listing: listing._id, eventKey: `auction-cancelled-before-close:${listing._id}` })
    res.json({ message: 'Listing cancelled.', listing: serialize(listing) })
  } catch (error) { next(error) }
})

export default router
