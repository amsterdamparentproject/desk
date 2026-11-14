import { LavaLoader } from './components/Lava'

// Route-level loading state. LavaLoader fades in after a 1s delay, so fast
// navigations never flash it.
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center bg-base p-4">
      <div className="w-full max-w-md">
        <LavaLoader />
      </div>
    </main>
  )
}
