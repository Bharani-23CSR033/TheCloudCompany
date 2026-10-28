import mongoose from 'mongoose'

const categories = ['Cycle', 'Calculator', 'Books', 'Electronics', 'Other']
const conditions = ['New', 'Like New', 'Good', 'Fair']

const listingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  category: { type: String, required: true, enum: categories },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  condition: { type: String, required: true, enum: conditions },
  images: { type: [String], required: true, validate: [(images) => images.length > 0 && images.length <= 6, 'Add between 1 and 6 item photos.'] },
  startingPrice: { type: Number, required: true, min: 0.01 },
  minimumBidIncrement: { type: Number, required: true, min: 0.01 },
  closingAt: { type: Date, required: true, validate: { validator: (value) => value > new Date(), message: 'Auction closing time must be in the future.' } },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  status: { type: String, enum: ['active', 'cancelled', 'closed'], default: 'active', index: true },
  bids: { type: [{ type: mongoose.Schema.Types.ObjectId }], default: [] },
}, { timestamps: true })

listingSchema.index({ status: 1, closingAt: 1 })

export { categories, conditions }
export default mongoose.model('Listing', listingSchema)
