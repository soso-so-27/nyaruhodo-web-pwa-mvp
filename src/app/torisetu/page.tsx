import { redirect } from "next/navigation";

export default function LegacyCatsRedirectPage() {
  redirect("/cats");
}
