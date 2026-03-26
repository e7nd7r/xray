/**
 * StateStore unit tests
 */

import { jest } from '@jest/globals';
import { StateStore } from './store';
import type { ToolbarState } from '../tools/types';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
    // Clear sessionStorage between tests
    sessionStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize with default toolbar state', () => {
      const toolbar = store.get('toolbar');

      expect(toolbar.currentTool).toBe('select');
      expect(toolbar.currentColor).toBe('#94a3b8');
      expect(toolbar.currentStrokeWidth).toBe(2);
      expect(toolbar.selectedElements).toEqual([]);
      expect(toolbar.drawings).toEqual([]);
      expect(toolbar.annotations).toEqual([]);
      expect(toolbar.snapshots).toEqual([]);
    });

    it('should initialize with default palette state', () => {
      const palette = store.get('palette');

      expect(palette.colors).toEqual([]);
      expect(palette.generationMode).toBe('algorithm');
      expect(palette.selectedAlgorithm).toBe('complementary');
      expect(palette.visualizerEnabled).toBe(false);
      expect(palette.visualizerSlide).toBe('palette-grid');
    });

    it('should accept partial initial state', () => {
      const customStore = new StateStore({
        toolbar: {
          currentTool: 'freehand',
          currentColor: '#ff0000',
          currentStrokeWidth: 4,
          selectedElements: [],
          drawings: [],
          annotations: [],
          snapshots: [],
        },
      });

      const toolbar = customStore.get('toolbar');
      expect(toolbar.currentTool).toBe('freehand');
      expect(toolbar.currentColor).toBe('#ff0000');
    });
  });

  describe('get/set', () => {
    it('should get state by key', () => {
      const toolbar = store.get('toolbar');
      expect(toolbar).toBeDefined();
      expect(toolbar.currentTool).toBe('select');
    });

    it('should set state by key', () => {
      const newToolbar: ToolbarState = {
        currentTool: 'arrow',
        currentColor: '#00ff00',
        currentStrokeWidth: 6,
        selectedElements: [],
        drawings: [],
        annotations: [],
        snapshots: [],
      };

      store.set('toolbar', newToolbar);

      const toolbar = store.get('toolbar');
      expect(toolbar.currentTool).toBe('arrow');
      expect(toolbar.currentColor).toBe('#00ff00');
    });
  });

  describe('update', () => {
    it('should update state using callback', () => {
      store.update('toolbar', (state) => ({
        ...state,
        currentTool: 'rectangle',
      }));

      expect(store.get('toolbar').currentTool).toBe('rectangle');
    });

    it('should preserve other state properties', () => {
      const originalColor = store.get('toolbar').currentColor;

      store.update('toolbar', (state) => ({
        ...state,
        currentTool: 'ellipse',
      }));

      expect(store.get('toolbar').currentColor).toBe(originalColor);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on set', () => {
      const listener = jest.fn();
      store.subscribe('toolbar', listener);

      const newToolbar: ToolbarState = {
        ...store.get('toolbar'),
        currentTool: 'text',
      };
      store.set('toolbar', newToolbar);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(newToolbar, expect.any(Object));
    });

    it('should notify listeners on update', () => {
      const listener = jest.fn();
      store.subscribe('toolbar', listener);

      store.update('toolbar', (state) => ({
        ...state,
        currentStrokeWidth: 10,
      }));

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should pass old and new values to listener', () => {
      const listener = jest.fn();

      store.subscribe('toolbar', listener);
      store.update('toolbar', (state) => ({
        ...state,
        currentTool: 'snapshot',
      }));

      const [newValue, oldValue] = listener.mock.calls[0] as [ToolbarState, ToolbarState];
      expect(oldValue.currentTool).toBe('select');
      expect(newValue.currentTool).toBe('snapshot');
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe('toolbar', listener);

      store.update('toolbar', (state) => ({ ...state, currentTool: 'arrow' }));
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      store.update('toolbar', (state) => ({ ...state, currentTool: 'rectangle' }));
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      store.subscribe('toolbar', listener1);
      store.subscribe('toolbar', listener2);

      store.update('toolbar', (state) => ({ ...state, currentTool: 'freehand' }));

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should only notify listeners for the changed key', () => {
      const toolbarListener = jest.fn();
      const paletteListener = jest.fn();

      store.subscribe('toolbar', toolbarListener);
      store.subscribe('palette', paletteListener);

      store.update('toolbar', (state) => ({ ...state, currentTool: 'arrow' }));

      expect(toolbarListener).toHaveBeenCalledTimes(1);
      expect(paletteListener).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return a copy of the full state', () => {
      const state = store.getState();

      expect(state).toHaveProperty('toolbar');
      expect(state).toHaveProperty('palette');
    });

    it('should not allow direct mutation', () => {
      const state = store.getState();
      state.toolbar.currentTool = 'arrow';

      // Original state should be unchanged
      expect(store.get('toolbar').currentTool).toBe('select');
    });
  });

  describe('persistence', () => {
    it('should save state to sessionStorage', () => {
      store.update('toolbar', (state) => ({ ...state, currentTool: 'freehand' }));
      store.save();

      const saved = sessionStorage.getItem(`xray-state-${window.location.pathname}`);
      expect(saved).toBeDefined();

      const parsed = JSON.parse(saved!);
      expect(parsed.toolbar.currentTool).toBe('freehand');
    });

    it('should restore state from sessionStorage', () => {
      // Save state with custom tool
      store.update('toolbar', (state) => ({ ...state, currentTool: 'ellipse' }));
      store.save();

      // Create new store and restore
      const newStore = new StateStore();
      newStore.restore();

      expect(newStore.get('toolbar').currentTool).toBe('ellipse');
    });

    it('should merge restored state with defaults', () => {
      // Save partial state
      const partialState = {
        toolbar: { currentTool: 'arrow' },
      };
      sessionStorage.setItem(
        `xray-state-${window.location.pathname}`,
        JSON.stringify(partialState)
      );

      const newStore = new StateStore();
      newStore.restore();

      // Should have restored value
      expect(newStore.get('toolbar').currentTool).toBe('arrow');
      // Should still have default values for other properties
      expect(newStore.get('toolbar').currentColor).toBe('#94a3b8');
    });

    it('should handle invalid JSON gracefully', () => {
      sessionStorage.setItem(`xray-state-${window.location.pathname}`, 'invalid json');

      const newStore = new StateStore();
      // Should not throw
      expect(() => newStore.restore()).not.toThrow();
      // Should keep default state
      expect(newStore.get('toolbar').currentTool).toBe('select');
    });
  });

  describe('clearListeners', () => {
    it('should remove all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      store.subscribe('toolbar', listener1);
      store.subscribe('palette', listener2);

      store.clearListeners();

      store.update('toolbar', (state) => ({ ...state, currentTool: 'arrow' }));
      store.update('palette', (state) => ({ ...state, generationMode: 'ai' }));

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should catch and log listener errors without breaking other listeners', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();

      store.subscribe('toolbar', errorListener);
      store.subscribe('toolbar', normalListener);

      store.update('toolbar', (state) => ({ ...state, currentTool: 'arrow' }));

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
