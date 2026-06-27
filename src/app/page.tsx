import { redirect } from "next/navigation";

const ATTRIBUTION_PARAMS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "campaign",
  "ref",
  "referral",
  "invite",
] as const;

type RootPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: RootPageProps) {
  redirect(buildRedirectTarget("/home", (await searchParams) ?? {}));
}

function buildRedirectTarget(
  pathname: "/home",
  currentParams: Record<string, string | string[] | undefined>,
) {
  const nextParams = new URLSearchParams();

  for (const key of ATTRIBUTION_PARAMS) {
    const value = getFirstParamValue(currentParams[key]);
    if (value) {
      nextParams.set(key, value.slice(0, 120));
    }
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getFirstParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
