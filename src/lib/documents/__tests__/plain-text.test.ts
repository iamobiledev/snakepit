import { describe, expect, it } from "vitest";
import { extractPlainText, buildSearchVectorSql } from "../plain-text";

describe("extractPlainText", () => {
  it("returns empty string for non-object / empty input", () => {
    expect(extractPlainText(null)).toBe("");
    expect(extractPlainText(undefined)).toBe("");
    expect(extractPlainText("just a string")).toBe("");
    expect(extractPlainText(42)).toBe("");
    expect(extractPlainText({})).toBe("");
  });

  it("returns the text of a leaf text node", () => {
    expect(extractPlainText({ type: "text", text: "hello" })).toBe("hello");
  });

  it("uses the linked page title for sub-page blocks", () => {
    expect(
      extractPlainText({ type: "subpage", attrs: { title: "Roadmap" } }),
    ).toBe("Roadmap");
    expect(extractPlainText({ type: "subpage" })).toBe("");
  });

  it("joins paragraph/heading/listItem children with newlines", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "first" },
            { type: "text", text: "second" },
          ],
        },
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe("first\nsecond Title");
  });

  it("joins other container children with spaces", () => {
    const doc = {
      type: "bulletList",
      content: [
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ],
    };
    expect(extractPlainText(doc)).toBe("a b");
  });

  it("joins block-level siblings under a container with spaces", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "one" }] },
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ type: "text", text: "two" }] },
      ],
    };
    // Empty paragraphs contribute nothing; the "doc" container joins with spaces.
    expect(extractPlainText(doc)).toBe("one two");
  });

  it("strips whitespace left dangling before a newline", () => {
    const paragraph = {
      type: "paragraph",
      content: [
        { type: "text", text: "one " },
        { type: "text", text: "two" },
      ],
    };
    // The two text nodes join with "\n" (paragraph parent), leaving "one \ntwo"
    // before the trailing-space cleanup collapses it.
    expect(extractPlainText(paragraph)).toBe("one\ntwo");
  });

  it("ignores nodes without text or content arrays", () => {
    expect(extractPlainText({ type: "horizontalRule" })).toBe("");
    expect(extractPlainText({ type: "doc", content: "not-an-array" })).toBe("");
  });
});

describe("buildSearchVectorSql", () => {
  it("passes through the weighted field inputs unchanged", () => {
    expect(
      buildSearchVectorSql("Title", "body text", "Team / Docs"),
    ).toEqual({
      title: "Title",
      plainText: "body text",
      breadcrumb: "Team / Docs",
    });
  });
});
