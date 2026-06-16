import {
  UniformGroup,
  createIdFromString,
  eventemitter3_default,
  getAttributeInfoFromFormat,
  uid
} from "./chunk-U3DNX22H.js";

// node_modules/pixi.js/lib/environment-browser/BrowserAdapter.mjs
var BrowserAdapter = {
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  createImage: () => new Image(),
  getCanvasRenderingContext2D: () => CanvasRenderingContext2D,
  getWebGLRenderingContext: () => WebGLRenderingContext,
  getNavigator: () => navigator,
  getBaseUrl: () => document.baseURI ?? window.location.href,
  getFontFaceSet: () => document.fonts,
  fetch: (url, options) => fetch(url, options),
  parseXML: (xml) => {
    const parser = new DOMParser();
    return parser.parseFromString(xml, "text/xml");
  }
};

// node_modules/pixi.js/lib/environment/adapter.mjs
var currentAdapter = BrowserAdapter;
var DOMAdapter = {
  /**
   * Returns the current adapter.
   * @returns {environment.Adapter} The current adapter.
   */
  get() {
    return currentAdapter;
  },
  /**
   * Sets the current adapter.
   * @param adapter - The new adapter.
   */
  set(adapter) {
    currentAdapter = adapter;
  }
};

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getTestContext.mjs
var context;
function getTestContext() {
  if (!context || (context == null ? void 0 : context.isContextLost())) {
    const canvas = DOMAdapter.get().createCanvas();
    context = canvas.getContext("webgl", {});
  }
  return context;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/getMaxFragmentPrecision.mjs
var maxFragmentPrecision;
function getMaxFragmentPrecision() {
  if (!maxFragmentPrecision) {
    maxFragmentPrecision = "mediump";
    const gl = getTestContext();
    if (gl) {
      if (gl.getShaderPrecisionFormat) {
        const shaderFragment = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        maxFragmentPrecision = shaderFragment.precision ? "highp" : "mediump";
      }
    }
  }
  return maxFragmentPrecision;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/addProgramDefines.mjs
function addProgramDefines(src, isES300, isFragment) {
  if (isES300) return src;
  if (isFragment) {
    src = src.replace("out vec4 finalColor;", "");
    return `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in varying
        #define finalColor gl_FragColor
        #define texture texture2D
        #endif
        ${src}
        `;
  }
  return `

        #ifdef GL_ES // This checks if it is WebGL1
        #define in attribute
        #define out varying
        #endif
        ${src}
        `;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/ensurePrecision.mjs
function ensurePrecision(src, options, isFragment) {
  const maxSupportedPrecision = isFragment ? options.maxSupportedFragmentPrecision : options.maxSupportedVertexPrecision;
  if (src.substring(0, 9) !== "precision") {
    let precision = isFragment ? options.requestedFragmentPrecision : options.requestedVertexPrecision;
    if (precision === "highp" && maxSupportedPrecision !== "highp") {
      precision = "mediump";
    }
    return `precision ${precision} float;
${src}`;
  } else if (maxSupportedPrecision !== "highp" && src.substring(0, 15) === "precision highp") {
    return src.replace("precision highp", "precision mediump");
  }
  return src;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/insertVersion.mjs
function insertVersion(src, isES300) {
  if (!isES300) return src;
  return `#version 300 es
${src}`;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/setProgramName.mjs
var fragmentNameCache = {};
var VertexNameCache = {};
function setProgramName(src, { name = `pixi-program` }, isFragment = true) {
  name = name.replace(/\s+/g, "-");
  name += isFragment ? "-fragment" : "-vertex";
  const nameCache = isFragment ? fragmentNameCache : VertexNameCache;
  if (nameCache[name]) {
    nameCache[name]++;
    name += `-${nameCache[name]}`;
  } else {
    nameCache[name] = 1;
  }
  if (src.indexOf("#define SHADER_NAME") !== -1) return src;
  const shaderName = `#define SHADER_NAME ${name}`;
  return `${shaderName}
${src}`;
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/program/preprocessors/stripVersion.mjs
function stripVersion(src, isES300) {
  if (!isES300) return src;
  return src.replace("#version 300 es", "");
}

// node_modules/pixi.js/lib/rendering/renderers/gl/shader/GlProgram.mjs
var processes = {
  // strips any version headers..
  stripVersion,
  // adds precision string if not already present
  ensurePrecision,
  // add some defines if WebGL1 to make it more compatible with WebGL2 shaders
  addProgramDefines,
  // add the program name to the shader
  setProgramName,
  // add the version string to the shader header
  insertVersion
};
var programCache = /* @__PURE__ */ Object.create(null);
var _GlProgram = class _GlProgram2 {
  /**
   * Creates a shiny new GlProgram. Used by WebGL renderer.
   * @param options - The options for the program.
   */
  constructor(options) {
    options = { ..._GlProgram2.defaultOptions, ...options };
    const isES300 = options.fragment.indexOf("#version 300 es") !== -1;
    const preprocessorOptions = {
      stripVersion: isES300,
      ensurePrecision: {
        requestedFragmentPrecision: options.preferredFragmentPrecision,
        requestedVertexPrecision: options.preferredVertexPrecision,
        maxSupportedVertexPrecision: "highp",
        maxSupportedFragmentPrecision: getMaxFragmentPrecision()
      },
      setProgramName: {
        name: options.name
      },
      addProgramDefines: isES300,
      insertVersion: isES300
    };
    let fragment = options.fragment;
    let vertex = options.vertex;
    Object.keys(processes).forEach((processKey) => {
      const processOptions = preprocessorOptions[processKey];
      fragment = processes[processKey](fragment, processOptions, true);
      vertex = processes[processKey](vertex, processOptions, false);
    });
    this.fragment = fragment;
    this.vertex = vertex;
    this.transformFeedbackVaryings = options.transformFeedbackVaryings;
    this._key = createIdFromString(`${this.vertex}:${this.fragment}`, "gl-program");
  }
  /** destroys the program */
  destroy() {
    this.fragment = null;
    this.vertex = null;
    this._attributeData = null;
    this._uniformData = null;
    this._uniformBlockData = null;
    this.transformFeedbackVaryings = null;
    programCache[this._cacheKey] = null;
  }
  /**
   * Helper function that creates a program for a given source.
   * It will check the program cache if the program has already been created.
   * If it has that one will be returned, if not a new one will be created and cached.
   * @param options - The options for the program.
   * @returns A program using the same source
   */
  static from(options) {
    const key = `${options.vertex}:${options.fragment}`;
    if (!programCache[key]) {
      programCache[key] = new _GlProgram2(options);
      programCache[key]._cacheKey = key;
    }
    return programCache[key];
  }
};
_GlProgram.defaultOptions = {
  preferredVertexPrecision: "highp",
  preferredFragmentPrecision: "mediump"
};
var GlProgram = _GlProgram;

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/extractAttributesFromGpuProgram.mjs
var WGSL_TO_VERTEX_TYPES = {
  f32: "float32",
  "vec2<f32>": "float32x2",
  "vec3<f32>": "float32x3",
  "vec4<f32>": "float32x4",
  vec2f: "float32x2",
  vec3f: "float32x3",
  vec4f: "float32x4",
  i32: "sint32",
  "vec2<i32>": "sint32x2",
  "vec3<i32>": "sint32x3",
  "vec4<i32>": "sint32x4",
  vec2i: "sint32x2",
  vec3i: "sint32x3",
  vec4i: "sint32x4",
  u32: "uint32",
  "vec2<u32>": "uint32x2",
  "vec3<u32>": "uint32x3",
  "vec4<u32>": "uint32x4",
  vec2u: "uint32x2",
  vec3u: "uint32x3",
  vec4u: "uint32x4",
  bool: "uint32",
  "vec2<bool>": "uint32x2",
  "vec3<bool>": "uint32x3",
  "vec4<bool>": "uint32x4"
};
var LOCATION_REGEX = /@location\((\d+)\)\s+([a-zA-Z0-9_]+)\s*:\s*([a-zA-Z0-9_<>]+)(?:,|\s|\)|$)/g;
function parseLocations(str, results) {
  let match;
  while ((match = LOCATION_REGEX.exec(str)) !== null) {
    const format = WGSL_TO_VERTEX_TYPES[match[3]] ?? "float32";
    results[match[2]] = {
      location: parseInt(match[1], 10),
      format,
      stride: getAttributeInfoFromFormat(format).stride,
      offset: 0,
      instance: false,
      start: 0
    };
  }
  LOCATION_REGEX.lastIndex = 0;
}
function stripComments(source) {
  return source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function extractAttributesFromGpuProgram({ source, entryPoint }) {
  const results = {};
  const cleanSource = stripComments(source);
  const mainVertStart = cleanSource.indexOf(`fn ${entryPoint}(`);
  if (mainVertStart === -1) {
    return results;
  }
  const arrowFunctionStart = cleanSource.indexOf("->", mainVertStart);
  if (arrowFunctionStart === -1) {
    return results;
  }
  const functionArgsSubstring = cleanSource.substring(mainVertStart, arrowFunctionStart);
  parseLocations(functionArgsSubstring, results);
  if (Object.keys(results).length === 0) {
    const structMatch = functionArgsSubstring.match(/\(\s*\w+\s*:\s*(\w+)/);
    if (structMatch) {
      const structName = structMatch[1];
      const structRegex = new RegExp(`struct\\s+${structName}\\s*\\{([^}]+)\\}`, "s");
      const structBody = cleanSource.match(structRegex);
      if (structBody) {
        parseLocations(structBody[1], results);
      }
    }
  }
  return results;
}

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/extractStructAndGroups.mjs
function extractStructAndGroups(wgsl) {
  var _a, _b;
  const linePattern = /(^|[^/])@(group|binding)\(\d+\)[^;]+;/g;
  const groupPattern = /@group\((\d+)\)/;
  const bindingPattern = /@binding\((\d+)\)/;
  const namePattern = /var(<[^>]+>)? (\w+)/;
  const typePattern = /:\s*([\w<>]+)/;
  const structPattern = /struct\s+(\w+)\s*{([^}]+)}/g;
  const structMemberPattern = /(\w+)\s*:\s*([\w\<\>]+)/g;
  const structName = /struct\s+(\w+)/;
  const groups = (_a = wgsl.match(linePattern)) == null ? void 0 : _a.map((item) => ({
    group: parseInt(item.match(groupPattern)[1], 10),
    binding: parseInt(item.match(bindingPattern)[1], 10),
    name: item.match(namePattern)[2],
    isUniform: item.match(namePattern)[1] === "<uniform>",
    type: item.match(typePattern)[1]
  }));
  if (!groups) {
    return {
      groups: [],
      structs: []
    };
  }
  const structs = ((_b = wgsl.match(structPattern)) == null ? void 0 : _b.map((struct) => {
    const name = struct.match(structName)[1];
    const members = struct.match(structMemberPattern).reduce((acc, member) => {
      const [name2, type] = member.split(":");
      acc[name2.trim()] = type.trim();
      return acc;
    }, {});
    if (!members) {
      return null;
    }
    return { name, members };
  }).filter(({ name }) => groups.some(
    (group) => (
      // Handle both direct type matches and generic types like array<StructName>
      group.type === name || group.type.includes(`<${name}>`)
    )
  ))) ?? [];
  return {
    groups,
    structs
  };
}

// node_modules/pixi.js/lib/rendering/renderers/shared/shader/const.mjs
var ShaderStage = ((ShaderStage2) => {
  ShaderStage2[ShaderStage2["VERTEX"] = 1] = "VERTEX";
  ShaderStage2[ShaderStage2["FRAGMENT"] = 2] = "FRAGMENT";
  ShaderStage2[ShaderStage2["COMPUTE"] = 4] = "COMPUTE";
  return ShaderStage2;
})(ShaderStage || {});

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/generateGpuLayoutGroups.mjs
function generateGpuLayoutGroups({ groups }) {
  const layout = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!layout[group.group]) {
      layout[group.group] = [];
    }
    if (group.isUniform) {
      layout[group.group].push({
        binding: group.binding,
        visibility: ShaderStage.VERTEX | ShaderStage.FRAGMENT,
        buffer: {
          type: "uniform"
        }
      });
    } else if (group.type === "sampler") {
      layout[group.group].push({
        binding: group.binding,
        visibility: ShaderStage.FRAGMENT,
        sampler: {
          type: "filtering"
        }
      });
    } else if (group.type === "texture_2d" || group.type.startsWith("texture_2d<")) {
      layout[group.group].push({
        binding: group.binding,
        visibility: ShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d",
          multisampled: false
        }
      });
    } else if (group.type === "texture_2d_array" || group.type.startsWith("texture_2d_array<")) {
      layout[group.group].push({
        binding: group.binding,
        visibility: ShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d-array",
          multisampled: false
        }
      });
    } else if (group.type === "texture_cube" || group.type.startsWith("texture_cube<")) {
      layout[group.group].push({
        binding: group.binding,
        visibility: ShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "cube",
          multisampled: false
        }
      });
    }
  }
  for (let i = 0; i < layout.length; i++) {
    layout[i] || (layout[i] = []);
  }
  return layout;
}

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/generateLayoutHash.mjs
function generateLayoutHash({ groups }) {
  const layout = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (!layout[group.group]) {
      layout[group.group] = {};
    }
    layout[group.group][group.name] = group.binding;
  }
  return layout;
}

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/utils/removeStructAndGroupDuplicates.mjs
function removeStructAndGroupDuplicates(vertexStructsAndGroups, fragmentStructsAndGroups) {
  const structNameSet = /* @__PURE__ */ new Set();
  const dupeGroupKeySet = /* @__PURE__ */ new Set();
  const structs = [...vertexStructsAndGroups.structs, ...fragmentStructsAndGroups.structs].filter((struct) => {
    if (structNameSet.has(struct.name)) {
      return false;
    }
    structNameSet.add(struct.name);
    return true;
  });
  const groups = [...vertexStructsAndGroups.groups, ...fragmentStructsAndGroups.groups].filter((group) => {
    const key = `${group.name}-${group.binding}`;
    if (dupeGroupKeySet.has(key)) {
      return false;
    }
    dupeGroupKeySet.add(key);
    return true;
  });
  return { structs, groups };
}

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/GpuProgram.mjs
var programCache2 = /* @__PURE__ */ Object.create(null);
var GpuProgram = class _GpuProgram {
  /**
   * Create a new GpuProgram
   * @param options - The options for the gpu program
   */
  constructor(options) {
    var _a, _b;
    this._layoutKey = 0;
    this._attributeLocationsKey = 0;
    const { fragment, vertex, layout, gpuLayout, name } = options;
    this.name = name;
    this.fragment = fragment;
    this.vertex = vertex;
    if (fragment.source === vertex.source) {
      const structsAndGroups = extractStructAndGroups(fragment.source);
      this.structsAndGroups = structsAndGroups;
    } else {
      const vertexStructsAndGroups = extractStructAndGroups(vertex.source);
      const fragmentStructsAndGroups = extractStructAndGroups(fragment.source);
      this.structsAndGroups = removeStructAndGroupDuplicates(vertexStructsAndGroups, fragmentStructsAndGroups);
    }
    this.layout = layout ?? generateLayoutHash(this.structsAndGroups);
    this.gpuLayout = gpuLayout ?? generateGpuLayoutGroups(this.structsAndGroups);
    this.autoAssignGlobalUniforms = !!(((_a = this.layout[0]) == null ? void 0 : _a.globalUniforms) !== void 0);
    this.autoAssignLocalUniforms = !!(((_b = this.layout[1]) == null ? void 0 : _b.localUniforms) !== void 0);
    this._generateProgramKey();
  }
  // TODO maker this pure
  _generateProgramKey() {
    const { vertex, fragment } = this;
    const bigKey = vertex.source + fragment.source + vertex.entryPoint + fragment.entryPoint;
    this._layoutKey = createIdFromString(bigKey, "program");
  }
  get attributeData() {
    this._attributeData ?? (this._attributeData = extractAttributesFromGpuProgram(this.vertex));
    return this._attributeData;
  }
  /** destroys the program */
  destroy() {
    this.gpuLayout = null;
    this.layout = null;
    this.structsAndGroups = null;
    this.fragment = null;
    this.vertex = null;
    programCache2[this._cacheKey] = null;
  }
  /**
   * Helper function that creates a program for a given source.
   * It will check the program cache if the program has already been created.
   * If it has that one will be returned, if not a new one will be created and cached.
   * @param options - The options for the program.
   * @returns A program using the same source
   */
  static from(options) {
    const key = `${options.vertex.source}:${options.fragment.source}:${options.fragment.entryPoint}:${options.vertex.entryPoint}`;
    if (!programCache2[key]) {
      programCache2[key] = new _GpuProgram(options);
      programCache2[key]._cacheKey = key;
    }
    return programCache2[key];
  }
};

