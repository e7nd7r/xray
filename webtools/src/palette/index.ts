/**
 * Palette Module Exports
 *
 * Part of DES-004: Color Palette Panel
 */

export { ColorPalettePanel, type ColorPalettePanelConfig } from './panel';
export { PaletteController } from './controller';
export { ColorPicker, type ColorPickerOptions } from './color-picker';
export type {
  PaletteColor,
  PaletteState,
  Algorithm,
  VisualizerSlide,
} from './types';
export {
  getColorName,
  isLightColor,
  getContrastClass,
  ROLE_PRESETS,
  type RolePreset,
} from './color-utils';
