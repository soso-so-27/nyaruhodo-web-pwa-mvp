import { BoardV2Prototype } from "../../../components/prototypes/BoardV2Prototype";
import { readBoardV2PrototypeOptions } from "../../../lib/collection/boardV2Prototype";

export default async function BoardV2PrototypePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <BoardV2Prototype options={readBoardV2PrototypeOptions(await searchParams)} />;
}
