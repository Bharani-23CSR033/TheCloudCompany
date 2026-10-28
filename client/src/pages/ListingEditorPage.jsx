import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../services/api'
import ErrorMessage from '../components/common/ErrorMessage'
import ListingForm from '../components/listings/ListingForm'

export default function ListingEditorPage({ edit = false }) {
  const { id } = useParams(); const navigate = useNavigate(); const [listing, setListing] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(edit)
  useEffect(() => { if (edit) api.get(`/listings/${id}`).then(({ data }) => setListing(data.listing)).catch((err) => setError(err.response?.data?.message || 'Unable to load listing.')).finally(() => setLoading(false)) }, [edit, id])
  if (loading) return <div className="container page-placeholder"><p>Loading listing...</p></div>
  if (edit && (error || !listing)) return <div className="container page-placeholder"><ErrorMessage message={error || 'Listing not found.'} /></div>
  return <div className="container form-page"><span className="eyebrow">{edit ? 'EDIT LISTING' : 'SELL ON CAMPUS'}</span><h1>{edit ? 'Update your listing' : 'Add a listing'}</h1><p className="text-muted mb-4">{edit ? 'Keep your item information up to date.' : 'Give your item a clear description so fellow students can find it.'}</p><ListingForm listing={listing} onSaved={(saved) => navigate(`/listings/${saved._id}`)} /></div>
}
