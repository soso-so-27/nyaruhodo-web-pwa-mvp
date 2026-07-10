import { AdminAccessGate } from "../../../components/admin/AdminAccessGate";
import { BoardV2Prototype } from "../../../components/prototypes/BoardV2Prototype";

export const dynamic = "force-dynamic";

export default function AdminBoardV2Page() {
  return (
    <AdminAccessGate title="Board v2">
      <BoardV2Prototype />
    </AdminAccessGate>
  );
}
