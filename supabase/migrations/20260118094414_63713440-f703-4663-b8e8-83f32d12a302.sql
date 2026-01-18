-- Añadir campo para explicar el motivo del scoring asignado
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS motivo_scoring text;