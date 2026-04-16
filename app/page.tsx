import PublicNavbar from "@/components/landing/PublicNavbar";
import HeroSection from "@/components/landing/HeroSection";
import CultosSection from "@/components/landing/CultosSection";
import MuralPublico from "@/components/landing/MuralPublico";
import GaleriaSection from "@/components/landing/GaleriaSection";
import QuemSomosSection from "@/components/landing/QuemSomosSection";
import MapaSection from "@/components/landing/MapaSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function HomePage() {
  return (
    <>
      <PublicNavbar />
      <main>
        {/* 1. Hero */}
        <HeroSection />
        {/* 2. Programação semanal — visibilidade máxima */}
        <CultosSection />
        {/* 3. Mural de avisos / programações especiais */}
        <MuralPublico />
        {/* 4. Galeria */}
        <GaleriaSection />
        {/* 5. Quem Somos — ao final, como "sobre" */}
        <QuemSomosSection />
        {/* 6. Localização */}
        <MapaSection />
      </main>
      <LandingFooter />
    </>
  );
}
