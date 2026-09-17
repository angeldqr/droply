import type { Clock } from '../../shared/clock';
import { HabitEntryId, HabitId, PhotoId, type IdGenerator } from '../../shared/identifiers';
import type {
  InboundMessage,
  InboundPhoto,
  InboundTap,
  JournalInbox,
} from '../../shared/journal-inbox';
import { detectMimeType, SIGNATURE_BYTES } from '../../shared/media-signature';
import type { AccountChat } from '../domain/account-chat';
import {
  COMMAND,
  doneButton,
  moveButton,
  offerMoveButton,
  parseChatAction,
  pickButton,
} from '../domain/chat-actions';
import { HabitEntry, PHOTO_MAX_BYTES, PHOTO_TYPES, PHOTOS_MAX } from '../domain/entry';
import type { Habit } from '../domain/habit';
import type {
  AccountChatRepository,
  ChatVoice,
  EntryRepository,
  HabitRepository,
  JournalPhotos,
} from '../domain/ports';
import type { LinkAccountChat } from './account-chat-use-cases';

/**
 * Lo que dice el bot. Junto y arriba, para poder leerlo de corrido: es lo único
 * que el usuario ve de todo este archivo.
 */
const SAYS = {
  linked: 'Listo, ya estás conectado. Escribe /habits cuando quieras anotar algo.',
  noHabits:
    'Todavía no tienes hábitos. Créalos en la aplicación, en Hábitos › Mi bitácora, y vuelve.',
  pick: '¿De cuál quieres contarme?',
  telling: (name: string) =>
    `${name}. Cuéntame qué hiciste: puedes mandarme texto y fotos. Cuando termines, aprieta Listo o escribe /fin.`,
  restarted: (name: string) =>
    `Pasó un rato, así que empecé una anotación nueva en ${name} con esto. Si era de otro hábito, cámbialo abajo.`,
  pickTarget: '¿A cuál lo paso?',
  noOtherHabit: 'No tienes otro hábito al que pasarlo.',
  moved: (name: string) => `Listo, lo pasé a ${name}. Sigue contándome o aprieta Listo.`,
  needPick: 'Escribe /habits y elige un hábito para que sepa dónde anotarlo.',
  tooManyPhotos: `Ya van ${PHOTOS_MAX} fotos en esta anotación, que es el tope. El texto sí lo sigo tomando.`,
  badPhoto: 'Esa no la pude guardar: solo entiendo fotos (jpg, png o webp).',
  photoFailed: 'No pude bajar esa foto. Vuelve a mandarla.',
  nothing: 'No anoté nada porque no me contaste nada. Escribe /habits cuando quieras.',
  saved: (name: string, notes: boolean, photos: number) => {
    const parts = [notes ? 'lo que escribiste' : null, photos > 0 ? fotos(photos) : null].filter(
      (part): part is string => part !== null,
    );

    return `Anotado en ${name}: ${parts.join(' y ')}.`;
  },
  soFar: (count: number, target: number) => `Hoy llevas ${count} de ${target}.`,
  goalMet: '¡Meta de hoy cumplida! 🎯',
} as const;

function fotos(count: number): string {
  return count === 1 ? 'una foto' : `${count} fotos`;
}

/**
 * La bitácora atendiendo el chat.
 *
 * Es lo único con estado de todo el contexto, y ese estado **no vive acá**: es
 * la anotación abierta de la base. Un mensaje entra, se mira si hay una
 * anotación abierta para ese chat, y eso decide todo. Así el bot se puede
 * reiniciar a mitad de una conversación sin que nadie lo note.
 *
 * El contrato con `recipients` es un booleano: `true` es «me hice cargo»,
 * `false` es «esto no es mío, sigue tú». Por eso todo lo que no reconoce cae
 * por el mismo sitio y el camino de los destinatarios queda intacto.
 */
