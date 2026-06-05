import { createBrowserSupabaseClient } from "./supabase/browser";

export type ClientAdminCapabilities = {
  isAdmin: boolean;
  testToolsEnabled: boolean;
  stockAdminEnabled: boolean;
};

export async function readClientAdminCapabilities() {
  const headers = new Headers();
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  try {
    const response = await fetch("/api/admin/capabilities", { headers });

    if (!response.ok) {
      return getDefaultCapabilities();
    }

    return {
      ...getDefaultCapabilities(),
      ...((await response.json()) as Partial<ClientAdminCapabilities>),
    };
  } catch {
    return getDefaultCapabilities();
  }
}

function getDefaultCapabilities(): ClientAdminCapabilities {
  return {
    isAdmin: false,
    testToolsEnabled: false,
    stockAdminEnabled: false,
  };
}
