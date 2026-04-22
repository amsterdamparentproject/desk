import { NewsletterEvent } from './types/event'

export const MOCK_EVENTS: NewsletterEvent[] = [
  {
      id: '1',
      startDate: "2026-04-26",
      startTime: "11:00",
      endDate: "2026-04-26",
      endTime: "11:45",
      duration: 45,
      day_of_week: "Sunday",
      title: "Musical Journey Across the Atlantic! with Duo Joana Almeida & Pedro Ivo",
      location: "Schinkelhavenstraat 27HS, 1075 VP Amsterdam, The Netherlands",
      neighborhood: "Schinkelbuurt",
      area: "South",
      description: "Join us for a playful musical journey across the Atlantic!...",
      url: "https://munganga.nl/programma/...",
      organization: "Munganga Theater",
      age: "0-6 years",
      newsletterDescription: "Experience a playful musical journey across the Atlantic at Munganga Theater.",
      is_highlight: false,
      list_id: 'incoming',
      repeat: null,
      repeatFrequency: null
  },
  {
    id: '2',
      "startDate": "2025-12-14",
      "startTime": "13:00",
      "endDate": "2025-12-16",
      "endTime": "16:00",
      "duration": 180,
      "day_of_week": "Friday",
      "title": "Book on Lap",
      "location": "Tweede Oosterparkstraat 226, Amsterdam, The Netherlands",
      "neighborhood": "De Baarsjes",
      "area": "West",
      "description": "A fun storytime for toddlers and their parents/guardians. We choose books suitable for children between 2 and 4. The stories are relatable, simple, and rich in visual stimuli. The event is ",
      "url": "oba.nl",
      "organization": "OBA",
      "repeat": "Weekly on Friday",
      "repeatFrequency": "Weekly",
      "age": "2-4 years",
      "newsletterDescription": "A fun storytime for toddlers and their families, hosted by the OBA. The stories are relatable, simple, and rich in visual stimuli, meant to foster an early love of reading and connection. For ages 2-4 years.",
      list_id: 'incoming',
      is_highlight: false
  }
]