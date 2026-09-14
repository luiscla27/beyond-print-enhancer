/**
 * ImageProcessor: client-side image read (FileReader) and compression
 * (canvas -> webp) used by the upload-from-disk flow.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 4. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 */

"use strict";

/**
 * U-36: in-app confirmation instead of the native `confirm()`.
 *
 * Resolved at CALL time through the shared modal primitive (js/modals.js, which
 * is injected after this file), falling back to the native dialog when the
 * primitive is absent so bare unit boots and existing `window.confirm` stubs
 * keep working. The name is unique per file because several modules are eval'd
 * into ONE shared scope in the test harness.
 */
function imageProcessorAskConfirm(opts) {
  const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
  if (w && typeof w.confirmAction === "function") return w.confirmAction(opts);
  const text = opts.title ? opts.title + "\n\n" + (opts.message || "") : opts.message || "";
  const nativeConfirm = w && typeof w.confirm === "function" ? w.confirm.bind(w) : null;
  return Promise.resolve(nativeConfirm ? nativeConfirm(text) : false);
}

  const ImageProcessor = {
    MAX_SIZE_BYTES: 750 * 1024, // 750KB threshold
    TARGET_WIDTH: 1200, // Reasonable max width for shapes

    /**
     * Processes a file: reads as base64 and compresses if needed.
     * @param {File} file
     * @returns {Promise<string>} Base64 string
     */
    processImage: async (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result;

          if (file.size <= ImageProcessor.MAX_SIZE_BYTES) {
            resolve(base64);
          } else {
            // Large file, needs compression
            const confirmed = await imageProcessorAskConfirm({
              title: "Compress this image?",
              message:
                `The image "${file.name}" is large (${(file.size / 1024).toFixed(1)}KB). ` +
                `It will be resized and compressed so the layout stays fast and sharable. ` +
                `Quality may decrease slightly.`,
              confirmLabel: "Continue",
            });

            if (!confirmed) {
              reject(new Error("User cancelled compression"));
              return;
            }

            try {
              const compressed = await ImageProcessor.compress(base64);
              resolve(compressed);
            } catch (err) {
              reject(err);
            }
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    /**
     * Compresses a base64 image using Canvas.
     * @param {string} base64
     * @returns {Promise<string>}
     */
    compress: async (base64) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Scale down if too wide
          if (width > ImageProcessor.TARGET_WIDTH) {
            const ratio = ImageProcessor.TARGET_WIDTH / width;
            width = ImageProcessor.TARGET_WIDTH;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Export as WebP with 0.8 quality
          resolve(canvas.toDataURL("image/webp", 0.8));
        };
        img.onerror = reject;
        img.src = base64;
      });
    },
  };

if (typeof module !== "undefined" && module.exports) {
  module.exports = ImageProcessor;
}
if (typeof window !== "undefined") {
  window.ImageProcessor = ImageProcessor;
}
