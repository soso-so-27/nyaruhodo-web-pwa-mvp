import type { SupabaseClient } from "@supabase/supabase-js";

export type CatMomentCatLink = {
  catId: string;
  localCatId: string | null;
  name: string;
  isPrimary: boolean;
  linkedAt: string;
};

export type CatMomentForCat = {
  catMomentId: string;
  localMomentId: string;
  localCatId: string;
  ownerCatId: string;
  photoUrl: string;
  state: string;
  visibility: string;
  deliveryStatus: string;
  isPrimary: boolean;
  capturedAt: string | null;
  createdAt: string;
};

type CatsForCatMomentRow = {
  cat_id: string;
  local_cat_id: string | null;
  name: string;
  is_primary: boolean;
  linked_at: string;
};

type CatMomentsForCatRow = {
  cat_moment_id: string;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  state: string;
  visibility: string;
  delivery_status: string;
  is_primary: boolean;
  captured_at: string | null;
  created_at: string;
};

export async function readCatsForCatMoment(
  supabase: SupabaseClient,
  catMomentId: string,
): Promise<CatMomentCatLink[]> {
  const { data, error } = await supabase.rpc("get_cats_for_cat_moment", {
    p_cat_moment_id: catMomentId,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as CatsForCatMomentRow[]).map((row) => ({
    catId: row.cat_id,
    localCatId: row.local_cat_id,
    name: row.name,
    isPrimary: Boolean(row.is_primary),
    linkedAt: row.linked_at,
  }));
}

export async function readCatMomentsForCat(
  supabase: SupabaseClient,
  catId: string,
): Promise<CatMomentForCat[]> {
  const { data, error } = await supabase.rpc("get_cat_moments_for_cat", {
    p_cat_id: catId,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as CatMomentsForCatRow[]).map((row) => ({
    catMomentId: row.cat_moment_id,
    localMomentId: row.local_moment_id,
    localCatId: row.local_cat_id,
    ownerCatId: row.owner_cat_id,
    photoUrl: row.photo_url,
    state: row.state,
    visibility: row.visibility,
    deliveryStatus: row.delivery_status,
    isPrimary: Boolean(row.is_primary),
    capturedAt: row.captured_at,
    createdAt: row.created_at,
  }));
}
