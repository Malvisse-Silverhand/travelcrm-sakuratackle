import ResetPasswordForm from "@/components/admin/ResetPasswordForm";

// Opened from the reset email: /admin/reset?token=<hashed recovery token>.
// The proxy lets it through without a session.

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
