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
    const { business } = await req.json();
    
    if (!business) {
      throw new Error("Business data is required");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context about the business
    const redesInfo = business.redes_sociales ? 
      Object.entries(business.redes_sociales)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") : "Sin redes sociales detectadas";

    const prompt = `Analiza el siguiente negocio para un profesional audiovisual (fotografía, vídeo, grabación de eventos) que quiere ofrecerles sus servicios.

DATOS DEL NEGOCIO:
- Nombre: ${business.nombre}
- Categoría: ${business.categoria}
- Ciudad: ${business.ciudad}
- Dirección: ${business.direccion}
- Web: ${business.web || "No tiene web"}
- Email: ${business.email || "No detectado"}
- Teléfono: ${business.telefono || "No detectado"}
- Redes sociales: ${redesInfo}
- Tamaño estimado: ${business.tamano_estimado}
- Score de presencia digital: ${business.presencia_digital_score}/100
- Score de potencial: ${business.potencial_score}/100

Genera un análisis estructurado con las siguientes secciones (usa emojis para hacerlo visual):

📋 DESCRIPCIÓN DEL NEGOCIO
[2-3 frases describiendo el negocio basándote en su categoría y ubicación]

✅ PUNTOS FUERTES
[Lista de 2-3 puntos fuertes que podrían tener basándote en su categoría]

⚠️ PUNTOS DÉBILES (ENFOCADOS EN PRESENCIA DIGITAL)
[Lista de 2-3 carencias digitales detectadas: web, redes, contenido visual, etc.]

🎯 OPORTUNIDADES DE MEJORA CON SERVICIOS AUDIOVISUALES
[Lista de 3-4 servicios específicos que podrían contratar:
- Fotografía profesional (productos, instalaciones, equipo)
- Vídeo promocional
- Contenido para redes sociales
- Grabación de eventos en directo
- Reportajes
etc.]

💡 ENFOQUE RECOMENDADO PARA EL CONTACTO
[1-2 frases sobre cómo enfocar el primer contacto comercial]

Sé conciso pero específico. Adapta el análisis al tipo de negocio.`;

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
            content: "Eres un experto en marketing digital y consultoría comercial para profesionales audiovisuales. Analizas negocios para identificar oportunidades de venta de servicios de fotografía, vídeo y contenido para redes sociales."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error("No analysis generated");
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-business:", error);
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
