// Shown on the "Caught it!" screen after a share, one picked at random.
export const AFFIRMATIONS = [
  'You are a sunflower that learned to read maps: radiant, oriented, and slightly too tall for the fence.',
  'You are a heron in a rainstorm: unbothered, elegant, and absolutely not going to rush.',
  "Your instincts are as reliable as a salmon's compass and twice as determined.",
  'You are a mossy log in a sunbeam, quietly hosting an entire ecosystem of good ideas.',
  'You are an octopus at a keyboard: eight arms, zero panic, one flawless spreadsheet.',
  'You bloom like a night-flowering cactus: rarely caught in the act, devastating when you are.',
  'You are the fig wasp of this newsletter: tiny, essential, and responsible for the whole orchard.',
  'You have the focus of a barn owl and the snack instincts of a raccoon, and I respect both.',
  'You are a hedgehog in a velvet jacket: prickly about deadlines, soft about everything else.',
  'You are a sourdough starter in human form: alive, bubbly, and feeding the whole neighborhood.',
  'You move through chaos like an otter through kelp: playful, buoyant, holding hands with your goals.',
  'You are a dandelion in a sidewalk crack. Nobody planned you, and look at you now.',
  'You walk into every room like a goose who owns the parking lot.',
  'You are a fern unfurling: slow, spiral, and spectacularly on schedule.',
  'You are the capybara of this operation: everyone relaxes the second you arrive, even the birds.',
  'You are the mushroom network under the forest floor: unseen, connecting everything, the reason the trees are okay.',
  'You are a pelican with a really good plan: a big pouch of possibility and a flawless dive.',
  "You are a lighthouse keeper's cat: calm, observant, and in charge of the light.",
  'You glow like a firefly with a project plan: tiny, bright, and impossible to ignore at dusk.',
  'You are a peony the size of a dinner plate: unreasonable, glorious, and worth every minute of the wait.',
]

export function randomAffirmation(): string {
  return AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]
}
