import type { Language } from "./index.js";

export const loadingStrings: Record<Language, Record<string, string>> = {
  en: {
    "loading.init": "> Initializing system core...",
    "loading.network": "> Reading network and save states...",
    "loading.neural": "> Awaiting neural synchronization...",
    "loading.hud": "> Loading HUD overlay interface...",
    "loading.hudMapping": "> Mapping dashboard layout panels...",
    "loading.hudLoaded": "> Neural DOM interface loaded successfully.",
    "loading.worldGen": "> Generating sector coordinate matrix...",
    "loading.worldPop": "> Populating local asteroids & anomalies...",
    "loading.worldGrid": "> System warp grid generated.",
    "loading.pixi": "> Bootstrapping PixiJS GPU engine...",
    "loading.pixiTextures": "> Baking planetary textures...",
    "loading.pixiShaders": "> Shaders compiled. Systems nominal.",
  },
  es: {
    "loading.init": "> Inicializando núcleo del sistema...",
    "loading.network": "> Leyendo red y estados guardados...",
    "loading.neural": "> Esperando sincronización neural...",
    "loading.hud": "> Cargando interfaz de superposición HUD...",
    "loading.hudMapping": "> Mapeando paneles de diseño del tablero...",
    "loading.hudLoaded": "> Interfaz DOM neural cargada exitosamente.",
    "loading.worldGen": "> Generando matriz de coordenadas del sector...",
    "loading.worldPop": "> Poblando asteroides y anomalías locales...",
    "loading.worldGrid": "> Rejilla de viaje warp generada.",
    "loading.pixi": "> Iniciando motor GPU PixiJS...",
    "loading.pixiTextures": "> Horneando texturas planetarias...",
    "loading.pixiShaders": "> Shaders compilados. Sistemas nominales.",
  },
};
