-- Enum para tamaño de negocio
CREATE TYPE public.tamano_negocio AS ENUM ('pequeno', 'mediano', 'grande');

-- Enum para estado de lead
CREATE TYPE public.estado_lead AS ENUM ('nuevo', 'contactado', 'respondido', 'descartado');

-- Enum para estado de email
CREATE TYPE public.estado_email AS ENUM ('borrador', 'enviado');

-- Tabla de negocios
CREATE TABLE public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    direccion TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    provincia TEXT NOT NULL DEFAULT 'Salamanca',
    fuente_datos TEXT NOT NULL DEFAULT 'OpenStreetMap',
    web TEXT,
    redes_sociales JSONB,
    tamano_estimado public.tamano_negocio NOT NULL DEFAULT 'pequeno',
    presencia_digital_score INTEGER NOT NULL DEFAULT 0 CHECK (presencia_digital_score >= 0 AND presencia_digital_score <= 100),
    potencial_score INTEGER NOT NULL DEFAULT 0 CHECK (potencial_score >= 0 AND potencial_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de leads
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    estado public.estado_lead NOT NULL DEFAULT 'nuevo',
    etiquetas TEXT[] DEFAULT '{}',
    notas TEXT,
    ultimo_contacto TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    user_id UUID NOT NULL
);

-- Tabla de emails
CREATE TABLE public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    asunto TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    gmail_draft_id TEXT,
    estado public.estado_email NOT NULL DEFAULT 'borrador',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses (all authenticated users can read/write - single user app)
CREATE POLICY "Authenticated users can view businesses"
    ON public.businesses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert businesses"
    ON public.businesses FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update businesses"
    ON public.businesses FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete businesses"
    ON public.businesses FOR DELETE
    TO authenticated
    USING (true);

-- RLS Policies for leads (user can only access their own leads)
CREATE POLICY "Users can view their own leads"
    ON public.leads FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads"
    ON public.leads FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
    ON public.leads FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
    ON public.leads FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for emails (through leads relationship)
CREATE POLICY "Users can view emails for their leads"
    ON public.emails FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = emails.lead_id 
        AND leads.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert emails for their leads"
    ON public.emails FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = emails.lead_id 
        AND leads.user_id = auth.uid()
    ));

CREATE POLICY "Users can update emails for their leads"
    ON public.emails FOR UPDATE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = emails.lead_id 
        AND leads.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete emails for their leads"
    ON public.emails FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.leads 
        WHERE leads.id = emails.lead_id 
        AND leads.user_id = auth.uid()
    ));

-- Create indexes for performance
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_business_id ON public.leads(business_id);
CREATE INDEX idx_emails_lead_id ON public.emails(lead_id);
CREATE INDEX idx_businesses_potencial_score ON public.businesses(potencial_score DESC);