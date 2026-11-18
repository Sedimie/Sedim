// packages/health/src/plan-config.ts
function createHealthPlanConfig(ctx, selectedFeatures) {
  const src = ctx.structure.srcDir ?? "src";
  const framework = ctx.framework.value;
  const detailed = selectedFeatures.includes("detailed");
  const templates = [];
  const injections = [];
  if (framework === "nextjs") {
    templates.push({
      templateKey: detailed ? "health/templates/routes/nextjs-detailed" : "health/templates/routes/nextjs-basic",
      outputPath: () => `${src}/app/api/health/route.ts`,
      overwriteStrategy: "skip"
    });
  } else if (framework === "express") {
    templates.push({
      templateKey: detailed ? "health/templates/routes/express-detailed" : "health/templates/routes/express-basic",
      outputPath: () => `${src}/sedim/health/router.ts`,
      overwriteStrategy: "skip"
    });
    injections.push({
      type: "import",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        express: {
          payload: `import { healthRouter } from './sedim/health/router'`,
          anchor: "import",
          position: "after"
        }
      }
    });
    injections.push({
      type: "route",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        express: {
          payload: `app.use('/health', healthRouter)`,
          anchor: "app.listen",
          position: "before"
        }
      }
    });
  } else if (framework === "hono") {
    templates.push({
      templateKey: detailed ? "health/templates/routes/hono-detailed" : "health/templates/routes/hono-basic",
      outputPath: () => `${src}/sedim/health/routes.ts`,
      overwriteStrategy: "skip"
    });
    injections.push({
      type: "import",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        hono: {
          payload: `import { healthRoutes } from './sedim/health/routes'`,
          anchor: "import",
          position: "after"
        }
      }
    });
    injections.push({
      type: "route",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        hono: {
          payload: `app.route('/health', healthRoutes)`,
          anchor: "export default",
          position: "before"
        }
      }
    });
  } else if (framework === "fastify") {
    templates.push({
      templateKey: detailed ? "health/templates/routes/fastify-detailed" : "health/templates/routes/fastify-basic",
      outputPath: () => `${src}/sedim/health/plugin.ts`,
      overwriteStrategy: "skip"
    });
    injections.push({
      type: "import",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        fastify: {
          payload: `import { healthPlugin } from './sedim/health/plugin'`,
          anchor: "import",
          position: "after"
        }
      }
    });
    injections.push({
      type: "route",
      target: (c) => {
        var _a;
        return ((_a = c.codeArchitecture.appEntrypoint) == null ? void 0 : _a.file) ?? null;
      },
      variants: {
        fastify: {
          payload: `app.register(healthPlugin, { prefix: '/health' })`,
          anchor: "app.listen",
          position: "before"
        }
      }
    });
  }
  return {
    moduleName: "health",
    version: "0.1.0",
    templates,
    injections,
    dependencies: [],
    devDependencies: [],
    envVars: [],
    schemaTables: [],
    peerContracts: []
  };
}
export {
  createHealthPlanConfig
};
