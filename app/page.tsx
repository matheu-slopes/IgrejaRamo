"use client";

import dynamic from "next/dynamic";
import ImmersiveNav from "@/components/landing/ImmersiveNav";
import FloatingCTA from "@/components/FloatingCTA";
import ParticleHero from "@/components/landing/ParticleHero";

// Lazy load seções abaixo do fold
const BentoGrid = dynamic(() => import("@/components/landing/BentoGrid"));
const CylinderCarousel = dynamic(() => import("@/components/landing/CylinderCarousel"));
const ScrollyQuemSomos = dynamic(() => import("@/components/landing/ScrollyQuemSomos"));
const ImmersiveMural = dynamic(() => import("@/components/landing/ImmersiveMural"));
const ImmersiveGaleria = dynamic(() => import("@/components/landing/ImmersiveGaleria"));
const ImmersiveMapa = dynamic(() => import("@/components/landing/ImmersiveMapa"));
const ImmersiveFooter = dynamic(() => import("@/components/landing/ImmersiveFooter"));

export default function HomePage() {
  return (
    <>
      <ImmersiveNav />
      <main>
        {/* 1. Portal — partículas + "A experiência começa agora" */}
        <ParticleHero />

        {/* 2. Bento Grid — cards 3D com parallax e lens cursor */}
        <div id="discover">
          <BentoGrid />
        </div>

        {/* 3. Carrossel 3D — programação semanal */}
        <div id="cultos">
          <CylinderCarousel />
        </div>

        {/* 4. Scrollytelling — Quem Somos (tipografia gigante + mask reveal) */}
        <div id="quem-somos">
          <ScrollyQuemSomos />
        </div>

        {/* 5. Mural de avisos */}
        <ImmersiveMural />

        {/* 6. Galeria */}
        <ImmersiveGaleria />

        {/* 7. Localização */}
        <ImmersiveMapa />
      </main>
      <ImmersiveFooter />
      <FloatingCTA />
    </>
  );
}
