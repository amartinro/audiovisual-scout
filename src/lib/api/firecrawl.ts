import { supabase } from '@/integrations/supabase/client';

export interface ContactInfo {
  web: string | null;
  telefono: string | null;
  email: string | null;
  redesSociales: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
  } | null;
}

export interface EnrichContactResponse {
  success: boolean;
  error?: string;
  contact: ContactInfo;
  enriched: boolean;
  contactCount?: number;
}

/**
 * Enrich contact information for a business using web search
 * This will search the web for additional contact info if the business
 * doesn't have at least 2 contact methods
 */
export async function enrichContact(
  businessName: string,
  ciudad: string,
  existingContact: ContactInfo
): Promise<EnrichContactResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('enrich-contact', {
      body: { businessName, ciudad, existingContact },
    });

    if (error) {
      console.error('Error enriching contact:', error);
      return { 
        success: false, 
        error: error.message, 
        contact: existingContact,
        enriched: false 
      };
    }

    return data as EnrichContactResponse;
  } catch (error) {
    console.error('Error calling enrich-contact:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      contact: existingContact,
      enriched: false 
    };
  }
}

/**
 * Count the number of contact methods a business has
 */
export function countContactMethods(contact: ContactInfo): number {
  let count = 0;
  if (contact.web) count++;
  if (contact.telefono) count++;
  if (contact.email) count++;
  if (contact.redesSociales) {
    const redes = contact.redesSociales;
    if (redes.instagram) count++;
    if (redes.facebook) count++;
    if (redes.twitter) count++;
    if (redes.linkedin) count++;
    if (redes.youtube) count++;
    if (redes.tiktok) count++;
  }
  return count;
}

/**
 * Check if a business has sufficient contact methods (2+)
 */
export function hasSufficientContact(contact: ContactInfo): boolean {
  return countContactMethods(contact) >= 2;
}
