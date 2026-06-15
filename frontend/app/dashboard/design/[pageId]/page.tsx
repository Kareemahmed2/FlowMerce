import { StorefrontBuilder } from '@/components/merchant/design/StorefrontBuilder'

export default async function StorefrontBuilderPage({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  return <StorefrontBuilder pageId={Number(pageId)} />
}
