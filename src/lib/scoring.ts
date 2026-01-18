// Scoring determinista según PRD
export type TamanoNegocio = 'pequeno' | 'mediano' | 'grande';

export interface ScoringInput {
  tamanoEstimado: TamanoNegocio;
  tieneWeb: boolean;
  webPobre: boolean;
  redesSocialesAbandonadas: boolean;
  tipoNegocio: string;
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

export function calcularPotencialScore(input: ScoringInput): number {
  let score = 0;

  // Factor 1: Tamaño del negocio
  switch (input.tamanoEstimado) {
    case 'pequeno':
      score += 10;
      break;
    case 'mediano':
      score += 25;
      break;
    case 'grande':
      score += 35;
      break;
  }

  // Factor 2: Presencia digital
  if (!input.tieneWeb || input.webPobre) {
    score += 25;
  }

  if (input.redesSocialesAbandonadas) {
    score += 25;
  }

  // Factor 3: Tipo de negocio
  const categoriaLower = input.tipoNegocio.toLowerCase();
  const esAltoPotencial = CATEGORIAS_ALTO_POTENCIAL.some(cat => 
    categoriaLower.includes(cat)
  );
  
  if (esAltoPotencial) {
    score += 15;
  } else {
    score += 5;
  }

  // Limitar a 100
  return Math.min(score, 100);
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
