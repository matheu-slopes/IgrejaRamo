import dynamic from "next/dynamic";
import ImmersiveNav from "@/components/landing/ImmersiveNav";
import FloatingCTA from "@/components/FloatingCTA";
import ParticleHero from "@/components/landing/ParticleHero";
import VerseMarquee from "@/components/landing/VerseMarquee";
import PwaEntryRedirect from "@/components/PwaEntryRedirect";

// Lazy load seções abaixo do fold
const BentoGrid = dynamic(() => import("@/components/landing/BentoGrid"));
const CylinderCarousel = dynamic(() => import("@/components/landing/CylinderCarousel"));
const ScrollyQuemSomos = dynamic(() => import("@/components/landing/ScrollyQuemSomos"));
const ImmersiveGaleria = dynamic(() => import("@/components/landing/ImmersiveGaleria"));
const ImmersiveMapa = dynamic(() => import("@/components/landing/ImmersiveMapa"));
const ImmersiveFooter = dynamic(() => import("@/components/landing/ImmersiveFooter"));

export default function HomePage() {
  return (
    <>
      <PwaEntryRedirect />
      <ImmersiveNav />
      <main>
        {/* 1. Portal — partículas + hero */}
        <ParticleHero />

        {/* 2. Bento Grid — Culto & Devocional */}
        <div id="discover">
          <BentoGrid />
        </div>

        {/* Carrossel de versículos */}
        <VerseMarquee />

        {/* 3. Programação semanal + Mural lado a lado */}
        <div id="cultos">
          <CylinderCarousel />
        </div>

        {/* 4. Scrollytelling — Quem Somos */}
        <div id="quem-somos">
          <ScrollyQuemSomos />
        </div>

        {/* 5. Galeria */}
        <ImmersiveGaleria />

        {/* 6. Localização */}
        <ImmersiveMapa />
      </main>
      <ImmersiveFooter />
      <FloatingCTA />
    </>
  );
}
