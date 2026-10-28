import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from './api'
import './App.css'

const products = [
  { id: 1, title: 'Scientific Calculator', category: 'Study essentials', price: 650, emoji: '🧮', seller: 'Aarav' },
  { id: 2, title: 'Ergonomic Study Chair', category: 'Furniture', price: 1800, emoji: '🪑', seller: 'Meera' },
  { id: 3, title: 'Acoustic Guitar', category: 'Hobbies', price: 4200, emoji: '🎸', seller: 'Rohan' },
  { id: 4, title: 'Desk Lamp', category: 'Room essentials', price: 500, emoji: '💡', seller: 'Ishita' },
]

function Layout({ children }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const logout = () => { localStorage.removeItem('token'); navigate('/') }
  return (
    <>
      <nav className="navbar navbar-expand-lg site-nav">
        <div className="container">
          <Link className="navbar-brand brand" to="/">Campus<span>Auction</span></Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-label="Toggle navigation"><span className="navbar-toggler-icon" /></button>
          <div className="collapse navbar-collapse" id="mainNav">
            <div className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
              <NavLink className="nav-link" to="/">Browse</NavLink>
              <NavLink className="nav-link" to="/listings">My Listings</NavLink>
              <NavLink className="nav-link" to="/auctions">My Auctions</NavLink>
              {token ? <button className="btn btn-outline-dark btn-sm px-3" onClick={logout}>Log out</button> : <Link className="btn btn-dark btn-sm px-3" to="/login">Sign in</Link>}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="footer"><div className="container d-flex justify-content-between flex-wrap gap-2"><span>© 2026 CampusAuction</span><span>Made for campus communities</span></div></footer>
    </>
  )
}

function ProductCard({ product }) {
  return <article className="product-card"><div className="product-image">{product.emoji}</div><div className="p-3"><div className="small text-muted mb-2">{product.category}</div><h3>{product.title}</h3><div className="d-flex justify-content-between align-items-end mt-3"><div><div className="price">₹{product.price.toLocaleString('en-IN')}</div><small className="text-muted">by {product.seller}</small></div><button className="btn btn-sm btn-light border">View</button></div></div></article>
}

function Home() {
  const [query, setQuery] = useState('')
  const filtered = products.filter((p) => `${p.title} ${p.category}`.toLowerCase().includes(query.toLowerCase()))
  return <><section className="hero-section"><div className="container"><div className="hero-copy"><span className="eyebrow">THE CAMPUS MARKETPLACE</span><h1>Find useful things.<br /><em>Pass them on.</em></h1><p>Buy and sell items with people in your college community. Simple, local, and made for students.</p><div className="search-wrap"><span aria-hidden="true">⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books, furniture, electronics..." aria-label="Search listings" /></div></div></div></section><section className="container py-5"><div className="section-heading"><div><span className="eyebrow">EXPLORE</span><h2>Popular around campus</h2></div><button className="btn btn-link text-dark p-0">View all →</button></div><div className="category-grid mb-5">{['📚 Study essentials', '🏠 Room essentials', '🎨 Hobbies', '🎧 Electronics'].map((category) => <div className="category-pill" key={category}>{category}<span>→</span></div>)}</div><div className="section-heading"><div><span className="eyebrow">FRESH LISTINGS</span><h2>Recently added</h2></div></div>{filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <EmptyState message="No listings match your search yet." />}</section></>
}

function EmptyState({ message }) { return <div className="empty-state"><div>◌</div><h3>Nothing here yet</h3><p>{message}</p></div> }

function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e) => { e.preventDefault(); setError(''); setLoading(true); try { const { data } = await api.post(`/auth/${isRegister ? 'register' : 'login'}`, form); localStorage.setItem('token', data.token); navigate('/profile') } catch (err) { setError(err.response?.data?.message || 'Something went wrong. Please try again.') } finally { setLoading(false) } }
  return <div className="auth-page container"><div className="auth-card"><span className="eyebrow">{isRegister ? 'JOIN THE COMMUNITY' : 'WELCOME BACK'}</span><h1>{isRegister ? 'Create your account' : 'Sign in to CampusAuction'}</h1><p className="text-muted mb-4">{isRegister ? 'Use your college email to get started.' : 'Your campus marketplace is waiting.'}</p>{error && <div className="alert alert-danger">{error}</div>}<form onSubmit={submit}>{isRegister && <label className="form-label">Full name<input className="form-control" required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}<label className="form-label">Email address<input type="email" className="form-control" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label className="form-label">Password<input type="password" className="form-control" required minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><button className="btn btn-dark w-100 py-2 mt-2" disabled={loading}>{loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}</button></form><p className="auth-switch">{isRegister ? 'Already a member?' : 'New to campus marketplace?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p></div></div>
}

function ProtectedPlaceholder({ title }) { return <div className="container page-placeholder"><span className="eyebrow">YOUR SPACE</span><h1>{title}</h1><EmptyState message="You have no items here yet. Check back after creating your first listing." /></div> }

function Profile() { const [profile, setProfile] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.get('/auth/profile').then(({ data }) => setProfile(data.student)).catch(() => setError('Please sign in to view your profile.')) }, []); return <div className="container page-placeholder"><span className="eyebrow">ACCOUNT</span><h1>Your profile</h1>{error ? <div className="alert alert-warning">{error}</div> : profile ? <div className="profile-card"><div className="avatar">{profile.name[0]}</div><h2>{profile.name}</h2><p>{profile.email}</p></div> : <p className="text-muted">Loading profile...</p>}</div> }

function App() { return <BrowserRouter><Layout><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/listings" element={<ProtectedPlaceholder title="My listings" />} /><Route path="/auctions" element={<ProtectedPlaceholder title="My auctions" />} /><Route path="/profile" element={<Profile />} /></Routes></Layout></BrowserRouter> }
export default App
