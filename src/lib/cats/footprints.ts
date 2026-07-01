import type {
  CatSleepingMilestone,
  CatSleepingMilestoneTarget,
} from "../home/sleepingPhotos";
import type { OmoideMemory } from "../home/omoideDelivery";

export type CatFootprintPhoto = {
  id: string;
  src: string;
  createdAt: number;
};

export type CatFootprintEntry = {
  id: string;
  type: "photo" | "milestone" | "pickup";
  title: string;
  timestamp: number;
  src?: string;
  photo?: {
    src: string;
    title: string;
    timestamp: number;
  };
  memory?: OmoideMemory;
};

export function createCatFootprintEntries({
  photos,
  milestones,
  memories,
  max = 4,
}: {
  photos: CatFootprintPhoto[];
  milestones: CatSleepingMilestone[];
  memories: OmoideMemory[];
  max?: number;
}): CatFootprintEntry[] {
  const milestonePhotoIds = new Set(
    milestones
      .filter((milestone) => milestone.reachedAt && milestone.photoId)
      .map((milestone) => milestone.photoId),
  );

  const photoEntries = photos
    .filter((photo) => photo.createdAt && !milestonePhotoIds.has(photo.id))
    .slice(0, 8)
    .map((photo) => ({
      id: `photo-${photo.id}`,
      type: "photo" as const,
      title: "ねがおを撮った",
      timestamp: photo.createdAt,
      src: photo.src,
      photo: {
        src: photo.src,
        title: "ねがおを撮った",
        timestamp: photo.createdAt,
      },
    }));

  const milestoneEntries = milestones
    .filter((milestone) => milestone.reachedAt)
    .map((milestone) => ({
      id: `milestone-${milestone.target}`,
      type: "milestone" as const,
      title: getCatFootprintMilestoneTitle(milestone.target),
      timestamp: milestone.reachedAt,
      src: milestone.src,
      photo: milestone.src
        ? {
            src: milestone.src,
            title: getCatFootprintMilestoneTitle(milestone.target),
            timestamp: milestone.reachedAt,
          }
        : undefined,
    }));

  const pickupEntries = memories
    .filter((memory) => memory.openedAt)
    .map((memory) => ({
      id: `pickup-${memory.id}`,
      type: "pickup" as const,
      title: "思い出を見た",
      timestamp: memory.openedAt ?? memory.deliveredAt,
      src: memory.photo.thumbnailSrc ?? memory.photo.displaySrc ?? memory.photo.src,
      memory,
    }));

  return [...photoEntries, ...milestoneEntries, ...pickupEntries]
    .filter((entry) => entry.timestamp)
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, max);
}

function getCatFootprintMilestoneTitle(target: CatSleepingMilestoneTarget) {
  if (target === 1) return "はじめてのねがお";
  return `${target}枚目`;
}
