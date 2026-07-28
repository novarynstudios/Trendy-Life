"use client"

import { useEffect } from "react"

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Administrative request failed", { digest: error.digest })
  }, [error.digest])
  return <main className="tl-auth-shell"><section className="tl-auth-card"><header><span className="tl-auth-mark">!</span><div><h1>Unable to complete request</h1><p>Trendy Life Admin</p></div></header><div className="tl-auth-form"><p>The request failed safely. No database details or stack trace have been exposed.</p>{error.digest && <p>Reference: <code>{error.digest}</code></p>}<button className="tl-button tl-button-primary tl-button-wide" type="button" onClick={reset}>Retry</button></div></section></main>
}
