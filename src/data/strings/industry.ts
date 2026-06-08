import type { Language } from "./index.js";

export const industryStrings: Record<Language, Record<string, string>> = {
  en: {
    "industry.unlock": "Unlock Blueprint ({cost}¢)",
    "industry.queueJob": "Queue Batch",
    "industry.required": "Required Materials",
    "industry.output": "Production Output",
    "industry.queue": "Fabrication Queue",
    "industry.noJobs": "No active jobs",
    "industry.cancelJob": "Cancel job",
    "industry.remaining": "remaining",
    "industry.job": "job",
    "industry.jobs": "jobs",
    "industry.noRecipes": "No recipes found.",
    "industry.selectRecipe": "Select a fabrication line to inspect throughput and queue a batch",
  },
  es: {
    "industry.unlock": "Desbloquear Plano ({cost}¢)",
    "industry.queueJob": "Encolar Trabajo",
    "industry.required": "Materiales Requeridos",
    "industry.output": "Producción",
    "industry.queue": "Cola de Fabricación",
    "industry.noJobs": "Sin trabajos activos",
    "industry.cancelJob": "Cancelar trabajo",
    "industry.remaining": "restante",
    "industry.job": "trabajo",
    "industry.jobs": "trabajos",
    "industry.noRecipes": "No se encontraron recetas.",
    "industry.selectRecipe": "Seleccione una línea de fabricación para inspeccionar el rendimiento y encolar un lote",
  },
};
