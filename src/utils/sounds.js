import genericClick from '../assets/generic8BitButton.mp3'
import gameClick from '../assets/gameButtonSound.wav'

export const playGenericClick = () => {
  new Audio(genericClick).play().catch(() => {})
}

export const playGameClick = () => {
  new Audio(gameClick).play().catch(() => {})
}