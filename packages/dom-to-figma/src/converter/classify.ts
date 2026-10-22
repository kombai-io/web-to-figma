import { TRANSPARENT_COLOR_VALUES } from "./styles/color";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type ElementKind =
  | "skip"
  | "group"
  | "frame"
  | "vector"
  | "image"
  | "text"
  | "form-with-placeholder";

export function defaultClassify(element: Element): ElementKind {
  if (isNonVisualElement(element)) {
    return "skip";
  }
  if (isHiddenElement(element)) {
    return "skip";
  }
  if (isGroupElement(element)) {
    return "group";
  }
  if (isSvgShapeElement(element)) {
    return "vector";
  }
  if (isImageElement(element)) {
    return "image";
  }
  if (isPlainTextElement(element)) {
    return "text";
  }
  if (isFormElementWithPlaceholder(element) && formDisplayText(element)) {
    return "form-with-placeholder";
  }
  return "frame";
}

// SVG elements that are only ever referenced, never drawn where they stand. Compared lowercased:
// `tagName` keeps an SVG element's case, so "clipPath" never matched a lowercased name, and a clip
// shape outside <defs> pasted as a visible shape (a <symbol>'s, <mask>'s or <pattern>'s likewise).
const SVG_REFERENCED_ONLY = new Set([
  "clippath",
  "mask",
  "symbol",
  "pattern",
  "marker",
  "lineargradient",
  "radialgradient",
  "filter",
]);

function isNonVisualElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "script" ||
    tagName === "style" ||
    tagName === "head" ||
    tagName === "meta" ||
    tagName === "title" ||
    tagName === "link" ||
    tagName === "noscript" ||
    tagName === "template" ||
    tagName === "comment" ||
    tagName === "defs" ||
    tagName === "desc" ||
    (element.namespaceURI === SVG_NAMESPACE && SVG_REFERENCED_ONLY.has(tagName))
  );
}

function isHiddenElement(element: Element): boolean {
  const computedStyle = window.getComputedStyle(element);

  if (computedStyle.display === "none") {
    return true;
  }

  const clip = computedStyle.clip;
  if (clip === "rect(0px, 0px, 0px, 0px)" || clip === "rect(0, 0, 0, 0)") {
    return true;
  }

  return false;
}

function isGroupElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "g";
}

function isSvgShapeElement(element: Element): boolean {
  // By namespace too: an HTML `<rect>` outside any <svg> has none of the SVG geometry properties.
  if (element.namespaceURI !== SVG_NAMESPACE) {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "path" ||
    tagName === "circle" ||
    tagName === "rect" ||
    tagName === "ellipse" ||
    tagName === "line" ||
    tagName === "polyline" ||
    tagName === "polygon"
  );
}

function isImageElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "img";
}

/**
 * A plain text element is a leaf with text content and no painted box of its
 * own (no padding, border, or background). The whole element is treated as
 * text rather than a frame containing text.
 *
 * A `display: contents` element has no box at all, so it is not one: its text
 * nodes are measured separately, where a Range gives their actual size.
 */
function isPlainTextElement(element: Element): boolean {
  const computedStyle = window.getComputedStyle(element);
  const hasText = !!(element.textContent || "").trim().length;
  const isTransparent = TRANSPARENT_COLOR_VALUES.includes(
    computedStyle.backgroundColor
  );
  const hasNoPadding = computedStyle.padding === "0px";
  const hasNoBorder = computedStyle.borderWidth === "0px";
  const hasBackgroundImage =
    !!computedStyle.backgroundImage && computedStyle.backgroundImage !== "none";

  return (
    hasText &&
    computedStyle.display !== "contents" &&
    element.children.length === 0 &&
    isTransparent &&
    !hasBackgroundImage &&
    hasNoPadding &&
    hasNoBorder
  );
}

const FORM_PLACEHOLDER_EXCLUDED_TYPES = [
  "checkbox",
  "radio",
  "submit",
  "button",
  "file",
  "hidden",
];

function isFormElementWithPlaceholder(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  // A closed <select> shows its selected option only; walked as a frame, every <option> became text.
  if (tagName === "select") {
    const select = element as HTMLSelectElement;
    return !select.multiple && select.size <= 1;
  }
  // `form.type` is a named-property lookup (a control named "type"), not a string.
  const type: unknown = (element as HTMLInputElement).type;
  const inputType = typeof type === "string" ? type.toLowerCase() : "";

  return (
    (tagName === "input" &&
      !FORM_PLACEHOLDER_EXCLUDED_TYPES.includes(inputType)) ||
    tagName === "textarea"
  );
}

// A slider's or colour picker's value is state, not text the control paints.
const FORM_VALUE_NOT_TEXT_TYPES = ["range", "color", "image"];

export type FormDisplayText = {
  text: string;
  /** The text is the placeholder, painted in the field's `::placeholder` colour. */
  placeholder: boolean;
};

/**
 * The text a form field shows: a closed <select>'s selected label, a text
 * field's value (bullets for a password), else its placeholder. A field
 * holding a value used to export as an empty box, and one with no placeholder
 * was not treated as a field at all.
 */
export function formDisplayText(element: Element): FormDisplayText | null {
  if (element.tagName.toLowerCase() === "select") {
    const label = (
      element as HTMLSelectElement
    ).selectedOptions[0]?.text.trim();
    return label ? { text: label, placeholder: false } : null;
  }
  const field = element as HTMLInputElement | HTMLTextAreaElement;
  if (FORM_VALUE_NOT_TEXT_TYPES.includes(field.type)) {
    return null;
  }
  const value = typeof field.value === "string" ? field.value : "";
  if (value.trim()) {
    return {
      text: field.type === "password" ? "\u2022".repeat(value.length) : value,
      placeholder: false,
    };
  }
  const placeholder = element.getAttribute("placeholder")?.trim();
  return placeholder ? { text: placeholder, placeholder: true } : null;
}
