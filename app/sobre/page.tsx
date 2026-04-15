"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Church, Heart, Users } from "lucide-react";

export default function SobrePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center mb-10">
          <Church className="w-14 h-14 text-indigo-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">Igreja Ramo</h1>
          <p className="text-gray-500 mt-2 max-w-md">
            Uma comunidade cristã comprometida com a Palavra, o amor e o serviço.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <InfoCard
            icon={<Church className="w-6 h-6 text-indigo-500" />}
            title="Nossa Missão"
            text="Proclamar o evangelho, discipular membros e servir a comunidade local com integridade e amor."
          />
          <InfoCard
            icon={<Heart className="w-6 h-6 text-red-400" />}
            title="Nossos Valores"
            text="Fé, família, serviço, comunhão e integridade guiam cada decisão e ministério da igreja."
          />
          <InfoCard
            icon={<Users className="w-6 h-6 text-green-500" />}
            title="Ministérios"
            text="Louvor, Ensino, Jovens, Infantil, Ação Social, Mídias e Cantina — cada um com seu propósito único."
          />
        </div>

        <div className="mt-10 bg-white rounded-2xl shadow p-6 text-sm text-gray-600 leading-relaxed">
          <h2 className="font-semibold text-gray-800 mb-2">Contato</h2>
          <p>Rua das Flores, 123 — São Paulo, SP</p>
          <p>contato@ramo.church · (11) 3000-0000</p>
          <p className="mt-2 text-gray-400 text-xs">
            Cultos: Domingos às 10h e 19h · Quarta às 20h
          </p>
        </div>
      </main>
    </>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-3">
      {icon}
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
