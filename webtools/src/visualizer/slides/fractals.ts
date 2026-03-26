/**
 * Fractal Slides
 *
 * Fractal visualization slides for the color palette visualizer.
 * Part of DES004-11.
 */

import chroma from 'chroma-js';
import type { Slide } from '../types';
import type { PaletteColor } from '../../palette/types';

// ============================================================================
// Mandelbrot Slide
// ============================================================================

/**
 * Create a Mandelbrot set slide - classic fractal with palette gradient.
 */
export function createMandelbrotSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'mandelbrot',
    name: 'Mandelbrot',
    category: 'fractals',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = '8px';

      // Build color gradient from palette
      const gradient = buildGradient(colors);

      // Infinite zoom parameters - zoom into a point on the boundary
      // This point is on the Mandelbrot boundary, ensuring infinite detail
      const targetX = -0.743643887037151;
      const targetY = 0.131825904205330;
      let zoom = 1;

      const animate = () => {
        if (!canvas || !ctx) return;

        // Use logarithmic zoom for smooth infinite effect
        const logZoom = Math.pow(1.5, zoom);
        renderMandelbrot(ctx, width, height, targetX, targetY, logZoom, gradient);

        // Increment zoom counter (loops due to floating point)
        zoom += 0.02;

        // Reset to create seamless loop (fractal is self-similar)
        if (zoom > 30) {
          zoom = 0;
        }

        animationId = requestAnimationFrame(animate);
      };

      animate();
    },
    destroy: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      canvas = null;
    },
  };
}

/**
 * Render Mandelbrot set.
 */
function renderMandelbrot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  zoom: number,
  gradient: string[]
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const maxIter = 100;

  const scale = 3 / zoom;
  const aspectRatio = width / height;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Map pixel to complex plane
      const x0 = centerX + (px / width - 0.5) * scale * aspectRatio;
      const y0 = centerY + (py / height - 0.5) * scale;

      let x = 0;
      let y = 0;
      let iter = 0;

      // Mandelbrot iteration: z = z² + c
      while (x * x + y * y <= 4 && iter < maxIter) {
        const xTemp = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xTemp;
        iter++;
      }

      const idx = (py * width + px) * 4;

      if (iter === maxIter) {
        // Inside the set - black
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      } else {
        // Smooth coloring
        const smoothIter = iter + 1 - Math.log(Math.log(Math.sqrt(x * x + y * y))) / Math.log(2);
        const colorIdx = Math.floor(smoothIter * 3) % gradient.length;
        const rgb = chroma(gradient[colorIdx]).rgb();
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================================================
// Julia Set Slide
// ============================================================================

/**
 * Create a Julia Set slide - related fractal with animated parameter.
 */
export function createJuliaSetSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'julia-set',
    name: 'Julia Set',
    category: 'fractals',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = '8px';

      const gradient = buildGradient(colors);

      let time = 0;

      const animate = () => {
        if (!canvas || !ctx) return;

        // Animate the Julia constant along a circle for morphing effect
        const cReal = 0.7885 * Math.cos(time);
        const cImag = 0.7885 * Math.sin(time);

        renderJulia(ctx, width, height, cReal, cImag, 1, gradient);

        time += 0.01;

        animationId = requestAnimationFrame(animate);
      };

      animate();
    },
    destroy: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      canvas = null;
    },
  };
}

/**
 * Render Julia set.
 */
function renderJulia(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cReal: number,
  cImag: number,
  zoom: number,
  gradient: string[]
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const maxIter = 80;

  const scale = 3 / zoom;
  const aspectRatio = width / height;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Map pixel to complex plane (centered at origin for Julia)
      let x = (px / width - 0.5) * scale * aspectRatio;
      let y = (py / height - 0.5) * scale;

      let iter = 0;

      // Julia iteration: z = z² + c (where c is constant)
      while (x * x + y * y <= 4 && iter < maxIter) {
        const xTemp = x * x - y * y + cReal;
        y = 2 * x * y + cImag;
        x = xTemp;
        iter++;
      }

      const idx = (py * width + px) * 4;

      if (iter === maxIter) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      } else {
        const smoothIter = iter + 1 - Math.log(Math.log(Math.sqrt(x * x + y * y))) / Math.log(2);
        const colorIdx = Math.floor(smoothIter * 2.5) % gradient.length;
        const rgb = chroma(gradient[colorIdx]).rgb();
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================================================
// Sierpinski Slide
// ============================================================================

/**
 * Create a Sierpinski triangle slide - recursive triangle fractal.
 */
export function createSierpinskiSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'sierpinski',
    name: 'Sierpinski',
    category: 'fractals',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = '8px';

      let rotation = 0;

      const animate = () => {
        if (!canvas || !ctx) return;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(rotation);
        ctx.translate(-width / 2, -height / 2);

        const size = Math.min(width, height) * 0.9;
        const startX = (width - size) / 2;
        const startY = height - (height - size * Math.sqrt(3) / 2) / 2;

        // Draw Sierpinski triangle with depth based on number of colors
        const depth = Math.min(Math.max(colors.length + 2, 4), 7);
        drawSierpinski(ctx, startX, startY, size, depth, colors, 0);

        ctx.restore();

        rotation += 0.003;
        animationId = requestAnimationFrame(animate);
      };

      animate();
    },
    destroy: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      canvas = null;
    },
  };
}

