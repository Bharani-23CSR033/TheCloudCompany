import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function NotificationBell() {
  const navigate = useNavigate()
  const [items, setItems] = useState([]); const [unread, setUnread] = useState(0); const [open, setOpen] = useState(false); const [notice, setNotice] = useState(''); const [supported] = useState(typeof window !== 'undefined' && 'Notification' in window)
  useEffect(() => {
    let firstLoad = true
    let storedSeen
    try { storedSeen = JSON.parse(window.localStorage.getItem('campusAuctionBrowserNotifications') || '[]') } catch { storedSeen = [] }
    const seen = new Set(Array.isArray(storedSeen) ? storedSeen : [])
    const load = async () => { try { const { data } = await api.get('/notifications'); setItems(data.notifications); setUnread(data.unreadCount); if (!firstLoad && supported && window.Notification.permission === 'granted') data.notifications.filter((item) => !item.read && !seen.has(item._id)).forEach((item) => { seen.add(item._id); new window.Notification('CampusAuction', { body: item.message }) }); window.localStorage.setItem('campusAuctionBrowserNotifications', JSON.stringify([...seen].slice(-100))) } catch { setNotice('Notifications are temporarily unavailable.') } finally { firstLoad = false } }
    load(); const timer = window.setInterval(load, 15000); return () => window.clearInterval(timer)
  }, [supported])
  const enable = async () => { if (!supported) return setNotice('Browser notifications are not supported here. In-app notifications remain available.'); const permission = await window.Notification.requestPermission(); setNotice(permission === 'granted' ? 'Browser notifications enabled.' : 'Browser notifications were denied. In-app notifications remain available.') }
  const markRead = async (id) => { try { await api.patch(`/notifications/${id}/read`); setItems((current) => current.map((item) => item._id === id ? { ...item, read: true } : item)); setUnread((current) => Math.max(0, current - 1)) } catch { setNotice('Unable to mark notification as read.') } }
  const markAllRead = async () => { try { await api.patch('/notifications/read-all'); setItems((current) => current.map((item) => ({ ...item, read: true }))); setUnread(0) } catch { setNotice('Unable to mark notifications as read.') } }
  const openNotification = async (item) => { if (!item.read) await markRead(item._id); setOpen(false); if (item.listing?._id) navigate(`/listings/${item.listing._id}`) }
  return <div className="notification-wrap"><button className="notification-bell" onClick={() => setOpen((current) => !current)} aria-label="Notifications">♢{unread > 0 && <span>{unread}</span>}</button>{open && <div className="notification-panel"><div className="notification-head"><strong>Notifications</strong><span><button onClick={markAllRead}>Mark all read</button> <button onClick={enable}>Enable browser notifications</button></span></div>{notice && <p className="notification-note">{notice}</p>}{items.length ? items.map((item) => <button className={`notification-item ${item.read ? '' : 'unread'}`} onClick={() => openNotification(item)} key={item._id}><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>) : <p className="notification-empty">No notifications yet.</p>}</div>}</div>
}
