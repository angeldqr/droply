// Una carpeta que no es ninguna de las cuatro capas. Antes de
// `no-unknown-files` este archivo podía importar lo que quisiera sin que
// ninguna regla lo mirara.
import { z } from 'zod';

import { product } from '../../catalog/domain/product';

export const orphan = [z, product];
