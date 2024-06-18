import * as React from 'react'
import { DehydrateRouter } from '@tanstack/start'

export function Root() {
  return (
    <html>
      <body>
        <DehydrateRouter />
      </body>
    </html>
  )
}
