import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PlatformView, { platformMetadata } from '@/components/PlatformView';
import { ADULT_PLATFORMS } from '@/lib/content';

type Props = { params: Promise<{ platform: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return ADULT_PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const p = ADULT_PLATFORMS.find((x) => x.slug === platform);
  return p ? platformMetadata(p, true) : {};
}

export default async function AdultPlatformPage({ params }: Props) {
  const { platform } = await params;
  const p = ADULT_PLATFORMS.find((x) => x.slug === platform);
  if (!p) notFound();
  return <PlatformView p={p} adult />;
}
