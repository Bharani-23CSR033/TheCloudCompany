import { Router } from 'express'
import Listing, { categories, conditions } from '../models/Listing.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadImages } from '../middleware/upload.js'
import '../models/Bid.js'

const router = Router()
const imageUrl = (req, file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const parseNumber = (value) => typeof value === 'number' ? value : Number(value)
const isValidDate = (value) => Number.isFinite(new Date(value).getTime())
const isOpen = (listing) => listing.status === 'active' && isValidDate(listing.closingAt) && new Date(listing.closingAt) > new Date()
const validBids = (listing) => (listing.bids || []).filter((bid) => bid.valid !== false && Number.isFinite(bid.amount) && bid.amount >= listing.startingPrice)
const currentPrice = (listing) => validBids(listing).reduce((highest, bid) => Math.max(highest, bid.amount), listing.startingPrice)

const serializeBid = (bid) => ({
  id: bid._id,
  bidder: { name: bid.bidder?.name || 'Student' },
  amount: bid.amount,
  createdAt: bid.createdAt,
})

const serialize = (listing, { includeBids = false } = {}) => {
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

    const sortMap = { newest: { createdAt: -1 }, closingSoon: { closingAt: 1 }, lowestPrice: { startingPrice: 1, createdAt: -1 } }
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

router.get('/:id', async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name').populate({ path: 'bids', populate: { path: 'bidder', select: 'name' } })
    if (!listing) return res.status(404).json({ message: 'Listing not found.' })
    res.json({ listing: serialize(listing, { includeBids: true }) })
  } catch (error) { next(error) }
})

router.put('/:id', requireAuth, handleUpload, async (req, res, next) => {
  try {
    const listing = await findOwned(req.params.id, req.student._id)
    if (!listing) return res.status(404).json({ message: 'Listing not found or you are not the seller.' })
    if (listing.status !== 'active') return res.status(400).json({ message: 'Only active listings can be edited.' })
    if (listing.bids.length) return res.status(400).json({ message: 'This listing cannot be edited because it already has bids.' })
    const error = validateFields(req.body)
    if (error) return res.status(400).json({ message: error })
    Object.assign(listing, { title: req.body.title, category: req.body.category, description: req.body.description, condition: req.body.condition, startingPrice: parseNumber(req.body.startingPrice), minimumBidIncrement: parseNumber(req.body.minimumBidIncrement), closingAt: new Date(req.body.closingAt) })
    if (req.files?.length) listing.images = req.files.map((file) => imageUrl(req, file))
    await listing.save()
    res.json({ listing: serialize(listing) })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await findOwned(req.params.id, req.student._id)
    if (!listing) return res.status(404).json({ message: 'Listing not found or you are not the seller.' })
    if (listing.status === 'cancelled') return res.status(400).json({ message: 'Listing is already cancelled.' })
    listing.status = 'cancelled'; await listing.save()
    res.json({ message: 'Listing cancelled.', listing: serialize(listing) })
  } catch (error) { next(error) }
})

export default router
