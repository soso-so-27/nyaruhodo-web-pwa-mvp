export type BoardV2PrototypeOptions = {
  mode: "v2" | "current";
  layout: "crop" | "natural";
  frame: "f1" | "f2" | "f3";
  order: "newest" | "brightest";
};

const DEFAULT_OPTIONS: BoardV2PrototypeOptions = {
  mode: "v2",
  layout: "crop",
  frame: "f1",
  order: "newest",
};

export function readBoardV2PrototypeOptions(
  searchParams: Record<string, string | string[] | undefined>,
): BoardV2PrototypeOptions {
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const mode = read("mode");
  const layout = read("layout");
  const frame = read("frame");
  const order = read("order");

  return {
    mode: mode === "current" ? "current" : "v2",
    layout: layout === "natural" ? "natural" : "crop",
    frame: frame === "f2" || frame === "f3" ? frame : "f1",
    order: order === "brightest" ? "brightest" : "newest",
  };
}

export const DEFAULT_BOARD_V2_PROTOTYPE_OPTIONS = DEFAULT_OPTIONS;
