/**
 * Geometric Slides
 *
 * Geometric pattern visualization slides for the color palette visualizer.
 * Part of DES004-10.
 */

import chroma from 'chroma-js';
import type { Slide } from '../types';

// ============================================================================
// Tessellation Slide
// ============================================================================

/**
 * Create a tessellation slide - repeating polygon patterns.
 * Uses hexagons for a visually appealing honeycomb pattern.
 */
export function createTessellationSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'tessellation',
    name: 'Tessellation',
    category: 'geometric',
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

      // Hexagon parameters
      const hexRadius = 30;
      const hexWidth = hexRadius * 2;
      const hexHeight = Math.sqrt(3) * hexRadius;

      let time = 0;
      const animate = () => {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, width, height);

        // Draw hexagonal grid
        for (let row = -1; row < Math.ceil(height / hexHeight) + 1; row++) {
          for (let col = -1; col < Math.ceil(width / (hexWidth * 0.75)) + 1; col++) {
            const x = col * hexWidth * 0.75;
            const y = row * hexHeight + (col % 2 === 1 ? hexHeight / 2 : 0);

            // Animate color selection with wave effect
            const waveOffset = Math.sin(time + col * 0.3 + row * 0.2) * 0.5 + 0.5;
            const idx = Math.floor(waveOffset * colors.length) % colors.length;
            const color = colors[idx];

            drawHexagon(ctx, x, y, hexRadius * 0.95, color.hex);
          }
        }

        time += 0.02;
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
 * Draw a hexagon at the specified position.
 */
function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillColor: string
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + radius * Math.cos(angle);
    const py = y + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = chroma(fillColor).darken(0.3).hex();
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ============================================================================
// Voronoi Slide
// ============================================================================

interface VoronoiPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

/**
 * Create a Voronoi diagram slide - cells with palette colors.
 */
export function createVoronoiSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;
  let points: VoronoiPoint[] = [];

  return {
    id: 'voronoi',
    name: 'Voronoi',
    category: 'geometric',
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

      // Initialize points - one per color, distributed randomly
      points = colors.map((c) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        color: c.hex,
      }));

      const animate = () => {
        if (!canvas || !ctx) return;

        // Update point positions
        for (const p of points) {
          p.x += p.vx;
          p.y += p.vy;

          // Bounce off walls
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Keep in bounds
          p.x = Math.max(0, Math.min(width, p.x));
          p.y = Math.max(0, Math.min(height, p.y));
        }

        // Render Voronoi using pixel-by-pixel nearest neighbor
        renderVoronoi(ctx, points, width, height);

        animationId = requestAnimationFrame(animate);
      };

      animate();
    },
    destroy: () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      points = [];
      canvas = null;
    },
  };
}

/**
 * Render Voronoi diagram by finding nearest point for each pixel.
 * Optimized with downsampling for performance.
 */
function renderVoronoi(
  ctx: CanvasRenderingContext2D,
  points: VoronoiPoint[],
  width: number,
  height: number
): void {
  // Use lower resolution for performance, then scale up with smoothing
  const scale = 2;  // Higher resolution for softer edges
  const w = Math.ceil(width / scale);
  const h = Math.ceil(height / scale);
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x * scale;
      const py = y * scale;

      // Find nearest point
      let minDist = Infinity;
      let nearestColor = '#000000';
      for (const p of points) {
        const dx = px - p.x;
        const dy = py - p.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          nearestColor = p.color;
        }
      }

      const rgb = chroma(nearestColor).rgb();
      const idx = (y * w + x) * 4;
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }

  // Create temporary canvas for scaling
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.putImageData(imageData, 0, 0);

  // Scale up to full size with smoothing for soft edges
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tempCanvas, 0, 0, width, height);

  // Apply blur for soft, organic edges
  ctx.filter = 'blur(1.5px)';
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = 'none';

  // Draw point markers
  drawVoronoiEdges(ctx, points);
}

/**
 * Draw point markers on Voronoi cells.
 */
function drawVoronoiEdges(
  ctx: CanvasRenderingContext2D,
  points: VoronoiPoint[]
): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;

  // Draw circles at each point
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = chroma(p.color).darken(1).hex();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

// ============================================================================
// Spirograph Slide
// ============================================================================

/**
 * Create a spirograph slide - rotating geometric curves.
 */
