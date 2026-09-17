'use client';

import { ALL_DAYS, HABIT_DAILY_TARGET_MAX, WEEKDAYS_ONLY } from '@reconectate/contracts';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { WEEKDAY_NAMES } from '@/components/habit-mark';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const PRESETS = [
  { label: 'Todos', days: ALL_DAYS },
  { label: 'Lun a vie', days: WEEKDAYS_ONLY },
] as const;

/**
 * La meta de un hábito: cuántas veces al día y en qué días.
 *
 * Va dentro de un `<form>` y deja los dos valores en campos ocultos
 * (`dailyTarget`, `activeDays`), para que el formulario los lea con `FormData`
 * igual que el nombre.
 */
export function HabitGoalFields({
  idPrefix,
  defaultTarget = 1,
  defaultDays = ALL_DAYS,
}: {
  idPrefix: string;
  defaultTarget?: number;
  defaultDays?: number;
}) {
  const [target, setTarget] = useState(defaultTarget);
  const [days, setDays] = useState(defaultDays);

  const selected = WEEKDAY_NAMES.flatMap((_, index) =>
    (days & (1 << index)) !== 0 ? [String(index)] : [],
  );

  function onDaysChange(values: string[]): void {
    // Sin ningún día el hábito no pediría nada nunca: el último no se suelta.
    if (values.length === 0) return;

    setDays(values.reduce((mask, value) => mask | (1 << Number(value)), 0));
  }

  return (
    <>
      <Field>
        <FieldLabel id={`${idPrefix}-veces`}>Veces al día</FieldLabel>

        <div className="flex items-center gap-3" role="group" aria-labelledby={`${idPrefix}-veces`}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setTarget((value) => Math.max(1, value - 1))}
            disabled={target <= 1}
            aria-label="Una vez menos"
          >
            <Minus />
          </Button>

          <output
            aria-live="polite"
            className="font-display min-w-8 text-center text-2xl font-bold tabular-nums"
          >
            {target}
          </output>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setTarget((value) => Math.min(HABIT_DAILY_TARGET_MAX, value + 1))}
            disabled={target >= HABIT_DAILY_TARGET_MAX}
            aria-label="Una vez más"
          >
            <Plus />
          </Button>
        </div>

        <FieldDescription>
          Cuántas veces tienes que contárselo al bot ese día para darlo por cumplido. Por ejemplo:
          gimnasio 1, comidas 3.
        </FieldDescription>
        <input type="hidden" name="dailyTarget" value={target} />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel id={`${idPrefix}-dias`}>Días</FieldLabel>

          <div className="flex gap-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant={days === preset.days ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDays(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <ToggleGroup
          type="multiple"
          variant="outline"
          spacing={1}
          value={selected}
          onValueChange={onDaysChange}
          aria-labelledby={`${idPrefix}-dias`}
          className="w-full"
        >
          {WEEKDAY_NAMES.map((day, index) => (
            <ToggleGroupItem
              key={day.long}
              value={String(index)}
              aria-label={day.long}
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground flex-1 font-semibold uppercase"
            >
              {day.narrow}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <FieldDescription>Los días que no marques no cuentan como fallo.</FieldDescription>
        <input type="hidden" name="activeDays" value={days} />
      </Field>
    </>
  );
}

/** Lee la meta que dejó `HabitGoalFields` en el formulario. */
export function goalFrom(form: FormData): { dailyTarget: number; activeDays: number } {
  return {
    dailyTarget: Number(form.get('dailyTarget')),
    activeDays: Number(form.get('activeDays')),
  };
}
