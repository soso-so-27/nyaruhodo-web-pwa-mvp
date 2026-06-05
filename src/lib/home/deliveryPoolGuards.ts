type DeliveryPoolRow = {
  local_moment_id: string;
  photo_url: string;
};

const BLOCKED_DELIVERY_LOCAL_MOMENT_IDS = new Set([
  "stock-sleeping-1780668154655-b6ebb7421ee0e",
  "stock-sleeping-1780668122297-e5eb05d072a45",
  "stock-sleeping-1780667902062-8cc5f82a733e5",
  "stock-sleeping-1780667802730-180dbaa18761e",
  "stock-sleeping-1780666931418-d851bd309b9be",
  "stock-sleeping-1780666298462-0bf050c1b4a46",
  "stock-sleeping-1780666290974-667316fed23db",
  "stock-sleeping-1780666262667-1443252bdfc25",
  "stock-sleeping-1780666061119-da7170a017e6d",
  "prod-e2e-own-1780664582769",
  "stock-sleeping-1780664461864-f0a8a577c37d8",
  "e2e-own-1780663561797",
  "e2e-own-1780663409732",
  "e2e-own-1780663211271",
  "fallback-own-1780662556259",
  "debug-own-1780662176144",
  "stock-sleeping-1780586352883-7a47f448ff2648",
  "stock-sleeping-1780586313069-3b77339a653d18",
  "stock-sleeping-1780585036999-e8f8c233cc9c68",
]);

export function isBlockedDeliveryPoolRow(row: DeliveryPoolRow) {
  if (BLOCKED_DELIVERY_LOCAL_MOMENT_IDS.has(row.local_moment_id)) {
    return true;
  }

  if (row.photo_url.includes("placecats.com")) {
    return true;
  }

  return /^(e2e|prod-e2e|debug|fallback)-/.test(row.local_moment_id);
}
