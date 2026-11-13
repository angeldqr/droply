'use client';

import { HABIT_PLAN_STATUS_LABELS, type HabitPlanSummary } from '@reconectate/contracts';
import { Sparkles } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { NewHabitPlanDialog } from '@/components/new-habit-plan-dialog';
import { RequireSession } from '@/components/require-session';
import { ShowMore } from '@/components/show-more';
import { StatRow } from '@/components/stat-row';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CardSpotlight } from '@/components/ui/card-spotlight';
import { MovingBorder } from '@/components/ui/moving-border';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHabitPlans } from '@/lib/habits';
import { useShown } from '@/lib/use-shown';
import { cn } from '@/lib/utils';

export default function HabitPlansPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Yo en 30 días' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { data, isPending, error } = useHabitPlans();

  const running = (data ?? []).filter((plan) => plan.status === 'ACTIVE');
  const done = (data ?? []).filter((plan) => plan.status !== 'ACTIVE');

  return (
    <div className="flex flex-col gap-6 pb-6 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Convierte tus bibliotecas en hábitos y mira cuánto se cumplen.
          </p>
        </div>

        {data && data.length > 0 ? <NewHabitPlanDialog id="nuevo-plan" plans={data} /> : null}
      </div>

      {data && data.length > 0 ? (
        <StatRow
          stats={[
            { label: 'Planes', value: data.length },
            { label: 'En marcha', value: running.length, accent: true },
            { label: 'Terminados', value: done.length },
          ]}
        />
      ) : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos traer tus planes</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : data.length === 0 ? (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay ningún plan</EmptyTitle>
            <EmptyDescription>
              Elige unas bibliotecas y un plazo. Cada envío llegará con tres botones —realizado, a
              medias, no cumplido— y al final sale un informe con lo que se consiguió.
            </EmptyDescription>
          </EmptyHeader>
          <NewHabitPlanDialog id="nuevo-plan-vacio" plans={data} />
        </Empty>
      ) : (
        <Tabs defaultValue={running.length > 0 ? 'en-marcha' : 'terminados'}>
          <TabsList>
            <TabsTrigger value="en-marcha">En marcha ({running.length})</TabsTrigger>
            <TabsTrigger value="terminados">Terminados ({done.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="en-marcha" className="mt-4">
            <PlanList plans={running} empty="No tienes ningún plan en marcha." />
          </TabsContent>

          <TabsContent value="terminados" className="mt-4">
            <PlanList plans={done} empty="Todavía no has terminado ninguno." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** De a cuántos planes se muestran: los terminados se acumulan sin tope. */
const PLANS_PART = 6;

function PlanList({ plans, empty }: { plans: readonly HabitPlanSummary[]; empty: string }) {
  const { shown, remaining, more } = useShown(plans, PLANS_PART);

  if (plans.length === 0) {
    return <p className="text-muted-foreground py-6 text-sm">{empty}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
      <ShowMore
        remaining={remaining}
        size={PLANS_PART}
        onMore={more}
        className="justify-self-start sm:col-span-2 lg:col-span-3"
      />
    </div>
  );
}

function PlanCard({ plan }: { plan: HabitPlanSummary }) {
  const habits = plan.libraryIds.length;
  const running = plan.status === 'ACTIVE';

  const card = (
    // Un foco de luz que sigue al cursor: dice cuál se va a abrir sin mover nada.
    <CardSpotlight className="flex h-full flex-col gap-4">
      <div className="relative flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-lg">{plan.name}</h3>
          <Badge variant={running ? 'default' : 'secondary'}>
            {HABIT_PLAN_STATUS_LABELS[plan.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Para {plan.recipientLabel} · {habits} {habits === 1 ? 'hábito' : 'hábitos'}
        </p>
      </div>

      <div className="relative mt-auto flex flex-col gap-3">
        <p className="text-muted-foreground font-mono text-xs">
          {running
            ? `Día ${plan.dayNumber} de ${plan.durationDays}`
            : `${plan.durationDays} días · terminó el ${plan.endOn}`}
        </p>

        <div className="flex items-center gap-3">
          <Progress value={plan.percent ?? 0} className="h-2 flex-1" />
          <span className="w-14 text-right font-mono text-sm tabular-nums">
            {plan.percent === null ? '—' : `${plan.percent}%`}
          </span>
        </div>
      </div>

      {/*
        La capa cubre la tarjeta entera en vez de envolverla: así el enlace no
        se lleva dentro los botones ni las insignias, que dejarían de poder
        recibir su propio clic.
      */}
      <Link
        href={`/yo-en-30-dias/${encodeURIComponent(plan.id)}`}
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2"
        aria-label={`Abrir ${plan.name}`}
      >
        <span className="sr-only">Abrir {plan.name}</span>
      </Link>
    </CardSpotlight>
  );

  return running ? <RunningFrame>{card}</RunningFrame> : card;
}

/**
 * El marco del plan en marcha: un brillo menta que recorre el borde.
 *
 * Es lo único que se mueve solo en la pantalla, y por eso marca el plan que
 * está vivo. Con «reducir movimiento» queda un borde menta quieto.
 */
function RunningFrame({ children }: { children: React.ReactNode }) {
  const still = useReducedMotion();

  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-[calc(var(--radius-4xl)+2px)] p-[2px]',
        still && 'bg-menta',
      )}
    >
      {still ? null : (
        <div className="absolute inset-0">
          <MovingBorder duration={5000} rx="12%" ry="12%">
            <div className="size-32 bg-[radial-gradient(var(--color-menta)_40%,transparent_65%)]" />
          </MovingBorder>
        </div>
      )}
      <div className="relative h-full">{children}</div>
    </div>
  );
}
