import type { Category, CategoryId } from '../types';

export const CATEGORIES: Category[] = [
  { id: 'faune', label: 'Faune', emoji: '🦬', color: '#7BC67E' },
  { id: 'volcans', label: 'Volcans', emoji: '🌋', color: '#FF6B3D' },
  { id: 'aurores', label: 'Aurores', emoji: '🌌', color: '#5EF2C2' },
  { id: 'urbain', label: 'Urbain', emoji: '🚦', color: '#FFD23F' },
  { id: 'espace', label: 'Espace', emoji: '🛰️', color: '#8FA8FF' },
  { id: 'fonds-marins', label: 'Fonds marins', emoji: '🐙', color: '#3DB8FF' },
  { id: 'frontieres', label: 'Frontières', emoji: '🧊', color: '#C9E4FF' },
  { id: 'paranormal', label: 'Paranormal', emoji: '👁️', color: '#C77DFF' },
];

export const categoryById = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id)!;
