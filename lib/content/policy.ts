// Booking terms and privacy notice for /polisi. Full English (Mal's call
// for this page; the rest of the customer site stays bahasa rojak).
//
// DRAFT until Mal confirms the numbers (cancellation windows, refund rules).
// The hold time is not written here: the page reads org_settings.hold_hours
// so it always matches what the system actually does.

export type PolicySection = {
  id: string;
  title: string;
  /** Paragraphs; {hold} is replaced with the hold time in hours. */
  body: string[];
  bullets?: string[];
};

export const POLICY_UPDATED = "15 October 2026";

export const POLICY: PolicySection[] = [
  {
    id: "tempahan",
    title: "Booking & Payment",
    body: [
      "One booking is one whole boat for your group, for one night. The price is the boat's charter rate for the night, not a price per person.",
      "You can pay the deposit only, or pay in full. Any balance is paid at the jetty before departure.",
      "Your slot is locked once your payment is verified. We check receipts within 24 hours and confirm with you on WhatsApp.",
    ],
  },
  {
    id: "tahan",
    title: "Unpaid Bookings",
    body: [
      "The night you book is held for {hold} hours while we wait for your payment or receipt. If no payment arrives in that time, the booking is cancelled automatically and the night goes back on sale.",
      "A night marked Selling Fast has been booked by another group that has not paid yet. You can still book it; the boat goes to the group whose payment is verified first.",
    ],
  },
  {
    id: "batal",
    title: "Cancellation by You",
    body: ["To cancel, WhatsApp us with your booking reference."],
    bullets: [
      "14 days or more before the trip: your deposit can be moved to another date in the same season, or refunded.",
      "Less than 14 days before the trip: the deposit is not refundable, but it can be moved once to another date if a slot is available.",
      "If you paid in full: everything above the deposit is refunded when you cancel 7 days or more before the trip.",
    ],
  },
  {
    id: "cuaca",
    title: "Weather & Safety",
    body: [
      "Safety comes first. The captain will cancel or postpone a trip if the weather, the sea or an official warning (MetMalaysia, the Maritime Agency) makes it unsafe.",
      "If we cancel for weather or safety, you choose: move to another date at no charge, or get a full refund.",
      "If the boat breaks down, we will try to replace it with another suitable boat. If we cannot, you get a full refund.",
    ],
  },
  {
    id: "tukar",
    title: "Changing Your Date or Group",
    body: [
      "Date changes depend on which nights are still available. WhatsApp us as early as you can.",
      "You can change your group size as long as it stays within the boat's capacity. The charter price does not change.",
    ],
  },
  {
    id: "di-bot",
    title: "On Board",
    body: [
      "Follow the captain's and crew's instructions at all times. Life jackets are provided and must be worn when you are told to.",
      "Children must be supervised by a parent or guardian throughout the trip.",
      "Drugs, alcohol and dangerous behaviour are not allowed. The captain may end the trip without a refund.",
    ],
  },
  {
    id: "privasi",
    title: "Privacy (PDPA 2010)",
    body: [
      "We collect your name, phone number, email and notes only to manage your booking: to confirm your slot, contact you about the trip and keep payment records.",
      "We do not sell or share your data with third parties, except your boat's captain (the group leader's name and phone) and where the law requires it.",
      "Payment receipts are stored privately and can only be seen by our admins.",
      "You can ask for a copy of your data, or for it to be deleted, at any time on WhatsApp. Payment records may need to be kept for accounting.",
    ],
  },
];
