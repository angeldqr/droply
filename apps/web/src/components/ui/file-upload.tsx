'use client';
import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { IconUpload } from '@tabler/icons-react';
import { useDropzone } from 'react-dropzone';

/*
 * La caja del icono se levanta un poco al pasar el ratón: invita a soltar ahí.
 * Motion no dispara `whileHover` con el dedo, así que en el teléfono no salta.
 */
const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 12, y: -12, opacity: 0.95 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

/**
 * La zona para subir un archivo: se elige con un clic o se suelta encima.
 *
 * Viene de un componente de terceros que estaba en inglés y con grises propios;
 * aquí habla español, usa la paleta de la aplicación y se dispara con un botón
 * de verdad, para que también se pueda usar con el teclado.
 *
 * El botón cubre la zona entera por encima en vez de envolverla: dentro de un
 * botón no puede ir el campo del archivo, y el lector de pantalla leería como
 * su nombre la tarjeta completa del archivo elegido.
 */
export const FileUpload = ({ onChange }: { onChange?: (files: File[]) => void }) => {
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    onChange?.(newFiles);
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDrop: handleFileChange,
  });

  return (
    <div className="w-full" {...getRootProps()}>
      <input
        ref={fileInputRef}
        id="file-upload-handle"
        type="file"
        tabIndex={-1}
        onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
        className="hidden"
      />
      <motion.div
        whileHover="animate"
        className="group/file relative block w-full overflow-hidden rounded-xl p-10 text-center"
      >
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
          <GridPattern />
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="font-display relative z-20 text-base font-bold">Sube un archivo</p>
          <p className="text-muted-foreground relative z-20 mt-2 text-sm">
            Arrástralo hasta aquí o elígelo desde tu equipo
          </p>
          <div className="relative mx-auto mt-10 w-full max-w-xl">
            {files.length > 0 &&
              files.map((file, idx) => (
                <motion.div
                  key={'file' + idx}
                  layoutId={idx === 0 ? 'file-upload' : 'file-upload-' + idx}
                  className="bg-card relative z-40 mx-auto mt-4 flex w-full flex-col items-start justify-start overflow-hidden rounded-lg p-4 shadow-sm md:h-24"
                >
                  <div className="flex w-full items-center justify-between gap-4">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="max-w-xs truncate text-base"
                    >
                      {file.name}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="bg-lavanda-200 text-ciruela-900 w-fit shrink-0 rounded-md px-2 py-1 text-sm tabular-nums"
                    >
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </motion.p>
                  </div>

                  <div className="text-muted-foreground mt-2 flex w-full flex-col items-start justify-between text-sm md:flex-row md:items-center">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="bg-muted rounded-md px-1 py-0.5"
                    >
                      {file.type || 'Sin tipo'}
                    </motion.p>

                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout>
                      Modificado el {new Date(file.lastModified).toLocaleDateString('es')}
                    </motion.p>
                  </div>
                </motion.div>
              ))}
            {!files.length && (
              <motion.div
                layoutId="file-upload"
                variants={mainVariant}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-card relative z-40 mx-auto mt-4 flex h-32 w-full max-w-[8rem] items-center justify-center rounded-lg shadow-[0px_10px_40px_rgba(47,24,75,0.12)] group-hover/file:shadow-[0px_16px_48px_rgba(47,24,75,0.18)]"
              >
                {isDragActive ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-primary flex flex-col items-center gap-1 text-sm font-semibold"
                  >
                    Suéltalo
                    <IconUpload className="size-4" />
                  </motion.p>
                ) : (
                  <IconUpload className="text-primary size-5" />
                )}
              </motion.div>
            )}

            {!files.length && (
              <motion.div
                variants={secondaryVariant}
                className="border-morado-400 absolute inset-0 z-30 mx-auto mt-4 flex h-32 w-full max-w-[8rem] items-center justify-center rounded-lg border border-dashed bg-transparent opacity-0"
              />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Elegir un archivo"
          className="focus-visible:ring-ring absolute inset-0 z-50 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2"
        />
      </motion.div>
    </div>
  );
};

/** La cuadrícula de fondo, en los tonos claros de la paleta. */
export function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="bg-lavanda-200/60 flex shrink-0 scale-105 flex-wrap items-center justify-center gap-x-px gap-y-px">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={`bg-papel-50 flex h-10 w-10 shrink-0 rounded-[2px] ${
                index % 2 === 0 ? '' : 'shadow-[0px_0px_1px_3px_rgba(255,255,255,1)_inset]'
              }`}
            />
          );
        }),
      )}
    </div>
  );
}
