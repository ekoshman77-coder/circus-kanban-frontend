export const NOTE_COLORS = {
  YELLOW: 'note-yellow',
  GREEN: 'note-green',
  PINK: 'note-pink',
  BLUE: 'note-blue'
} as const;

// Die Liste für das Dropdown im HTML (@for)
export const NOTE_COLOR_PALETTE = [
  { value: NOTE_COLORS.YELLOW, label: 'Gelb 🟡' },
  { value: NOTE_COLORS.GREEN, label: 'Grün 🟢' },
  { value: NOTE_COLORS.PINK, label: 'Pink 🌸' },
  { value: NOTE_COLORS.BLUE, label: 'Blau 🔵' }
];