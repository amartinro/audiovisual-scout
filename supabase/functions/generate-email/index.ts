import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { business, notas } = await req.json();
    
    if (!business) {
      throw new Error("Business data is required");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const tono = business.tamano_estimado === 'grande' ? 'formal y corporativo' : 
                 business.tamano_estimado === 'pequeno' ? 'cercano y personal' : 'profesional pero accesible';

    // Detectar carencias digitales
    const carencias: string[] = [];
    if (!business.web) carencias.push("no tienen página web");
    const redesSociales = business.redes_sociales;
    if (!redesSociales || (!redesSociales.instagram && !redesSociales.facebook)) {
      carencias.push("no tienen presencia activa en redes sociales");
    }
    
    const carenciasTexto = carencias.length > 0 
      ? `Carencias detectadas: ${carencias.join(", ")}.`
      : "El negocio tiene presencia digital básica que podría potenciarse.";

    const prompt = `Genera un email comercial personalizado para el siguiente negocio.

DATOS DEL NEGOCIO:
- Nombre: ${business.nombre}
- Categoría: ${business.categoria}
- Ciudad: ${business.ciudad}
- Tamaño: ${business.tamano_estimado}
- ${carenciasTexto}

${notas ? `NOTAS DEL ANÁLISIS PREVIO:
${notas}` : ""}

INSTRUCCIONES:
1. Tono: ${tono}
2. El email debe:
   - Hacer referencia explícita al tipo de negocio (${business.categoria})
   - Mencionar carencias digitales detectadas de forma positiva (como oportunidades)
   - Proponer servicios audiovisuales específicos y relevantes para su sector
   - NO ser agresivo ni comercialmente invasivo
   - Ser único y personalizado
   - Tener un asunto atractivo pero profesional

3. Servicios que ofrece Alberto:
   - Fotografía profesional (productos, instalaciones, equipo)
   - Vídeo promocional y corporativo
   - Contenido para redes sociales (Instagram, TikTok, etc.)
   - Grabación y emisión de eventos en directo

4. FIRMA OBLIGATORIA (incluir exactamente así):
Alberto Martín
Fotografía y vídeo profesional
Web: https://tufotoyvideopromocional.es/
Instagram: https://www.instagram.com/amartinro/
Email: a.martinro@gmail.com
WhatsApp: +34 665 651 344

FORMATO DE RESPUESTA (JSON):
{
  "asunto": "Asunto del email",
  "cuerpo": "Cuerpo completo del email con la firma incluida"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un experto en redacción de emails comerciales para profesionales audiovisuales. Generas emails personalizados, profesionales y efectivos que no resultan invasivos. SIEMPRE respondes en formato JSON válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No email generated");
    }

    // Clean up the response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Parse JSON
    const emailData = JSON.parse(content);

    return new Response(
      JSON.stringify(emailData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
