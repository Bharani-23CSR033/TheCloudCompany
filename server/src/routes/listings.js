import { Router } from 'express'
import Listing, { categories, conditions } from '../models/Listing.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadImages } from '../middleware/upload.js'

const router = Router()
const imageUrl = (req, file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
const serialize = (req, listing) => {
  const item = listing.toObject()
  item.seller = item.seller && typeof item.seller === 'object' && item.seller.name
    ? { id: item.seller._id, name: item.seller.name }
    : item.seller
  item.status = item.status === 'active' && new Date(item.closingAt) <= new Date() ? 'closed' : item.status
  delete item.bids
  return item
}
const parseNumber = (value) => typeof value === 'number' ? value : Number(value)
const validateFields = (body, { requireClosing = true } = {}) => {
  const { title, category, description, condition, startingPrice, minimumBidIncrement, closingAt } = body
  if (!title?.trim() || !category || !description?.trim() || !condition || startingPrice === undefined || minimumBidIncrement === undefined || (requireClosing && !closingAt)) return 'Title, category, description, condition, prices and closing time are required.'
  if (!categories.includes(category)) return `Category must be one of: ${categories.join(', ')}.`
  if (!conditions.includes(condition)) return `Condition must be one of: ${conditions.join(', ')}.`
  const price = parseNumber(startingPrice)
  const increment = parseNumber(minimumBidIncrement)
  if (!Number.isFinite(price) || price <= 0) return 'Starting price must be greater than zero.'
  if (!Number.isFinite(increment) || increment <= 0) return 'Minimum bid increment must be greater than zero.'
  if (closingAt && (!Number.isFinite(new Date(closingAt).getTime()) || new Date(closingAt) <= new Date())) return 'Auction closing time must be in the future.'
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
    res.status(201).json({ listing: serialize(req, listing) })
  } catch (error) { next(error) }
})

const authenticateIfMine = (req, res, next) => req.query.mine === 'true' ? requireAuth(req, res, next) : next()

router.get('/', authenticateIfMine, async (req, res, next) => {
  try {
    const query = {}
    if (req.query.mine === 'true') {
      query.seller = req.student._id
    } else query.status = 'active'
    if (req.query.category) query.category = req.query.category
    const listings = await Listing.find(query).populate('seller', 'name').sort({ createdAt: -1 })
    res.json({ listings: listings.map((listing) => serialize(req, listing)) })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name')
    if (!listing) return res.status(404).json({ message: 'Listing not found.' })
    res.json({ listing: serialize(req, listing) })
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
    const updates = {
      title: req.body.title, category: req.body.category, description: req.body.description,
      condition: req.body.condition, startingPrice: parseNumber(req.body.startingPrice),
      minimumBidIncrement: parseNumber(req.body.minimumBidIncrement), closingAt: new Date(req.body.closingAt),
    }
    if (req.files?.length) updates.images = req.files.map((file) => imageUrl(req, file))
    Object.assign(listing, updates)
    await listing.save()
    res.json({ listing: serialize(req, listing) })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await findOwned(req.params.id, req.student._id)
    if (!listing) return res.status(404).json({ message: 'Listing not found or you are not the seller.' })
    if (listing.status === 'cancelled') return res.status(400).json({ message: 'Listing is already cancelled.' })
    listing.status = 'cancelled'
    await listing.save()
    res.json({ message: 'Listing cancelled.', listing: serialize(req, listing) })
  } catch (error) { next(error) }
})

export default router
