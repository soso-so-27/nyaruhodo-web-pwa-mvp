import { AdminAccessGate } from "../../../components/admin/AdminAccessGate";
import { BoardV2Prototype } from "../../../components/prototypes/BoardV2Prototype";
import { readBoardV2PrototypeOptions } from "../../../lib/collection/boardV2Prototype";

export const dynamic = "force-dynamic";

export default async function AdminBoardV2Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminAccessGate title="Board v2">
      <BoardV2Prototype options={readBoardV2PrototypeOptions(await searchParams)} />
    </AdminAccessGate>
  );
}
