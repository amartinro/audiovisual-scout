-- Añadir campos de contacto a businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS telefono text,
ADD COLUMN IF NOT EXISTS email text;

-- Crear tabla de configuración para el usuario
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email_prompt text NOT NULL DEFAULT 'Genera un email comercial personalizado para {nombre}, un {categoria} ubicado en {ciudad}. 

Considera:
- Si es empresa grande: tono formal
- Si es empresa pequeña: tono cercano  
- Si es empresa mediana: tono profesional neutro

{carencias_digitales}

El email debe:
- Hacer referencia explícita al tipo de negocio
- Proponer servicios audiovisuales (fotografía, vídeo, contenido para redes)
- NO ser agresivo en ventas
- Ser único y diferente cada vez

Firma:
Alberto Martín
Fotografía y vídeo profesional
Web: https://tufotoyvideopromocional.es/
Instagram: https://www.instagram.com/amartinro/
Email: a.martinro@gmail.com
WhatsApp: +34 665 651 344',
  auto_save_leads boolean NOT NULL DEFAULT true,
  default_ciudad text NOT NULL DEFAULT 'Salamanca',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();