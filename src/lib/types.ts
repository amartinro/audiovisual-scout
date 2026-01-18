export type TamanoNegocio = 'pequeno' | 'mediano' | 'grande';
export type EstadoLead = 'nuevo' | 'contactado' | 'respondido' | 'descartado';
export type EstadoEmail = 'borrador' | 'enviado';

export type RedesSociales = {
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
} | null;

export interface Business {
  id: string;
  nombre: string;
  categoria: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  fuente_datos: string;
  web: string | null;
  telefono: string | null;
  email: string | null;
  redes_sociales: RedesSociales | null;
  tamano_estimado: TamanoNegocio;
  presencia_digital_score: number;
  potencial_score: number;
  motivo_scoring: string | null;
  created_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  email_prompt: string;
  auto_save_leads: boolean;
  default_ciudad: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  estado: EstadoLead;
  etiquetas: string[];
  notas: string | null;
  ultimo_contacto: string | null;
  created_at: string;
  user_id: string;
  business?: Business;
}

export interface Email {
  id: string;
  lead_id: string;
  asunto: string;
  cuerpo: string;
  gmail_draft_id: string | null;
  estado: EstadoEmail;
  created_at: string;
}

export interface DashboardStats {
  totalBusinesses: number;
  totalLeads: number;
  leadsPorEstado: Record<EstadoLead, number>;
  promedioScore: number;
}
