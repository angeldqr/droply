'use client';

import { HABIT_PLAN_STATUS_LABELS, type HabitPlanDetail } from '@reconectate/contracts';
import { Ban, Send, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { HabitPlanConsistency, HabitPlanGrid } from '@/components/habit-plan-grid';
import { dayInWords } from '@/components/habit-mark';
import { Panel, PanelBar, PanelFigure, PanelHeader } from '@/components/panel';
import { RequireSession } from '@/components/require-session';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import {
  useCancelHabitPlan,
  useDeleteHabitPlan,
  useHabitPlan,
  useResendPlanReport,
} from '@/lib/habits';

export default function HabitPlanPage() {
  const params = useParams<{ planId: string }>();

  return (
    <RequireSession>
      <Contents planId={params.planId} />
    </RequireSession>
  );
}

function Contents({ planId }: { planId: string }) {
  const { data, isPending, error } = useHabitPlan(planId);

  return (
    <AppShell
      crumbs={[{ label: 'Yo en 30 días', href: '/yo-en-30-dias' }, { label: data?.name ?? 'Plan' }]}
      // Anular, reenviar o eliminar: va junto al nombre del plan, en la barra.
      actions={data ? <Actions plan={data} /> : null}
    >
      <div className="flex flex-col gap-2 pb-6 pt-2">
        {isPending ? (
          <Skeleton className="rounded-4xl h-72 w-full" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos abrir este plan</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : (
          <Plan plan={data} />
        )}
      </div>
    </AppShell>
  );
}

/** Lo que dice el panel negro según en qué quedó el plan. */
const STATUS_NOTE: Readonly<Record<HabitPlanDetail['status'], string | null>> = {
  ACTIVE: null,
  CLOSED: 'Terminó. Lo que se contó queda aquí.',
  CANCELLED:
    'Se anuló antes de terminar: sus bibliotecas volvieron a estar libres y siguen enviando lo suyo, ya sin botones. Lo contado hasta ese día queda aquí hasta que lo elimines.',
};

/**
 * Un plan: arriba, en el panel negro, cuánto se cumplió y en qué va; debajo, el
 * día a día y la constancia, a todo el ancho.
 */
function Plan({ plan }: { plan: HabitPlanDetail }) {
  const running = plan.status === 'ACTIVE';
  const note = STATUS_NOTE[plan.status];

  return (
    <>
      <Panel filled className="gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            className={
              running
                ? 'bg-menta text-sobre-menta'
                : 'bg-primary-foreground/15 text-primary-foreground'
            }
          >
            {HABIT_PLAN_STATUS_LABELS[plan.status]}
          </Badge>
          {plan.progressPerDay > 0 ? (
            <p className="text-primary-foreground/70 text-sm">
              {plan.progressPerDay} {plan.progressPerDay === 1 ? 'aviso' : 'avisos'} de progreso al
              día
            </p>
          ) : null}
        </div>

        <dl className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <PanelFigure
            label="Todo el plan"
            value={plan.percent === null ? 'Sin datos' : `${plan.percent}%`}
            hint={plan.percent === null ? 'Todavía no hay respuestas' : 'de lo enviado se cumplió'}
            big
          >
            <PanelBar value={plan.percent ?? 0} label="Avance de todo el plan" />
          </PanelFigure>
          {/*
            Anulado no «duró» ni «terminó»: el plan no guarda el día en que se
            anuló, y su fecha de fin es la que estaba prevista.
          */}
          <PanelFigure
            label={running ? 'Va en' : plan.status === 'CLOSED' ? 'Duró' : 'Era de'}
            value={running ? `Día ${plan.dayNumber}` : `${plan.durationDays} días`}
            hint={
              running
                ? `de ${plan.durationDays}`
                : plan.status === 'CLOSED'
                  ? `terminó el ${dayInWords(plan.endOn)}`
                  : 'se anuló antes de terminar'
            }
          />
          <PanelFigure
            label={plan.status === 'CANCELLED' ? 'Fechas previstas' : 'Fechas'}
            value={`${dayInWords(plan.startOn)} – ${dayInWords(plan.endOn)}`}
            hint={`Para ${plan.recipientLabel}`}
          />
        </dl>

        {note ? <p className="text-primary-foreground/60 text-sm">{note}</p> : null}
      </Panel>

      <Panel>
        <PanelHeader
          title="Día a día"
          description="Cuánto se cumplió cada día, hábito por hábito. Pasa el cursor por un día para ver el detalle."
        />
        <HabitPlanGrid habits={plan.habits} durationDays={plan.durationDays} />
      </Panel>

      <Panel>
        <PanelHeader title="¿Cuántos días se cumplió bien?" />
        <HabitPlanConsistency habits={plan.habits} />
      </Panel>
    </>
  );
}

/**
 * Lo único que se le puede hacer a un plan.
 *
 * No hay botón de editar, y no porque falte: un plan no se edita. Cambiarle las
 * bibliotecas a mitad de camino haría que el número del final midiera otra cosa
 * cada semana.
 */
function Actions({ plan }: { plan: HabitPlanDetail }) {
  const cancel = useCancelHabitPlan();
  const resend = useResendPlanReport();

  async function onCancel(): Promise<void> {
    try {
      await cancel.mutateAsync(plan.id);
      toast.success('Plan anulado. Sus bibliotecas quedaron libres.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo anular.');
    }
  }

  async function onResend(): Promise<void> {
    try {
      await resend.mutateAsync(plan.id);
      toast.success(`Informe enviado a ${plan.recipientLabel}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo mandar el informe.');
    }
  }

  if (plan.status === 'CLOSED') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void onResend()}
        disabled={resend.isPending}
      >
        {resend.isPending ? <Spinner /> : <Send />}
        Reenviar informe
      </Button>
    );
  }

  if (plan.status === 'CANCELLED') return <DeleteAction plan={plan} />;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Ban /> Anular
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular «{plan.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus bibliotecas quedan libres y siguen enviando lo suyo, pero sin botones para
            responder. Lo contado hasta hoy se queda a la vista, y el plan no se puede reanudar.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Dejarlo como está</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onCancel()}>Anular el plan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Un plan anulado ya no mide nada: se puede borrar para que no estorbe en la lista. */
function DeleteAction({ plan }: { plan: HabitPlanDetail }) {
  const remove = useDeleteHabitPlan();
  const router = useRouter();

  async function onDelete(): Promise<void> {
    try {
      await remove.mutateAsync(plan.id);
      toast.success('Plan eliminado.');
      router.push('/yo-en-30-dias');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo eliminar.');
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={remove.isPending}>
          {remove.isPending ? <Spinner /> : <Trash2 />}
          Eliminar
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar «{plan.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borra del todo, con lo que se contó y las respuestas de sus botones. No se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Dejarlo</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onDelete()}>
            Eliminar el plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
