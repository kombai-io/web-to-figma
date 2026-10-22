/**
 * Fidelity regressions that need a real browser's layout and computed styles:
 * paint order, hidden boxes, decorations in auto layout, line splitting, form
 * fields, SVG paint servers and responsive images.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createTestFontLoader,
  loadTestFontIntoBrowser,
  TEST_FONT_FAMILY,
} from "./__fixtures__/loaders";
import type {
  FigmaNodeChange,
  FigmaTextNodeChange,
  FigmaVectorNodeChange,
} from "./converter/types";
import type { ImageLoader } from "./figma";
import { createFigmaConverter } from "./figma";

const WIDTH = 400;
const HEIGHT = 300;

beforeAll(async () => {
  await loadTestFontIntoBrowser();
});

afterEach(() => {
  document.body.innerHTML = "";
});

type Converted = {
  nodes: Array<FigmaNodeChange>;
  /** The node emitted for the element a selector names. */
  nodeFor: (selector: string) => FigmaNodeChange;
};

async function convert(
  html: string,
  imageLoader?: ImageLoader
): Promise<Converted> {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:${WIDTH}px;height:${HEIGHT}px;font-family:'${TEST_FONT_FAMILY}';font-size:16px`;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  await Promise.all(
    Array.from(wrapper.querySelectorAll("img"), (img) => img.decode())
  );
  const figma = createFigmaConverter({
    layout: "auto",
    trace: true,
    fontLoader: createTestFontLoader(),
    ...(imageLoader && { imageLoader }),
  });
  const result = await figma.convert({
    element: wrapper,
    width: WIDTH,
    height: HEIGHT,
  });
  const nodes = result.document.nodeChanges;
  const nodeFor = (selector: string) => {
    const element = wrapper.querySelector(selector);
    const entry = result.trace?.entries.find(
      (candidate) =>
        candidate.tag !== "#text" &&
        candidate.domPath !== ":scope" &&
        wrapper.querySelector(candidate.domPath) === element
    );
    const node = nodes.find(
      (change) => change.guid.localID === entry?.guid.localID
    );
    if (!(element && node)) {
      throw new Error(`no node for ${selector}`);
    }
    return node;
  };
  return { nodes, nodeFor };
}

const texts = (nodes: Array<FigmaNodeChange>): Array<string> =>
  nodes
    .filter((node): node is FigmaTextNodeChange => node.type === "TEXT")
    .map((node) => node.characters.trim());

const named = (nodes: Array<FigmaNodeChange>, name: string) => {
  const node = nodes.find((change) => change.name === name);
  if (!node) {
    throw new Error(`no node named ${name}`);
  }
  return node;
};

const byPosition = (a: FigmaNodeChange, b: FigmaNodeChange) =>
  (a.parentIndex?.position ?? "") < (b.parentIndex?.position ?? "") ? -1 : 1;

const childrenOf = (nodes: Array<FigmaNodeChange>, parent: FigmaNodeChange) =>
  nodes.filter(
    (change) => change.parentIndex?.guid.localID === parent.guid.localID
  );

describe("paint order", () => {
  it("puts a negative z-index layer below in-flow content", async () => {
    const { nodes, nodeFor } = await convert(
      `<div id="stack" style="position:relative;z-index:0;width:200px;height:100px">
        <div id="content" style="width:100px;height:40px;background:blue"></div>
        <div id="backdrop" style="position:absolute;inset:0;z-index:-1;background:red"></div>
      </div>`
    );
    const order = childrenOf(nodes, nodeFor("#stack")).sort(byPosition);
    expect(order.indexOf(nodeFor("#backdrop"))).toBeLessThan(
      order.indexOf(nodeFor("#content"))
    );
  });
});

describe("visibility: hidden", () => {
  it("keeps a hidden box's visible descendants without painting the box or its own text", async () => {
    const { nodes, nodeFor } = await convert(
      `<div id="hidden" style="visibility:hidden;width:200px;padding:8px;background:red;border:2px solid blue;outline:2px solid green">
        Hidden text
        <span style="visibility:visible">Shown text</span>
      </div>`
    );
    const hidden = nodeFor("#hidden");
    expect(hidden.type).toBe("FRAME");
    expect("fillPaints" in hidden ? hidden.fillPaints : []).toEqual([]);
    expect("strokePaints" in hidden ? hidden.strokePaints : []).toEqual([]);
    expect(nodes.some((change) => change.name === "Outline")).toBe(false);
    expect(texts(nodes)).toEqual(["Shown text"]);
  });
});

describe("decorations in auto layout", () => {
  const decoration = async (style: string, name: string) => {
    const { nodes } = await convert(
      `<div style="display:flex;flex-direction:column;width:200px;${style}"><div style="height:100px;background:red"></div></div>`
    );
    const ring = named(nodes, name);
    const parent = nodes.find(
      (change) => change.guid.localID === ring.parentIndex?.guid.localID
    );
    if (!parent) {
      throw new Error("decoration has no parent");
    }
    const position = ring.parentIndex?.position ?? "";
    const siblings = childrenOf(nodes, parent)
      .filter((change) => change !== ring)
      .map((change) => change.parentIndex?.position ?? "");
    return {
      parentStack: "stackMode" in parent ? parent.stackMode : undefined,
      positioning: "stackPositioning" in ring ? ring.stackPositioning : "",
      // Figma orders siblings by comparing positions as code units.
      above: siblings.length > 0 && siblings.every((s) => position > s),
      below: siblings.length > 0 && siblings.every((s) => position < s),
    };
  };

  it("draws an outline above the content, taking no slot in the stack", async () => {
    expect(
      await decoration("outline:2px solid green;outline-offset:-2px", "Outline")
    ).toEqual({
      parentStack: "VERTICAL",
      positioning: "ABSOLUTE",
      above: true,
      below: false,
    });
  });

  it("draws a double border's inner line below the content, taking no slot in the stack", async () => {
    expect(
      await decoration("border:6px double blue", "Border (inner)")
    ).toEqual({
      parentStack: "VERTICAL",
      positioning: "ABSOLUTE",
      above: false,
      below: true,
    });
  });
});

describe("wrapped text", () => {
  it("keeps wrapped text in a flex item as one text layer", async () => {
    const { nodes } = await convert(
      `<div style="display:flex;align-items:center;gap:16px;width:300px;padding:12px">
        <span style="flex:0 0 84px;height:84px"><i style="display:block;width:84px;height:84px;background:#ccc"></i></span>
        <span style="min-width:0">Botanical line art printable with a longer label</span>
      </div>`
    );
    expect(texts(nodes)).toEqual([
      "Botanical line art printable with a longer label",
    ]);
  });

  it("keeps bare text in a flex row as one text layer", async () => {
    const { nodes } = await convert(
      `<div style="display:flex;align-items:center;gap:8px;width:140px">
        <span style="flex:0 0 24px"><i style="display:block;width:24px;height:24px;background:#ccc"></i></span>Download the printable files now
      </div>`
    );
    expect(texts(nodes)).toEqual(["Download the printable files now"]);
  });

  it("still splits inline text that starts mid-line into one layer per line", async () => {
    const { nodes } = await convert(
      `<p style="width:160px;margin:0"><b>Note:</b> <span>this sentence starts mid-line and wraps across lines</span></p>`
    );
    const [first, ...rest] = texts(nodes);
    expect(first).toBe("Note:");
    expect(rest.length).toBeGreaterThan(1);
    expect(rest.join(" ")).toBe(
      "this sentence starts mid-line and wraps across lines"
    );
  });

  it("measures the text nodes of a display: contents element separately", async () => {
    const { nodes } = await convert(
      `<p style="width:300px;margin:0">Before <span style="display:contents">inside</span> after</p>`
    );
    // A display: contents box measures 0×0; its text keeps the size it renders at.
    const inside = nodes.find(
      (change): change is FigmaTextNodeChange =>
        change.type === "TEXT" && change.characters.trim() === "inside"
    );
    expect(inside?.size.x).toBeGreaterThan(0);
    expect(inside?.size.y).toBeGreaterThan(0);
  });
});

describe("form fields", () => {
  it("exports a text field's value, else its placeholder in the ::placeholder colour", async () => {
    const { nodes } = await convert(
      `<style>#empty::placeholder { color: rgb(255, 0, 0); }</style>
      <input id="filled" value="ada@example.com" style="width:200px">
      <input id="empty" placeholder="Email" style="width:200px;color:rgb(0,0,0)">
      <input id="secret" type="password" value="hunter2" style="width:200px">`
    );
    expect(texts(nodes)).toEqual(["ada@example.com", "Email", "•".repeat(7)]);
    const placeholder = nodes.find(
      (change): change is FigmaTextNodeChange =>
        change.type === "TEXT" && change.characters === "Email"
    );
    const fill = placeholder?.fillPaints?.[0];
    expect(fill && "color" in fill ? fill.color : undefined).toMatchObject({
      r: 1,
      g: 0,
      b: 0,
    });
  });

  it("exports a closed select's selected label only", async () => {
    const { nodes } = await convert(
      `<select style="width:200px"><option>First</option><option selected>Second</option><option>Third</option></select>`
    );
    expect(texts(nodes)).toEqual(["Second"]);
  });

  it("converts a form that has a control named type", async () => {
    const { nodes } = await convert(
      `<form style="width:200px;height:40px"><input name="type" value="kind"></form>`
    );
    expect(texts(nodes)).toEqual(["kind"]);
  });
});

describe("SVG", () => {
  it("fills a shape that references a gradient paint server", async () => {
    const { nodes } = await convert(
      `<svg width="100" height="50" viewBox="0 0 100 50">
        <defs><linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs>
        <rect width="100" height="50" fill="url(#g)"/>
      </svg>`
    );
    const vectors = nodes.filter(
      (change): change is FigmaVectorNodeChange => change.type === "VECTOR"
    );
    expect(vectors).toHaveLength(1);
    expect(vectors[0]?.fillPaints?.map((paint) => paint.type)).toEqual([
      "GRADIENT_LINEAR",
    ]);
  });

  it("does not draw a clip path's shape", async () => {
    const { nodes } = await convert(
      `<svg width="24" height="24" viewBox="0 0 24 24">
        <clipPath id="half"><rect width="12" height="24"/></clipPath>
        <circle cx="12" cy="12" r="10" fill="blue" clip-path="url(#half)"/>
      </svg>`
    );
    const vectors = nodes.filter((change) => change.type === "VECTOR");
    expect(vectors).toHaveLength(1);
  });
});

describe("responsive images", () => {
  it("loads each <picture> candidate the browser chose, even with a shared fallback src", async () => {
    const pixel = async (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("no 2d context");
      }
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) {
        throw new Error("toBlob failed");
      }
      return URL.createObjectURL(blob);
    };
    const [fallback, red, blue] = await Promise.all([
      pixel("gray"),
      pixel("red"),
      pixel("blue"),
    ]);
    const loaded: Array<string> = [];
    const loader: ImageLoader = async ({ element }) => {
      const src = element.currentSrc || element.src;
      loaded.push(src);
      const response = await fetch(src);
      const blob = await response.blob();
      return { bytes: await blob.arrayBuffer(), mimeType: blob.type };
    };
    await convert(
      [red, blue]
        .map(
          (src) =>
            `<picture><source srcset="${src}"><img src="${fallback}" width="20" height="20"></picture>`
        )
        .join(""),
      loader
    );
    expect(loaded.sort()).toEqual([red, blue].sort());
  });
});
