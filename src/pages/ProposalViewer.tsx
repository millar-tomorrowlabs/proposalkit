import { useParams } from "react-router-dom"

const ProposalViewer = () => {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading proposal: {slug}</p>
    </div>
  )
}

export default ProposalViewer
