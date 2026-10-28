export default function ErrorMessage({ message }) {
  return message ? <div className="alert alert-danger" role="alert">{message}</div> : null
}
