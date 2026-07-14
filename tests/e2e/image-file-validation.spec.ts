import { expect, test } from "@playwright/test";
import {
  MAX_IMAGE_FILE_BYTES,
  validateImageFile,
} from "../../src/lib/imageFileValidation";

test.describe("image file validation", () => {
  test("accepts a JPEG extension when an embedded browser reports a generic MIME type", () => {
    expect(
      validateImageFile({
        name: "line-photo.jpg",
        size: 1024,
        type: "application/octet-stream",
      }),
    ).toEqual({ ok: true, acceptedBy: "extension" });
  });

  test("accepts common browser MIME aliases", () => {
    expect(
      validateImageFile({
        name: "line-photo",
        size: 1024,
        type: "image/jpg",
      }),
    ).toEqual({ ok: true, acceptedBy: "mime" });
  });

  test("rejects unsupported, empty, and oversized files", () => {
    expect(
      validateImageFile({
        name: "not-a-photo.txt",
        size: 1024,
        type: "text/plain",
      }),
    ).toEqual({ ok: false, reason: "unsupported_file_type" });
    expect(
      validateImageFile({ name: "empty.jpg", size: 0, type: "image/jpeg" }),
    ).toEqual({ ok: false, reason: "empty_file" });
    expect(
      validateImageFile({
        name: "large.jpg",
        size: MAX_IMAGE_FILE_BYTES + 1,
        type: "image/jpeg",
      }),
    ).toEqual({ ok: false, reason: "file_too_large" });
  });
});
