---
"@kombai/dom-to-figma": minor
---

First release as `@kombai/dom-to-figma`, Kombai's fork of `@figit/dom-to-figma` 0.2.4.

- Export `cssBackgroundToFigmaPaints`, which now parses each background layer on its own and lists them bottom layer first; a `url()` layer no longer shortens a gradient.
- Skip SVG elements that are only referenced (`clipPath`, `mask`, `symbol`, `pattern`, `marker`, gradients, `filter`), whatever their case; treat only SVG-namespace elements as vector shapes.
- Fill and stroke SVG shapes from a referenced linear or radial gradient.
- A colour value that cannot be parsed gives no paint instead of dropping the layer.
- Paint negative z-index layers below in-flow content.
- A `visibility: hidden` box keeps its visible descendants but paints no fill, border, shadow, outline or text of its own.
- In an auto layout frame, a double border's inner line and an outline ring are positioned absolutely, the line below the children and the ring above them.
- Wrapped text in a flex or grid item stays one text layer; only text in inline flow is split per line.
- A `display: contents` or background-image element is not treated as plain text.
- Form fields export their value (bullets for a password), else the placeholder in its `::placeholder` colour, measured in the field's own document; a closed `<select>` exports its selected label; a form with a control named `type` converts.
- Responsive images are cached by `currentSrc`.