// node_modules/pixi.js/lib/rendering/renderers/gpu/shader/BindGroup.mjs
var BindGroup = class {
  /**
   * Create a new instance eof the Bind Group.
   * @param resources - The resources that are bound together for use by a shader.
   */
  constructor(resources) {
    this.resources = /* @__PURE__ */ Object.create(null);
    this._dirty = true;
    let index = 0;
    for (const i in resources) {
      const resource = resources[i];
      this.setResource(resource, index++);
    }
    this._updateKey();
  }
  /**
   * Updates the key if its flagged as dirty. This is used internally to
   * match this bind group to a WebGPU BindGroup.
   * @internal
   */
  _updateKey() {
    if (!this._dirty) return;
    this._dirty = false;
    const keyParts = [];
    let index = 0;
    for (const i in this.resources) {
      keyParts[index++] = this.resources[i]._resourceId;
    }
    this._key = keyParts.join("|");
  }
  /**
   * Set a resource at a given index. this function will
   * ensure that listeners will be removed from the current resource
   * and added to the new resource.
   * @param resource - The resource to set.
   * @param index - The index to set the resource at.
   */
  setResource(resource, index) {
    var _a, _b;
    const currentResource = this.resources[index];
    if (resource === currentResource) return;
    (_a = currentResource == null ? void 0 : currentResource.off) == null ? void 0 : _a.call(currentResource, "change", this.onResourceChange, this);
    (_b = resource.on) == null ? void 0 : _b.call(resource, "change", this.onResourceChange, this);
    this.resources[index] = resource;
    this._dirty = true;
  }
  /**
   * Returns the resource at the current specified index.
   * @param index - The index of the resource to get.
   * @returns - The resource at the specified index.
   */
  getResource(index) {
    return this.resources[index];
  }
  /**
   * Used internally to 'touch' each resource, to ensure that the GC
   * knows that all resources in this bind group are still being used.
   * @param now - The current time in milliseconds.
   * @param tick - The current tick.
   * @internal
   */
  _touch(now, tick) {
    const resources = this.resources;
    for (const i in resources) {
      resources[i]._gcLastUsed = now;
      resources[i]._touched = tick;
    }
  }
  /** Destroys this bind group and removes all listeners. */
  destroy() {
    var _a;
    const resources = this.resources;
    for (const i in resources) {
      const resource = resources[i];
      (_a = resource == null ? void 0 : resource.off) == null ? void 0 : _a.call(resource, "change", this.onResourceChange, this);
    }
    this.resources = null;
  }
  onResourceChange(resource) {
    this._dirty = true;
    if (resource.destroyed) {
      this.destroy();
    } else {
      this._updateKey();
    }
  }
};

