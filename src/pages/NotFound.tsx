import { Link } from "react-router-dom"

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/builder" className="text-sm underline">
        Go to builder
      </Link>
    </div>
  )
}

export default NotFound
