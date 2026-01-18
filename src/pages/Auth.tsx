import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function Auth() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          variant: 'destructive',
          title: 'Error de validación',
          description: validation.error.errors[0].message,
        });
        setLoading(false);
        return;
      }

      const { error } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        let message = error.message;
        if (error.message.includes('Invalid login credentials')) {
          message = 'Credenciales incorrectas';
        } else if (error.message.includes('User already registered')) {
          message = 'Este email ya está registrado';
        } else if (error.message.includes('Email not confirmed')) {
          message = 'Por favor, confirma tu email';
        }

        toast({
          variant: 'destructive',
          title: 'Error',
          description: message,
        });
      } else if (!isLogin) {
        toast({
          title: '¡Cuenta creada!',
          description: 'Ya puedes iniciar sesión',
        });
        setIsLogin(true);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error inesperado',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Camera className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">ProspectAV</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prospección audiovisual inteligente
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">
              {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Accede a tu panel de prospección'
                : 'Crea tu cuenta para empezar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLogin ? (
                  'Iniciar sesión'
                ) : (
                  'Crear cuenta'
                )}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              </span>{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setIsLogin(!isLogin)}
                disabled={loading}
              >
                {isLogin ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
