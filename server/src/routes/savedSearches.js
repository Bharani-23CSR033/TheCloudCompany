import { Router } from 'express'
import mongoose from 'mongoose'
import SavedSearch from '../models/SavedSearch.js'
import { requireAuth } from '../middleware/auth.js'
import { categories, conditions } from '../models/Listing.js'

const router = Router()
const fields = ['name', 'keyword', 'category', 'condition', 'maximumPrice', 'minimumPrice']

const normalize = (body) => {
  const result = {}
  for (const field of fields) if (body[field] !== undefined) result[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
  if (result.name === '') delete result.name
  if (result.keyword === '') delete result.keyword
  if (result.category === '') delete result.category
  if (result.condition === '') delete result.condition
  if (result.maximumPrice === '') delete result.maximumPrice
  if (result.minimumPrice === '') delete result.minimumPrice
  return result
}

const validate = (values) => {
  if (!values.keyword && !values.category && !values.condition && values.maximumPrice === undefined && values.minimumPrice === undefined) return 'Add at least one search criterion.'
  if (values.category && !categories.includes(values.category)) return `Category must be one of: ${categories.join(', ')}.`
  if (values.condition && !conditions.includes(values.condition)) return `Condition must be one of: ${conditions.join(', ')}.`
  for (const field of ['maximumPrice', 'minimumPrice']) {
    if (values[field] !== undefined && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) return `${field === 'maximumPrice' ? 'Maximum' : 'Minimum'} price must be a non-negative number.`
    if (values[field] !== undefined) values[field] = Number(values[field])
  }
  if (values.minimumPrice !== undefined && values.maximumPrice !== undefined && values.minimumPrice > values.maximumPrice) return 'Minimum price cannot exceed maximum price.'
  if (values.keyword && values.keyword.length > 120) return 'Keyword must be 120 characters or fewer.'
  return null
}

router.use(requireAuth)

router.post('/', async (req, res, next) => {
  try {
    const values = normalize(req.body || {}); const error = validate(values)
    if (error) return res.status(400).json({ message: error })
    const savedSearch = await SavedSearch.create({ ...values, userId: req.student._id })
    res.status(201).json({ savedSearch })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try { res.json({ savedSearches: await SavedSearch.find({ userId: req.student._id }).sort({ updatedAt: -1 }).limit(100) }) } catch (error) { next(error) }
})

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid saved search ID.' })
    const existing = await SavedSearch.findOne({ _id: req.params.id, userId: req.student._id })
    if (!existing) return res.status(404).json({ message: 'Saved search not found.' })
    const values = normalize({ ...existing.toObject(), ...(req.body || {}) })
    for (const field of fields) if (req.body?.[field] === '') values[field] = undefined
    const error = validate(values)
    if (error) return res.status(400).json({ message: error })
    for (const field of fields) if (req.body?.[field] === '') values[field] = null
    delete values._id; delete values.userId; delete values.createdAt; delete values.updatedAt; delete values.__v
    const savedSearch = await SavedSearch.findOneAndUpdate({ _id: req.params.id, userId: req.student._id }, values, { new: true, runValidators: true })
    res.json({ savedSearch })
  } catch (error) { next(error) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid saved search ID.' })
    const result = await SavedSearch.deleteOne({ _id: req.params.id, userId: req.student._id })
    if (!result.deletedCount) return res.status(404).json({ message: 'Saved search not found.' })
    res.json({ message: 'Saved search deleted.' })
  } catch (error) { next(error) }
})

export default router
