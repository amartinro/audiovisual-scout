-- Add enrichment status to leads table
ALTER TABLE public.leads 
ADD COLUMN estado_enriquecimiento text NOT NULL DEFAULT 'guardado';

-- Add comment explaining the values
COMMENT ON COLUMN public.leads.estado_enriquecimiento IS 'Estado del enriquecimiento: guardado, enriquecido, error';