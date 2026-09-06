'use client';

import { HABIT_PLAN_STATUS_LABELS, type HabitPlanDetail } from '@reconectate/contracts';
import { Ban, Send } from 'lucide-react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { HabitPlanGrid, PlanProgress } from '@/components/habit-plan-grid';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useCancelHabitPlan, useHabitPlan, useResendPlanReport } from '@/lib/habits';

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
    >
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {isPending ? (
          <Skeleton className="h-72 w-full" />
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

function Plan({ plan }: { plan: HabitPlanDetail }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display truncate text-2xl font-semibold">{plan.name}</h1>
            <Badge variant={plan.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {HABIT_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
          </div>

          <p className="text-muted-foreground text-sm">
            Para {plan.recipientLabel} · del {plan.startOn} al {plan.endOn}
            {plan.status === 'ACTIVE' ? ` · día ${plan.dayNumber} de ${plan.durationDays}` : ''}
          </p>
        </div>

        <Actions plan={plan} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todo el plan</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanProgress percent={plan.percent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Día a día</CardTitle>
        </CardHeader>
        <CardContent>
          <HabitPlanGrid habits={plan.habits} durationDays={plan.durationDays} />
        </CardContent>
      </Card>

      {plan.status === 'CANCELLED' ? (
        <Alert>
          <AlertTitle>Este plan se anuló</AlertTitle>
          <AlertDescription>
            Sus bibliotecas volvieron a estar libres y siguen enviando lo suyo, pero ya sin botones.
            Lo que se contó hasta el día que se anuló sigue acá.
          </AlertDescription>
        </Alert>
      ) : null}
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
      <Button variant="outline" onClick={() => void onResend()} disabled={resend.isPending}>
        {resend.isPending ? <Spinner /> : <Send />}
        Reenviar informe
      </Button>
    );
  }

  if (plan.status !== 'ACTIVE') return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
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
