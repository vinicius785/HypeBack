import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-12 relative overflow-hidden">
      <div className="text-center max-w-2xl w-full relative z-10">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative bg-linear-to-br from-primary-500 to-primary-700 p-6 rounded-3xl shadow-2xl">
              <Icon name="FileQuestionMark" size={80} color="#ffffff" />
            </div>
          </div>
        </div>

        <h1 className="mb-4 text-8xl md:text-9xl font-bold bg-linear-to-r from-primary-400 via-primary-500 to-primary-600 bg-clip-text text-transparent leading-none">
          404
        </h1>

        <h2 className="text-3xl md:text-4xl font-bold text-neutral-950 mb-4">
          Ops! Página não encontrada
        </h2>

        <p className="text-lg text-neutral-600 mb-12 leading-relaxed max-w-md mx-auto">
          Parece que esta página se perdeu no espaço digital. Que tal voltarmos
          para um lugar mais seguro?
        </p>

        <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
          <Button>
            <Link to="/" className="flex items-center justify-center gap-2">
              <Icon name="House" size={16} color="#ffffff" />

              <p className="text-neutral-50 font-semibold">Voltar ao início</p>
            </Link>
          </Button>

          <Button variant="outline">
            <Link to="/" className="flex items-center justify-center gap-2">
              <Icon name="ArrowLeft" size={16} color="#0a0a0a" />

              <span className="text-neutral-700 font-semibold">
                Página anterior
              </span>
            </Link>
          </Button>
        </div>

        <p className="text-sm text-neutral-500 mt-12">
          Se você acredita que isso é um erro, entre em contato conosco.
        </p>
      </div>
    </div>
  );
}
