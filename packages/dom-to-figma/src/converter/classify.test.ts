// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defaultClassify, formDisplayText } from "./classify";

const SVG_NS = "http://www.w3.org/2000/svg";

const make = (tag: string, attrs: Record<string, string> = {}): Element => {
  const element = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    element.setAttribute(k, v);
  }
  document.body.appendChild(element);
  return element;
};

const makeSvg = (tag: string): Element => {
  const element = document.createElementNS(SVG_NS, tag);
  document.body.appendChild(element);
  return element;
};

describe("defaultClassify", () => {
  it("skips non-visual elements (script, style, head, meta)", () => {
    expect(defaultClassify(make("script"))).toBe("skip");
    expect(defaultClassify(make("style"))).toBe("skip");
    expect(defaultClassify(make("meta"))).toBe("skip");
    expect(defaultClassify(make("noscript"))).toBe("skip");
  });

  it("skips display:none elements", () => {
    const div = make("div") as HTMLElement;
    div.style.display = "none";
    expect(defaultClassify(div)).toBe("skip");
  });

  it("classifies <g> as group", () => {
    expect(defaultClassify(makeSvg("g"))).toBe("group");
  });

  it("classifies svg shape elements as vector", () => {
    for (const tag of [
      "path",
      "circle",
      "rect",
      "ellipse",
      "line",
      "polyline",
      "polygon",
    ]) {
      expect(defaultClassify(makeSvg(tag))).toBe("vector");
    }
  });

  it("classifies <img> as image", () => {
    expect(defaultClassify(make("img"))).toBe("image");
  });

  it("classifies an input with a placeholder as form-with-placeholder", () => {
    const input = make("input", { placeholder: "Email" });
    expect(defaultClassify(input)).toBe("form-with-placeholder");
  });

  it("classifies a textarea with a placeholder as form-with-placeholder", () => {
    const textarea = make("textarea", { placeholder: "Bio" });
    expect(defaultClassify(textarea)).toBe("form-with-placeholder");
  });

  it("does not treat checkbox/radio/submit inputs as form-with-placeholder", () => {
    for (const type of [
      "checkbox",
      "radio",
      "submit",
      "button",
      "file",
      "hidden",
    ]) {
      const input = make("input", { type, placeholder: "anything" });
      expect(defaultClassify(input)).toBe("frame");
    }
  });

  it("falls back to frame for an empty div", () => {
    expect(defaultClassify(make("div"))).toBe("frame");
  });

  it("skips SVG elements that are only referenced, whatever their case", () => {
    for (const tag of [
      "clipPath",
      "mask",
      "symbol",
      "pattern",
      "marker",
      "linearGradient",
      "radialGradient",
      "filter",
    ]) {
      expect(defaultClassify(makeSvg(tag))).toBe("skip");
    }
  });

  it("does not treat an HTML element named like an SVG shape as a vector", () => {
    expect(defaultClassify(make("rect"))).not.toBe("vector");
    expect(defaultClassify(make("mask"))).not.toBe("skip");
  });

  it("classifies a text field holding a value, with no placeholder, as form-with-placeholder", () => {
    const input = make("input") as HTMLInputElement;
    input.value = "ada@example.com";
    expect(defaultClassify(input)).toBe("form-with-placeholder");
  });

  it("does not treat a slider or colour picker's value as text", () => {
    for (const type of ["range", "color"]) {
      const input = make("input", { type }) as HTMLInputElement;
      expect(defaultClassify(input)).toBe("frame");
    }
  });
});

describe("formDisplayText", () => {
  it("prefers the value, then the placeholder", () => {
    const input = make("input", { placeholder: "Email" }) as HTMLInputElement;
    expect(formDisplayText(input)).toEqual({
      text: "Email",
      placeholder: true,
    });
    input.value = "ada@example.com";
    expect(formDisplayText(input)).toEqual({
      text: "ada@example.com",
      placeholder: false,
    });
  });

  it("masks a password value", () => {
    const input = make("input", { type: "password" }) as HTMLInputElement;
    input.value = "hunter2";
    expect(formDisplayText(input)?.text).toBe("\u2022".repeat(7));
  });

  it("returns null for a field with nothing to show", () => {
    expect(formDisplayText(make("input"))).toBeNull();
    expect(formDisplayText(make("input", { placeholder: "  " }))).toBeNull();
  });
});
