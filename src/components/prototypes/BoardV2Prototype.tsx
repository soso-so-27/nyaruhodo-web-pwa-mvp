"use client";

import { CollectionPage } from "../collection/CollectionPage";
import {
  DEFAULT_BOARD_V2_PROTOTYPE_OPTIONS,
  type BoardV2PrototypeOptions,
} from "../../lib/collection/boardV2Prototype";

export function BoardV2Prototype({
  options = DEFAULT_BOARD_V2_PROTOTYPE_OPTIONS,
}: {
  options?: BoardV2PrototypeOptions;
}) {
  return <CollectionPage boardV2Prototype={options} />;
}
