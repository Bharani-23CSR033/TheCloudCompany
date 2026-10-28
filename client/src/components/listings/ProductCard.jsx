import { Link } from 'react-router-dom'

export default function ProductCard({ listing }) {
  const price = listing.currentPrice ?? listing.startingPrice
  return <Link className="product-card" to={`/listings/${listing._id}`}><div className="product-image">{listing.images?.[0] ? <img src={listing.images[0]} alt={listing.title} /> : '📦'}</div><div className="p-3"><div className="small text-muted mb-2">{listing.category} · {listing.condition}</div><h3>{listing.title}</h3><div className="small text-muted mt-2"><span className={`status status-${listing.status}`}>{listing.status}</span>{listing.closingAt && <span className="ms-2">Closes {new Date(listing.closingAt).toLocaleDateString()}</span>}</div>{listing.matchReason && <p className="small text-muted mt-2 mb-0">{listing.matchReason}</p>}<div className="d-flex justify-content-between align-items-end mt-3"><div><div className="price">₹{price.toLocaleString('en-IN')}</div><small className="text-muted">{listing.bidCount ? `${listing.bidCount} bid${listing.bidCount === 1 ? '' : 's'} · current bid` : 'Starting price'}</small></div><span className="btn btn-sm btn-light border">View</span></div></div></Link>
}