// node_modules/pixi.js/lib/rendering/renderers/types.mjs
var RendererType = ((RendererType2) => {
  RendererType2[RendererType2["WEBGL"] = 1] = "WEBGL";
  RendererType2[RendererType2["WEBGPU"] = 2] = "WEBGPU";
  RendererType2[RendererType2["CANVAS"] = 4] = "CANVAS";
  RendererType2[RendererType2["BOTH"] = 3] = "BOTH";
  return RendererType2;
})(RendererType || {});

// node_modules/pixi.js/lib/rendering/renderers/shared/shader/Shader.mjs
var Shader = class _Shader extends eventemitter3_default {
  constructor(options) {
    super();
    this.uid = uid("shader");
    this._uniformBindMap = /* @__PURE__ */ Object.create(null);
    this._ownedBindGroups = [];
    this._destroyed = false;
    let {
      gpuProgram,
      glProgram,
      groups,
      resources,
      compatibleRenderers,
      groupMap
    } = options;
    this.gpuProgram = gpuProgram;
    this.glProgram = glProgram;
    if (compatibleRenderers === void 0) {
      compatibleRenderers = 0;
      if (gpuProgram) compatibleRenderers |= RendererType.WEBGPU;
      if (glProgram) compatibleRenderers |= RendererType.WEBGL;
    }
    this.compatibleRenderers = compatibleRenderers;
    const nameHash = {};
    if (!resources && !groups) {
      resources = {};
    }
    if (resources && groups) {
      throw new Error("[Shader] Cannot have both resources and groups");
    } else if (!gpuProgram && groups && !groupMap) {
      throw new Error("[Shader] No group map or WebGPU shader provided - consider using resources instead.");
    } else if (!gpuProgram && groups && groupMap) {
      for (const i in groupMap) {
        for (const j in groupMap[i]) {
          const uniformName = groupMap[i][j];
          nameHash[uniformName] = {
            group: i,
            binding: j,
            name: uniformName
          };
        }
      }
    } else if (gpuProgram && groups && !groupMap) {
      const groupData = gpuProgram.structsAndGroups.groups;
      groupMap = {};
      groupData.forEach((data) => {
        groupMap[data.group] = groupMap[data.group] || {};
        groupMap[data.group][data.binding] = data.name;
        nameHash[data.name] = data;
      });
    } else if (resources) {
      groups = {};
      groupMap = {};
      if (gpuProgram) {
        const groupData = gpuProgram.structsAndGroups.groups;
        groupData.forEach((data) => {
          groupMap[data.group] = groupMap[data.group] || {};
          groupMap[data.group][data.binding] = data.name;
          nameHash[data.name] = data;
        });
      }
      let bindTick = 0;
      for (const i in resources) {
        if (nameHash[i]) continue;
        if (!groups[99]) {
          groups[99] = new BindGroup();
          this._ownedBindGroups.push(groups[99]);
        }
        nameHash[i] = { group: 99, binding: bindTick, name: i };
        groupMap[99] = groupMap[99] || {};
        groupMap[99][bindTick] = i;
        bindTick++;
      }
      for (const i in resources) {
        const name = i;
        let value = resources[i];
        if (!value.source && !value._resourceType) {
          value = new UniformGroup(value);
        }
        const data = nameHash[name];
        if (data) {
          if (!groups[data.group]) {
            groups[data.group] = new BindGroup();
            this._ownedBindGroups.push(groups[data.group]);
          }
          groups[data.group].setResource(value, data.binding);
        }
      }
    }
    this.groups = groups;
    this._uniformBindMap = groupMap;
    this.resources = this._buildResourceAccessor(groups, nameHash);
  }
  /**
   * Sometimes a resource group will be provided later (for example global uniforms)
   * In such cases, this method can be used to let the shader know about the group.
   * @param name - the name of the resource group
   * @param groupIndex - the index of the group (should match the webGPU shader group location)
   * @param bindIndex - the index of the bind point (should match the webGPU shader bind point)
   */
  addResource(name, groupIndex, bindIndex) {
    var _a, _b;
    (_a = this._uniformBindMap)[groupIndex] || (_a[groupIndex] = {});
    (_b = this._uniformBindMap[groupIndex])[bindIndex] || (_b[bindIndex] = name);
    if (!this.groups[groupIndex]) {
      this.groups[groupIndex] = new BindGroup();
      this._ownedBindGroups.push(this.groups[groupIndex]);
    }
  }
  _buildResourceAccessor(groups, nameHash) {
    const uniformsOut = {};
    for (const i in nameHash) {
      const data = nameHash[i];
      Object.defineProperty(uniformsOut, data.name, {
        get() {
          return groups[data.group].getResource(data.binding);
        },
        set(value) {
          groups[data.group].setResource(value, data.binding);
        }
      });
    }
    return uniformsOut;
  }
  /**
   * Use to destroy the shader when its not longer needed.
   * It will destroy the resources and remove listeners.
   * @param destroyPrograms - if the programs should be destroyed as well.
   * Make sure its not being used by other shaders!
   */
  destroy(destroyPrograms = false) {
    var _a, _b;
    if (this._destroyed) return;
    this._destroyed = true;
    this.emit("destroy", this);
    if (destroyPrograms) {
      (_a = this.gpuProgram) == null ? void 0 : _a.destroy();
      (_b = this.glProgram) == null ? void 0 : _b.destroy();
    }
    this.gpuProgram = null;
    this.glProgram = null;
    this.removeAllListeners();
    this._uniformBindMap = null;
    this._ownedBindGroups.forEach((bindGroup) => {
      bindGroup.destroy();
    });
    this._ownedBindGroups = null;
    this.resources = null;
    this.groups = null;
  }
  static from(options) {
    const { gpu, gl, ...rest } = options;
    let gpuProgram;
    let glProgram;
    if (gpu) {
      gpuProgram = GpuProgram.from(gpu);
    }
    if (gl) {
      glProgram = GlProgram.from(gl);
    }
    return new _Shader({
      gpuProgram,
      glProgram,
      ...rest
    });
  }
};

export {
  BrowserAdapter,
  DOMAdapter,
  getTestContext,
  getMaxFragmentPrecision,
  addProgramDefines,
  ensurePrecision,
  insertVersion,
  setProgramName,
  stripVersion,
  GlProgram,
  extractAttributesFromGpuProgram,
  extractStructAndGroups,
  ShaderStage,
  generateGpuLayoutGroups,
  generateLayoutHash,
  removeStructAndGroupDuplicates,
  GpuProgram,
  BindGroup,
  RendererType,
  Shader
};
//# sourceMappingURL=chunk-U4DY3P56.js.map