/**
 * Recursively draw Sierpinski triangle.
 */
function drawSierpinski(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  depth: number,
  colors: PaletteColor[],
  colorIndex: number
): void {
  if (depth === 0) {
    // Draw filled triangle
    const color = colors[colorIndex % colors.length];
    const h = size * Math.sqrt(3) / 2;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y - h);
    ctx.closePath();

    ctx.fillStyle = color.hex;
    ctx.fill();
    ctx.strokeStyle = chroma(color.hex).darken(0.5).hex();
    ctx.lineWidth = 0.5;
    ctx.stroke();
    return;
  }

  const newSize = size / 2;
  const h = newSize * Math.sqrt(3) / 2;

  // Bottom-left triangle
  drawSierpinski(ctx, x, y, newSize, depth - 1, colors, colorIndex);
  // Bottom-right triangle
  drawSierpinski(ctx, x + newSize, y, newSize, depth - 1, colors, (colorIndex + 1) % colors.length);
  // Top triangle
  drawSierpinski(ctx, x + newSize / 2, y - h, newSize, depth - 1, colors, (colorIndex + 2) % colors.length);
}

// ============================================================================
// Fractal Noise Slide
// ============================================================================

/**
 * Create a Fractal Noise slide - multi-octave Perlin-like noise.
 */
export function createFractalNoiseSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'fractal-noise',
    name: 'Fractal Noise',
    category: 'fractals',
    render: (container, colors) => {
      if (colors.length === 0) {
        container.innerHTML = '<div class="slide-empty">Add colors to see visualization</div>';
        return;
      }

      container.innerHTML = '<div class="slide-wrapper"><canvas></canvas></div>';
      const wrapper = container.querySelector('.slide-wrapper') as HTMLElement;
      canvas = container.querySelector('canvas');
      if (!canvas || !wrapper) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.borderRadius = '8px';

      const gradient = buildGradient(colors);

      // Initialize permutation table for noise
      const perm = initPermutation();

      let time = 0;

      const animate = () => {
        if (!canvas || !ctx) return;

        renderFractalNoise(ctx, width, height, time, gradient, perm);

        time += 0.008;
        animationId = requestAnimationFrame(animate);
      };

      animate();
    },
    destroy: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      canvas = null;
    },
  };
}

/**
 * Render fractal noise (fBm - fractional Brownian motion).
 */
function renderFractalNoise(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  gradient: string[],
  perm: number[]
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const scale = 0.01;
  const octaves = 5;
  const persistence = 0.5;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      // Calculate multi-octave noise
      let amplitude = 1;
      let frequency = 1;
      let noiseValue = 0;
      let maxValue = 0;

      for (let o = 0; o < octaves; o++) {
        noiseValue += amplitude * noise3D(
          px * scale * frequency,
          py * scale * frequency,
          time,
          perm
        );
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }

      // Normalize to 0-1
      noiseValue = (noiseValue / maxValue + 1) / 2;

      // Map to gradient
      const colorIdx = Math.floor(noiseValue * (gradient.length - 1));
      const rgb = chroma(gradient[colorIdx]).rgb();

      const idx = (py * width + px) * 4;
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a smooth gradient array from palette colors.
 */
function buildGradient(colors: PaletteColor[]): string[] {
  if (colors.length === 1) {
    // Single color - create light to dark gradient
    const base = chroma(colors[0].hex);
    return [
      base.brighten(2).hex(),
      base.brighten(1).hex(),
      base.hex(),
      base.darken(1).hex(),
      base.darken(2).hex(),
    ];
  }

  // Create smooth gradient through all colors
  const scale = chroma.scale(colors.map(c => c.hex)).mode('lab').colors(64);
  return scale;
}

/**
 * Initialize permutation table for noise.
 */
function initPermutation(): number[] {
  const p: number[] = [];
  for (let i = 0; i < 256; i++) {
    p[i] = i;
  }
  // Shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  // Duplicate for overflow
  return [...p, ...p];
}

/**
 * 3D Perlin-like noise.
 */
function noise3D(x: number, y: number, z: number, perm: number[]): number {
  // Find unit cube containing point
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  // Find relative position in cube
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  // Compute fade curves
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  // Hash coordinates of cube corners
  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;

  // Blend results from 8 corners
  return lerp(w,
    lerp(v,
      lerp(u, grad3D(perm[AA], x, y, z), grad3D(perm[BA], x - 1, y, z)),
      lerp(u, grad3D(perm[AB], x, y - 1, z), grad3D(perm[BB], x - 1, y - 1, z))
    ),
    lerp(v,
      lerp(u, grad3D(perm[AA + 1], x, y, z - 1), grad3D(perm[BA + 1], x - 1, y, z - 1)),
      lerp(u, grad3D(perm[AB + 1], x, y - 1, z - 1), grad3D(perm[BB + 1], x - 1, y - 1, z - 1))
    )
  );
}

/**
 * Fade function for smooth interpolation.
 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation.
 */
function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

/**
 * Gradient function for 3D noise.
 */
function grad3D(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
