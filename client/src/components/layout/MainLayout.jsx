import { Link, NavLink, useNavigate } from 'react-router-dom'
import NotificationBell from '../notifications/NotificationBell'

export default function MainLayout({ children }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const logout = () => { localStorage.removeItem('token'); navigate('/') }
  return <><nav className="navbar navbar-expand-lg site-nav"><div className="container"><Link className="navbar-brand brand" to="/">Campus<span>Auction</span></Link><button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-label="Toggle navigation"><span className="navbar-toggler-icon" /></button><div className="collapse navbar-collapse" id="mainNav"><div className="navbar-nav ms-auto align-items-lg-center gap-lg-3"><NavLink className="nav-link" to="/">Browse</NavLink>{token && <><NavLink className="nav-link" to="/ai-assistant">AI Assistant</NavLink><NavLink className="nav-link" to="/listings">My Listings</NavLink><NavLink className="nav-link" to="/saved-searches">Saved Searches</NavLink><Link className="btn btn-coral btn-sm px-3" to="/listings/new">Sell an item</Link><NavLink className="nav-link" to="/auctions">My Auctions</NavLink><NotificationBell /><button className="btn btn-outline-dark btn-sm px-3" onClick={logout}>Log out</button></>}{!token && <Link className="btn btn-dark btn-sm px-3" to="/login">Sign in</Link>}</div></div></div></nav><main>{children}</main><footer className="footer"><div className="container d-flex justify-content-between flex-wrap gap-2"><span>© 2026 CampusAuction</span><span>Made for campus communities</span></div></footer></>
}
