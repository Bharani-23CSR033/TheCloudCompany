import { useState } from 'react'
import api from '../../services/api'
import ErrorMessage from '../common/ErrorMessage'
import { categories, conditions } from '../../constants/listingOptions'

const emptyForm = { title: '', category: '', description: '', condition: '', startingPrice: '', minimumBidIncrement: '', closingAt: '' }

export default function ListingForm({ listing, onSaved }) {
  const [form, setForm] = useState(listing ? { ...listing, closingAt: new Date(listing.closingAt).toISOString().slice(0, 16) } : emptyForm)
  const [files, setFiles] = useState([]); const [previews, setPreviews] = useState(listing?.images || []); const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const chooseFiles = (event) => {
    const selected = Array.from(event.target.files)
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) return setError('Only JPEG, PNG, and WebP files are supported.')
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) return setError('Each image must be 5 MB or smaller.')
    if (selected.length > 6) return setError('You can upload at most 6 images.')
    setError(''); setFiles(selected); setPreviews(selected.map((file) => URL.createObjectURL(file)))
  }
  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (!listing && !files.length) return setError('Add at least one item photo.')
    if (new Date(form.closingAt) <= new Date()) return setError('Auction closing time must be in the future.')
    const data = new FormData()
    Object.entries(form).forEach(([key, value]) => { if (!['images', 'seller', 'status', '_id', 'createdAt', 'updatedAt', 'bids'].includes(key)) data.append(key, value) })
    files.forEach((file) => data.append('images', file)); setSaving(true)
    try { const response = await api({ method: listing ? 'put' : 'post', url: listing ? `/listings/${listing._id}` : '/listings', data }); onSaved(response.data.listing) } catch (err) { setError(err.response?.status === 401 ? 'Your session has expired. Please sign in again before publishing a listing.' : err.response?.data?.message || 'Unable to save this listing.') } finally { setSaving(false) }
  }
  return <form className="listing-form" onSubmit={submit}><ErrorMessage message={error} /><div className="form-section"><h2>Item details</h2><label className="form-label">Title<input className="form-control" required minLength="3" maxLength="120" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Engineering Mathematics textbook" /></label><div className="row"><label className="form-label col-md-6">Category<select className="form-select" required value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">Choose category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="form-label col-md-6">Condition<select className="form-select" required value={form.condition} onChange={(event) => update('condition', event.target.value)}><option value="">Choose condition</option>{conditions.map((item) => <option key={item}>{item}</option>)}</select></label></div><label className="form-label">Description<textarea className="form-control" required minLength="10" maxLength="2000" rows="5" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the item's condition and what is included." /></label></div><div className="form-section"><h2>Photos</h2><p className="text-muted small">Upload 1-6 JPEG, PNG, or WebP images. Maximum 5 MB per image.</p><input className="form-control" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!listing} onChange={chooseFiles} />{previews.length > 0 && <div className="preview-grid">{previews.map((src) => <img src={src} alt="Preview" key={src} />)}</div>}</div><div className="form-section"><h2>Auction details</h2><div className="row"><label className="form-label col-md-4">Starting price (₹)<input className="form-control" type="number" min="0.01" step="0.01" required value={form.startingPrice} onChange={(event) => update('startingPrice', event.target.value)} /></label><label className="form-label col-md-4">Minimum bid increment (₹)<input className="form-control" type="number" min="0.01" step="0.01" required value={form.minimumBidIncrement} onChange={(event) => update('minimumBidIncrement', event.target.value)} /></label><label className="form-label col-md-4">Closing date and time<input className="form-control" type="datetime-local" required value={form.closingAt} onChange={(event) => update('closingAt', event.target.value)} /></label></div></div><button className="btn btn-dark px-4" disabled={saving}>{saving ? 'Saving...' : listing ? 'Save changes' : 'Publish listing'}</button></form>
}
