import type { CSSProperties, ReactNode } from 'react';
import { AuthDialog } from '@/components/auth-dialog';
import { SignatureCard } from '@/components/signature-card';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { FlipWords } from '@/components/ui/flip-words';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { WobbleCard } from '@/components/ui/wobble-card';
import { cn } from '@/lib/utils';

/** Lo que el bot manda: la frase de la portada va rotando por los cuatro tipos. */
const KINDS = ['audios', 'videos', 'imágenes', 'textos'];

/**
 * La portada: cuatro paneles sobre negro.
 *
 * El primero va a todo el ancho, con el nombre de corrido: dice qué es y deja
 * entrar. Los otros tres no describen la aplicación: la muestran, con lo mismo
 * que se ve adentro —el chat de Telegram, la cuadrícula de un plan y el
 * asistente—.
 */
export default function LandingPage() {
  return (
    <main className="bg-noche text-noche-tinta flex min-h-dvh flex-col p-2 md:p-3">
      <BentoGrid className="mx-auto w-full max-w-6xl flex-1 gap-2 md:auto-rows-[minmax(20rem,auto)] md:grid-cols-3">
        <Enter delay={0} className="md:col-span-3">
          <WobbleCard
            containerClassName="h-full"
            className="flex h-full flex-col justify-between gap-12 p-8 sm:p-10"
          >
            <span aria-hidden className="bg-menta size-16 rounded-full rounded-tl-xl" />

            <div>
              {/* El tamaño sigue al ancho en el teléfono: el nombre va entero, en un renglón. */}
              <h1 className="text-[13vw] font-medium leading-[0.9] tracking-tighter md:text-8xl lg:text-9xl">
                Reconéctate
              </h1>
              <div className="text-noche-apagado mt-6 max-w-md text-2xl leading-[1.1] tracking-tight">
                <TextGenerateEffect words="Tus bibliotecas llegan solas, a la hora que elijas." />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <AuthDialog modo="entrar" />
                <span className="text-noche-apagado text-sm">
                  Las cuentas las crea quien administra Reconéctate.
                </span>
              </div>
            </div>
          </WobbleCard>
        </Enter>

        <Enter delay={1}>
          <BentoGridItem
            className="h-full"
            header={<TelegramDemo />}
            title={
              <>
                Llegan <FlipWords words={KINDS} className="text-menta" /> por Telegram
              </>
            }
            description="Arma una colección, elige a quién y cuándo. El bot se encarga del resto."
          />
        </Enter>

        <Enter delay={2}>
          <BentoGridItem
            className="h-full"
            header={<PlanDemo />}
            title="Yo en 30 días"
            description="Cada envío pregunta si se hizo. La cuadrícula muestra el mes, día por día."
          />
        </Enter>

        <Enter delay={3}>
          <BentoGridItem
            className="h-full"
            header={<AssistantDemo />}
            title="Pregúntale cómo vas"
            description="El asistente responde con tus datos: tus planes, tu bitácora y tus envíos."
          />
        </Enter>
      </BentoGrid>
    </main>
  );
}

/** Cada panel se asienta un poco después del anterior. */
function Enter({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('animate-asentar', className)}
      style={{ animationDelay: `${delay * 90}ms`, animationDuration: '700ms' } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** El marco de una demostración: la misma pantalla clara de la aplicación, sobre la noche. */
function Demo({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-fondo text-tinta flex min-h-44 flex-1 flex-col justify-end gap-2 rounded-3xl p-4 text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

function TelegramDemo() {
  return (
    <Demo>
      <span className="bg-menta text-sobre-menta max-w-[75%] self-end rounded-2xl rounded-br-md px-3 py-2">
        /habitos
      </span>
      <span className="bg-tarjeta max-w-[80%] self-start rounded-2xl rounded-bl-md px-3 py-2">
        Hoy te toca: meditación de la mañana 🎧
      </span>
      <span className="flex gap-2 self-start">
        <span className="bg-tinta text-tarjeta rounded-full px-3 py-1.5">Realizado</span>
        <span className="bg-tarjeta rounded-full px-3 py-1.5">50%</span>
        <span className="bg-tarjeta rounded-full px-3 py-1.5">No cumplido</span>
      </span>
    </Demo>
  );
}

/** Treinta días inventados, con las tres bandas de un plan: cumplido, a medias y no cumplido. */
const MONTH = '221220212221022122212201222122';
const BAND = ['bg-coral', 'bg-ambar', 'bg-logro'] as const;

function PlanDemo() {
  return (
    <Demo className="justify-center">
      <div className="grid grid-cols-10 gap-1.5">
        {[...MONTH].map((score, day) => (
          <span
            key={day}
            className={cn(
              'text-sobre grid aspect-square place-items-center rounded-lg font-mono text-[10px]',
              BAND[Number(score)],
            )}
          >
            {day + 1}
          </span>
        ))}
      </div>
    </Demo>
  );
}

function AssistantDemo() {
  return (
    <div aria-hidden className="flex min-h-44 flex-1">
      <SignatureCard
        containerClassName="flex-1 rounded-3xl"
        className="flex h-full flex-col justify-end gap-3 p-5 md:p-5"
      >
        <p className="text-sobre-menta/60 ml-auto text-sm">¿Cómo voy en mi plan?</p>
        <p className="text-xl font-medium leading-snug tracking-tight">
          Vas en el día 12 de 30 y llevas un 83% cumplido.
        </p>
      </SignatureCard>
    </div>
  );
}
