export default function EmptyState({ message, action }) {
  return <div className="empty-state"><div>◌</div><h3>Nothing here yet</h3><p>{message}</p>{action}</div>
}
