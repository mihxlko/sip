'use client'

// Agentation — dev-only visual annotation overlay. Lets design notes be pinned
// directly onto elements in the running app; the annotations go to the local
// Agentation server (http://localhost:4747), which the coding agent reads.
//
// Guarded twice on purpose: the NODE_ENV check is what Next statically
// eliminates at build time, and the dynamic import keeps the package out of the
// production bundle graph entirely rather than relying on that alone.
//
// Web-only: the extension's settings page renders the same shared Settings
// component, so annotating here covers both surfaces.

import dynamic from 'next/dynamic'

// The guard has to sit on the dynamic() CALL, not inside the component. Next
// statically replaces process.env.NODE_ENV at build time, so `false ? … : null`
// lets webpack dead-code-eliminate the import() entirely and never emit a
// chunk. With the check inside the component body the import stays in the
// module graph and agentation ships to production — a lazily-loaded chunk
// nobody ever downloads, but still deployed, and still a devDependency that a
// `--omit=dev` install would fail to resolve at build time.
const isDev = process.env.NODE_ENV === 'development'

const Agentation = isDev
  ? dynamic(() => import('agentation').then(m => m.Agentation), { ssr: false })
  : null

export default function DevAnnotation() {
  return Agentation ? <Agentation /> : null
}
