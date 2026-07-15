import { Suspense } from 'react'
import { CreatorStudio } from '@/components/v2/CreatorStudio'

export default function Home() {
  return (
    <Suspense fallback={<main className="studio-loading"><p>Opening the workshop</p></main>}>
      <CreatorStudio />
    </Suspense>
  )
}
