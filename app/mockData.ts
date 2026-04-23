import { NewsletterEvent } from './types/event'

export const MOCK_EVENTS: NewsletterEvent[] = [
  {
    id: '1',
    startDate: '2026-04-26',
    startTime: '11:00',
    endDate: '2026-04-26',
    endTime: '11:45',
    duration: 45,
    day_of_week: 'Sunday',
    title:
      'Musical Journey Across the Atlantic! with Duo Joana Almeida & Pedro Ivo',
    location: 'Schinkelhavenstraat 27HS, 1075 VP Amsterdam, The Netherlands',
    neighborhood: 'Schinkelbuurt',
    area: 'South',
    description:
      'Duo Joana Almeida (vocals) and Pedro Ivo (guitar) invite you on a musical journey across the Atlantic Ocean. This event is specially designed for children aged 2 and up and their parents/caregivers, featuring Brazilian classics and songs adapted for the occasion. It promises a journey full of color, fun, and emotion! After the concert, attendees will have the opportunity to discover and try out instruments from Brazil.',
    url: 'https://munganga.nl/programma/sun-26-apr-2026-1100-musical-journey-across-the-atlantic-bij-duo-joana-almeida-pedro-ivo',
    organization: 'Munganga Theater',
    age: '0-6 years',
    newsletterDescription:
      "Teatro Munganga invites families with children aged 2 and up to a 'Musical Journey Across the Atlantic' with Duo Joana Almeida and Pedro Ivo. This vibrant concert features Brazilian classics, promising a journey full of color, fun, and emotion, followed by an opportunity for kids and parents to try out instruments from Brazil. Tickets are required for this engaging musical event.",
    is_highlight: false,
    list_id: 'review',
    repeat: null,
    repeatFrequency: null,
  },
  {
    id: '2',
    startDate: '2025-12-14',
    startTime: '13:00',
    endDate: '2025-12-16',
    endTime: '16:00',
    duration: 180,
    day_of_week: 'Friday',
    title: 'Book on Lap',
    location: 'Tweede Oosterparkstraat 226, Amsterdam, The Netherlands',
    neighborhood: 'De Baarsjes',
    area: 'West',
    description:
      'A fun storytime for toddlers and their parents/guardians. We choose books suitable for children between 2 and 4. The stories are relatable, simple, and rich in visual stimuli. The event is ',
    url: 'oba.nl',
    organization: 'OBA',
    repeat: 'Weekly on Friday',
    repeatFrequency: 'Weekly',
    age: '2-4 years',
    newsletterDescription:
      'A fun storytime for toddlers and their families, hosted by the OBA. The stories are relatable, simple, and rich in visual stimuli, meant to foster an early love of reading and connection. For ages 2-4 years.',
    list_id: 'review',
    is_highlight: false,
  },
  {
    id: '3',
    title: 'Become a Support Family with Buurtgezinnen',
    area: 'Everywhere',
    description:
      "Buurtgezinnen connects families needing extra support with local 'support families.' This free volunteering opportunity allows you to offer or receive practical help (like meal prep and babysitting) and a listening ear, with flexible time commitments. Thanks to APP community member Markus for the tip!",
    url: 'https://www.buurtgezinnen.nl/steungezin/',
    organization: 'Buurtgezinnen',
    newsletterDescription:
      "Buurtgezinnen connects families needing extra support with local 'support families.' This free volunteering opportunity allows you to offer or receive practical help (like meal prep and babysitting) and a listening ear, with flexible time commitments. Thanks to APP community member Markus for the tip!",
    is_highlight: false,
    list_id: 'review',
  },
]
