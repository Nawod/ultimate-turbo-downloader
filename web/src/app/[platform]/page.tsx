import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlatformView, { platformMetadata } from '@/components/PlatformView';
import { PLATFORMS } from '@/lib/content';

type Props = { params: Promise<{ platform: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  return p ? platformMetadata(p) : {};
}

export default async function PlatformPage({ params }: Props) {
  const { platform } = await params;
  const p = PLATFORMS.find((x) => x.slug === platform);
  if (!p) notFound();
  return <PlatformView p={p} />;
}
