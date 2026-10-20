import { loadReceipt, receiptPdf } from "@/lib/receipts/receipt";

// The receipt as a PDF download (same token as the receipt page).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Not found", { status: 404 });
  const r = await loadReceipt({ token });
  if (!r) return new Response("Not found", { status: 404 });
  const bytes = await receiptPdf(r);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
