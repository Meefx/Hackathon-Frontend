import { AccountWorkspace } from "@/features/accounts/components/account-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <AccountWorkspace key={accountId} accountId={accountId} />;
}
