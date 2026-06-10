const fs = require('fs');
const f = 'C:/Users/JBCry/.windsurf/worktrees/Novus-adde757b/Novus-adde757b-25d51078/src/render/pixi-target-arrows.ts';
fs.appendFileSync(f, `\n\nexport const tutorialGuideArrowRenderer: RenderSubsystem = {\n  name: "tutorialGuideArrow",\n  sync: (ctx) => {\n    if (ctx.tutorialActive) syncPixiTutorialGuideArrow(ctx.width, ctx.height, ctx.camxR, ctx.camyR, ctx.now);\n  },\n  destroy: () => {},\n  modes: [AppMode.SPACE],\n  order: 360,\n};\n`);
