const FACTION_NAMES = [
  "Alliance Trader",
  "Free Trader",
  "Belter Prospector",
  "Deep Space Hauler",
  "Consolidated Mining Patrol",
  "Frontier Escort",
  "Scout-94",
  "Vanguard Scout",
  "Starlight Courier",
  "Hyperion Miner",
];

const HAIL_LINES = [
  "How do you organize a space party? You planet!",
  "Why did the sun go to school? To get brighter!",
  "What is an astronaut's favorite key on the keyboard? The space bar!",
  "I'm reading a book on anti-gravity. I just can't put it down!",
  "Why did the alien throw beef at the asteroid? He wanted a little meatier shower!",
  "What kind of music do planets sing? Nep-tunes!",
  "How do you know when the moon has enough to eat? When it's full!",
  "Why are astronauts so clean? They take meteor showers!",
  "What does a star do when it gets hot? It gets a solar fan!",
  "I wanted to have a space-themed birthday party, but there was no atmosphere.",
  "Why did the comet visit the doctor? It was feeling a bit under the weather-balloon!",
  "Greetings, Commander. Sensors show calm spaceways today... mostly.",
  "Safe travels, pilot. Watch out for those pirate spawn zones!",
  "We're just passing through on mining business. Clear skies!",
];

export function randomShipName(): string {
  const name = FACTION_NAMES[Math.floor(Math.random() * FACTION_NAMES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${name} ${num}`;
}

export function randomHailLine(): string {
  return HAIL_LINES[Math.floor(Math.random() * HAIL_LINES.length)];
}
