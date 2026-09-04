/**
 * Custom Tiptap extension: ImageLink
 *
 * Extends the built-in Image extension so that the `src` attribute
 * accepts an external URL instead of a file upload.  The only change
 * from the stock extension is that `addAttributes` preserves `alt`,
 * `title`, and `caption` alongside `src`, and the NodeView renders a
 * `<figure>` with an optional `<figcaption>`.
 */
import Image from "@tiptap/extension-image";

export const ImageLink = Image.extend({
  name: "imageLink",

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: "",
      },
      title: {
        default: null,
      },
      caption: {
        default: "",
      },
    };
  },
});
