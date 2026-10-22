<p align="center">
  <img src="./assets/figit-logotype.png" alt="Figit" width="240" />
</p>

Convert HTML to editable Figma layers. No plugin needed, just paste.

> **This is Kombai's fork** of [figitdesign/web-to-figma](https://github.com/figitdesign/web-to-figma).
> It publishes the converter as `@kombai/dom-to-figma`, which Kombai's Copy to Figma depends on.
> See [Kombai's fork](#kombais-fork) below for how it differs and how to maintain it.

```ts
import { createFigmaConverter } from "@kombai/dom-to-figma";

const figma = createFigmaConverter();

const result = await figma.convert({
  element: document.getElementById("design"),
  width: 1280,
  height: 800,
  name: "Hero",
});

await navigator.clipboard.write([result.toClipboardItem()]);
```

Paste in Figma with **Cmd+V** / **Ctrl+V**. Done.

## What it does

Walks a real DOM tree, reads computed styles, and produces what Figma reads on paste. Text becomes editable text; images, vectors, gradients, shadows, borders, and form placeholders all carry over. Layouts arrive as **native Figma auto-layout** by default — flex, block flow, wrap, and grid become real stacks, with per-container fallback to absolute positioning when a layout can't be reproduced exactly. Opt out with `createFigmaConverter({ layout: "absolute" })`.

Used in production by [Sleek](https://sleek.design) to copy generated designs straight from the browser into Figma.

## Packages

| Package | Version | Description |
| ------- | ------- | ----------- |
| [`@kombai/dom-to-figma`](./packages/dom-to-figma) | [![npm](https://img.shields.io/npm/v/@kombai/dom-to-figma)](https://www.npmjs.com/package/@kombai/dom-to-figma) | Convert any DOM tree to a Figma clipboard payload. |

See the [`dom-to-figma` README](./packages/dom-to-figma) for the full API: customizing font/image loaders, multi-frame canvases, and DOM-to-node classification.

## Install

```sh
pnpm add @kombai/dom-to-figma
```

## Kombai's fork

- **Base:** upstream `859efea`, the commit that built `@figit/dom-to-figma` 0.2.4. Upstream's
  history is kept, so `git log upstream/main..main` lists everything the fork adds.
- **Published:** only `@kombai/dom-to-figma`. `packages/fig-kiwi` is marked private here, and the
  published converter depends on upstream's `@figit/fig-kiwi` from npm (pnpm swaps `workspace:*`
  for its version on publish). A change to `packages/fig-kiwi` therefore does not ship until it is
  published under `@kombai` too.
- **Releasing:** bump `version` in `packages/dom-to-figma/package.json` and add a `CHANGELOG.md`
  entry in a PR. Merging it to `main` publishes that version to npm (the Release workflow, using the
  `NPM_TOKEN` repo secret). A version already on npm is skipped.
- **Syncing upstream:** `git remote add upstream https://github.com/figitdesign/web-to-figma.git`,
  then `git fetch upstream && git merge upstream/main`. Expect conflicts where the fork renamed
  `@figit/dom-to-figma` to `@kombai/dom-to-figma`.
- **Upstreaming:** a fix that is not Kombai-specific should also go to upstream as a PR.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — Figit.

Not affiliated with or endorsed by Figma.
