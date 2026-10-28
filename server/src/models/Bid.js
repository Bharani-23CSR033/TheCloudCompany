import mongoose from 'mongoose'

const bidSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  amount: { type: Number, required: true, min: 0.01 },
  valid: { type: Boolean, default: true, index: true },
}, { timestamps: true })

export default mongoose.model('Bid', bidSchema)
