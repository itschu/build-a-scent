import type { ListingStatus } from "./domain";

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  pending_review: "Pending review",
  approved: "Live",
  rejected: "Rejected",
  unavailable: "Unavailable",
  withdrawn: "Withdrawn",
};
