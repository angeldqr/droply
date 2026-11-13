'use client';

import {
  appliesOn,
  dayScore,
  DELIVERY_STATUS_LABELS,
  type HabitView,
} from '@reconectate/contracts';
import { ArrowUpRight, CalendarClock, NotebookPen, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { ListState } from '@/components/list-state';
import { MotionItem, MotionList } from '@/components/motion-list';
import { Notices } from '@/components/notices';
import { Panel, PanelHeader } from '@/components/panel';
import { RequireSession } from '@/components/require-session';
import { RollingNumber } from '@/components/rolling-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useHabitPlans } from '@/lib/habits';
import { useHabits } from '@/lib/journal';
import { useDeliveries, useNotices, useSchedules } from '@/lib/schedules';
import { useSession } from '@/lib/session';

export default function HomePage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Inicio' }]}>
        <Content />
      </AppShell>
    </RequireSession>
  );
}

const TODAY = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
const HOUR = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });
const WHEN = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

/** Cuántos de los últimos envíos caben en el resumen. El historial entero está en Horarios. */
const RECENT = 5;

/**
 * La pantalla a la que se llega al entrar: el día, de un vistazo.
 *
 * No trae nada propio de la API. Cada panel resume una sección con la misma
 * consulta que esa sección ya usa, y lleva a ella.
 */
function Content() {
  return (
    <MotionList className="grid gap-2 pb-2 lg:grid-cols-3">
      <MotionItem key="saludo" index={0} className="lg:col-span-1">
        <Greeting />
      </MotionItem>
      <MotionItem key="plan" index={1}>
        <RunningPlan />
      </MotionItem>
      <MotionItem key="hoy" index={2}>
        <TodaySchedules />
      </MotionItem>
      <MotionItem key="envios" index={3} className="lg:col-span-2">
        <RecentDeliveries />
      </MotionItem>
      <MotionItem key="avisos" index={4}>
        <NoticesPanel />
      </MotionItem>
    </MotionList>
  );
}

function NoticesPanel() {
  const notices = useNotices();

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Avisos"
        description="Lo que falló y necesita que hagas algo, como un envío que no pudo salir."
      >
        <SectionLink href="/horarios">Ver horarios</SectionLink>
      </PanelHeader>

      <ListState
        query={notices}
        errorTitle="No pudimos traer tus avisos"
        skeleton={<Skeleton className="h-12 w-full rounded-3xl" />}
      >
        {(data) =>
          // `Notices` comparte esta misma consulta y dibuja la lista con su botón de leído.
          data.length === 0 ? <Quiet>No tienes avisos sin leer.</Quiet> : <Notices />
        }
      </ListState>
    </Panel>
  );
}

/** Lo que dice un panel cuando no tiene nada que mostrar. */
function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** El enlace de un panel a su sección. */
function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>
        {children} <ArrowUpRight />
      </Link>
    </Button>
  );
}

/**
 * Los hábitos que aplican hoy: cuántos van hechos y cuáles faltan, con la misma
 * cuenta que Mi bitácora.
 */
function todayOf(habits: readonly HabitView[]): { done: number; due: number; pending: string[] } {
  let done = 0;
  const pending: string[] = [];

  for (const habit of habits) {
    if (habit.paused || !appliesOn(habit.activeDays, habit.today)) continue;

    const count = habit.week.find((day) => day.day === habit.today)?.count ?? 0;

    if (dayScore(count, habit.dailyTarget) === 1) done += 1;
    else pending.push(habit.name);
  }

  return { done, due: done + pending.length, pending };
}

/** «Leer», «Leer y Caminar», «Leer, Caminar y 2 más». */
function namesOf(names: readonly string[]): string {
  const [first, second, ...rest] = names;

  if (first === undefined) return '';
  if (second === undefined) return first;
  if (rest.length === 0) return `${first} y ${second}`;

  return `${first}, ${second} y ${rest.length} más`;
}

/**
 * El panel relleno: el saludo y los hábitos de hoy.
 *
 * La cifra sola («0 de 1») no dice de qué es: va con su rótulo arriba, la
 * unidad al lado y, debajo, los hábitos que faltan con su nombre.
 */
