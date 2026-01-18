import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Business, Lead, RedesSociales } from '@/lib/types';

interface LeadWithBusiness extends Lead {
  business: Business;
}

interface LeadEditDialogProps {
  lead: LeadWithBusiness | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedLead: LeadWithBusiness) => void;
}

export function LeadEditDialog({ lead, open, onOpenChange, onSave }: LeadEditDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Business fields
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [web, setWeb] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Initialize fields when lead changes or dialog opens
  useEffect(() => {
    if (open && lead) {
      setNombre(lead.business?.nombre || '');
      setCategoria(lead.business?.categoria || '');
      setCiudad(lead.business?.ciudad || '');
      setDireccion(lead.business?.direccion || '');
      setWeb(lead.business?.web || '');
      setTelefono(lead.business?.telefono || '');
      setEmail(lead.business?.email || '');
      
      const redes = (lead.business?.redes_sociales || {}) as { instagram?: string; facebook?: string; twitter?: string; linkedin?: string };
      setInstagram(redes.instagram || '');
      setFacebook(redes.facebook || '');
      setTwitter(redes.twitter || '');
      setLinkedin(redes.linkedin || '');
    }
  }, [open, lead]);

  const handleSave = async () => {
    if (!lead) return;
    
    setSaving(true);
    try {
      const redes_sociales: RedesSociales = {};
      if (instagram) redes_sociales.instagram = instagram;
      if (facebook) redes_sociales.facebook = facebook;
      if (twitter) redes_sociales.twitter = twitter;
      if (linkedin) redes_sociales.linkedin = linkedin;

      const { error } = await supabase
        .from('businesses')
        .update({
          nombre,
          categoria,
          ciudad,
          direccion,
          web: web || null,
          telefono: telefono || null,
          email: email || null,
          redes_sociales: Object.keys(redes_sociales).length > 0 ? redes_sociales : null,
        })
        .eq('id', lead.business.id);

      if (error) throw error;

      const updatedBusiness: Business = {
        ...lead.business,
        nombre,
        categoria,
        ciudad,
        direccion,
        web: web || null,
        telefono: telefono || null,
        email: email || null,
        redes_sociales: Object.keys(redes_sociales).length > 0 ? redes_sociales : null,
      };

      onSave({
        ...lead,
        business: updatedBusiness,
      });

      toast({ title: 'Lead actualizado correctamente' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el lead',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>
            Modifica la información del negocio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
          </div>

          {/* Contact Info */}
          <div className="pt-2 border-t">
            <Label className="text-sm font-medium text-muted-foreground">Datos de Contacto</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Web</Label>
              <Input 
                value={web} 
                onChange={(e) => setWeb(e.target.value)} 
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input 
                value={telefono} 
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+34..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
            />
          </div>

          {/* Social Media */}
          <div className="pt-2 border-t">
            <Label className="text-sm font-medium text-muted-foreground">Redes Sociales</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input 
                value={instagram} 
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@usuario o URL"
              />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input 
                value={facebook} 
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="URL de Facebook"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Twitter/X</Label>
              <Input 
                value={twitter} 
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@usuario o URL"
              />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input 
                value={linkedin} 
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="URL de LinkedIn"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
