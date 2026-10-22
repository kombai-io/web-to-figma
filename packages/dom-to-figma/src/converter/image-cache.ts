import { DedupCache } from "./dedup-cache";
import type { ImageBlobInfo, ImageLoader } from "./nodes/image/loader";
import { processImageFile } from "./nodes/image/loader";

export type ImageCache = DedupCache<HTMLImageElement, ImageBlobInfo>;

export function createImageCache(imageLoader: ImageLoader): ImageCache {
  return new DedupCache({
    load: (element) =>
      imageLoader({ src: element.src, element }).then(processImageFile),
    // Responsive images can share a fallback src while displaying different <picture>/srcset candidates.
    toCacheKey: (element) => element.currentSrc || element.src,
  });
}
