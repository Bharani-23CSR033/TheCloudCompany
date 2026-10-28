import { useState } from 'react'
import { ProductCard } from '../components/listings'
import EmptyState from '../components/common/EmptyState'
import ErrorMessage from '../components/common/ErrorMessage'
import api from '../services/api'

const suggestions = ['Find a scientific calculator under ₹400.', 'Show me second-hand engineering textbooks.', 'Find a laptop available for auction.', 'Recommend items suitable for a CSE student.']

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Tell me what you are looking for. I search current campus listings and never place bids automatically.' }])
  const [input, setInput] = useState(''); const [listings, setListings] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const send = async (event, suggestedMessage) => {
    event?.preventDefault()
    const message = (suggestedMessage || input).trim()
    if (!message || loading) return
    setError(''); setInput(''); setMessages((current) => [...current, { role: 'user', content: message }]); setLoading(true)
    try { const history = messages.slice(-10).map(({ role, content }) => ({ role, content })); const { data } = await api.post('/ai-assistant/chat', { message, history }); setMessages((current) => [...current, { role: 'assistant', content: data.response }]); setListings(data.listings || []) } catch (err) { setError(err.response?.data?.message || 'The AI Assistant is temporarily unavailable.') } finally { setLoading(false) }
  }
  return <div className="container page-placeholder"><span className="eyebrow">SMART MARKETPLACE SEARCH</span><h1>AI Assistant</h1><p className="text-muted">Ask about real listings, budgets, conditions, and auction availability. The assistant recommends items only; use the listing page to bid.</p><div className="form-section"><div className="d-flex flex-wrap gap-2 mb-3">{suggestions.map((suggestion) => <button className="btn btn-sm btn-outline-dark" type="button" key={suggestion} onClick={(event) => send(event, suggestion)}>{suggestion}</button>)}</div><div className="border rounded p-3 mb-3 bg-white" aria-live="polite">{messages.map((message, index) => <div className={`mb-3 ${message.role === 'user' ? 'text-end' : ''}`} key={`${message.role}-${index}`}><span className={`d-inline-block p-2 rounded ${message.role === 'user' ? 'bg-dark text-white' : 'bg-light'}`}>{message.content}</span></div>)}{loading && <p className="text-muted mb-0">Searching current listings...</p>}</div><ErrorMessage message={error} /><form onSubmit={send}><div className="input-group"><input className="form-control" value={input} maxLength="500" onChange={(event) => setInput(event.target.value)} placeholder="Ask: scientific calculator under ₹400" aria-label="Ask the AI Assistant" /><button className="btn btn-coral" disabled={loading || !input.trim()}>{loading ? 'Searching...' : 'Send'}</button></div></form></div>{listings.length ? <><div className="section-heading mt-5"><div><span className="eyebrow">MATCHING LISTINGS</span><h2>Real marketplace results</h2></div></div><div className="product-grid">{listings.map((listing) => <ProductCard listing={listing} key={listing._id} />)}</div></> : !loading && messages.length > 1 && <EmptyState message="No current listings matched that request. Try a broader keyword or a higher budget." />}</div>
}