export class JournalConversation implements JournalInbox {
  constructor(
    private readonly chats: AccountChatRepository,
    private readonly habits: HabitRepository,
    private readonly entries: EntryRepository,
    private readonly photos: JournalPhotos,
    private readonly voice: ChatVoice,
    private readonly linkChat: LinkAccountChat,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async handle(message: InboundMessage): Promise<boolean> {
    const code = startPayloadOf(message.text);

    if (code !== null) return this.tryLink(code, message.chatId);

    const chat = await this.chats.findByChatId(message.chatId);

    // Un chat que no es de ninguna cuenta nunca ve la lista de hábitos de nadie.
    if (!chat || !chat.isLinked) return false;

    if (isCommand(message.text, COMMAND)) return this.offerHabits(chat, message.chatId);

    if (isCommand(message.text, '/fin')) return this.closeOpen(chat, message.chatId);

    return this.collect(chat, message);
  }

  async tap(tap: InboundTap): Promise<boolean> {
    const action = parseChatAction(tap.data);

    if (!action) return false;

    const chat = await this.chats.findByChatId(tap.chatId);

    if (!chat || !chat.isLinked) {
      await this.voice.acknowledge(tap.callbackId);

      return true;
    }

    await this.voice.acknowledge(tap.callbackId);

    switch (action.kind) {
      case 'DONE':
        await this.closeOpen(chat, tap.chatId);
        break;
      case 'OFFER_MOVE':
        await this.offerMove(chat, tap.chatId);
        break;
      case 'MOVE':
        await this.move(chat, tap.chatId, HabitId.from(action.habitId));
        break;
      case 'PICK':
        await this.startEntry(chat, tap.chatId, HabitId.from(action.habitId));
        break;
    }

    // El teclado ya se usó: dejarlo invitaría a apretarlo dos veces.
    if (tap.messageId !== null) await this.voice.clearKeyboard(tap.chatId, tap.messageId);

    return true;
  }

  /**
   * `/start <código>` puede ser de una cuenta o de un destinatario.
   *
   * Si no es de una cuenta se devuelve `false` **sin decir nada**, y el camino
   * de los destinatarios lo atiende como siempre. Contestar acá convertiría el
   * bot en un oráculo para probar códigos a ciegas.
   */
  private async tryLink(code: string, chatId: string): Promise<boolean> {
    const linked = await this.linkChat.execute(code, chatId);

    if (linked === 'NOT_MINE') return false;

    // El texto sale del propio error: tenerlo también acá eran dos frases que
    // dicen lo mismo esperando a separarse.
    await this.voice.say(chatId, linked.ok ? SAYS.linked : linked.error.message);

    return true;
  }

  /** La lista numerada, como pidió el cliente, pero apretable. */
  private async offerHabits(chat: AccountChat, chatId: string): Promise<boolean> {
    const habits = await this.habits.listOwnedBy(chat.userId);

    if (habits.length === 0) {
      await this.voice.say(chatId, SAYS.noHabits);

      return true;
    }

    // Elegir otro hábito cierra lo que estuviera abierto: nadie escribe en dos
    // sitios a la vez, y dejarlo abierto pegaría lo nuevo a lo viejo.
    await this.closeOpen(chat, chatId, { quiet: true });

    const days = await this.entries.dayCountsOf(chat.userId, this.clock.now(), 1);

    // Un botón por fila, como la lámina: varios por fila serían ilegibles.
    await this.voice.say(
      chatId,
      SAYS.pick,
      habits.map((habit, index) =>
        pickButton(
          index + 1,
          habit.name,
          habit.id,
          progressTag(habit, days.counts.get(habit.id)?.get(days.today) ?? 0, days.today),
        ),
      ),
    );

    return true;
  }

  private async startEntry(chat: AccountChat, chatId: string, habitId: HabitId): Promise<void> {
    const habit = await this.habits.findOwned(habitId, chat.userId);

    // El hábito se borró entre que se mandó el teclado y alguien lo apretó.
    if (!habit) {
      await this.voice.say(chatId, SAYS.needPick);

      return;
    }

    await this.closeOpen(chat, chatId, { quiet: true });

    const entry = HabitEntry.open({
      id: HabitEntryId.from(this.ids.generate()),
      habitId,
      ownerId: chat.userId,
      chatId,
      now: this.clock.now(),
    });

    await this.entries.add(entry);
    await this.voice.say(chatId, SAYS.telling(habit.name), [doneButton()]);
  }

  /**
   * Lo que llega mientras hay una anotación abierta.
   *
   * Sin anotación abierta devuelve `false`: el mensaje sigue su camino y quien
   * escriba «hola» recibe la misma explicación de siempre.
   */
  private async collect(chat: AccountChat, message: InboundMessage): Promise<boolean> {
    const open = await this.entries.findOpenFor(message.chatId, chat.userId);

    if (!open) return false;

    if (open.hasGoneStale(this.clock.now())) return this.restart(open, message);

    await this.store(open, message);

    return true;
  }

  /**
   * Lo que llega cuando la anotación abierta ya caducó.
   *
   * No se tira: se cierra la vieja y se abre una nueva **en el mismo hábito**
   * con lo que llegó, que es lo más probable. Si el bot adivinó mal, el botón
   * «Era de otro hábito» la mueve con un toque. Guardar el mensaje aparte
   * hasta que el usuario eligiera obligaría a tener una tabla de pendientes.
   */
  private async restart(stale: HabitEntry, message: InboundMessage): Promise<boolean> {
    await this.settle(stale, message.chatId, { quiet: true });

    // Un sticker o algo sin texto ni foto: no hay nada que empezar.
    if (!message.photo && !message.text?.trim()) return false;

    const habit = await this.habits.findOwned(stale.habitId, stale.ownerId);

    if (!habit) {
      await this.voice.say(message.chatId, SAYS.needPick);

      return true;
    }

    const entry = HabitEntry.open({
      id: HabitEntryId.from(this.ids.generate()),
      habitId: habit.id,
      ownerId: stale.ownerId,
      chatId: message.chatId,
      now: this.clock.now(),
    });

    /*
     * Las fotos de un álbum que llega tarde entran a la vez y todas ven la
     * anotación caducada. Solo una puede abrir la nueva —lo impide el índice
     * único de la base— y las demás se suman a la que ganó, sin repetir el
     * aviso.
     */
    try {
      await this.entries.add(entry);
    } catch (caught) {
      const winner = await this.entries.findOpenFor(message.chatId, stale.ownerId);

      if (!winner) throw caught;

      await this.store(winner, message);

      return true;
    }

    await this.store(entry, message);

    // Si lo que llegó no se pudo guardar —una foto rota— el bot ya lo dijo, y
    // anunciar una anotación nueva «con esto» sería mentir.
    const saved = await this.entries.findOpenFor(message.chatId, stale.ownerId);

    if (saved && !saved.isEmpty) {
      await this.voice.say(message.chatId, SAYS.restarted(habit.name), [
        doneButton(),
        offerMoveButton(),
      ]);
    }

    return true;
  }

  private async store(entry: HabitEntry, message: InboundMessage): Promise<void> {
    if (message.photo) await this.attachPhoto(entry, message.chatId, message.photo);

    /*
     * El texto se añade con un `UPDATE` que concatena en la base, no leyendo y
     * volviendo a guardar: el pie de foto de un álbum llega en varios mensajes
     * a la vez, y en memoria uno de los dos se perdía.
     */
    if (message.text)
      await this.entries.appendNote(entry.id, entry.ownerId, message.text, this.clock.now());
  }

  /** La lista de los otros hábitos, para pasar ahí la anotación abierta. */
  private async offerMove(chat: AccountChat, chatId: string): Promise<void> {
    const open = await this.entries.findOpenFor(chatId, chat.userId);

    if (!open) {
      await this.voice.say(chatId, SAYS.needPick);

      return;
    }

    const others = (await this.habits.listOwnedBy(chat.userId)).filter(
      (habit) => habit.id !== open.habitId,
    );

    if (others.length === 0) {
      await this.voice.say(chatId, SAYS.noOtherHabit, [doneButton()]);

      return;
    }

    await this.voice.say(
      chatId,
      SAYS.pickTarget,
      others.map((habit, index) => moveButton(index + 1, habit.name, habit.id)),
    );
  }

  private async move(chat: AccountChat, chatId: string, habitId: HabitId): Promise<void> {
    const open = await this.entries.findOpenFor(chatId, chat.userId);
    // El dueño en la búsqueda: un toque inventado con el hábito de otra cuenta
    // no encuentra nada.
    const habit = await this.habits.findOwned(habitId, chat.userId);

    if (!open || !habit) {
      await this.voice.say(chatId, SAYS.needPick);

      return;
    }

    open.moveTo(habit.id, this.clock.now());
    await this.entries.save(open);
    await this.voice.say(chatId, SAYS.moved(habit.name), [doneButton()]);
  }

  private async attachPhoto(entry: HabitEntry, chatId: string, photo: InboundPhoto): Promise<void> {
    if (!entry.acceptsPhoto()) {
      await this.voice.say(chatId, SAYS.tooManyPhotos);

      return;
    }

    const bytes = await this.voice.download(photo.fileId);

    if (!bytes) {
      await this.voice.say(chatId, SAYS.photoFailed);

      return;
    }

    const mimeType = photoTypeOf(bytes);

    if (!mimeType) {
      await this.voice.say(chatId, SAYS.badPhoto);

      return;
    }

    const photoId = PhotoId.from(this.ids.generate());
    /*
     * Bajo el prefijo del dueño, como los archivos de las bibliotecas: es lo que
     * vacía el borrado de una cuenta, y fuera de él las fotos quedarían en el
     * bucket de alguien que ya no existe.
     */
    const key = `${entry.ownerId}/journal/${entry.id}/${photoId}`;

    await this.photos.put(key, bytes, mimeType);

    const thumbKey = await this.saveThumb(photo, `${key}.min`);

    /*
     * El tope de verdad lo cuenta la base, no la memoria: las fotos de un álbum
     * llegan a la vez y dos que contaran antes de escribir verían el mismo
     * número. Lo que sobra se borra del almacenamiento en el momento, para no
     * dejar un archivo que ninguna fila nombra.
     */
    const discard = async (): Promise<void> => {
      await this.photos.remove(key);

      if (thumbKey !== null) await this.photos.remove(thumbKey);
    };

    let total: number;

    try {
      total = await this.entries.addPhoto({
        id: photoId,
        ownerId: entry.ownerId,
        entryId: entry.id,
        storageKey: key,
        mimeType,
        sizeBytes: bytes.byteLength,
        thumbKey,
        now: this.clock.now(),
      });
    } catch (caught) {
      // Si la base falla, ninguna fila nombra los archivos ya subidos.
      await discard();

      throw caught;
    }

    if (total === 0 || total > PHOTOS_MAX) {
      await discard();

      if (total > PHOTOS_MAX) await this.voice.say(chatId, SAYS.tooManyPhotos);

      return;
    }

    entry.countPhotos(total, this.clock.now());
  }

  /**
   * La versión mediana que Telegram ya trae hecha, para las rejillas.
   *
   * Es un extra: si no llega, no es una imagen o falla al guardarse, la foto se
   * guarda igual y la pantalla usa la grande.
   */
  private async saveThumb(photo: InboundPhoto, key: string): Promise<string | null> {
    if (photo.thumbFileId === photo.fileId) return null;

    try {
      const bytes = await this.voice.download(photo.thumbFileId);
      const mimeType = bytes ? photoTypeOf(bytes) : null;

      if (!bytes || !mimeType) return null;

      await this.photos.put(key, bytes, mimeType);

      return key;
    } catch {
      return null;
    }
  }

  /** Cierra la anotación abierta de ese chat, si la hay. */
  private async closeOpen(
    chat: AccountChat,
    chatId: string,
    options: { quiet?: boolean } = {},
  ): Promise<boolean> {
    const open = await this.entries.findOpenFor(chatId, chat.userId);

    if (!open) {
      if (!options.quiet) await this.voice.say(chatId, SAYS.needPick);

      return true;
    }

    await this.settle(open, chatId, options);

    return true;
  }

  /**
   * Da por terminada una anotación.
   *
   * La que está vacía **se borra en vez de cerrarse**: alguien que eligió un
   * hábito y no contó nada no quiso anotar nada, y una fila en blanco en la
   * pantalla es ruido que después hay que limpiar a mano.
   */
  private async settle(
    entry: HabitEntry,
    chatId: string,
    options: { quiet?: boolean } = {},
  ): Promise<void> {
    if (entry.isEmpty) {
      await this.entries.remove(entry.id, entry.ownerId);

      if (!options.quiet) await this.voice.say(chatId, SAYS.nothing);

      return;
    }

    entry.close(this.clock.now());
    await this.entries.save(entry);

    if (options.quiet) return;

    const habit = await this.habits.findOwned(entry.habitId, entry.ownerId);
    const saved = SAYS.saved(habit?.name ?? 'tu hábito', entry.noteLength > 0, entry.photoCount);
    const goal = habit ? await this.goalLine(habit) : null;

    await this.voice.say(chatId, goal ? `${saved} ${goal}` : saved);
  }

  /**
   * Cómo va la meta de hoy, dicho una vez: al quedar por debajo, el avance; al
   * alcanzarla, la felicitación. Pasada la meta o en día de descanso, nada.
   */
  private async goalLine(habit: Habit): Promise<string | null> {
    const days = await this.entries.dayCountsOf(habit.ownerId, this.clock.now(), 1);
    const count = days.counts.get(habit.id)?.get(days.today) ?? 0;

    if (!habit.appliesOn(days.today)) return null;
    if (count < habit.dailyTarget) return SAYS.soFar(count, habit.dailyTarget);

    return count === habit.dailyTarget ? SAYS.goalMet : null;
  }
}

/** «✓» si hoy ya está, «1/2» si no, «descanso» si hoy no aplica. */
function progressTag(habit: Habit, count: number, today: string): string {
  if (!habit.appliesOn(today)) return 'descanso';

  return count >= habit.dailyTarget ? '✓' : `${count}/${habit.dailyTarget}`;
}

/**
 * El tipo de lo que llegó, mirando los bytes y no lo que Telegram dice, o
 * `null` si no es una foto que se acepte.
 *
 * Es la misma comprobación que hace la subida del navegador y por el mismo
 * motivo: el tipo declarado no prueba nada. Acá además es la única defensa,
 * porque del otro lado no hay una política firmada que corte antes de escribir.
 */
function photoTypeOf(bytes: Uint8Array): string | null {
  const mimeType = detectMimeType(bytes.subarray(0, SIGNATURE_BYTES));

  if (!mimeType || !PHOTO_TYPES.includes(mimeType) || bytes.byteLength > PHOTO_MAX_BYTES) {
    return null;
  }

  return mimeType;
}

/** `/start <código>`, con o sin el `@bot` que Telegram añade en los grupos. */
function startPayloadOf(text: string | null): string | null {
  if (!text) return null;

  return /^\/start(?:@\w+)?\s+(\S+)$/.exec(text.trim())?.[1] ?? null;
}

function isCommand(text: string | null, command: string): boolean {
  if (!text) return false;

  return new RegExp(`^${command}(?:@\\w+)?$`).test(text.trim().toLowerCase());
}
