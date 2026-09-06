'use client';

import { HABIT_PLAN_STATUS_LABELS, type HabitPlanSummary } from '@reconectate/contracts';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { NewHabitPlanDialog } from '@/components/new-habit-plan-dialog';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Yo en 30 días</h1>
          <p className="text-muted-foreground text-sm">
            Convierte tus bibliotecas en hábitos y mira cuánto se cumplen.
          </p>
        </div>

        {data && data.length > 0 ? <NewHabitPlanDialog id="nuevo-plan" plans={data} /> : null}
      </div>

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
        <Empty className="border-border border">
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

function PlanList({ plans, empty }: { plans: readonly HabitPlanSummary[]; empty: string }) {
  if (plans.length === 0) {
    return <p className="text-muted-foreground py-6 text-sm">{empty}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }: { plan: HabitPlanSummary }) {
  const habits = plan.libraryIds.length;

  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 truncate">{plan.name}</CardTitle>
          <Badge variant={plan.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {HABIT_PLAN_STATUS_LABELS[plan.status]}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Para {plan.recipientLabel} · {habits} {habits === 1 ? 'hábito' : 'hábitos'}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground font-mono text-xs">
          {plan.status === 'ACTIVE'
            ? `Día ${plan.dayNumber} de ${plan.durationDays}`
            : `${plan.durationDays} días · terminó el ${plan.endOn}`}
        </p>

        <div className="flex items-center gap-3">
          <Progress value={plan.percent ?? 0} className="h-2 flex-1" />
          <span className="w-14 text-right font-mono text-sm tabular-nums">
            {plan.percent === null ? '—' : `${plan.percent}%`}
          </span>
        </div>
      </CardContent>

      {/*
        La capa cubre la tarjeta entera en vez de envolverla: así el enlace no
        se lleva dentro los botones ni las insignias, que dejarían de poder
        recibir su propio clic.
      */}
      <Link
        href={`/yo-en-30-dias/${encodeURIComponent(plan.id)}`}
        className="focus-visible:ring-ring absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2"
        aria-label={`Abrir ${plan.name}`}
      >
        <span className="sr-only">Abrir {plan.name}</span>
      </Link>
    </Card>
  );
}
