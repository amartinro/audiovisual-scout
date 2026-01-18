// Scoring determinista según PRD
export type TamanoNegocio = 'pequeno' | 'mediano' | 'grande';

export interface ScoringInput {
  tamanoEstimado: TamanoNegocio;
  tieneWeb: boolean;
  webPobre: boolean;
  redesSocialesAbandonadas: boolean;
  tipoNegocio: string;
  // Contact info for penalty calculation
  tieneTelefono?: boolean;
  tieneEmail?: boolean;
  tieneRedesSociales?: boolean;
}

export interface ScoringResult {
  score: number;
  motivo: string;
}

// Count total contact methods
export function countContactMethods(input: {
  tieneWeb?: boolean;
  tieneTelefono?: boolean;
  tieneEmail?: boolean;
  tieneRedesSociales?: boolean;
}): number {
  let count = 0;
  if (input.tieneWeb) count++;
  if (input.tieneTelefono) count++;
  if (input.tieneEmail) count++;
  if (input.tieneRedesSociales) count++;
  return count;
}

// Categorías con alto potencial audiovisual
const CATEGORIAS_ALTO_POTENCIAL = [
  'eventos',
  'hostelería',
  'hosteleria',
  'turismo',
  'clínicas',
  'clinicas',
  'gimnasios',
  'restaurante',
  'hotel',
  'spa',
  'bodega',
  'catering',
  'bodas',
  'celebraciones',
  'fitness',
  'estética',
  'estetica',
  'salud',
  'bienestar',
];

export function calcularPotencialScoreConMotivo(input: ScoringInput): ScoringResult {
  let score = 0;
  const motivos: string[] = [];

  // Factor 1: Tamaño del negocio
  switch (input.tamanoEstimado) {
    case 'pequeno':
      score += 10;
      motivos.push('Negocio pequeño (+10)');
      break;
    case 'mediano':
      score += 25;
      motivos.push('Negocio mediano (+25)');
      break;
    case 'grande':
      score += 35;
      motivos.push('Negocio grande (+35)');
      break;
  }

  // Factor 2: Presencia digital
  if (!input.tieneWeb || input.webPobre) {
    score += 25;
    motivos.push('Sin web o web pobre (+25)');
  }

  if (input.redesSocialesAbandonadas) {
    score += 25;
    motivos.push('Redes sociales abandonadas (+25)');
  }

  // Factor 3: Tipo de negocio
  const categoriaLower = input.tipoNegocio.toLowerCase();
  const esAltoPotencial = CATEGORIAS_ALTO_POTENCIAL.some(cat => 
    categoriaLower.includes(cat)
  );
  
  if (esAltoPotencial) {
    score += 15;
    motivos.push(`Sector alto potencial: ${input.tipoNegocio} (+15)`);
  } else {
    score += 5;
    motivos.push(`Sector estándar: ${input.tipoNegocio} (+5)`);
  }

  // Factor 4: PENALIZACIÓN por falta de contactos
  const contactCount = countContactMethods({
    tieneWeb: input.tieneWeb,
    tieneTelefono: input.tieneTelefono,
    tieneEmail: input.tieneEmail,
    tieneRedesSociales: input.tieneRedesSociales,
  });

  if (contactCount === 0) {
    score -= 40;
    motivos.push('Sin contactos disponibles (-40)');
  } else if (contactCount === 1) {
    score -= 20;
    motivos.push('Solo 1 método de contacto (-20)');
  } else {
    motivos.push(`${contactCount} métodos de contacto`);
  }

  // Limitar entre 0 y 100
  const finalScore = Math.max(0, Math.min(score, 100));
  
  return {
    score: finalScore,
    motivo: motivos.join(' | ')
  };
}

export function calcularPotencialScore(input: ScoringInput): number {
  return calcularPotencialScoreConMotivo(input).score;
}

export function calcularPresenciaDigitalScore(tieneWeb: boolean, webPobre: boolean, redesAbandonadas: boolean): number {
  let score = 100;

  if (!tieneWeb) {
    score -= 50;
  } else if (webPobre) {
    score -= 25;
  }

  if (redesAbandonadas) {
    score -= 25;
  }

  return Math.max(score, 0);
}

export function getScoreColor(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return 'Alto potencial';
  if (score >= 40) return 'Potencial medio';
  return 'Bajo potencial';
}
