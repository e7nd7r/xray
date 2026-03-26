/**
 * XRay Combined State Types
 *
 * Only defines the combined XRayState interface.
 * Module-specific types should be imported from their respective modules.
 */

import type { ToolbarState } from './tools/types';
import type { PaletteState } from './palette/types';

/** Combined XRay state - all state slices */
export interface XRayState {
  toolbar: ToolbarState;
  palette: PaletteState;
}
