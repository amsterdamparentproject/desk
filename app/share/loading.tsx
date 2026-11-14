import { LavaLoader } from '../components/Lava'

// Shown right after the phone's share sheet hands over. No delay: on mobile the
// hand-off is the one moment the person is staring at the screen waiting.
export default function ShareLoading() {
  return (
    <main className="flex flex-1 items-center justify-center bg-base p-4">
      <div className="w-full max-w-md">
        <LavaLoader message="Catching your share…" delay={0} />
      </div>
    </main>
  )
}
