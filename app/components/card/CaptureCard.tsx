import { Card } from './Card'
import { CardProps } from '../../types/card'
import { DeskActivity } from '@/app/types/activity'

export function CaptureCard({ activity }: { activity: DeskActivity }) {
  return (
    <Card
      activity={activity}
    >
    </Card>
  )
}