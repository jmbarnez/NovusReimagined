
// src/audio/music.ts

let musicElement: HTMLAudioElement | null = null;
let musicVolume = 1.0;

export function playBackgroundMusic() {
  if (musicElement) {
    return;
  }
  musicElement = new Audio('/data/audio/music/leberch-cinematic-space-510707.mp3');
  musicElement.loop = true;
  musicElement.volume = musicVolume;
  musicElement.play().catch(error => {
    console.error("Failed to play background music:", error);
  });
}

export function setMusicVolume(volume: number) {
  musicVolume = volume;
  if (musicElement) {
    musicElement.volume = volume;
  }
}