export function createSpirographSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'spirograph',
    name: 'Spirograph',
    category: 'geometric',
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

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2 - 10;

      // Spirograph parameters
      // R = fixed circle radius, r = moving circle radius, d = pen distance
      const R = maxRadius * 0.6;
      const patterns = colors.map((c, i) => ({
        color: c.hex,
        r: R * (0.3 + 0.15 * Math.sin(i * 0.7)),
        d: R * (0.5 + 0.3 * Math.cos(i * 1.1)),
        offset: (i * Math.PI * 2) / colors.length,
      }));

      let t = 0;
      const points: { x: number; y: number; color: string }[][] = patterns.map(() => []);

      // Fill background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);

      const animate = () => {
        if (!canvas || !ctx) return;

        // Fade effect for trailing lines
        ctx.fillStyle = 'rgba(26, 26, 46, 0.02)';
        ctx.fillRect(0, 0, width, height);

        // Calculate and draw each pattern
        patterns.forEach((pattern, i) => {
          const { color, r, d, offset } = pattern;
          const angle = t + offset;

          // Spirograph equations
          // x = (R - r) * cos(angle) + d * cos((R - r) / r * angle)
          // y = (R - r) * sin(angle) - d * sin((R - r) / r * angle)
          const x = centerX + (R - r) * Math.cos(angle) + d * Math.cos(((R - r) / r) * angle);
          const y = centerY + (R - r) * Math.sin(angle) - d * Math.sin(((R - r) / r) * angle);

          points[i].push({ x, y, color });

          // Keep only last 500 points per pattern
          if (points[i].length > 500) {
            points[i].shift();
          }

          // Draw the curve
          if (points[i].length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';

            for (let j = 1; j < points[i].length; j++) {
              const alpha = j / points[i].length;
              ctx.globalAlpha = alpha * 0.8;
              ctx.beginPath();
              ctx.moveTo(points[i][j - 1].x, points[i][j - 1].y);
              ctx.lineTo(points[i][j].x, points[i][j].y);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }

          // Draw current point
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });

        t += 0.03;
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

// ============================================================================
// Kaleidoscope Slide
// ============================================================================

/**
 * Create a kaleidoscope slide - mirrored symmetrical pattern.
 */
export function createKaleidoscopeSlide(): Slide {
  let canvas: HTMLCanvasElement | null = null;
  let animationId: number | null = null;

  return {
    id: 'kaleidoscope',
    name: 'Kaleidoscope',
    category: 'geometric',
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

      const centerX = width / 2;
      const centerY = height / 2;
      const segments = 12; // Number of mirror segments
      const segmentAngle = (Math.PI * 2) / segments;

      // Floating shapes
      interface KaleidoShape {
        angle: number;
        dist: number;
        size: number;
        color: string;
        speed: number;
        distSpeed: number;
        type: 'circle' | 'triangle' | 'diamond';
      }

      const shapes: KaleidoShape[] = [];
      const shapeTypes: ('circle' | 'triangle' | 'diamond')[] = ['circle', 'triangle', 'diamond'];

      // Create shapes for each color
      colors.forEach((c, i) => {
        for (let j = 0; j < 3; j++) {
          shapes.push({
            angle: Math.random() * segmentAngle,
            dist: 20 + Math.random() * (Math.min(width, height) / 3),
            size: 8 + Math.random() * 15,
            color: c.hex,
            speed: 0.005 + Math.random() * 0.01,
            distSpeed: 0.3 + Math.random() * 0.5,
            type: shapeTypes[(i + j) % shapeTypes.length],
          });
        }
      });

      let time = 0;

      const animate = () => {
        if (!canvas || !ctx) return;

        // Clear with semi-transparent background for trails
        ctx.fillStyle = 'rgba(26, 26, 46, 0.1)';
        ctx.fillRect(0, 0, width, height);

        // Update shapes
        for (const shape of shapes) {
          shape.angle += shape.speed;
          shape.dist += Math.sin(time * shape.distSpeed) * 0.5;

          // Keep angle within one segment
          if (shape.angle > segmentAngle) shape.angle -= segmentAngle;
          if (shape.angle < 0) shape.angle += segmentAngle;
        }

        // Draw shapes mirrored across all segments
        ctx.save();
        ctx.translate(centerX, centerY);

        for (let seg = 0; seg < segments; seg++) {
          ctx.save();
          ctx.rotate(seg * segmentAngle);

          // Draw each shape
          for (const shape of shapes) {
            const x = Math.cos(shape.angle) * shape.dist;
            const y = Math.sin(shape.angle) * shape.dist;

            drawKaleidoShape(ctx, x, y, shape.size, shape.color, shape.type);

            // Mirror within segment
            ctx.save();
            ctx.scale(1, -1);
            drawKaleidoShape(ctx, x, y, shape.size, shape.color, shape.type);
            ctx.restore();
          }

          ctx.restore();
        }

        ctx.restore();

        // Draw center decoration
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
        colors.forEach((c, i) => {
          gradient.addColorStop(i / colors.length, c.hex);
        });
        gradient.addColorStop(1, colors[0].hex);

        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        time += 0.02;
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
 * Draw a kaleidoscope shape.
 */
function drawKaleidoShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  type: 'circle' | 'triangle' | 'diamond'
): void {
  ctx.fillStyle = chroma(color).alpha(0.7).css();
  ctx.strokeStyle = chroma(color).darken(0.5).hex();
  ctx.lineWidth = 1;

  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;

    case 'triangle':
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
        const px = x + Math.cos(angle) * size / 2;
        const py = y + Math.sin(angle) * size / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x + size / 3, y);
      ctx.lineTo(x, y + size / 2);
      ctx.lineTo(x - size / 3, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
  }
}
