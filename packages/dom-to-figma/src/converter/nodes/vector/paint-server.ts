import Color from "colorjs.io";

import { cssBackgroundToFigmaPaints } from "../../styles/gradient";
import type { FigmaPaint } from "../../types";

const PAINT_SERVER_REFERENCE = /^url\(\s*["']?#([^"')]+)["']?\s*\)/;
// A gradient that inherits its stops through `href` chains; bounded against a cycle.
const MAX_HREF_HOPS = 5;
const TRAILING_STOP_OFFSET = /\s[\d.]+%$/;
const RIGHT_ANGLE_DEG = 90;
const PERCENT = 100;
const MAX_CHANNEL = 255;

/**
 * An SVG paint-server reference (`fill="url(#g)"`) as Figma paints: the
 * referenced linear or radial gradient's stops (following `href` for inherited
 * stops) re-expressed as the equivalent CSS gradient, which the CSS gradient
 * converter then maps. The line's angle is taken in bounding-box space; the
 * gradient's exact end points and `userSpaceOnUse` units are approximated.
 * Anything else (a pattern, a missing id) produces no paint.
 */
export function svgPaintServerToFigmaPaints(
  element: Element,
  value: string,
  box: { width: number; height: number },
  opacity: number
): Array<FigmaPaint> {
  const id = PAINT_SERVER_REFERENCE.exec(value || "")?.[1];
  if (!id) {
    return [];
  }
  const doc = element.ownerDocument;
  const server = doc.getElementById(id);
  if (!server) {
    return [];
  }

  const stops = gradientStops(doc, server);
  const cssStops = stops.flatMap((stop) => {
    const cssStop = stopToCss(doc, stop);
    return cssStop ? [cssStop] : [];
  });
  const [onlyStop] = cssStops;
  if (onlyStop === undefined) {
    return [];
  }
  if (cssStops.length === 1) {
    cssStops.push(onlyStop.replace(TRAILING_STOP_OFFSET, " 100%"));
  }

  const tag = server.tagName.toLowerCase();
  let css: string;
  if (tag === "lineargradient") {
    css = `linear-gradient(${linearAngle(server, box)}deg, ${cssStops.join(", ")})`;
  } else if (tag === "radialgradient") {
    css = `radial-gradient(${cssStops.join(", ")})`;
  } else {
    return [];
  }

  const scale = Number.isFinite(opacity) ? opacity : 1;
  return cssBackgroundToFigmaPaints(css, box).map((paint) => ({
    ...paint,
    opacity: (paint.opacity ?? 1) * scale,
  }));
}

function gradientStops(doc: Document, server: Element): Array<Element> {
  let source: Element | null = server;
  for (
    let hops = 0;
    source && !source.querySelector("stop") && hops < MAX_HREF_HOPS;
    hops += 1
  ) {
    const ref: string | null =
      source.getAttribute("href") || source.getAttribute("xlink:href");
    source = ref?.startsWith("#") ? doc.getElementById(ref.slice(1)) : null;
  }
  return source ? Array.from(source.querySelectorAll("stop")) : [];
}

function stopToCss(doc: Document, stop: Element): string | null {
  const style = (doc.defaultView ?? window).getComputedStyle(stop);
  let color: Color;
  try {
    color = new Color(
      style.stopColor || stop.getAttribute("stop-color") || "black"
    );
  } catch {
    return null;
  }
  const stopOpacity = Number.parseFloat(
    style.stopOpacity || stop.getAttribute("stop-opacity") || "1"
  );
  if (Number.isFinite(stopOpacity)) {
    color.alpha = Number(color.alpha) * stopOpacity;
  }
  const rawOffset = (stop.getAttribute("offset") || "0").trim();
  const offset = rawOffset.endsWith("%")
    ? Number.parseFloat(rawOffset)
    : Number.parseFloat(rawOffset) * PERCENT;
  const [r, g, b] = color
    .to("srgb")
    .coords.map((c) =>
      Math.round(Math.min(1, Math.max(0, c ?? 0)) * MAX_CHANNEL)
    );
  const clampedOffset = Math.min(
    PERCENT,
    Math.max(0, Number.isFinite(offset) ? offset : 0)
  );
  return `rgba(${r}, ${g}, ${b}, ${Number(color.alpha)}) ${clampedOffset}%`;
}

/** The CSS angle of a linear gradient's `x1,y1 → x2,y2` line across the box. */
function linearAngle(
  server: Element,
  box: { width: number; height: number }
): number {
  const coord = (name: string, fallback: number) => {
    const raw = server.getAttribute(name);
    if (raw == null) {
      return fallback;
    }
    const n = Number.parseFloat(raw);
    return raw.trim().endsWith("%") ? n / PERCENT : n;
  };
  const dx = (coord("x2", 1) - coord("x1", 0)) * box.width;
  const dy = (coord("y2", 0) - coord("y1", 0)) * box.height;
  if (dx === 0 && dy === 0) {
    return RIGHT_ANGLE_DEG;
  }
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}