function Greeting() {
  const { user } = useSession();
  const habits = useHabits();
  const { done, due, pending } = todayOf(habits.data ?? []);

  return (
    <Panel filled className="h-full justify-between gap-8">
      <div>
        <h2 className="text-2xl">Hola, {user?.displayName}</h2>
        <p className="text-primary-foreground/60 mt-1 text-sm first-letter:uppercase">
          {TODAY.format(new Date())}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-menta flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em]">
          <NotebookPen className="size-4" aria-hidden /> Mi bitácora · hábitos de hoy
        </p>

        {habits.isPending ? (
          <Skeleton className="bg-primary-foreground/15 h-16 w-48 rounded-2xl" />
        ) : habits.error ? (
          <p role="alert" className="text-primary-foreground/70 text-lg leading-snug">
            No pudimos traer tus hábitos. Recarga la página.
          </p>
        ) : due === 0 ? (
          <p className="text-primary-foreground/70 text-lg leading-snug">
            {(habits.data?.length ?? 0) === 0
              ? 'Todavía no tienes hábitos. Crea el primero y cuéntale al bot cada vez que lo hagas.'
              : 'Hoy no te toca ninguno de tus hábitos.'}
          </p>
        ) : (
          <div>
            <p className="font-display flex flex-wrap items-baseline gap-x-3 text-5xl font-medium tracking-tight">
              <span>
                <RollingNumber value={done} /> de {due}
              </span>
              <span className="text-primary-foreground/60 text-lg tracking-normal">
                {due === 1 ? 'hábito hecho' : 'hábitos hechos'}
              </span>
            </p>
            <p className="text-primary-foreground/70 mt-2 text-sm">
              {pending.length === 0
                ? 'Ya cumpliste todo lo de hoy.'
                : `Te falta: ${namesOf(pending)}.`}
            </p>
          </div>
        )}

        <Button asChild className="bg-menta hover:bg-menta/85 text-sobre-menta self-start">
          <Link href="/habitos">
            {(habits.data?.length ?? 0) === 0 ? 'Crear un hábito' : 'Abrir Mi bitácora'}
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

function RunningPlan() {
  const plans = useHabitPlans();

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Yo en 30 días"
        description="El plan de hábitos que le estás mandando a alguien, y cuánto lleva cumplido."
      >
        <SectionLink href="/yo-en-30-dias">Ver planes</SectionLink>
      </PanelHeader>

      <ListState
        query={plans}
        errorTitle="No pudimos traer tus planes"
        skeleton={<Skeleton className="h-20 w-full rounded-3xl" />}
      >
        {(data) => {
          const running = data.filter((plan) => plan.status === 'ACTIVE');

          if (running.length === 0) {
            return (
              <Quiet>
                <Sparkles className="mb-2 size-5" aria-hidden />
                No tienes ningún plan en marcha.
              </Quiet>
            );
          }

          return (
            <ul className="flex flex-col gap-4">
              {running.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/yo-en-30-dias/${plan.id}`}
                    className="hover:bg-muted focus-visible:outline-ring -m-2 flex flex-col gap-2 rounded-2xl p-2 transition-colors focus-visible:outline-2"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{plan.name}</span>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                        día {plan.dayNumber} de {plan.durationDays}
                      </span>
                    </span>
                    <Progress
                      value={plan.percent ?? 0}
                      aria-label={`Avance de ${plan.name}`}
                      className="h-2"
                    />
                    <span className="text-muted-foreground text-xs">
                      {plan.percent === null
                        ? 'Todavía sin respuestas'
                        : `${Math.round(plan.percent)}% cumplido · para ${plan.recipientLabel}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </ListState>
    </Panel>
  );
}

/** Si esa hora cae hoy, en el reloj de quien mira. */
function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function TodaySchedules() {
  const schedules = useSchedules();

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Lo que sale hoy"
        description="El próximo envío de hoy de cada horario activo, a la hora de este dispositivo."
      >
        <SectionLink href="/horarios">Ver horarios</SectionLink>
      </PanelHeader>

      <ListState
        query={schedules}
        errorTitle="No pudimos traer tus horarios"
        skeleton={<Skeleton className="h-20 w-full rounded-3xl" />}
      >
        {(data) => {
          const today = data
            .filter(
              (schedule) => schedule.active && schedule.nextRunAt && isToday(schedule.nextRunAt),
            )
            .sort((a, b) => (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? ''));

          if (today.length === 0) {
            return (
              <Quiet>
                <CalendarClock className="mb-2 size-5" aria-hidden />
                {data.length === 0
                  ? 'Todavía no tienes horarios.'
                  : 'Hoy no queda ningún envío por salir.'}
              </Quiet>
            );
          }

          return (
            <ul className="flex flex-col gap-3">
              {today.map((schedule) => (
                <li key={schedule.id} className="flex items-baseline gap-3 text-sm">
                  <span className="font-mono tabular-nums">
                    {schedule.nextRunAt ? HOUR.format(new Date(schedule.nextRunAt)) : ''}
                  </span>
                  <span className="min-w-0 truncate">
                    {schedule.libraryName} → {schedule.recipientLabel}
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </ListState>
    </Panel>
  );
}

function RecentDeliveries() {
  const deliveries = useDeliveries(1, RECENT);

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Lo que ya salió"
        description="Los últimos envíos del bot: qué biblioteca, a quién, y si llegó."
      >
        <SectionLink href="/horarios">Ver historial</SectionLink>
      </PanelHeader>

      <ListState
        query={deliveries}
        errorTitle="No pudimos traer tus envíos"
        skeleton={<Skeleton className="h-32 w-full rounded-3xl" />}
      >
        {(data) =>
          data.total === 0 ? (
            <Quiet>
              <Send className="mb-2 size-5" aria-hidden />
              Todavía no salió ningún envío.
            </Quiet>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.items.map((delivery) => (
                <li
                  key={delivery.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <Badge variant={delivery.status === 'SENT' ? 'secondary' : 'outline'}>
                    {DELIVERY_STATUS_LABELS[delivery.status]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {delivery.libraryName} → {delivery.recipientLabel}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {WHEN.format(new Date(delivery.occurredAt))}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </ListState>
    </Panel>
  );
}
