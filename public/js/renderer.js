function smoothStep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

window.BERG_ROUTE_LANE_SPACING = window.BERG_ROUTE_LANE_SPACING || 6.35;

class BergRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.atmospherePreset = options.atmospherePreset || 'classic';
    this.isNewYearPreset = this.atmospherePreset === 'newyear';
    this.scene = new THREE.Scene();
    // Tighter, denser atmospheric haze — the far silhouettes now fade into
    // the sky instead of sitting hard against a cool-black backdrop.
    this.scene.fog = new THREE.Fog(0x1a2834, 48, 190);

    this.routeHeight = 228;
    this.routeScale = this.routeHeight / 100;
    this.verticalCompression = 0.52;
    this.summitFocusLocal = new THREE.Vector3(0, 246.5, -8.2);

    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 520);
    this.camera.position.set(0, 2, 4.2);
    this.camera.lookAt(0, 12, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Lower exposure + the denser fog give the frame the cold, silvery
    // quality of north-face stills in alpine documentaries.
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.physicallyCorrectLights = true;

    this.elapsed = 0;
    this.playerRender = new THREE.Vector3(0, 0, 1.5);
    this.cameraTarget = new THREE.Vector3(0, 10, 0);
    this.lastSnapshot = null;
    this.upAxis = new THREE.Vector3(0, 1, 0);
    this.tempVecA = new THREE.Vector3();
    this.tempVecB = new THREE.Vector3();
    this.tempVecC = new THREE.Vector3();
    this.tempVecD = new THREE.Vector3();
    this.tempVecE = new THREE.Vector3();
    this.tempVecF = new THREE.Vector3();
    this.tempVecG = new THREE.Vector3();
    this.tempMatA = new THREE.Matrix4();

    this.rockMeshes = new Map();
    this.fissureMeshes = new Map();
    this.avalancheMeshes = new Map();
    this.footprints = new Map();
    this.routeLanterns = [];
    this.cloudCards = [];
    this.crackNodes = [];
    this.icePanels = [];
    this.ropeSegments = [];
    this.auroraBands = [];

    this.root = new THREE.Group();
    this.root.scale.y = this.verticalCompression;
    this.scene.add(this.root);

    this._createMaterials();
    this._buildLights();
    this._buildBackdrop();
    this._buildEnvironment();
    this._buildRope();
    this._buildPlayer();
    this._buildDynamicLayers();
    this._buildParticles();

    this._handleResize = () => this.resize();
    window.addEventListener('resize', this._handleResize);
  }

  _createMaterials() {
    const snowMap = this._makeTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#fbfeff');
      gradient.addColorStop(0.34, '#dcecf6');
      gradient.addColorStop(0.68, '#b8cfde');
      gradient.addColorStop(1, '#88a5b7');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let index = 0; index < 2600; index += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 0.6 + Math.random() * 3.2;
        ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.16})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let line = 0; line < 120; line += 1) {
        const startX = Math.random() * size;
        const startY = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.random() * 42 - 21, startY + Math.random() * 22 - 11);
        ctx.strokeStyle = `rgba(170,190,206,${0.04 + Math.random() * 0.08})`;
        ctx.lineWidth = 1 + Math.random() * 1.2;
        ctx.stroke();
      }
    });

    const rockMap = this._makeTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#293842');
      gradient.addColorStop(0.45, '#1a2630');
      gradient.addColorStop(1, '#0c1318');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let index = 0; index < 1800; index += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const width = 6 + Math.random() * 26;
        const height = 5 + Math.random() * 20;
        ctx.fillStyle = Math.random() > 0.5
          ? `rgba(255,255,255,${0.02 + Math.random() * 0.04})`
          : `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
        ctx.fillRect(x, y, width, height);
      }

      for (let crack = 0; crack < 60; crack += 1) {
        const startX = Math.random() * size;
        const startY = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        for (let step = 0; step < 5; step += 1) {
          ctx.lineTo(
            startX + step * (8 + Math.random() * 14),
            startY + Math.random() * 28 - 14
          );
        }
        ctx.strokeStyle = `rgba(0,0,0,${0.14 + Math.random() * 0.1})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.stroke();
      }
    });

    const boulderMap = this._makeTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#9ea6ab');
      gradient.addColorStop(0.28, '#767d82');
      gradient.addColorStop(0.64, '#575d62');
      gradient.addColorStop(1, '#353b40');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let patch = 0; patch < 260; patch += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 18 + Math.random() * 54;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const tint = Math.random();
        const lightTone = tint > 0.55 ? '170,176,180' : '132,138,142';
        const darkTone = tint > 0.55 ? '76,81,86' : '54,58,62';
        glow.addColorStop(0, `rgba(${lightTone},${0.06 + Math.random() * 0.08})`);
        glow.addColorStop(0.6, `rgba(${darkTone},${0.04 + Math.random() * 0.08})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      for (let speck = 0; speck < 2100; speck += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const width = 2 + Math.random() * 10;
        const height = 1.5 + Math.random() * 7;
        ctx.fillStyle = Math.random() > 0.48
          ? `rgba(255,255,255,${0.015 + Math.random() * 0.04})`
          : `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 1.2);
        ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
        ctx.restore();
      }

      for (let seam = 0; seam < 90; seam += 1) {
        const startX = Math.random() * size;
        const startY = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        for (let step = 1; step < 5; step += 1) {
          ctx.lineTo(
            startX + step * (10 + Math.random() * 18),
            startY + (Math.random() * 20 - 10)
          );
        }
        ctx.strokeStyle = `rgba(28,31,34,${0.08 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.8 + Math.random() * 1.6;
        ctx.stroke();
      }
    });

    const lavaMap = this._makeTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#ffe5a8');
      gradient.addColorStop(0.18, '#ffb15f');
      gradient.addColorStop(0.42, '#ff6c3c');
      gradient.addColorStop(0.72, '#5b221d');
      gradient.addColorStop(1, '#1c0908');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let index = 0; index < 1200; index += 1) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 4 + Math.random() * 18;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, `rgba(255,240,180,${0.15 + Math.random() * 0.25})`);
        glow.addColorStop(0.35, `rgba(255,120,60,${0.08 + Math.random() * 0.12})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    });

    const fabricMap = this._makeTexture(256, (ctx, size) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      for (let index = 0; index < 160; index += 1) {
        const x = (index % 16) * (size / 16);
        ctx.fillStyle = `rgba(0,0,0,${0.02 + (index % 3) * 0.01})`;
        ctx.fillRect(x, 0, 1, size);
      }
      for (let index = 0; index < 160; index += 1) {
        const y = (index % 16) * (size / 16);
        ctx.fillStyle = `rgba(255,255,255,${0.015 + (index % 4) * 0.012})`;
        ctx.fillRect(0, y, size, 1);
      }
    });

    const cloudMap = this._makeTexture(256, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
      gradient.addColorStop(0.45, 'rgba(235,245,255,0.44)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      for (let index = 0; index < 10; index += 1) {
        const x = size * (0.2 + Math.random() * 0.6);
        const y = size * (0.25 + Math.random() * 0.5);
        const radius = 16 + Math.random() * 40;
        const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);
        puff.addColorStop(0, 'rgba(255,255,255,0.32)');
        puff.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = puff;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    });

    const spriteMap = this._makeTexture(128, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 3, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.34, 'rgba(230,240,255,0.72)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });

    const warmSpriteMap = this._makeTexture(128, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 3, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,245,220,1)');
      gradient.addColorStop(0.34, 'rgba(255,170,100,0.8)');
      gradient.addColorStop(1, 'rgba(255,90,50,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });

    const footprintMap = this._makeTexture(160, (ctx, size) => {
      ctx.translate(size / 2, size / 2);
      ctx.rotate(-0.18);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 22, 48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -28, 18, 0, Math.PI * 2);
      ctx.fill();
      for (let toe = -14; toe <= 14; toe += 7) {
        ctx.beginPath();
        ctx.arc(toe, -48, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x87bddd) },
      horizonColor: { value: new THREE.Color(0xd2ecff) },
      bottomColor: { value: new THREE.Color(0x09111a) }
    };

    this.materials = {
      sky: new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float heightMix = normalize(vWorldPosition).y * 0.5 + 0.5;
            vec3 color = mix(bottomColor, horizonColor, smoothstep(0.0, 0.45, heightMix));
            color = mix(color, topColor, smoothstep(0.38, 1.0, heightMix));
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        side: THREE.BackSide,
        depthWrite: false
      }),
      cliff: new THREE.MeshStandardMaterial({
        map: snowMap,
        color: 0xffffff,
        roughness: 0.95,
        metalness: 0.03,
        vertexColors: true,
        flatShading: true
      }),
      cliffShadow: new THREE.MeshStandardMaterial({
        map: rockMap,
        color: 0x16212b,
        roughness: 1,
        metalness: 0.02
      }),
      glacier: new THREE.MeshStandardMaterial({
        map: snowMap,
        color: 0xcfe8fa,
        transparent: true,
        opacity: 0.24,
        roughness: 0.25,
        metalness: 0.08
      }),
      moltenFace: new THREE.MeshStandardMaterial({
        map: lavaMap,
        color: 0xff8a52,
        emissive: 0xff632d,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0,
        roughness: 0.82
      }),
      crack: new THREE.MeshStandardMaterial({
        color: 0xff8d57,
        emissive: 0xff5b2d,
        emissiveIntensity: 1.35,
        transparent: true,
        opacity: 0
      }),
      summit: new THREE.MeshStandardMaterial({
        map: snowMap,
        color: 0xeaf2f8,
        roughness: 0.72
      }),
      flag: new THREE.MeshStandardMaterial({
        color: 0xc73a36,
        roughness: 0.84,
        side: THREE.DoubleSide
      }),
      peakShadow: new THREE.MeshStandardMaterial({
        color: 0x0f1820,
        roughness: 1
      }),
      rope: new THREE.MeshStandardMaterial({
        color: 0xbfced7,
        roughness: 0.76,
        metalness: 0.08
      }),
      ropeLine: new THREE.LineBasicMaterial({
        color: 0xdbe4ea,
        transparent: true,
        opacity: 0.18
      }),
      tether: new THREE.LineBasicMaterial({
        color: 0xfdf5e7,
        transparent: true,
        opacity: 0.74
      }),
      anchorMetal: new THREE.MeshStandardMaterial({
        color: 0xb9c8d2,
        roughness: 0.34,
        metalness: 0.86
      }),
      rock: new THREE.MeshStandardMaterial({
        map: boulderMap,
        color: 0xc8cdd1,
        roughness: 0.97,
        metalness: 0.03,
        vertexColors: true
      }),
      trail: new THREE.SpriteMaterial({
        map: spriteMap,
        color: 0xc9e6fb,
        transparent: true,
        opacity: 0.36,
        depthWrite: false
      }),
      emberTrail: new THREE.SpriteMaterial({
        map: warmSpriteMap,
        color: 0xffa974,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      avalanche: new THREE.MeshBasicMaterial({
        map: cloudMap,
        color: 0xf1fbff,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      avalancheCore: new THREE.MeshBasicMaterial({
        color: 0xc9ebff,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      // Volumetric avalanche puff: overlapping subdivided spheres that read
      // as dense powder when stacked. Cloned once per avalanche so opacity
      // can pulse with intensity without touching the shared base.
      avalancheBlob: new THREE.MeshStandardMaterial({
        color: 0xe6f1fb,
        emissive: 0x7dabd0,
        emissiveIntensity: 0.28,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.78,
        depthWrite: false
      }),
      // Brighter foam crown riding on top of the main mass.
      avalancheCrest: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xd0e6ff,
        emissiveIntensity: 0.42,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      }),
      // Soft additive halo behind the mass so the silhouette is backlit
      // by a diffuse glow rather than a hard cut-out edge.
      avalancheGlow: new THREE.SpriteMaterial({
        map: cloudMap,
        color: 0xe3efff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      // Powder trail cards streaming out behind the avalanche.
      avalancheTrail: new THREE.SpriteMaterial({
        map: cloudMap,
        color: 0xf5fbff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
      }),
      // Ice-crystal spray points blown off the leading edge.
      avalancheSpray: new THREE.PointsMaterial({
        map: spriteMap,
        color: 0xffffff,
        size: 0.52,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      }),
      snowFar: new THREE.PointsMaterial({
        map: spriteMap,
        color: 0xe9f8ff,
        size: 0.16,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      }),
      snowMid: new THREE.PointsMaterial({
        map: spriteMap,
        color: 0xf7fdff,
        size: 0.22,
        transparent: true,
        opacity: 0.58,
        depthWrite: false
      }),
      snowNear: new THREE.PointsMaterial({
        map: spriteMap,
        color: 0xffffff,
        size: 0.34,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      }),
      ash: new THREE.PointsMaterial({
        map: warmSpriteMap,
        color: 0xffb78a,
        size: 0.28,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      star: new THREE.PointsMaterial({
        map: spriteMap,
        color: 0xe7f4ff,
        size: 1.1,
        transparent: true,
        opacity: 0.7,
        depthWrite: false
      }),
      cloud: new THREE.MeshBasicMaterial({
        map: cloudMap,
        color: 0xe3f3ff,
        transparent: true,
        opacity: 0.14,
        depthWrite: false
      }),
      aurora: new THREE.MeshBasicMaterial({
        map: cloudMap,
        color: 0x9ee8ff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      }),
      footprint: new THREE.MeshBasicMaterial({
        map: footprintMap,
        color: 0x90afc2,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      }),
      body: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x1f2d36,
        roughness: 0.92
      }),
      // Single saturated alpine red as the character's only hot accent —
      // the colour that reads from far away on a north face. Replaces the
      // orange construction-worker jacket the build used to ship with.
      bodyAccent: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x8c3630,
        roughness: 0.78
      }),
      bodySoft: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x3a4a55,
        roughness: 0.72
      }),
      backpackCanvas: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x2a343d,
        roughness: 0.95
      }),
      strap: new THREE.MeshStandardMaterial({
        color: 0x12181e,
        roughness: 0.9
      }),
      gloves: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x18232d,
        roughness: 0.9
      }),
      skin: new THREE.MeshStandardMaterial({
        color: 0xd8b099,
        roughness: 0.92
      }),
      visor: new THREE.MeshStandardMaterial({
        color: 0xcdeeff,
        emissive: 0x63d6ff,
        emissiveIntensity: 0.2,
        roughness: 0.12,
        metalness: 0.18,
        transparent: true,
        opacity: 0.72
      }),
      helmet: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0xdce2e8,
        roughness: 0.58
      }),
      boot: new THREE.MeshStandardMaterial({
        color: 0x11171d,
        roughness: 0.96
      }),
      metal: new THREE.MeshStandardMaterial({
        color: 0xa9b8c4,
        roughness: 0.34,
        metalness: 0.9
      }),
      iceTool: new THREE.MeshStandardMaterial({
        color: 0xf1b06e,
        roughness: 0.58,
        metalness: 0.06
      }),
      halo: new THREE.SpriteMaterial({
        map: warmSpriteMap,
        color: 0xffbf84,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      shield: new THREE.MeshBasicMaterial({
        map: spriteMap,
        color: 0xb8f3ff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }),
      moon: new THREE.SpriteMaterial({
        map: spriteMap,
        color: 0xeaf8ff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      }),
      lanternFrame: new THREE.MeshStandardMaterial({
        color: 0x4e3a23,
        roughness: 0.58,
        metalness: 0.62
      }),
      lanternGlass: new THREE.MeshStandardMaterial({
        color: 0xffdc9f,
        emissive: 0xe0a348,
        emissiveIntensity: 1.3,
        roughness: 0.18,
        metalness: 0.02,
        transparent: true,
        opacity: 0.92
      })
    };
  }

  _buildLights() {
    this.ambientLight = new THREE.HemisphereLight(0xe7f5ff, 0x20303b, 1.5);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xdaf0ff, 2.3);
    this.keyLight.position.set(18, 26, 22);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 220;
    this.keyLight.shadow.camera.left = -45;
    this.keyLight.shadow.camera.right = 45;
    this.keyLight.shadow.camera.top = 85;
    this.keyLight.shadow.camera.bottom = -85;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0x8fc3ff, 0.55);
    this.fillLight.position.set(-14, 8, 20);
    this.scene.add(this.fillLight);

    this.lavaLight = new THREE.PointLight(0xff6e3d, 14, 170, 2);
    this.lavaLight.position.set(0, this._worldY(158), 18);
    this.scene.add(this.lavaLight);

    this.summitLight = new THREE.PointLight(0xffd1a3, 6, 95, 2);
    this.summitLight.position.set(0, this._worldY(this.summitFocusLocal.y), 4);
    this.scene.add(this.summitLight);
  }

  _buildBackdrop() {
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 24), this.materials.sky);
    this.scene.add(skyDome);

    // Distant cold moon: small, no warm halo. Pushed further back and paler
    // so it sits in the sky instead of glowing like a lantern in frame.
    this.moonHalo = new THREE.Sprite(this.materials.halo.clone());
    this.moonHalo.material.color.setHex(0xaecadd);
    this.moonHalo.material.opacity = 0.08;
    this.moonHalo.material.blending = THREE.NormalBlending;
    this.moonHalo.position.set(-62, 148, -150);
    this.moonHalo.scale.set(12, 12, 1);
    this.scene.add(this.moonHalo);

    this.moonDisk = new THREE.Sprite(this.materials.moon.clone());
    this.moonDisk.material.color.setHex(0xd9e4ec);
    this.moonDisk.position.copy(this.moonHalo.position);
    this.moonDisk.scale.set(3.4, 3.4, 1);
    this.scene.add(this.moonDisk);

    const starCount = this.isNewYearPreset ? 1280 : 850;
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const radius = 160 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.46;
      starPositions[index * 3] = Math.cos(theta) * Math.sin(phi) * radius;
      starPositions[index * 3 + 1] = Math.cos(phi) * radius;
      starPositions[index * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starField = new THREE.Points(starGeometry, this.materials.star);
    if (this.isNewYearPreset) {
      this.starField.material.color.setHex(0xf5d26b);
      this.starField.material.size = 1.34;
    }
    this.scene.add(this.starField);

    // Distant ridge silhouettes: extrude a jagged polyline per band so the
    // horizon reads as an actual mountain chain instead of a row of cones.
    // Three parallax bands with atmospheric desaturation add real depth.
    this.distantPeaks = new THREE.Group();
    this.root.add(this.distantPeaks);

    const buildRidge = (width, segments, heightRange, roughness) => {
      const shape = new THREE.Shape();
      const halfWidth = width / 2;
      shape.moveTo(-halfWidth, 0);
      const pts = [];
      for (let i = 0; i <= segments; i += 1) {
        const x = -halfWidth + (i / segments) * width;
        const jitter = (Math.random() - 0.5) * roughness;
        const envelope = Math.sin((i / segments) * Math.PI);
        const y = heightRange[0] + envelope * (heightRange[1] - heightRange[0]) + jitter * 6;
        // Occasional sharp spike for drama
        const spike = Math.random() < 0.14 ? 5 + Math.random() * 5 : 0;
        pts.push([x, Math.max(2, y + spike)]);
      }
      pts.forEach((p) => shape.lineTo(p[0], p[1]));
      shape.lineTo(halfWidth, 0);
      shape.lineTo(-halfWidth, 0);
      return new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: false });
    };

    const ridgeBands = [
      { z: -118, baseY: 30, width: 280, segments: 22, heightRange: [14, 46], roughness: 1.6, tint: 0x52636e, mix: 0.58 },
      { z: -92,  baseY: 26, width: 240, segments: 18, heightRange: [16, 52], roughness: 1.2, tint: 0x45525d, mix: 0.4 },
      { z: -68,  baseY: 20, width: 210, segments: 14, heightRange: [18, 58], roughness: 1.0, tint: 0x38434d, mix: 0.22 }
    ];
    ridgeBands.forEach((band) => {
      const geom = buildRidge(band.width, band.segments, band.heightRange, band.roughness);
      const mat = new THREE.MeshBasicMaterial({ color: band.tint, fog: true });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(0, band.baseY, band.z);
      mesh.userData.hazeMix = band.mix;
      this.distantPeaks.add(mesh);
    });

    this.cloudGroup = new THREE.Group();
    this.root.add(this.cloudGroup);
    for (let index = 0; index < 14; index += 1) {
      const material = this.materials.cloud.clone();
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(18 + Math.random() * 16, 8 + Math.random() * 7), material);
      cloud.position.set(
        -30 + Math.random() * 60,
        18 + index * 15 + Math.random() * 8,
        -28 - Math.random() * 28
      );
      cloud.rotation.y = (Math.random() - 0.5) * 0.6;
      cloud.rotation.z = (Math.random() - 0.5) * 0.18;
      this.cloudCards.push({
        mesh: cloud,
        speed: 0.5 + Math.random() * 0.7,
        drift: 6 + Math.random() * 8,
        anchorX: cloud.position.x
      });
      this.cloudGroup.add(cloud);
    }

    // "Sea of clouds" shelf that follows the climber below eye-level. It
    // materialises past mid-climb and sells the feeling of being above the
    // weather layer. Positioned in root scope so it inherits verticalCompression.
    this.undercloudGroup = new THREE.Group();
    this.root.add(this.undercloudGroup);
    this.undercloudCards = [];
    for (let index = 0; index < 18; index += 1) {
      const material = this.materials.cloud.clone();
      material.opacity = 0;
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(32 + Math.random() * 26, 10 + Math.random() * 8),
        material
      );
      const angle = (index / 18) * Math.PI * 2;
      const radius = 28 + Math.random() * 36;
      cloud.position.set(
        Math.cos(angle) * radius,
        (index % 3 - 1) * 4,   // slight vertical jitter
        -6 - Math.sin(angle) * 14 - Math.random() * 10
      );
      cloud.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.14;
      cloud.rotation.z = Math.random() * Math.PI * 2;
      this.undercloudCards.push({
        mesh: cloud,
        angle,
        radius,
        speed: 0.08 + Math.random() * 0.06,
        yOffset: cloud.position.y
      });
      this.undercloudGroup.add(cloud);
    }

    // Aurora removed: too fantasy/game-y for the documentary alpine tone.
    // An empty placeholder group keeps later refs to this.auroraBands
    // cheap no-ops without special-casing every update call-site.
    this.auroraGroup = new THREE.Group();
    this.root.add(this.auroraGroup);
  }

  // Named mountain constants shared by the mesh builder and anything that
  // needs to sit on the generated slope.
  _mountainMeta() {
    const LANE_X = window.BERG_ROUTE_LANE_SPACING || 6.35;
    const ROUTE_HALF = LANE_X * 1.58 + 1.1;
    const MOUNT_WIDTH = 264;
    const MOUNT_HEIGHT = 336;
    return {
      LANE_X,
      ROUTE_HALF,
      MOUNT_WIDTH,
      MOUNT_HEIGHT,
      MOUNT_HALF_W: MOUNT_WIDTH / 2,
      MOUNT_HALF_H: MOUNT_HEIGHT / 2,
      FLANK_SPAN: MOUNT_WIDTH / 2 - ROUTE_HALF,
      BASE_Y: 112,
      BASE_Z: 0.4
    };
  }

  // Single source of truth for the mountain surface. Given a mesh-local
  // (baseX, meshY), returns the displaced (x, z) along with flags the
  // mesh builder and prop placers both need.
  _mountainProfile(baseX, meshY) {
    const m = this._mountainMeta();
    const slopeRatio = clamp01((meshY + m.MOUNT_HALF_H) / m.MOUNT_HEIGHT);
    const xSign = baseX === 0 ? 0 : Math.sign(baseX);
    const silhouette = Math.pow(1 - slopeRatio, 1.55);
    const summitPinch = smoothStep(0.82, 1, slopeRatio);

    let x;
    const absBase = Math.abs(baseX);
    if (absBase <= m.ROUTE_HALF) {
      x = baseX;
    } else {
      const outerFrac = (absBase - m.ROUTE_HALF) / m.FLANK_SPAN;
      const scaled = outerFrac * Math.max(0.04, silhouette);
      x = xSign * (m.ROUTE_HALF * Math.max(0.05, silhouette + summitPinch * -0.04) + scaled * m.FLANK_SPAN);
    }
    const absX = Math.abs(x);
    const outsideCorridor = absX > m.ROUTE_HALF;
    const insideRoute = !outsideCorridor;
    const flankFrac = outsideCorridor ? clamp01((absX - m.ROUTE_HALF) / m.FLANK_SPAN) : 0;
    const routeCenter = insideRoute ? clamp01(1 - absX / (m.ROUTE_HALF * 0.94)) : 0;
    const routeSmoothMask = insideRoute ? Math.pow(routeCenter, 1.35) : 0;
    // Soft falloff mask for the far flanks so noise and crags ease off before
    // the plane edge — prevents sharp "holes" when the silhouette recedes.
    const edgeFalloff = 1 - smoothStep(0.72, 1, flankFrac);

    const noise = (nx, ny, fx, fy) =>
      Math.sin(nx * fx + ny * fy * 1.3) * Math.cos(ny * fx * 1.1 - nx * fy * 0.7);

    const laneCenters = [-m.LANE_X, 0, m.LANE_X];
    let laneGullies = 0;
    let laneRibs = 0;
    let laneShoulders = 0;
    laneCenters.forEach((center, laneIndex) => {
      const laneDist = Math.abs(baseX - center);
      const trenchWidth = 1.24 + slopeRatio * 0.18 + laneIndex * 0.02;
      const trench = Math.max(0, 1 - laneDist / trenchWidth);
      laneGullies += Math.pow(trench, 2.8) * (1.08 + Math.sin(meshY * 0.095 + laneIndex * 1.6) * 0.14);
    });
    [-m.LANE_X * 0.5, m.LANE_X * 0.5].forEach((center, ribIndex) => {
      const ribDist = Math.abs(baseX - center);
      const rib = Math.max(0, 1 - ribDist / 1.05);
      laneRibs += Math.pow(rib, 2.2) * (0.92 + Math.cos(meshY * 0.082 + ribIndex * 1.4) * 0.12);
    });
    [-m.LANE_X * 1.16, m.LANE_X * 1.16].forEach((center, shoulderIndex) => {
      const shoulderDist = Math.abs(baseX - center);
      const shoulder = Math.max(0, 1 - shoulderDist / 1.7);
      laneShoulders += Math.pow(shoulder, 1.8) * (0.66 + Math.sin(meshY * 0.07 + shoulderIndex * 1.7) * 0.09);
    });

    const spineBank = Math.pow(Math.max(0, 1 - absX / 25.5), 1.22) * 4.8;
    const terrace =
      (Math.sin(meshY * 0.076 - x * 0.11) * 1.9 + Math.sin(meshY * 0.038 - x * 0.22) * 1.28) * edgeFalloff;
    const crags =
      noise(x, meshY, 0.28, 0.21) * 1.65 +
      noise(x, meshY, 0.74, 0.58) * 1.05 +
      noise(x, meshY, 1.52, 1.02) * 0.54 +
      noise(x, meshY, 3.4, 2.2) * 0.28;
    const fractureNoise =
      Math.abs(noise(x, meshY, 1.72, 1.28)) * 1.06 +
      Math.abs(Math.sin(meshY * 0.17 + x * 0.58)) * 0.56;
    const shearBands =
      Math.pow(Math.abs(Math.sin(meshY * 0.132 + x * 0.28)), 5.5) * (1.15 + flankFrac * 0.9) * edgeFalloff;
    const faultScarps =
      smoothStep(0.68, 0.98, Math.abs(Math.sin(meshY * 0.094 - x * 0.19))) *
      (0.95 + Math.abs(Math.sin(meshY * 0.041 + x * 0.33)) * 0.75) *
      edgeFalloff;
    const brokenFaces =
      smoothStep(0.2, 0.96, slopeRatio) *
      edgeFalloff *
      (Math.abs(Math.sin(meshY * 0.123 + x * 0.41)) * 1.2 + Math.abs(Math.sin(meshY * 0.29 - x * 0.17)) * 0.45);
    const chimneyCuts =
      smoothStep(0.18, 0.88, slopeRatio) *
      Math.max(0, 1 - Math.abs(Math.sin(x * 0.34 + meshY * 0.068)) / 0.72) *
      0.92 *
      edgeFalloff;
    const sideMass = smoothStep(m.ROUTE_HALF + 1.5, m.ROUTE_HALF + 22, absX) * (5.1 + Math.sin(meshY * 0.118) * 0.92) * edgeFalloff;
    const shoulderRise = Math.sin(slopeRatio * Math.PI) * smoothStep(m.ROUTE_HALF, m.ROUTE_HALF + 18, absX) * 2.6 * edgeFalloff;
    const crownLift = smoothStep(0.68, 1, slopeRatio) * Math.max(0, 8.2 - absX * 0.32);
    const brokenShelves =
      (Math.sin(meshY * 0.16 + x * 0.38) * 0.92 + Math.sin(meshY * 0.36 - x * 0.21) * 0.42) *
      smoothStep(0.1, 0.92, slopeRatio) *
      edgeFalloff;
    const buttress =
      smoothStep(m.ROUTE_HALF + 0.8, m.ROUTE_HALF + 22, absX) * (2.4 + Math.sin(meshY * 0.064 + absX * 0.18) * 0.84) * edgeFalloff;
    // Smooth, deep recession into the distance with a cubic taper so the far
    // silhouette fades into the horizon instead of ending in a cliff edge.
    const flankRecession = -(Math.pow(flankFrac, 1.16) * 29 + Math.pow(flankFrac, 3.2) * 18);
    const couloirDepth = insideRoute
      ? smoothStep(0, m.ROUTE_HALF, m.ROUTE_HALF - absX) * (0.74 + Math.sin(meshY * 0.19) * 0.11)
      : 0;
    const ledges = insideRoute ? Math.sin(meshY * 0.47 + x * 0.24) * 0.28 : 0;
    const routeChatter = insideRoute ? noise(x, meshY, 2.1, 1.46) * 0.22 : 0;
    const apexPush = smoothStep(0.84, 1, slopeRatio) * Math.max(0, 4.6 - absX * 0.34);
    const summitRecess = insideRoute
      ? smoothStep(0.84, 0.985, slopeRatio) *
        (0.9 + routeSmoothMask * 2.4 + Math.max(0, 1 - absX / (m.ROUTE_HALF + 0.6)) * 0.35)
      : 0;
    const fractureMask = clamp01((faultScarps * 0.45 + brokenFaces * 0.18 + shearBands * 0.16) / 1.55);
    const routeMacroScale = insideRoute ? 0.52 + (1 - routeSmoothMask) * 0.12 : 1;
    const routeCragScale = insideRoute ? 0.34 + (1 - routeSmoothMask) * 0.16 : 1;
    const routeBandScale = insideRoute ? 0.18 + (1 - routeSmoothMask) * 0.2 : 1;
    const routeMicroScale = insideRoute ? 0.28 + (1 - routeSmoothMask) * 0.16 : 1;
    const routeLaneScale = insideRoute ? 0.72 + (1 - routeSmoothMask) * 0.14 : 1;

    const z =
      -4.2 +
      spineBank +
      terrace * (insideRoute ? 0.88 * routeMacroScale : 0.88) +
      crags * (insideRoute ? 0.62 * routeCragScale : 0.88 * edgeFalloff) +
      fractureNoise * (insideRoute ? 0.32 * routeMicroScale : 0.62) * edgeFalloff +
      shearBands * (insideRoute ? 1.18 * routeBandScale : 1.18) +
      faultScarps * (insideRoute ? 1.22 * routeBandScale : 1.22) +
      brokenFaces * (insideRoute ? 0.56 * routeBandScale : 0.56) -
      chimneyCuts * (insideRoute ? 0.92 * routeBandScale : 0.92) +
      sideMass * 1.08 +
      shoulderRise +
      buttress * 1.16 +
      crownLift +
      brokenShelves * (insideRoute ? 1.18 * routeMacroScale : 1.18) +
      ledges * (insideRoute ? routeMicroScale : 1) +
      routeChatter * (insideRoute ? routeMicroScale : 1) +
      laneRibs * (insideRoute ? 1.04 * routeLaneScale : 1.04) +
      laneShoulders * (insideRoute ? 0.84 * routeLaneScale : 0.84) +
      apexPush +
      brokenShelves * smoothStep(0.88, 1, slopeRatio) * 0.06 -
      summitRecess +
      flankRecession -
      couloirDepth * (insideRoute ? 1.58 + routeSmoothMask * 0.22 : 1.44) -
      laneGullies * ((insideRoute ? 1.2 - routeSmoothMask * 0.08 : 1.34) + slopeRatio * (insideRoute ? 0.24 : 0.38));

    return { x, z, insideRoute, slopeRatio, crags, terrace, flankFrac, fractureMask, routeSmoothMask };
  }

  // Given a prop baseX plus its environmentGroup-local y, return the
  // environmentGroup-local anchor (x, y, z) that sits exactly on the face.
  // `embedDepth` lets callers sink the prop partially into the slope so
  // it reads as attached instead of floating above it.
  _faceAnchor(baseX, worldY, embedDepth = 0) {
    const m = this._mountainMeta();
    const meshY = worldY - m.BASE_Y;
    const profile = this._mountainProfile(baseX, meshY);
    return {
      x: profile.x,
      y: worldY,
      z: profile.z + m.BASE_Z - embedDepth,
      insideRoute: profile.insideRoute,
      slopeRatio: profile.slopeRatio,
      crags: profile.crags,
      flankFrac: profile.flankFrac
    };
  }

  _surfaceFrame(baseX, worldY) {
    const acrossA = this._faceAnchor(baseX - 0.4, worldY, 0);
    const acrossB = this._faceAnchor(baseX + 0.4, worldY, 0);
    const alongA = this._faceAnchor(baseX, worldY - 0.7, 0);
    const alongB = this._faceAnchor(baseX, worldY + 0.7, 0);

    this.tempVecD.set(acrossB.x - acrossA.x, acrossB.y - acrossA.y, acrossB.z - acrossA.z);
    if (this.tempVecD.lengthSq() < 1e-5) {
      this.tempVecD.set(1, 0, 0);
    } else {
      this.tempVecD.normalize();
    }

    this.tempVecE.set(alongB.x - alongA.x, alongB.y - alongA.y, alongB.z - alongA.z);
    if (this.tempVecE.lengthSq() < 1e-5) {
      this.tempVecE.set(0, 1, 0);
    } else {
      this.tempVecE.normalize();
    }

    this.tempVecF.crossVectors(this.tempVecD, this.tempVecE);
    if (this.tempVecF.lengthSq() < 1e-5) {
      this.tempVecF.set(0, 0, 1);
    } else {
      this.tempVecF.normalize();
    }
    if (this.tempVecF.z < 0) {
      this.tempVecF.multiplyScalar(-1);
    }

    this.tempVecG.crossVectors(this.tempVecF, this.tempVecD);
    if (this.tempVecG.lengthSq() < 1e-5) {
      this.tempVecG.set(0, 1, 0);
    } else {
      this.tempVecG.normalize();
    }

    return {
      position: this._faceAnchor(baseX, worldY, 0),
      tangentX: this.tempVecD,
      tangentY: this.tempVecG,
      normal: this.tempVecF
    };
  }

  _seededUnit(seed) {
    const raw = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return raw - Math.floor(raw);
  }

  _directionFromSeed(seed) {
    const vector = new THREE.Vector3(
      this._seededUnit(seed) * 2 - 1,
      this._seededUnit(seed + 9.17) * 2 - 1,
      this._seededUnit(seed + 17.41) * 2 - 1
    );
    if (vector.lengthSq() < 1e-5) {
      vector.set(0.4, 0.8, 0.2);
    }
    return vector.normalize();
  }

  _makeRockMaterial(seed = Math.random() * 1000, family = 'env') {
    const familyTuning = {
      env: { light: 0.42, sat: 0.055, roughness: 0.93 },
      perched: { light: 0.36, sat: 0.05, roughness: 0.97 },
      falling: { light: 0.39, sat: 0.045, roughness: 0.98 }
    };
    const tuning = familyTuning[family] || familyTuning.env;
    const hue = 0.58 + (this._seededUnit(seed + 1) - 0.5) * 0.035;
    const saturation = tuning.sat + this._seededUnit(seed + 2) * 0.035;
    const lightness = tuning.light + (this._seededUnit(seed + 3) - 0.5) * 0.14;
    const color = new THREE.Color().setHSL(hue, saturation, lightness);

    return new THREE.MeshStandardMaterial({
      map: this.materials.rock.map,
      color,
      roughness: Math.min(1, tuning.roughness + this._seededUnit(seed + 4) * 0.08),
      metalness: 0.02 + this._seededUnit(seed + 5) * 0.04,
      vertexColors: true
    });
  }

  // Boulder sculpt: stretch the primitive into an uneven mass, then carve
  // flatter faces and chipped ridges so the silhouette reads like fractured
  // alpine stone instead of a noisy sphere.
  _buildBoulderGeometry(radius, detail = 2, jitterAmount = 0.22, options = {}) {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const temp = new THREE.Vector3();
    const base = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const seed = options.seed ?? Math.random() * 1000;
    const stretchX = options.stretchX ?? (0.82 + this._seededUnit(seed + 7) * 0.42);
    const stretchY = options.stretchY ?? (0.74 + this._seededUnit(seed + 11) * 0.34);
    const stretchZ = options.stretchZ ?? (0.78 + this._seededUnit(seed + 13) * 0.46);
    const lobeA = this._directionFromSeed(seed + 17);
    const lobeB = this._directionFromSeed(seed + 29);
    const lobeC = this._directionFromSeed(seed + 43);
    const ridgeAxis = this._directionFromSeed(seed + 59);
    const colorBias = (this._seededUnit(seed + 67) - 0.5) * 0.05;

    for (let v = 0; v < positions.count; v += 1) {
      temp.set(positions.getX(v), positions.getY(v), positions.getZ(v));
      const length = temp.length() || 1;
      temp.multiplyScalar(1 / length);

      base.set(temp.x * stretchX, temp.y * stretchY, temp.z * stretchZ);
      const baseLength = base.length() || 1;
      dir.copy(base).multiplyScalar(1 / baseLength);

      // Broad faceting, a second medium octave, and directional cuts combine
      // into chunky silhouettes with obvious broken planes.
      const coarse =
        Math.sin(dir.x * (2.3 + this._seededUnit(seed + 71) * 1.4) + dir.y * 3.6 + seed * 0.12) * 0.44 +
        Math.cos(dir.y * 2.8 - dir.z * 3.1 + seed * 0.21) * 0.3;
      const medium =
        Math.sin(dir.dot(lobeA) * 7.8 + seed * 0.16) * 0.2 +
        Math.cos(dir.dot(lobeB) * 11.7 - seed * 0.19) * 0.15;
      const chip =
        Math.sin(dir.x * 14.2 + dir.y * 10.8 + dir.z * 8.9 + seed * 0.61) * 0.08;
      const facetA = Math.pow(Math.max(0, Math.abs(dir.dot(lobeA)) - 0.12), 1.7) * (0.52 + this._seededUnit(seed + 79) * 0.28);
      const facetB = Math.pow(Math.max(0, dir.dot(lobeB) - 0.02), 2.4) * (0.28 + this._seededUnit(seed + 83) * 0.18);
      const ridge = Math.pow(1 - Math.abs(dir.dot(ridgeAxis)), 3) * (0.12 + this._seededUnit(seed + 89) * 0.1);
      const flatten = Math.pow(Math.max(0, dir.dot(lobeC)), 2.6) * (0.24 + this._seededUnit(seed + 97) * 0.14);
      const offset =
        coarse * jitterAmount +
        medium * jitterAmount * 0.8 +
        chip * jitterAmount * 0.85 +
        facetA * jitterAmount * 0.95 +
        facetB * jitterAmount * 0.7 +
        ridge -
        flatten * jitterAmount * 0.9;
      const scale = radius * baseLength * (1 + offset);

      positions.setXYZ(v, dir.x * scale, dir.y * scale, dir.z * scale);

      const shade = clamp01(
        0.7 +
        coarse * 0.11 +
        medium * 0.09 +
        chip * 0.24 -
        facetA * 0.12 -
        flatten * 0.09 +
        ridge * 0.18 +
        dir.y * 0.04
      );
      colors[v * 3] = shade * (0.94 - colorBias * 0.25);
      colors[v * 3 + 1] = shade * 0.98;
      colors[v * 3 + 2] = shade * (1.03 + colorBias);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  // Snow puff: smooth UV sphere softly distorted along its normal so it reads
  // as a pillowy cloud instead of a billiard ball. Lower jitter than a rock
  // on purpose — powder wants gentle undulation, not craggy facets.
  _buildSnowPuffGeometry(radius, jitter = 0.12) {
    const geometry = new THREE.SphereGeometry(radius, 20, 14);
    const positions = geometry.attributes.position;
    const temp = new THREE.Vector3();

    for (let v = 0; v < positions.count; v += 1) {
      temp.set(positions.getX(v), positions.getY(v), positions.getZ(v));
      const length = temp.length() || 1;
      const n = temp.clone().multiplyScalar(1 / length);
      const wave =
        Math.sin(n.x * 2.1 + n.y * 2.7) * 0.6 +
        Math.cos(n.y * 1.8 + n.z * 2.4) * 0.4 +
        (Math.random() - 0.5) * 0.35;
      const scaled = length * (1 + wave * jitter);
      positions.setXYZ(v, n.x * scaled, n.y * scaled, n.z * scaled);
    }

    geometry.computeVertexNormals();
    return geometry;
  }

  // Jagged slit outline. Flattens the X axis and compresses the Y axis so
  // the shape reads as an elongated crack, then breaks the edge with a
  // seeded triple-octave wobble.
  _buildFissureOutline(halfWidth, halfLength, seed = 0, jagScale = 0.14, pointsCount = 32) {
    const points = [];
    for (let index = 0; index < pointsCount; index += 1) {
      const angle = (index / pointsCount) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const shapedX = Math.sign(cos) * Math.pow(Math.abs(cos), 0.55);
      const shapedY = Math.sign(sin) * Math.pow(Math.abs(sin), 1.4);
      const noise =
        Math.sin(angle * 3.1 + seed * 0.07) * 0.08 +
        Math.cos(angle * 7.3 - seed * 0.05) * 0.05 +
        Math.sin(angle * 13.1 + seed * 0.17) * 0.03;
      const x = shapedX * halfWidth * (1 + noise * jagScale * 2);
      const y = shapedY * halfLength * (1 + noise * jagScale);
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  }

  // Flat irregular slit used for soft surface stains and the inner void.
  _buildFissureShapeGeometry(width = 5.4, length = 1.5, seed = 0, jagScale = 0.14, pointsCount = 32) {
    const outline = this._buildFissureOutline(width * 0.5, length * 0.5, seed, jagScale, pointsCount);
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(outline), 24);
    geometry.computeVertexNormals();
    return geometry;
  }

  // Extruded ring forming the crevasse's snow-crust rim and the ice walls
  // descending to `depth`. Inner hole is a smaller, narrower slit so every
  // rim edge keeps visible crust thickness. Vertex colors paint the snow
  // crown, the pale ice, and the cold depth as the walls fall away.
  _buildFissureLipGeometry(width = 5.4, length = 1.5, depth = 1.55, seed = 0) {
    const outerHalfW = width * 0.5;
    const outerHalfL = length * 0.5;
    const innerHalfW = outerHalfW * 0.72;
    const innerHalfL = outerHalfL * 0.34;

    const outer = this._buildFissureOutline(outerHalfW, outerHalfL, seed, 0.18, 36);
    const inner = this._buildFissureOutline(innerHalfW, innerHalfL, seed + 23.3, 0.24, 36).reverse();
    const shape = new THREE.Shape(outer);
    const hole = new THREE.Path();
    hole.setFromPoints(inner);
    shape.holes.push(hole);

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelSize: 0.09,
      bevelThickness: 0.22,
      bevelSegments: 3,
      curveSegments: 32
    });
    // Surface crust at z=0, walls go down to z=-depth.
    geometry.translate(0, 0, -depth);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const snowColor = new THREE.Color(0xeaf4fb);
    const iceColor = new THREE.Color(0x7a95ad);
    const deepColor = new THREE.Color(0x1f3042);
    const scratch = new THREE.Color();

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const depthMix = clamp01(-z / depth);
      const nx = x / outerHalfW;
      const ny = y / outerHalfL;
      const breakNoise =
        Math.sin(nx * 9.7 + ny * 3.1 + seed * 0.13) * 0.04 +
        Math.cos(ny * 12.6 - seed * 0.08) * 0.025;

      scratch.copy(snowColor)
        .lerp(iceColor, Math.pow(depthMix, 0.8))
        .lerp(deepColor, Math.pow(depthMix, 1.7) * 0.7);
      scratch.offsetHSL(0, 0, breakNoise);

      colors[index * 3] = scratch.r;
      colors[index * 3 + 1] = scratch.g;
      colors[index * 3 + 2] = scratch.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  // Stable hash from a fissure id so a single crevasse reads consistent
  // across frames (same shard layout, same noise seed) without re-rolling.
  _fissureSeed(id) {
    const source = String(id);
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = (hash * 131 + source.charCodeAt(i)) >>> 0;
    }
    return (hash % 100000) * 0.01;
  }

  _buildEnvironment() {
    this.environmentGroup = new THREE.Group();
    this.root.add(this.environmentGroup);

    const m = this._mountainMeta();
    const { LANE_X, ROUTE_HALF, MOUNT_WIDTH, MOUNT_HEIGHT, MOUNT_HALF_H } = m;

    // Wider, taller plane so the mountain reads as a real peak, not a strip.
    // Vertex displacement runs through _mountainProfile so boulders and
    // markers placed via _faceAnchor share the exact same surface math.
    const mountainGeometry = new THREE.PlaneGeometry(MOUNT_WIDTH, MOUNT_HEIGHT, 320, 540);
    const positions = mountainGeometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const snowTone = new THREE.Color(0xe5f0f7);
    const stoneTone = new THREE.Color(0x485864);
    const darkTone = new THREE.Color(0x242d36);
    const scratch = new THREE.Color();

    for (let index = 0; index < positions.count; index += 1) {
      const baseX = positions.getX(index);
      const y = positions.getY(index);
      const profile = this._mountainProfile(baseX, y);

      positions.setX(index, profile.x);
      positions.setZ(index, profile.z);

      const absX = Math.abs(profile.x);
      const routeSmoothMask = profile.routeSmoothMask || 0;
      const snowMix = clamp01(
        1 - absX / 16.5 +
        smoothStep(0.72, 1, profile.slopeRatio) * 0.22 -
        Math.max(0, -profile.crags * 0.28) -
        (profile.fractureMask || 0) * 0.12 +
        routeSmoothMask * 0.12
      );
      const darkMix = clamp01(
        Math.max(0, -profile.terrace * 0.32 - profile.crags * 0.22) +
        smoothStep(90, 10, y) * 0.14 +
        smoothStep(ROUTE_HALF + 3, ROUTE_HALF + 24, absX) * 0.25 +
        profile.flankFrac * 0.2 +
        (profile.fractureMask || 0) * 0.24 -
        routeSmoothMask * 0.16
      );
      scratch.copy(stoneTone).lerp(snowTone, snowMix);
      scratch.lerp(snowTone, routeSmoothMask * 0.06);
      scratch.lerp(darkTone, Math.max(0, darkMix * (0.75 - routeSmoothMask * 0.16)));
      colors[index * 3] = scratch.r;
      colors[index * 3 + 1] = scratch.g;
      colors[index * 3 + 2] = scratch.b;
    }
    mountainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    mountainGeometry.computeVertexNormals();

    this.mountain = new THREE.Mesh(mountainGeometry, this.materials.cliff);
    this.mountain.position.set(0, 112, 0.4);
    this.mountain.receiveShadow = true;
    this.mountain.castShadow = true;
    this.environmentGroup.add(this.mountain);

    this.moltenFace = new THREE.Mesh(mountainGeometry.clone(), this.materials.moltenFace);
    this.moltenFace.position.copy(this.mountain.position);
    this.moltenFace.position.z += 0.08;
    this.environmentGroup.add(this.moltenFace);

    this.glacierSheen = new THREE.Mesh(mountainGeometry.clone(), this.materials.glacier);
    this.glacierSheen.position.copy(this.mountain.position);
    this.glacierSheen.position.z += 0.05;
    this.environmentGroup.add(this.glacierSheen);

    // Embedded boulders and flank crags. Every boulder snaps to the face via
    // _faceAnchor, then sinks into the slope so it reads as fractured rock
    // growing out of the mountain rather than beads floating in the air.
    this._boulderMats = Array.from({ length: 7 }, (_, index) =>
      this._makeRockMaterial(180 + index * 23, 'env')
    );

    const placeBoulder = ({ baseX, worldY, radius, matIndex, wide = 1.05, tall = 0.58, depth = 0.75 }) => {
      // Bury ~60% of the boulder's vertical extent in the slope so the crown
      // reads as an outcrop, not a pebble glued onto the face.
      const embed = radius * tall * 0.62 + 0.35;
      const anchor = this._faceAnchor(baseX, worldY, embed);
      const rockSeed = Math.random() * 1000;
      // Smaller boulders don't need the full subdivision budget; bigger ones
      // earn detail 3 so the silhouette stays craggy when camera passes close.
      const detail = radius > 1.25 ? 3 : 2;
      const geometry = this._buildBoulderGeometry(1, detail, 0.2 + Math.random() * 0.08, { seed: rockSeed });

      const materialIndex =
        (matIndex + Math.floor(this._seededUnit(rockSeed + 8) * this._boulderMats.length)) % this._boulderMats.length;
      const boulder = new THREE.Mesh(geometry, this._boulderMats[materialIndex]);
      boulder.position.set(anchor.x, anchor.y, anchor.z);
      boulder.scale.set(radius * wide, radius * tall, radius * depth);
      boulder.rotation.set(
        (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.environmentGroup.add(boulder);
    };

    // Flanking scatter: tapers with slope ratio so the summit stays clean.
    const flankCount = 96;
    for (let index = 0; index < flankCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const slopeFrac = Math.pow(Math.random(), 0.85);  // bias toward lower/mid slopes
      const lateralReach = Math.max(2.4, (1 - slopeFrac * 0.75) * 44);
      const baseX = side * (ROUTE_HALF + 0.6 + Math.random() * lateralReach);
      const worldY = -8 + slopeFrac * 246;
      const radius = 0.9 + Math.random() * 1.9 * (1 - slopeFrac * 0.35);
      placeBoulder({
        baseX,
        worldY,
        radius,
        matIndex: index,
        wide: 1 + Math.random() * 0.35,
        tall: 0.5 + Math.random() * 0.35,
        depth: 0.75 + Math.random() * 0.35
      });
    }

    // Route-adjacent outcrops: small rocks tucked between lanes for parallax.
    const innerCount = 18;
    for (let index = 0; index < innerCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const baseX = side * (LANE_X * 0.5 + (Math.random() - 0.5) * 0.6);
      const worldY = 6 + Math.random() * 228;
      const radius = 0.38 + Math.random() * 0.46;
      placeBoulder({
        baseX,
        worldY,
        radius,
        matIndex: index + 2,
        wide: 1,
        tall: 0.42 + Math.random() * 0.22,
        depth: 0.55 + Math.random() * 0.28
      });
    }

    const dividerOutcropCount = 18;
    for (let index = 0; index < dividerOutcropCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const baseX = side * (LANE_X * (0.58 + Math.random() * 0.24) + (Math.random() - 0.5) * 0.35);
      const worldY = 10 + Math.random() * 224;
      const radius = 0.5 + Math.random() * 0.72;
      placeBoulder({
        baseX,
        worldY,
        radius,
        matIndex: index + flankCount,
        wide: 1 + Math.random() * 0.18,
        tall: 0.44 + Math.random() * 0.22,
        depth: 0.72 + Math.random() * 0.24
      });
    }

    // Massive background silhouette — a single broad pyramid behind the climb
    // face that gives the mountain its iconic triangular profile against the sky.
    const backMassGeometry = new THREE.ConeGeometry(132, 360, 28, 10, false);
    const backMassPositions = backMassGeometry.attributes.position;
    for (let i = 0; i < backMassPositions.count; i += 1) {
      const px = backMassPositions.getX(i);
      const py = backMassPositions.getY(i);
      const pz = backMassPositions.getZ(i);
      // Add coarse ridgeline noise so the back mass reads as craggy rock.
      const n = Math.sin(px * 0.18 + py * 0.11) * Math.cos(pz * 0.22 - py * 0.08);
      backMassPositions.setX(i, px + n * 3.4);
      backMassPositions.setZ(i, pz + Math.cos(px * 0.12 + py * 0.1) * 2.6);
    }
    backMassGeometry.computeVertexNormals();
    const backMass = new THREE.Mesh(backMassGeometry, this.materials.peakShadow.clone());
    backMass.material.color.setHex(0x2a3643);
    backMass.position.set(0, 114, -64);
    backMass.receiveShadow = true;
    backMass.castShadow = false;
    this.environmentGroup.add(backMass);
    this.backMassMesh = backMass;

    // Two flanking sub-peaks spreading outward so the ridge feels broad.
    this.backFlankMeshes = [];
    [-1, 1].forEach((side) => {
      const flankGeom = new THREE.ConeGeometry(48, 250, 22, 7, false);
      const flankPositions = flankGeom.attributes.position;
      for (let i = 0; i < flankPositions.count; i += 1) {
        const px = flankPositions.getX(i);
        const py = flankPositions.getY(i);
        const pz = flankPositions.getZ(i);
        const n = Math.sin(px * 0.18 + py * 0.09) * Math.cos(pz * 0.24 - py * 0.07);
        flankPositions.setX(i, px + n * 2.4);
        flankPositions.setZ(i, pz + Math.cos(px * 0.14 + py * 0.08) * 2.1);
      }
      flankGeom.computeVertexNormals();
      const flank = new THREE.Mesh(flankGeom, this.materials.peakShadow.clone());
      flank.material.color.setHex(0x2d3947);
      flank.position.set(side * 68, 78, -46);
      flank.rotation.z = side * 0.18;
      flank.receiveShadow = true;
      this.environmentGroup.add(flank);
      this.backFlankMeshes.push(flank);
    });

    // A ring of neighbouring peaks at varying distances + heights so the
    // primary mountain reads as part of a range, not a lonely wedge.
    const distantPeaks = [
      { side: -1, x: 132, z: -92, radius: 46, height: 210, tint: 0x22303d, noise: 3.2 },
      { side: -1, x: 188, z: -128, radius: 52, height: 172, tint: 0x1c2631, noise: 2.6 },
      { side: 1, x: 142, z: -104, radius: 50, height: 230, tint: 0x24303b, noise: 3.0 },
      { side: 1, x: 204, z: -148, radius: 58, height: 186, tint: 0x1a242e, noise: 2.4 },
      { side: -1, x: 96, z: -78, radius: 34, height: 150, tint: 0x2a3542, noise: 2.8 },
      { side: 1, x: 104, z: -86, radius: 38, height: 158, tint: 0x263240, noise: 2.6 },
      { side: -1, x: 238, z: -178, radius: 62, height: 140, tint: 0x141d25, noise: 2.0 },
      { side: 1, x: 252, z: -186, radius: 66, height: 132, tint: 0x131b23, noise: 1.9 }
    ];
    distantPeaks.forEach((peak, idx) => {
      const geom = new THREE.ConeGeometry(peak.radius, peak.height, 22, 7, false);
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const n = Math.sin(px * 0.14 + py * 0.1 + idx) * Math.cos(pz * 0.2 - py * 0.07);
        pos.setX(i, px + n * peak.noise);
        pos.setZ(i, pz + Math.cos(px * 0.11 + py * 0.09 + idx) * peak.noise * 0.8);
      }
      geom.computeVertexNormals();
      const mesh = new THREE.Mesh(geom, this.materials.peakShadow.clone());
      mesh.material.color.setHex(peak.tint);
      mesh.position.set(peak.side * peak.x, peak.height * 0.25 + 12, peak.z);
      mesh.rotation.z = peak.side * (0.08 + Math.random() * 0.1);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.receiveShadow = true;
      this.environmentGroup.add(mesh);
    });

    // Low horizon ridges: broad, short, far-away silhouettes that stretch
    // laterally behind the peaks so the bottom of the sky reads as a range.
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 3; i += 1) {
        const ridgeGeom = new THREE.ConeGeometry(72 + i * 18, 82 - i * 16, 18, 4, false);
        const ridgePos = ridgeGeom.attributes.position;
        for (let v = 0; v < ridgePos.count; v += 1) {
          const px = ridgePos.getX(v);
          const py = ridgePos.getY(v);
          const pz = ridgePos.getZ(v);
          const n = Math.sin(px * 0.1 + py * 0.07 + i) * 1.6;
          ridgePos.setX(v, px + n);
          ridgePos.setZ(v, pz + Math.cos(px * 0.09 + i) * 1.2);
        }
        ridgeGeom.computeVertexNormals();
        const ridge = new THREE.Mesh(ridgeGeom, this.materials.peakShadow.clone());
        ridge.material.color.setHex([0x0e161e, 0x0a1218, 0x060b11][i]);
        ridge.position.set(side * (150 + i * 56), 6 + i * 4, -210 - i * 28);
        ridge.scale.set(1.3 + i * 0.2, 1, 0.9);
        ridge.rotation.z = side * (0.05 + Math.random() * 0.06);
        ridge.receiveShadow = false;
        this.environmentGroup.add(ridge);
      }
    });

    // Jagged ridgeline spires on each flank — further out now that the
    // mountain itself is wide. Bumped segment count + subtle noise so they
    // don't read as naked cones.
    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const spireGeom = new THREE.ConeGeometry(2.8 + Math.random() * 2.2, 18 + Math.random() * 22, 14, 4);
      const spirePos = spireGeom.attributes.position;
      for (let v = 0; v < spirePos.count; v += 1) {
        const px = spirePos.getX(v);
        const py = spirePos.getY(v);
        const pz = spirePos.getZ(v);
        const n = Math.sin(px * 1.4 + py * 0.7 + index) * 0.22;
        spirePos.setX(v, px + n);
        spirePos.setZ(v, pz + Math.cos(px * 1.2 + py * 0.5) * 0.22);
      }
      spireGeom.computeVertexNormals();
      const spire = new THREE.Mesh(spireGeom, this.materials.cliffShadow.clone());
      spire.position.set(
        side * (82 + Math.random() * 28),
        -2 + index * 16 + Math.random() * 6,
        -28 - Math.random() * 14
      );
      spire.rotation.z = side * (0.08 + Math.random() * 0.14);
      spire.castShadow = true;
      spire.receiveShadow = true;
      this.environmentGroup.add(spire);
    }

    const lowerMist = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 60),
      new THREE.MeshBasicMaterial({
        map: this.materials.cloud.map,
        color: 0xdff3ff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      })
    );
    lowerMist.position.set(0, -14, 18);
    this.environmentGroup.add(lowerMist);

    // A far atmospheric haze plane behind the distant peaks that fades the
    // range into the sky, preventing the mountain silhouettes from cutting
    // a hard horizon line.
    const horizonHaze = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 180),
      new THREE.MeshBasicMaterial({
        map: this.materials.cloud.map,
        color: 0xc7d9e8,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      })
    );
    horizonHaze.position.set(0, 72, -240);
    this.environmentGroup.add(horizonHaze);

    this.summitGroup = new THREE.Group();
    this.summitGroup.position.z = -9.5;
    this.environmentGroup.add(this.summitGroup);

    const crownShadow = new THREE.Mesh(new THREE.ConeGeometry(13.5, 24, 20, 4), this.materials.peakShadow.clone());
    crownShadow.position.set(0, 236, -8.8);
    crownShadow.scale.set(1.3, 1, 1.05);
    crownShadow.castShadow = true;
    this.summitGroup.add(crownShadow);

    const peak = new THREE.Mesh(new THREE.ConeGeometry(8.5, 20, 20, 4), this.materials.summit);
    peak.position.set(0, 240, -4.8);
    peak.castShadow = true;
    this.summitGroup.add(peak);

    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(new THREE.ConeGeometry(4.6, 10.5, 18, 3), this.materials.summit.clone());
      shoulder.position.set(side * 6.1, 236.4, -6.4);
      shoulder.rotation.z = side * 0.12;
      shoulder.castShadow = true;
      this.summitGroup.add(shoulder);
    });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 8.5, 20, 4), this.materials.anchorMetal);
    tower.position.set(3.2, 247, -3.4);
    this.summitGroup.add(tower);

    this.flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), this.materials.flag);
    this.flagMesh.position.set(7.4, 249.8, -2.8);
    this.flagMesh.rotation.y = -0.34;
    this.summitGroup.add(this.flagMesh);

    // The warm summit halo was the single loudest "this is a game" tell.
    // Replaced by a near-invisible sprite that only exists so the rest of
    // the update code doesn't have to branch on its presence.
    this.summitAura = new THREE.Sprite(this.materials.halo.clone());
    this.summitAura.position.set(1.8, 245.5, -2.6);
    this.summitAura.scale.set(0.01, 0.01, 1);
    this.summitAura.material.opacity = 0;
    this.summitAura.visible = false;
    this.summitGroup.add(this.summitAura);

    for (let index = 0; index < 10; index += 1) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5 + Math.random() * 4.5, 9 + Math.random() * 16),
        this.materials.glacier.clone()
      );
      panel.position.set(
        -5.2 + Math.random() * 10.4,
        14 + index * 18 + Math.random() * 8,
        1.4 + Math.random() * 0.5
      );
      panel.rotation.z = -0.25 + Math.random() * 0.5;
      panel.rotation.y = -0.08 + Math.random() * 0.16;
      panel.material.opacity = 0.12 + Math.random() * 0.14;
      this.icePanels.push(panel);
      this.environmentGroup.add(panel);
    }

    const crackCurves = [
      [new THREE.Vector3(-5, 126, 1.2), new THREE.Vector3(-3, 150, 1.1), new THREE.Vector3(-7, 176, 1.4), new THREE.Vector3(-2, 214, 1.6)],
      [new THREE.Vector3(4, 132, 1.4), new THREE.Vector3(2, 152, 1.5), new THREE.Vector3(6, 185, 1.9), new THREE.Vector3(1, 222, 2.1)],
      [new THREE.Vector3(0, 148, 1.35), new THREE.Vector3(-1, 172, 1.5), new THREE.Vector3(1, 198, 1.7), new THREE.Vector3(-1, 232, 2.2)]
    ];

    crackCurves.forEach((points, index) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.09 + index * 0.02, 14, false), this.materials.crack.clone());
      this.environmentGroup.add(tube);

      const glow = new THREE.Sprite(this.materials.halo.clone());
      glow.position.copy(points[points.length - 2]);
      glow.scale.set(8 + index * 2, 8 + index * 2, 1);
      this.environmentGroup.add(glow);

      this.crackNodes.push({ tube, glow, offset: index * 0.6 });
    });

    // Altitude landmarks — physical 3D features attached to the slope, not
    // flat decals. Each one snaps to the generated face so the climber sees
    // real geometry at memorable heights.
    this.altitudeMarkers = [];
    const ledgeMat = new THREE.MeshStandardMaterial({
      color: 0xe8f5ff,
      roughness: 0.6,
      metalness: 0.02,
      flatShading: true
    });

    // 1) Wide ice ledge at ~30m — wedge carved out of the face so the top
    // reads as a walkable shelf and the underside as an overhang.
    {
      const anchor = this._faceAnchor(-3.2, 70, 0.35);
      const shape = new THREE.Shape();
      shape.moveTo(-4.4, 0);
      shape.lineTo(4.4, 0);
      shape.lineTo(3.6, 0.55);
      shape.lineTo(-3.6, 0.55);
      shape.closePath();
      const ledge = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.12, bevelSegments: 2 }),
        ledgeMat.clone()
      );
      ledge.geometry.translate(0, 0, -1.3);  // centre extrusion on its anchor
      ledge.position.set(anchor.x, anchor.y, anchor.z);
      ledge.rotation.x = -Math.PI / 2;
      ledge.rotation.z = -0.06;
      ledge.castShadow = true;
      ledge.receiveShadow = true;
      this.environmentGroup.add(ledge);
      this.altitudeMarkers.push(ledge);
    }

    // 2) Serac (leaning ice tower) at ~55m — sunk into the face, leaning out.
    {
      const anchor = this._faceAnchor(2.6, 120, 0.8);
      const serac = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 5, 14, 4, false),
        ledgeMat.clone()
      );
      serac.material.color.setHex(0xb9dff0);
      serac.position.set(anchor.x, anchor.y, anchor.z);
      serac.rotation.z = 0.28;
      serac.castShadow = true;
      this.environmentGroup.add(serac);
      this.altitudeMarkers.push(serac);
    }

    // 3) Old rope stub with frayed cloth at ~70m. The rope is a real cylinder
    // driven slightly into the face; the cloth is a three-segment strip with
    // a twist so it reads as a torn flag, not a 2D sticker.
    {
      const anchor = this._faceAnchor(-2.2, 158, 0.15);
      const oldRope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.6, 14),
        new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.95 })
      );
      oldRope.position.set(anchor.x, anchor.y, anchor.z);
      oldRope.rotation.z = 0.24;
      this.environmentGroup.add(oldRope);

      const clothGeometry = new THREE.PlaneGeometry(0.9, 1.8, 1, 6);
      const clothPositions = clothGeometry.attributes.position;
      for (let i = 0; i < clothPositions.count; i += 1) {
        const localX = clothPositions.getX(i);
        const localY = clothPositions.getY(i);
        // Curl and warp the cloth so it does not read as a flat decal.
        const curl = Math.sin(localY * 2.1 + localX * 0.6) * 0.18;
        const bow = Math.cos(localY * 1.2) * 0.14 * (0.5 - localX);
        clothPositions.setZ(i, curl + bow);
      }
      clothGeometry.computeVertexNormals();
      const oldRopeFlag = new THREE.Mesh(
        clothGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xc9483b,
          roughness: 0.85,
          side: THREE.DoubleSide
        })
      );
      // Offset out of the face so the cloth reads as billowing in wind.
      oldRopeFlag.position.set(anchor.x - 0.5, anchor.y - 0.2, anchor.z + 0.35);
      oldRopeFlag.rotation.z = 0.12;
      this.environmentGroup.add(oldRopeFlag);
      this.altitudeMarkers.push(oldRopeFlag);
    }

    // 4) Overhanging ice curtain at ~85m — a trio of icicles clipped to the
    // wall rather than one floating cone.
    {
      const curtainGroup = new THREE.Group();
      const anchor = this._faceAnchor(3.4, 190, 0.2);
      const curtainMat = ledgeMat.clone();
      curtainMat.color.setHex(0xc0e6ff);
      curtainMat.opacity = 0.82;
      curtainMat.transparent = true;
      [[-0.9, 0, 1.0, 4.2], [0.3, -0.4, 0.78, 3.4], [1.4, 0.1, 0.62, 2.6]].forEach(([offsetX, offsetY, radius, length]) => {
        const icicle = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 14, 4, false), curtainMat.clone());
        icicle.position.set(offsetX, offsetY - length * 0.5, 0.1 + offsetX * 0.12);
        icicle.rotation.x = Math.PI;   // point down
        icicle.rotation.z = 0.08 + offsetX * 0.04;
        icicle.castShadow = true;
        curtainGroup.add(icicle);
      });
      curtainGroup.position.set(anchor.x, anchor.y, anchor.z);
      this.environmentGroup.add(curtainGroup);
      this.altitudeMarkers.push(curtainGroup);
    }

    // 5) Bergschrund — a real crack carved into the face, built from a
    // curved tube that hugs the slope. Reads as volumetric shadow, not a
    // dark rectangle pasted on top.
    {
      const crackPoints = [];
      const segments = 12;
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const baseX = -2.7 + t * 5.4;
        const worldY = 217.5 + Math.sin(t * Math.PI) * 0.9 + (Math.random() - 0.5) * 0.12;
        const anchor = this._faceAnchor(baseX, worldY, 0.18);
        crackPoints.push(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
      }
      const curve = new THREE.CatmullRomCurve3(crackPoints);
      const crackMat = new THREE.MeshStandardMaterial({
        color: 0x0b1116,
        roughness: 1,
        metalness: 0,
        emissive: 0x0a0f14,
        emissiveIntensity: 0.2
      });
      const bergschrund = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 0.28, 8, false),
        crackMat
      );
      bergschrund.castShadow = false;
      bergschrund.receiveShadow = true;
      this.environmentGroup.add(bergschrund);
      this.altitudeMarkers.push(bergschrund);
    }

    if (this.isNewYearPreset) {
      this._buildHolidayLanterns();
    }
  }

  _buildHolidayLanterns() {
    const lanternHeights = [24, 46, 72, 102, 134, 166, 198, 226];
    lanternHeights.forEach((worldY, index) => {
      const sideSign = index % 2 === 0 ? -1 : 1;
      const baseX = sideSign * (1.95 + (index % 3) * 0.12);
      const anchor = this._faceAnchor(baseX, worldY, 0.12);
      const group = new THREE.Group();
      group.position.set(anchor.x, anchor.y, anchor.z + 0.16);
      group.rotation.z = sideSign * (0.06 + (index % 2) * 0.015);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 2.2, 12),
        this.materials.lanternFrame
      );
      pole.position.set(0, 0.78, -0.08);
      pole.castShadow = true;
      group.add(pole);

      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.045, 1.02, 10),
        this.materials.lanternFrame
      );
      arm.position.set(sideSign * 0.42, 1.72, 0);
      arm.rotation.z = Math.PI / 2;
      group.add(arm);

      const lanternBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.56, 0.34),
        this.materials.lanternFrame
      );
      lanternBody.position.set(sideSign * 0.74, 1.38, 0.12);
      lanternBody.castShadow = true;
      group.add(lanternBody);

      const lanternGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.36, 0.2),
        this.materials.lanternGlass.clone()
      );
      lanternGlass.position.copy(lanternBody.position);
      group.add(lanternGlass);

      const lanternCap = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.16, 6),
        this.materials.lanternFrame
      );
      lanternCap.position.set(sideSign * 0.74, 1.73, 0.12);
      group.add(lanternCap);

      const glow = new THREE.Sprite(this.materials.halo.clone());
      glow.material.color.setHex(0xffd06a);
      glow.material.opacity = 0.5;
      glow.position.set(sideSign * 0.74, 1.38, 0.28);
      glow.scale.set(2.2, 2.2, 1);
      group.add(glow);

      const light = new THREE.PointLight(0xffcb68, 2.6, 20, 2);
      light.position.copy(glow.position);
      group.add(light);

      this.environmentGroup.add(group);
      this.routeLanterns.push({
        group,
        glow,
        light,
        lanternGlass,
        baseIntensity: 2.1 + Math.random() * 0.45,
        phaseOffset: Math.random() * Math.PI * 2
      });
    });
  }

  _buildRope() {
    this.routeRopeMinY = -12;
    this.routeRopeMaxY = 252;
    this.ropePointCount = 34;
    this.ropePoints = Array.from({ length: this.ropePointCount }, (_, index) => {
      const t = index / (this.ropePointCount - 1);
      return new THREE.Vector3(0, this.routeRopeMinY + t * (this.routeRopeMaxY - this.routeRopeMinY), 1.28);
    });
    this.routeRopeVelocities = Array.from({ length: this.ropePointCount }, () => new THREE.Vector2(0, 0));
    this.routeRopeInitialized = false;

    this.ropeGeometry = new THREE.BufferGeometry().setFromPoints(this.ropePoints);
    this.ropeLine = new THREE.Line(this.ropeGeometry, this.materials.ropeLine);
    this.environmentGroup.add(this.ropeLine);

    const ropeSegmentGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1, 16, 1, false);
    for (let index = 0; index < this.ropePointCount - 1; index += 1) {
      const segment = new THREE.Mesh(ropeSegmentGeometry, this.materials.rope);
      segment.castShadow = true;
      this.ropeSegments.push(segment);
      this.environmentGroup.add(segment);
    }

    this.anchorNodes = [];
    const anchorRibbonMat = new THREE.MeshBasicMaterial({
      color: 0xffb24a,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    // Denser anchor ladder so the climber measures progress against it.
    [14, 32, 52, 72, 92, 112, 132, 152, 172, 192, 212, 228].forEach((y, index) => {
      const sideSign = index % 2 === 0 ? -1 : 1;
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 18), this.materials.anchorMetal);
      screw.position.set(sideSign * 0.8, y, 0.34);
      screw.rotation.z = Math.PI / 2;
      this.environmentGroup.add(screw);

      // Faded ribbon flag on every third anchor — visible "altitude marker".
      let ribbon = null;
      if (index % 3 === 0) {
        ribbon = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 0.38),
          anchorRibbonMat.clone()
        );
        ribbon.material.color.setHSL(0.05 + (index / 12) * 0.12, 0.68, 0.56);
        ribbon.position.set(sideSign * 0.9, y + 0.05, 1.12);
        ribbon.rotation.z = sideSign * -0.14;
        this.environmentGroup.add(ribbon);
      }

      // Pulse glow sprite — fires as the climber passes.
      const pulse = new THREE.Sprite(this.materials.halo.clone());
      pulse.position.set(sideSign * 0.1, y, 1.2);
      pulse.scale.set(0.1, 0.1, 1);
      pulse.material.opacity = 0;
      this.environmentGroup.add(pulse);

      this.anchorNodes.push({ screw, ribbon, pulse, baseY: y, triggeredAt: -1e9 });
    });
  }

  _sampleRouteRopeAtY(targetY, out = new THREE.Vector3()) {
    const minY = this.routeRopeMinY;
    const maxY = this.routeRopeMaxY;
    const clampedY = Math.max(minY, Math.min(maxY, targetY));
    const scaledIndex = ((clampedY - minY) / (maxY - minY)) * (this.ropePointCount - 1);
    const lowerIndex = Math.floor(scaledIndex);
    const upperIndex = Math.min(this.ropePointCount - 1, lowerIndex + 1);
    const blend = scaledIndex - lowerIndex;
    return out.copy(this.ropePoints[lowerIndex]).lerp(this.ropePoints[upperIndex], blend);
  }

  _updateTether(playerVx, dt, anchorPosition) {
    this.harnessAnchor.updateMatrixWorld(true);
    const harnessPosition = this.harnessAnchor.getWorldPosition(this.tempVecA);
    this.root.worldToLocal(harnessPosition);

    const count = this.tetherSegmentCount;
    const dtClamped = Math.min(dt, 0.05);
    const directDistance = harnessPosition.distanceTo(anchorPosition);
    const segmentLength = (directDistance * 1.1 + 0.32) / Math.max(1, count - 1);

    if (!this.tetherInitialized) {
      for (let i = 0; i < count; i += 1) {
        const t = i / (count - 1);
        const sag = Math.sin(Math.PI * t) * 0.36;
        this.tetherPoints[i].lerpVectors(harnessPosition, anchorPosition, t);
        this.tetherPoints[i].y -= sag;
        this.tetherVelocities[i].set(0, 0, 0);
      }
      this.tetherInitialized = true;
    }

    for (let i = 1; i < count - 1; i += 1) {
      const t = i / (count - 1);
      const point = this.tetherPoints[i];
      const vel = this.tetherVelocities[i];

      const lineX = harnessPosition.x * (1 - t) + anchorPosition.x * t;
      const lineY = harnessPosition.y * (1 - t) + anchorPosition.y * t;
      const lineZ = harnessPosition.z * (1 - t) + anchorPosition.z * t;
      const sag = Math.sin(Math.PI * t) * (0.34 + directDistance * 0.018);
      const guidePull = 11 + Math.sin(Math.PI * t) * 9;
      const whip = Math.sin(Math.PI * t) * playerVx * 0.0052;
      const dragToRoute = (anchorPosition.x - harnessPosition.x) * Math.pow(t, 1.2) * 0.08;
      const wind = Math.sin(this.elapsed * 0.72 + t * 2.4) * 0.018;
      const depthPulse = Math.cos(this.elapsed * 0.68 + t * 2.1) * 0.018;

      vel.x += (lineX + whip + dragToRoute + wind - point.x) * guidePull * dtClamped;
      vel.y += ((lineY - sag) - point.y) * (guidePull * 0.94) * dtClamped;
      vel.z += (lineZ + depthPulse - point.z) * (guidePull * 0.88) * dtClamped;
      vel.y -= (1.1 + Math.sin(Math.PI * t) * 0.28) * dtClamped;
      vel.multiplyScalar(Math.exp(-dtClamped * 6.1));

      point.x += vel.x * dtClamped;
      point.y += vel.y * dtClamped;
      point.z += vel.z * dtClamped;
    }

    for (let iteration = 0; iteration < 7; iteration += 1) {
      this.tetherPoints[0].copy(harnessPosition);
      this.tetherPoints[count - 1].copy(anchorPosition);

      for (let i = 0; i < count - 1; i += 1) {
        const left = this.tetherPoints[i];
        const right = this.tetherPoints[i + 1];
        const delta = this.tempVecC.copy(right).sub(left);
        const distance = Math.max(0.0001, delta.length());
        const stretch = (distance - segmentLength) / distance;

        if (i === 0) {
          right.addScaledVector(delta, -stretch);
        } else if (i === count - 2) {
          left.addScaledVector(delta, stretch);
        } else {
          left.addScaledVector(delta, stretch * 0.5);
          right.addScaledVector(delta, -stretch * 0.5);
        }
      }

      for (let i = 1; i < count - 1; i += 1) {
        const t = i / (count - 1);
        const guideX = harnessPosition.x * (1 - t) + anchorPosition.x * t;
        const guideY = harnessPosition.y * (1 - t) + anchorPosition.y * t - Math.sin(Math.PI * t) * 0.44;
        const guideZ = harnessPosition.z * (1 - t) + anchorPosition.z * t;
        const point = this.tetherPoints[i];
        point.x += (guideX - point.x) * 0.026;
        point.y += (guideY - point.y) * 0.042;
        point.z += (guideZ - point.z) * 0.03;
      }
    }

    this.tetherPoints[0].copy(harnessPosition);
    this.tetherPoints[count - 1].copy(anchorPosition);
    this.tetherVelocities[0].set(0, 0, 0);
    this.tetherVelocities[count - 1].set(0, 0, 0);

    const tetherAttr = this.tetherGeometry.attributes.position;
    for (let i = 0; i < count; i += 1) {
      const p = this.tetherPoints[i];
      tetherAttr.setXYZ(i, p.x, p.y, p.z);
    }
    tetherAttr.needsUpdate = true;
  }

  _buildPlayer() {
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0, 0, 1.5);
    this.root.add(this.playerGroup);

    this.harnessAnchor = new THREE.Object3D();
    this.harnessAnchor.position.set(0, 0.18, -0.14);
    this.playerGroup.add(this.harnessAnchor);

    // Proportions follow a 1.78 m climber: torso ~0.62 m, upper arm 0.34,
    // forearm 0.30, thigh 0.46, shin 0.44. The old rig made the limbs
    // longer than the torso — the silhouette read as a stick puppet.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.02, 0.52), this.materials.body);
    torso.position.set(0, 0.92, 0);
    torso.castShadow = true;
    this.playerGroup.add(torso);

    // Chest panel: the single red accent. Narrower than the torso so it
    // reads as an insulated jacket over shell, not a full orange suit.
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.58, 0.56), this.materials.bodyAccent);
    chest.position.set(0, 1.12, 0.04);
    chest.castShadow = true;
    this.playerGroup.add(chest);

    // Shoulder caps blend the neck into the arms instead of the old
    // hard shoulder edge.
    const shoulderCapL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), this.materials.body);
    shoulderCapL.position.set(-0.44, 1.4, 0.02);
    this.playerGroup.add(shoulderCapL);
    const shoulderCapR = shoulderCapL.clone();
    shoulderCapR.position.x = 0.44;
    this.playerGroup.add(shoulderCapR);

    // Backpack: body + top lid + compression straps. Sits higher on the
    // back and slightly wider than the old single-box pack.
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.02, 0.44), this.materials.backpackCanvas);
    backpack.position.set(0, 1.02, -0.46);
    backpack.castShadow = true;
    this.playerGroup.add(backpack);

    const packLid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.46), this.materials.bodyAccent);
    packLid.position.set(0, 1.58, -0.46);
    this.playerGroup.add(packLid);

    const packStrapTop = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.04), this.materials.strap);
    packStrapTop.position.set(0, 1.18, -0.24);
    this.playerGroup.add(packStrapTop);
    const packStrapMid = packStrapTop.clone();
    packStrapMid.position.y = 0.84;
    this.playerGroup.add(packStrapMid);

    const packSideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.48), this.materials.strap);
    packSideL.position.set(-0.42, 1.02, -0.46);
    this.playerGroup.add(packSideL);
    const packSideR = packSideL.clone();
    packSideR.position.x = 0.42;
    this.playerGroup.add(packSideR);

    // Shoulder straps visible over the chest — classic harness detail
    // that sells the backpack without needing a full UV unwrap.
    const chestStrapL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.04), this.materials.strap);
    chestStrapL.position.set(-0.22, 1.1, 0.36);
    this.playerGroup.add(chestStrapL);
    const chestStrapR = chestStrapL.clone();
    chestStrapR.position.x = 0.22;
    this.playerGroup.add(chestStrapR);

    // Head + neck + helmet. Helmet slightly smaller, matte off-white so
    // it doesn't glow against the sky.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.2, 16), this.materials.bodySoft);
    neck.position.set(0, 1.56, 0);
    this.playerGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), this.materials.skin);
    head.position.set(0, 1.82, 0.02);
    head.castShadow = true;
    this.playerGroup.add(head);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.materials.helmet
    );
    helmet.position.set(0, 1.92, 0.0);
    helmet.rotation.x = 0.12;
    helmet.castShadow = true;
    this.playerGroup.add(helmet);

    // Helmet brim: the dark visor band gives the shape its silhouette.
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.34), this.materials.strap);
    brim.position.set(0, 1.82, 0.08);
    this.playerGroup.add(brim);

    // Chin strap — two thin verticals from helmet to neck.
    const chinStrapL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.02), this.materials.strap);
    chinStrapL.position.set(-0.18, 1.75, 0.14);
    this.playerGroup.add(chinStrapL);
    const chinStrapR = chinStrapL.clone();
    chinStrapR.position.x = 0.18;
    this.playerGroup.add(chinStrapR);

    // Darker visor glass for eyes — avoids the doll-face pale sphere.
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.08), this.materials.visor);
    visor.position.set(0, 1.82, 0.22);
    this.playerGroup.add(visor);

    this.headlamp = new THREE.PointLight(0xbfe4f2, 1.2, 14, 2);
    this.headlamp.position.set(0, 1.92, 0.26);
    this.playerGroup.add(this.headlamp);

    const headlampBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), this.materials.metal);
    headlampBody.position.copy(this.headlamp.position);
    this.playerGroup.add(headlampBody);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.58), this.materials.strap);
    belt.position.set(0, 0.34, 0);
    belt.castShadow = true;
    this.playerGroup.add(belt);

    const harnessLoop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 12, 24), this.materials.metal);
    harnessLoop.position.set(0, 0.22, 0.22);
    harnessLoop.rotation.x = Math.PI / 2;
    this.playerGroup.add(harnessLoop);

    // Arm proportions: upper 0.34 m, forearm 0.30 m, hand 0.1 m. Pivots
    // sit at the shoulder, elbow, wrist — that's how the IK reads clean
    // through bend without the old ragdoll stretch.
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.48, 1.42, 0.02);
    this.playerGroup.add(this.leftArmPivot);
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 0.56, 14), this.materials.body);
    leftUpperArm.position.y = -0.28;
    leftUpperArm.castShadow = true;
    this.leftArmPivot.add(leftUpperArm);
    this.leftForearmPivot = new THREE.Group();
    this.leftForearmPivot.position.set(0, -0.56, 0);
    this.leftArmPivot.add(this.leftForearmPivot);
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.5, 14), this.materials.bodyAccent);
    leftForearm.position.y = -0.26;
    leftForearm.castShadow = true;
    this.leftForearmPivot.add(leftForearm);
    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.12), this.materials.gloves);
    leftHand.position.set(0, -0.58, 0.04);
    this.leftForearmPivot.add(leftHand);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.48, 1.42, 0.02);
    this.playerGroup.add(this.rightArmPivot);
    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 0.56, 14), this.materials.body);
    rightUpperArm.position.y = -0.28;
    rightUpperArm.castShadow = true;
    this.rightArmPivot.add(rightUpperArm);
    this.rightForearmPivot = new THREE.Group();
    this.rightForearmPivot.position.set(0, -0.56, 0);
    this.rightArmPivot.add(this.rightForearmPivot);
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.5, 14), this.materials.bodyAccent);
    rightForearm.position.y = -0.26;
    rightForearm.castShadow = true;
    this.rightForearmPivot.add(rightForearm);
    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.12), this.materials.gloves);
    rightHand.position.set(0, -0.58, 0.04);
    this.rightForearmPivot.add(rightHand);

    // Ice axe: shaft + curved pick + adze + leash loop. A shaft-only
    // stick reads as a walking pole; the pick is what says "mountaineer".
    const axeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 12), this.materials.iceTool);
    axeShaft.position.set(0, -0.36, 0.08);
    axeShaft.rotation.z = 0.12;
    this.rightForearmPivot.add(axeShaft);
    // Pick: tapered box angled down and forward.
    const axePick = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.05), this.materials.metal);
    axePick.position.set(0.15, -0.72, 0.18);
    axePick.rotation.z = -0.4;
    this.rightForearmPivot.add(axePick);
    // Adze (the blunt counterweight): shorter box on the opposite side.
    const axeAdze = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), this.materials.metal);
    axeAdze.position.set(-0.08, -0.72, 0.15);
    this.rightForearmPivot.add(axeAdze);
    // Leash to the wrist — thin dark strap.
    const axeLeash = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.015), this.materials.strap);
    axeLeash.position.set(0, -0.52, 0.03);
    axeLeash.rotation.z = 0.3;
    this.rightForearmPivot.add(axeLeash);

    // Legs: same proportion fix as arms. Thigh 0.46, shin 0.44, boot 0.22.
    const buildLeg = (side) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.22, 0.14, 0.02);
      this.playerGroup.add(legPivot);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.7, 16), this.materials.body);
      thigh.position.y = -0.36;
      thigh.castShadow = true;
      legPivot.add(thigh);

      const shinPivot = new THREE.Group();
      shinPivot.position.set(0, -0.7, 0.02);
      legPivot.add(shinPivot);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.66, 16), this.materials.body);
      shin.position.y = -0.34;
      shin.castShadow = true;
      shinPivot.add(shin);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.42), this.materials.boot);
      boot.position.set(0, -0.72, 0.08);
      boot.castShadow = true;
      shinPivot.add(boot);

      // Crampons: six small pyramids under the boot — front two point
      // forward for the front-points, middle and heel point down. Not
      // individually articulated but the silhouette reads "alpinist".
      const cramponPoints = [
        { x: -0.06, z: 0.26, rot: 0.3 },
        { x: 0.06, z: 0.26, rot: 0.3 },
        { x: -0.07, z: 0.06, rot: 0 },
        { x: 0.07, z: 0.06, rot: 0 },
        { x: -0.07, z: -0.14, rot: 0 },
        { x: 0.07, z: -0.14, rot: 0 }
      ];
      cramponPoints.forEach((p) => {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), this.materials.metal);
        tooth.position.set(p.x, -0.84, 0.08 + p.z);
        tooth.rotation.x = p.rot;
        shinPivot.add(tooth);
      });

      return { legPivot, shinPivot };
    };

    const leftLeg = buildLeg(-1);
    this.leftLegPivot = leftLeg.legPivot;
    this.leftShinPivot = leftLeg.shinPivot;

    const rightLeg = buildLeg(1);
    this.rightLegPivot = rightLeg.legPivot;
    this.rightShinPivot = rightLeg.shinPivot;

    this.shieldBillboard = new THREE.Sprite(this.materials.shield.clone());
    this.shieldBillboard.position.set(0, 0.9, 0.1);
    this.shieldBillboard.scale.set(3.2, 4.4, 1);
    this.shieldBillboard.visible = false;
    this.playerGroup.add(this.shieldBillboard);

    this.shieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 18, 48), this.materials.metal.clone());
    this.shieldRing.material.transparent = true;
    this.shieldRing.material.opacity = 0;
    this.shieldRing.rotation.x = Math.PI / 2;
    this.shieldRing.position.set(0, 0.8, 0.08);
    this.playerGroup.add(this.shieldRing);

    // Climbing tether: a multi-segment line from the harness to an anchor
    // above the climber. Unlike a simple "points chase a curve" rig, this
    // chain preserves segment lengths, so motion propagates up the rope and
    // the lower section doesn't instantly hinge to the body.
    this.tetherSegmentCount = 14;
    this.tetherPoints = [];
    for (let i = 0; i < this.tetherSegmentCount; i += 1) {
      this.tetherPoints.push(new THREE.Vector3());
    }
    this.tetherVelocities = this.tetherPoints.map(() => new THREE.Vector3());
    this.tetherInitialized = false;
    this.tetherGeometry = new THREE.BufferGeometry().setFromPoints(this.tetherPoints);
    this.tetherLine = new THREE.Line(this.tetherGeometry, this.materials.tether);
    this.root.add(this.tetherLine);
  }

  _buildDynamicLayers() {
    this.dynamicHazards = new THREE.Group();
    this.avalancheGroup = new THREE.Group();
    this.footprintGroup = new THREE.Group();
    this.root.add(this.dynamicHazards);
    this.root.add(this.avalancheGroup);
    this.root.add(this.footprintGroup);
  }

  _buildParticles() {
    this.snowFarField = this._createParticleField(760, this.materials.snowFar, {
      x: 44,
      yMin: -24,
      yMax: 244,
      zMin: -20,
      zMax: 24
    });
    this.snowMidField = this._createParticleField(560, this.materials.snowMid, {
      x: 34,
      yMin: -12,
      yMax: 230,
      zMin: -6,
      zMax: 22
    });
    this.snowNearField = this._createParticleField(340, this.materials.snowNear, {
      x: 18,
      yMin: -6,
      yMax: 226,
      zMin: 7,
      zMax: 26
    });
    this.ashField = this._createParticleField(260, this.materials.ash, {
      x: 48,
      yMin: -12,
      yMax: 240,
      zMin: -8,
      zMax: 24
    });

    this.root.add(this.snowFarField.points);
    this.root.add(this.snowMidField.points);
    this.root.add(this.snowNearField.points);
    this.root.add(this.ashField.points);
  }

  _createParticleField(count, material, bounds) {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * bounds.x;
      positions[index * 3 + 1] = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
      positions[index * 3 + 2] = bounds.zMin + Math.random() * (bounds.zMax - bounds.zMin);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { points: new THREE.Points(geometry, material), bounds };
  }

  _makeTexture(size, painter) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    painter(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  _sceneYFromGameY(value) {
    return value * this.routeScale;
  }

  _worldY(localY) {
    return localY * this.verticalCompression;
  }

  _buildRenderSnapshot(snapshot) {
    return {
      ...snapshot,
      player: {
        ...snapshot.player,
        progressY: snapshot.player.y,
        y: this._sceneYFromGameY(snapshot.player.y),
        fallOffset: this._sceneYFromGameY(snapshot.player.fallOffset || 0),
        fallRatio: clamp01((snapshot.player.fallOffset || 0) / 28)
      },
      rocks: snapshot.rocks.map((rock) => ({
        ...rock,
        progressY: rock.y,
        y: this._sceneYFromGameY(rock.y),
        speed: this._sceneYFromGameY(rock.speed)
      })),
      avalanches: snapshot.avalanches.map((avalanche) => ({
        ...avalanche,
        progressY: avalanche.y,
        y: this._sceneYFromGameY(avalanche.y)
      })),
      couloirFissures: (snapshot.couloirFissures || []).map((fissure) => ({
        ...fissure,
        progressY: fissure.y,
        y: this._sceneYFromGameY(fissure.y)
      })),
      footprints: snapshot.footprints.map((mark) => ({
        ...mark,
        progressY: mark.y,
        y: this._sceneYFromGameY(mark.y)
      }))
    };
  }

  render(snapshot, dt = 0.016) {
    if (!snapshot) {
      return;
    }

    const renderSnapshot = this._buildRenderSnapshot(snapshot);
    this.elapsed += dt;
    this.lastSnapshot = renderSnapshot;
    this._updateEnvironment(renderSnapshot, dt);
    this._updatePlayer(renderSnapshot, dt);
    this._updateRope(renderSnapshot, dt);
    this._updateCouloirFissures(renderSnapshot, dt);
    this._updateHazards(renderSnapshot, dt);
    this._updateFootprints(renderSnapshot);
    this._updateParticles(renderSnapshot, dt);
    this._updateBackdrop(renderSnapshot, dt);
    this._updateCamera(renderSnapshot, dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateBackdrop(snapshot, dt) {
    const phase = snapshot.phaseRatio;
    const progressRatio = Math.min(1, snapshot.player.progressY / 100);

    if (this.isNewYearPreset) {
      this.moonHalo.material.opacity = 0.018 + (1 - phase) * 0.016;
      this.moonDisk.material.opacity = 0.08 + (1 - phase) * 0.06;
      this.starField.material.opacity = 0.54 + (1 - phase) * 0.16;
      this.starField.rotation.y = this.elapsed * 0.01;
    } else {
      this.moonHalo.material.opacity = 0.06 + (1 - phase) * 0.04;
      this.moonDisk.material.opacity = 0.32 + (1 - phase) * 0.18;
      this.starField.material.opacity = (1 - phase) * 0.28;
    }

    this.cloudCards.forEach((cloud, index) => {
      cloud.mesh.position.x = cloud.anchorX + Math.sin(this.elapsed * cloud.speed + index) * cloud.drift;
      cloud.mesh.position.y += Math.sin(this.elapsed * 0.2 + index) * dt * 0.5;
      cloud.mesh.material.opacity = this.isNewYearPreset
        ? 0.02 + (1 - phase) * 0.028 + Math.sin(this.elapsed * cloud.speed) * 0.01
        : 0.08 + (1 - phase) * 0.09 + Math.sin(this.elapsed * cloud.speed) * 0.015;
    });

    // "Sea of clouds" shelf: rises into view past progressRatio 0.35 and sits
    // below the climber. The whole group tracks the player in scene-local Y so
    // the camera (below & behind) always looks down onto it.
    const shelfBaseY = this.playerRender.y - 18;
    this.undercloudGroup.position.y = shelfBaseY;
    const shelfFade = clamp01((progressRatio - 0.35) / 0.2);
    const warmth = phase * 0.25;
    this.undercloudCards.forEach((card, index) => {
      card.angle += card.speed * dt * 0.3;
      card.mesh.position.x = Math.cos(card.angle) * card.radius;
      card.mesh.position.z = -6 - Math.sin(card.angle) * (card.radius * 0.55) - 4;
      card.mesh.position.y = card.yOffset + Math.sin(this.elapsed * 0.22 + index) * 0.6;
      const targetOpacity = shelfFade * (
        this.isNewYearPreset
          ? 0.16 + Math.sin(this.elapsed * 0.4 + index) * 0.03
          : 0.32 + Math.sin(this.elapsed * 0.4 + index) * 0.05
      );
      card.mesh.material.opacity = targetOpacity;
      if (this.isNewYearPreset) {
        card.mesh.material.color.setRGB(
          0.56 - phase * 0.04,
          0.7 - phase * 0.06,
          0.88 - phase * 0.08
        );
      } else {
        card.mesh.material.color.setRGB(
          0.82 - warmth * 0.08,
          0.9 - phase * 0.18,
          1 - phase * 0.28
        );
      }
    });
    this.undercloudGroup.visible = shelfFade > 0.001;

    // Aurora no longer rendered — block intentionally empty.

    // Atmospheric perspective: distant ridges wash toward the horizon so
    // depth reads clearly. Mix amount rises with distance via each mesh's
    // stored hazeMix; closer bands stay saturated, farther ones fade out.
    const horizonColor = this.tempColorA || (this.tempColorA = new THREE.Color());
    if (this.isNewYearPreset) {
      horizonColor.setRGB(
        0.12 + phase * 0.04,
        0.16 + phase * 0.05,
        0.22 + phase * 0.06
      );
    } else {
      horizonColor.setRGB(
        0.56 + phase * 0.14,
        0.64 - phase * 0.16,
        0.74 - phase * 0.26
      );
    }
    const rockColor = this.tempColorB || (this.tempColorB = new THREE.Color());
    this.distantPeaks.children.forEach((peak) => {
      if (this.isNewYearPreset) {
        rockColor.setRGB(0.44 - phase * 0.03, 0.56 - phase * 0.02, 0.72 - phase * 0.02);
      } else {
        rockColor.setHex(0x3a4751);
      }
      const baseMix = peak.userData.hazeMix != null ? peak.userData.hazeMix : 0.5;
      peak.material.color.copy(rockColor).lerp(
        horizonColor,
        this.isNewYearPreset
          ? Math.max(0.06, baseMix - 0.16 + phase * 0.03)
          : baseMix + phase * 0.05
      );
    });

    if (this.backMassMesh) {
      if (this.isNewYearPreset) {
        rockColor.setRGB(0.32, 0.42, 0.56);
        this.backMassMesh.material.color.copy(rockColor).lerp(horizonColor, 0.12);
      } else {
        rockColor.setRGB(0.2 + phase * 0.16, 0.24 + phase * 0.05, 0.28 - phase * 0.02);
        this.backMassMesh.material.color.copy(rockColor).lerp(horizonColor, 0.34 - phase * 0.1);
      }
    }
    if (this.backFlankMeshes) {
      this.backFlankMeshes.forEach((flank) => {
        if (this.isNewYearPreset) {
          rockColor.setRGB(0.34, 0.45, 0.6);
          flank.material.color.copy(rockColor).lerp(horizonColor, 0.1);
        } else {
          rockColor.setRGB(0.22 + phase * 0.18, 0.26 + phase * 0.05, 0.3 - phase * 0.02);
          flank.material.color.copy(rockColor).lerp(horizonColor, 0.24 - phase * 0.08);
        }
      });
    }
  }

  _updateEnvironment(snapshot) {
    const phase = snapshot.phaseRatio;
    const progressRatio = Math.min(1, snapshot.player.progressY / 100);
    const danger = snapshot.dangerLevel || 0;

    if (this.isNewYearPreset) {
      this.skyUniforms.topColor.value.setRGB(
        0.03 + phase * 0.02,
        0.05 + phase * 0.02,
        0.09 + phase * 0.03
      );
      this.skyUniforms.horizonColor.value.setRGB(
        0.09 + phase * 0.03,
        0.14 + phase * 0.04,
        0.22 + phase * 0.05
      );
      this.skyUniforms.bottomColor.value.setRGB(
        0.008,
        0.012 + phase * 0.01,
        0.03 + phase * 0.01
      );

      this.scene.fog.color.setRGB(
        0.04 + phase * 0.02,
        0.06 + phase * 0.02,
        0.10 + phase * 0.03
      );
      this.scene.fog.near = 58 - danger * 4;
      this.scene.fog.far = 220 - phase * 16 - danger * 10;

      this.renderer.setClearColor(
        new THREE.Color().setRGB(
          0.018,
          0.024 + phase * 0.01,
          0.04 + phase * 0.01
        )
      );

      this.materials.cliff.color.lerpColors(
        new THREE.Color(0xeaf6ff),
        new THREE.Color(0xa5c9ea),
        Math.min(1, phase * 0.72 + danger * 0.1)
      );
      this.materials.cliff.emissive = new THREE.Color(0x06131f);
      this.materials.cliff.emissiveIntensity = 0.05;
      this.materials.moltenFace.opacity = 0;
      this.materials.moltenFace.emissiveIntensity = 0;
      this.materials.glacier.opacity = 0.18 + (1 - phase) * 0.12;

      this.crackNodes.forEach((node) => {
        node.tube.material.opacity = 0;
        node.tube.material.emissiveIntensity = 0;
        node.glow.material.opacity = 0;
      });

      this.icePanels.forEach((panel, index) => {
        panel.visible = true;
        panel.material.opacity = 0.12 + (1 - phase) * 0.08 + (index % 3) * 0.015;
        panel.rotation.z += Math.sin(this.elapsed * 0.15 + index) * 0.0008;
      });

      this.flagMesh.rotation.z = Math.sin(this.elapsed * 3.1) * 0.11 - 0.04;
      this.summitGroup.position.y = Math.sin(this.elapsed * 0.28) * 0.26;

      this.ambientLight.intensity = 0.82;
      this.ambientLight.groundColor.setRGB(0.05, 0.07, 0.1);
      this.keyLight.color.setRGB(0.78, 0.86, 0.98);
      this.keyLight.intensity = 1.1 + danger * 0.06;
      this.fillLight.color.setRGB(0.98, 0.86, 0.62);
      this.fillLight.intensity = 0.32;
      this.lavaLight.intensity = 0;
      this.summitLight.color.setRGB(1, 0.84, 0.56);
      this.summitLight.intensity = 1.8 + Math.sin(this.elapsed * 1.8) * 0.12;

      this.moonHalo.position.y = 154 + progressRatio * 4;
      this.moonDisk.position.y = this.moonHalo.position.y;

      this.routeLanterns.forEach((lantern, index) => {
        const flicker =
          0.88 +
          Math.sin(this.elapsed * 6.2 + lantern.phaseOffset) * 0.08 +
          Math.sin(this.elapsed * 11.4 + index) * 0.05;
        lantern.group.rotation.y = Math.sin(this.elapsed * 0.8 + lantern.phaseOffset) * 0.08;
        lantern.glow.material.opacity = 0.34 + flicker * 0.18;
        lantern.glow.scale.setScalar(2 + flicker * 0.48);
        lantern.light.intensity = lantern.baseIntensity * flicker + danger * 0.14;
        lantern.lanternGlass.material.emissiveIntensity = 1.1 + flicker * 0.7;
      });
      return;
    }

    // Cold-leaning sky palette. Top stays a deep slate blue, horizon a pale
    // washed grey — the look you get on an overcast north-face morning.
    // Lava phase only just begins to smear orange into the band.
    this.skyUniforms.topColor.value.setRGB(
      0.30 + phase * 0.14,
      0.42 - phase * 0.16,
      0.58 - phase * 0.24
    );
    this.skyUniforms.horizonColor.value.setRGB(
      0.68 + phase * 0.12,
      0.72 - phase * 0.14,
      0.78 - phase * 0.26
    );
    this.skyUniforms.bottomColor.value.setRGB(
      0.05 + phase * 0.08,
      0.07 + phase * 0.01,
      0.10 - phase * 0.01
    );

    this.scene.fog.color.setRGB(
      0.10 + phase * 0.14,
      0.16 + phase * 0.02,
      0.20 - phase * 0.03
    );
    this.scene.fog.near = 48 - phase * 8;
    this.scene.fog.far = 190 - phase * 28 - danger * 8;

    this.renderer.setClearColor(
      new THREE.Color().setRGB(
        0.08 + phase * 0.14,
        0.12 + phase * 0.02,
        0.16 - phase * 0.02
      )
    );

    // Warm drift saved entirely for the final volcanic phase; the snow and
    // ice faces stay a clean cool white so the mountain reads as serious.
    this.materials.cliff.color.lerpColors(
      new THREE.Color(0xf4f8fc),
      new THREE.Color(0x7a4a3a),
      Math.max(0, phase - 0.72) * 1.3
    );
    this.materials.cliff.emissive = new THREE.Color(0x000000);
    this.materials.moltenFace.opacity = Math.max(0, phase - 0.62) * 1.4;
    this.materials.moltenFace.emissiveIntensity = 0.3 + Math.max(0, phase - 0.62) * 2.0 + danger * 0.2;
    this.materials.glacier.opacity = (1 - phase) * 0.22 + 0.04;

    this.crackNodes.forEach((node, index) => {
      node.tube.material.opacity = phase * (0.46 + Math.sin(this.elapsed * 2.2 + node.offset) * 0.16);
      node.tube.material.emissiveIntensity = 0.7 + phase * 1.3 + Math.sin(this.elapsed * 3.4 + index) * 0.18;
      node.glow.material.opacity = phase * (0.2 + Math.sin(this.elapsed * 2 + index) * 0.08 + 0.08);
      node.glow.scale.setScalar(6 + phase * 8 + Math.sin(this.elapsed * 1.8 + index) * 0.8);
    });

    this.icePanels.forEach((panel, index) => {
      panel.visible = true;
      panel.material.opacity = (1 - phase) * (0.1 + (index % 3) * 0.03);
      panel.rotation.z += Math.sin(this.elapsed * 0.15 + index) * 0.0008;
    });

    this.flagMesh.rotation.z = Math.sin(this.elapsed * 3.4) * 0.12 - phase * 0.08;
    this.summitGroup.position.y = Math.sin(this.elapsed * 0.35) * 0.3;

    // Cooler, softer key light. Documentary cinematographers usually
    // expose for the face of the mountain, not for neon rim-light.
    this.ambientLight.intensity = 0.95 - phase * 0.08;
    this.ambientLight.groundColor.setRGB(0.10 + phase * 0.06, 0.14 + phase * 0.03, 0.17);
    this.keyLight.color.setRGB(0.78 + phase * 0.08, 0.84 - phase * 0.12, 0.94 - phase * 0.22);
    this.keyLight.intensity = 1.55 - phase * 0.12 + danger * 0.05;
    this.fillLight.intensity = 0.34 - phase * 0.1;
    // Lava glow only engages meaningfully in volcanic phase; snow face
    // used to read as torch-lit because this light was always on.
    const lavaGate = Math.max(0, phase - 0.62) * 1.5;
    this.lavaLight.intensity = lavaGate * (9 + danger * 2.2);
    this.lavaLight.position.y = this._worldY(136 + snapshot.player.y * 0.4);
    // Summit kill-light: no more warm sparkle on the peak snow.
    this.summitLight.intensity = 0;

    this.moonHalo.position.y = 148 + progressRatio * 6;
    this.moonDisk.position.y = this.moonHalo.position.y;
  }

  _updatePlayer(snapshot, dt) {
    const targetPosition = new THREE.Vector3(snapshot.player.x, snapshot.player.y, 1.5);
    this.playerRender.lerp(targetPosition, 1 - Math.exp(-dt * 7));
    this.playerGroup.position.copy(this.playerRender);

    const lateralSwing = snapshot.player.vx || 0;
    const falling = Boolean(snapshot.player.falling);
    const fallRatio = snapshot.player.fallRatio || 0;
    // Pulse amplitude scales with active climbing. When the climber is
    // just hanging on the rope, limbs drift gently; when pulling up,
    // the cadence is visible and deliberate.
    const climbing = Boolean(snapshot.player.climbing);
    const climbGain = climbing ? 1 : 0.35;
    const climbPulse =
      Math.sin(this.elapsed * (climbing ? 5.6 : 2.4) + snapshot.player.y * 0.38) *
      0.24 * climbGain;
    const sway = clamp(snapshot.player.x * 0.08 + lateralSwing * 0.008, -0.45, 0.45);

    // Phase-driven posture blend:
    //   snow:  balanced axe-planting stance
    //   ice:   leaning deeper into the face, shorter reaches (more tension)
    //   lava:  right arm rises to shield the face from heat/embers
    const phase = snapshot.phaseRatio || 0;
    const iceMix = clamp01((phase - 0.45) / 0.33);
    const heatMix = clamp01((phase - 0.78) / 0.22);
    const torsoLean = iceMix * 0.12 - heatMix * 0.08;
    const shieldRaise = heatMix * 1.15;

    this.playerGroup.rotation.z = -sway * 0.7;
    this.playerGroup.rotation.x = -0.16 + climbPulse * 0.08 - torsoLean;

    this.leftArmPivot.rotation.x = 1.65 + climbPulse * 0.55 + iceMix * 0.18;
    this.leftArmPivot.rotation.z = -0.38 - sway * 0.25 - iceMix * 0.08;
    this.leftForearmPivot.rotation.x = -0.52 - climbPulse * 0.34 - iceMix * 0.18;

    // Right arm lifts up to shield during volcanic phase.
    this.rightArmPivot.rotation.x = 1.42 - climbPulse * 0.45 - shieldRaise;
    this.rightArmPivot.rotation.z = 0.34 - sway * 0.22 + heatMix * 0.28;
    this.rightForearmPivot.rotation.x = -0.44 + climbPulse * 0.24 - heatMix * 0.9;

    this.leftLegPivot.rotation.x = 0.28 - climbPulse * 0.58 - iceMix * 0.1;
    this.leftShinPivot.rotation.x = -0.32 + climbPulse * 0.44 + iceMix * 0.08;
    this.rightLegPivot.rotation.x = 0.22 + climbPulse * 0.58 + iceMix * 0.12;
    this.rightShinPivot.rotation.x = -0.28 - climbPulse * 0.38 - iceMix * 0.06;

    this.headlamp.intensity = 1.8 + Math.sin(this.elapsed * 8) * 0.18;

    if (snapshot.player.shieldActive) {
      this.shieldBillboard.visible = true;
      this.shieldBillboard.material.opacity = 0.18 + Math.sin(this.elapsed * 6) * 0.08;
      this.shieldBillboard.scale.set(4.6 + Math.sin(this.elapsed * 4.2) * 0.2, 6.2 + Math.sin(this.elapsed * 3.3) * 0.25, 1);
      this.shieldRing.material.opacity = 0.2 + Math.sin(this.elapsed * 4.8) * 0.08;
      this.shieldRing.scale.setScalar(1 + Math.sin(this.elapsed * 3.8) * 0.06);
    } else {
      this.shieldBillboard.visible = false;
      this.shieldRing.material.opacity = 0;
    }

    if (falling) {
      const flail = Math.sin(this.elapsed * 8.7 + snapshot.player.y * 0.26) * (0.08 + fallRatio * 0.12);
      const twist = Math.sin(this.elapsed * 5.4 + snapshot.player.x * 0.18) * (0.06 + fallRatio * 0.1);
      const kick = Math.sin(this.elapsed * 10.2 + snapshot.player.y * 0.42) * (0.14 + fallRatio * 0.16);
      const reach = Math.sin(this.elapsed * 7.4 + 0.8) * (0.05 + fallRatio * 0.09);

      // Keep the climber opened toward the route so the face and chest still
      // read as looking upslope rather than tumbling away from the mountain.
      this.playerGroup.rotation.x = -0.96 + fallRatio * 0.18 + flail;
      this.playerGroup.rotation.y = twist;
      this.playerGroup.rotation.z = -0.16 - sway * 0.24 + twist * 0.85;
      this.playerGroup.position.y -= snapshot.player.fallOffset;
      this.playerGroup.position.z += snapshot.player.fallOffset * (0.34 + fallRatio * 0.08);
      this.playerGroup.position.x += Math.sin(this.elapsed * 3.7 + snapshot.player.y * 0.14) * 0.12 * fallRatio;

      this.leftArmPivot.rotation.x = 1.94 + fallRatio * 0.5 + reach;
      this.leftArmPivot.rotation.z = -0.5 - twist * 0.8;
      this.leftForearmPivot.rotation.x = -0.18 - fallRatio * 0.3 - reach * 0.9;

      this.rightArmPivot.rotation.x = 1.18 + fallRatio * 0.44 - reach * 0.8;
      this.rightArmPivot.rotation.z = 0.48 + twist * 0.6;
      this.rightForearmPivot.rotation.x = -0.82 + fallRatio * 0.22 + reach * 0.7;

      this.leftLegPivot.rotation.x = 0.74 + fallRatio * 0.18 - kick;
      this.leftShinPivot.rotation.x = -0.2 + kick * 0.9;
      this.rightLegPivot.rotation.x = -0.1 + fallRatio * 0.42 + kick;
      this.rightShinPivot.rotation.x = -0.56 - kick * 0.82;

      this.headlamp.intensity = 1.95 + Math.sin(this.elapsed * 10.5) * 0.24;
    }

  }

  _updateRope(snapshot, dt) {
    const attr = this.ropeGeometry.attributes.position;
    const ropeDepth = 1.12;
    const playerPullY = snapshot.player.y + 1.6;
    const dtClamped = Math.min(dt || 0.016, 0.05);
    const playerX = snapshot.player.x || 0;
    const playerVx = snapshot.player.vx || 0;
    const ropeBottomAnchorX = playerX * 0.28 + playerVx * 0.018;
    const ropeTopAnchorX = playerX * 0.08;
    const ropeBottomAnchorZ = ropeDepth + 0.14 + Math.abs(playerX) * 0.012;
    const ropeTopAnchorZ = ropeDepth - 0.02;

    if (!this.routeRopeInitialized) {
      for (let index = 0; index < this.ropePointCount; index += 1) {
        const t = index / (this.ropePointCount - 1);
        const y = this.routeRopeMinY + t * (this.routeRopeMaxY - this.routeRopeMinY);
        this.ropePoints[index].set(0, y, ropeDepth);
        this.routeRopeVelocities[index].set(0, 0);
      }
      this.routeRopeInitialized = true;
    }

    for (let index = 0; index < this.ropePointCount; index += 1) {
      const t = index / (this.ropePointCount - 1);
      const y = this.routeRopeMinY + t * (this.routeRopeMaxY - this.routeRopeMinY);
      const point = this.ropePoints[index];
      const vel = this.routeRopeVelocities[index];
      const clipPull = Math.exp(-Math.pow((y - playerPullY) / 6.2, 2));
      const upperCarry = Math.exp(-Math.pow((y - (playerPullY + 16)) / 18, 2));
      const lowerCarry = Math.exp(-Math.pow((y - (playerPullY - 14)) / 16, 2));
      const globalCarry = Math.exp(-Math.pow((y - playerPullY) / 88, 2));
      const endPin = Math.max(Math.exp(-Math.pow(t / 0.12, 2)), Math.exp(-Math.pow((1 - t) / 0.12, 2)));
      const motionDamp = 1 - endPin * 0.58;
      const anchorX = ropeBottomAnchorX * (1 - t) + ropeTopAnchorX * t;
      const anchorZ = ropeBottomAnchorZ * (1 - t) + ropeTopAnchorZ * t;

      const baseSway =
        Math.sin(t * Math.PI * 0.96 + this.elapsed * 0.82) * 0.045 +
        Math.sin(t * Math.PI * 2.8 + this.elapsed * 1.16) * 0.018;
      const travelWave =
        Math.sin(this.elapsed * 1.34 - t * 5.4) *
        (playerX * 0.06 + playerVx * 0.022) *
        (0.18 + clipPull * 0.62 + upperCarry * 0.24);
      const shoulderWave =
        Math.sin(Math.PI * t) *
        playerX *
        (clipPull * 0.58 + upperCarry * 0.36 + lowerCarry * 0.28 + globalCarry * 0.12);
      const targetX =
        anchorX +
        (
          baseSway +
          shoulderWave +
          travelWave +
          playerVx * (clipPull * 0.064 + upperCarry * 0.028 + lowerCarry * 0.018)
        ) *
          motionDamp;
      const targetZ =
        anchorZ +
        (
          Math.cos(t * Math.PI + this.elapsed * 0.58) * 0.016 +
          clipPull * 0.42 +
          upperCarry * 0.18 +
          lowerCarry * 0.06
        ) *
          motionDamp;

      vel.x += (targetX - point.x) * (9.2 + clipPull * 36 + upperCarry * 16 + globalCarry * 6) * dtClamped;
      vel.x *= Math.exp(-dtClamped * (4.8 - clipPull * 0.9));
      point.x += vel.x * dtClamped;

      vel.y += (targetZ - point.z) * (7.8 + clipPull * 22 + upperCarry * 8) * dtClamped;
      vel.y *= Math.exp(-dtClamped * 4.9);
      point.z += vel.y * dtClamped;
      point.y = y;
    }

    for (let iteration = 0; iteration < 5; iteration += 1) {
      for (let index = 1; index < this.ropePointCount - 1; index += 1) {
        const prev = this.ropePoints[index - 1];
        const next = this.ropePoints[index + 1];
        const point = this.ropePoints[index];
        point.x += (((prev.x + next.x) * 0.5) - point.x) * 0.24;
        point.z += (((prev.z + next.z) * 0.5) - point.z) * 0.19;
      }
    }

    this.ropePoints[0].x = ropeBottomAnchorX;
    this.ropePoints[this.ropePointCount - 1].x = ropeTopAnchorX;
    this.ropePoints[0].z = ropeBottomAnchorZ;
    this.ropePoints[this.ropePointCount - 1].z = ropeTopAnchorZ;

    for (let index = 0; index < this.ropePointCount; index += 1) {
      const point = this.ropePoints[index];
      attr.setXYZ(index, point.x, point.y, point.z);
    }
    attr.needsUpdate = true;

    for (let index = 0; index < this.ropeSegments.length; index += 1) {
      const start = this.ropePoints[index];
      const end = this.ropePoints[index + 1];
      const segment = this.ropeSegments[index];
      const distance = start.distanceTo(end);
      segment.position.copy(start).lerp(end, 0.5);
      segment.scale.set(1, distance, 1);
      this.tempVecA.copy(end).sub(start).normalize();
      segment.quaternion.setFromUnitVectors(this.upAxis, this.tempVecA);
    }

    const tetherAnchor = this._sampleRouteRopeAtY(playerPullY + 6.4, this.tempVecB);
    tetherAnchor.z += 0.08;
    this._updateTether(playerVx, dtClamped, tetherAnchor);

    const playerSceneY = snapshot.player.y;
    this.anchorNodes.forEach((node) => {
      // Screws bob softly with altitude-driven noise so the ladder feels alive.
      node.screw.rotation.y = Math.sin(this.elapsed * 0.9 + node.baseY * 0.008) * 0.12;

      // Trigger a pulse the first frame the climber rises past the anchor.
      if (node.triggeredAt < 0 && playerSceneY >= node.baseY - 1.2) {
        node.triggeredAt = this.elapsed;
      }
      const age = this.elapsed - node.triggeredAt;
      if (age >= 0 && age < 1.3) {
        const t = age / 1.3;
        const fade = 1 - t;
        node.pulse.material.opacity = fade * 0.85;
        node.pulse.scale.setScalar(0.4 + t * 4.2);
      } else {
        node.pulse.material.opacity = 0;
      }

      if (node.ribbon) {
        // Ribbons flutter on wind; amplitude rises with altitude.
        const altFactor = clamp01(node.baseY / 240);
        node.ribbon.rotation.z += Math.sin(this.elapsed * 3.1 + node.baseY * 0.04) * 0.003 * (0.4 + altFactor);
        node.ribbon.position.x += Math.sin(this.elapsed * 2.2 + node.baseY * 0.06) * 0.002;
      }
    });
  }

  _updateCouloirFissures(snapshot, dt) {
    const liveIds = new Set();
    const fissures = snapshot.couloirFissures || [];

    fissures.forEach((fissure, index) => {
      liveIds.add(fissure.id);
      let node = this.fissureMeshes.get(fissure.id);
      if (!node) {
        node = this._createFissureNode(fissure);
        this.fissureMeshes.set(fissure.id, node);
      }

      const maxTurns = Math.max(1, fissure.maxTurns || 3);
      const dangerMix = clamp01((fissure.turnsLeft || 0) / maxTurns);
      const freshness = fissure.freshness || 0;
      // Spawn "cracks open" from a hairline to full aperture; once freshness
      // runs out, geometry stays at its full size — a real crevasse doesn't
      // heal as the climber answers correctly.
      const openAnim = smoothStep(0, 1, 1 - Math.pow(freshness, 2.2));
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.6 + node.seed * 0.11);

      // Lay the group onto the mountain face with the surface normal as +Z.
      const surface = this._surfaceFrame(fissure.x, fissure.y);
      node.group.position.copy(surface.position);
      node.group.position.addScaledVector(surface.normal, 0.11 + freshness * 0.05);
      this.tempMatA.makeBasis(surface.tangentX, surface.tangentY, surface.normal);
      node.group.quaternion.setFromRotationMatrix(this.tempMatA);
      node.group.rotateZ(node.twist);

      // Body breathes gently only during the spawn animation — no permanent
      // size change tied to turnsLeft.
      node.body.position.z = 0.028 + openAnim * 0.018;
      node.body.scale.set(0.94 + openAnim * 0.06, 0.14 + openAnim * 0.86, 1);
      node.body.rotation.z = Math.sin(this.elapsed * 0.8 + node.seed * 0.12) * 0.006 * freshness;
      node.shadow.scale.set(0.92 + openAnim * 0.08, 0.18 + openAnim * 0.82, 1);
      node.shadow.material.opacity = 0.08 + dangerMix * 0.08 + openAnim * 0.1 + freshness * 0.02;

      node.lip.material.emissiveIntensity = 0.05 + dangerMix * 0.09 + freshness * 0.16;
      node.abyss.material.opacity = 0.88 + dangerMix * 0.08;
      node.abyss.scale.set(0.96 + openAnim * 0.04, 0.2 + openAnim * 0.8, 1);
      node.glow.material.opacity = 0.09 + dangerMix * 0.12 + pulse * 0.04 + freshness * 0.08;
      node.glow.scale.set(0.9 + pulse * 0.05, 0.2 + openAnim * 0.55 + pulse * 0.04, 1);
      node.mist.material.opacity = 0.03 + dangerMix * 0.05 + freshness * 0.08;
      node.mist.scale.set(3 + pulse * 0.18, 0.54 + openAnim * 0.26 + pulse * 0.06, 1);
      node.mist.position.y = Math.sin(this.elapsed * 1.6 + index * 0.8) * 0.025;
      node.mist.position.z = 0.28 + openAnim * 0.06;

      // Shards are siblings of the body, so they don't stretch with the
      // spawn animation — only a small z-wobble to sell instability.
      const shardVisible = openAnim > 0.15;
      node.shards.forEach((shard, shardIndex) => {
        shard.visible = shardVisible;
        if (!shardVisible) {
          return;
        }
        const wobble = Math.sin(this.elapsed * shard.userData.wobble + shard.userData.phase + shardIndex) * 0.018;
        shard.position.z = shard.userData.baseZ + wobble * (0.25 + dangerMix * 0.28);
        shard.rotation.z = shard.userData.baseRotZ + wobble * 0.28;
      });
    });

    this._pruneFissures(liveIds);
  }

  _createFissureNode(fissure) {
    const seed = this._fissureSeed(fissure.id);
    const group = new THREE.Group();
    const body = new THREE.Group();

    // Soft dark pool on the surface around the crack — anchors it to the
    // slope so the floating ice doesn't read as a decal.
    const shadow = new THREE.Mesh(
      this._buildFissureShapeGeometry(6.2, 1.04, seed + 5.3, 0.22, 34),
      new THREE.MeshBasicMaterial({
        color: 0x06101a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    shadow.position.z = 0.012;
    shadow.material.polygonOffset = true;
    shadow.material.polygonOffsetFactor = -1;
    shadow.material.polygonOffsetUnits = -1;
    group.add(shadow);
    group.add(body);

    // Ice rim + descending walls as a single extruded ring.
    const lip = new THREE.Mesh(
      this._buildFissureLipGeometry(5.2, 1.22, 1.72, seed),
      new THREE.MeshStandardMaterial({
        emissive: 0x1a3550,
        emissiveIntensity: 0.08,
        roughness: 0.88,
        metalness: 0.02,
        vertexColors: true
      })
    );
    lip.castShadow = true;
    lip.receiveShadow = true;
    // Avoid z-fighting with the mountain face at the crest of the rim.
    lip.material.polygonOffset = true;
    lip.material.polygonOffsetFactor = -2;
    lip.material.polygonOffsetUnits = -2;
    body.add(lip);

    // The void at the bottom of the crack — slightly wider than the hole so
    // the walls read as fully enclosed when viewed head-on.
    const abyss = new THREE.Mesh(
      this._buildFissureShapeGeometry(3.6, 0.4, seed + 41.7, 0.1, 30),
      new THREE.MeshBasicMaterial({
        color: 0x030608,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    abyss.position.z = -1.56;
    body.add(abyss);

    // A single cold glow layered mid-depth: gives the crack its "looking
    // into deep ice" quality without stacking five overlapping planes.
    const glow = new THREE.Mesh(
      this._buildFissureShapeGeometry(2.5, 0.28, seed + 73.9, 0.08, 26),
      new THREE.MeshBasicMaterial({
        color: 0x2f78c8,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    glow.position.z = -0.78;
    body.add(glow);

    // Chill vapor rising from the slit.
    const mist = new THREE.Sprite(this.materials.trail.clone());
    mist.material.color.setHex(0xd6ecfa);
    mist.material.opacity = 0.12;
    mist.position.set(0, 0, 0.3);
    mist.scale.set(3.05, 0.62, 1);
    group.add(mist);

    // Ice debris scattered in a ring around the outside of the crack. Kept
    // at group level so the spawn animation (body scale) never squashes them.
    const shards = [];
    const shardCount = 6;
    for (let i = 0; i < shardCount; i += 1) {
      const shardSeed = seed + i * 11.7 + 3.1;
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (2.72 + this._seededUnit(shardSeed + 3) * 0.48);
      const y = (this._seededUnit(shardSeed + 5) - 0.5) * 1.08;
      const z = 0.04 + this._seededUnit(shardSeed + 7) * 0.1;

      const shard = new THREE.Mesh(
        this._buildBoulderGeometry(0.16 + this._seededUnit(shardSeed + 9) * 0.08, 1, 0.28, { seed: shardSeed }),
        this._makeRockMaterial(shardSeed, 'env')
      );
      shard.castShadow = true;
      shard.receiveShadow = true;
      shard.position.set(x, y, z);
      shard.rotation.set(
        (this._seededUnit(shardSeed + 11) - 0.5) * 0.5,
        this._seededUnit(shardSeed + 13) * Math.PI * 2,
        (this._seededUnit(shardSeed + 15) - 0.5) * 0.6
      );
      shard.userData = {
        baseZ: z,
        baseRotZ: shard.rotation.z,
        wobble: 1.4 + this._seededUnit(shardSeed + 17) * 0.9,
        phase: this._seededUnit(shardSeed + 19) * Math.PI * 2
      };
      group.add(shard);
      shards.push(shard);
    }

    this.dynamicHazards.add(group);
    return {
      group,
      body,
      lip,
      abyss,
      glow,
      mist,
      shadow,
      shards,
      seed,
      twist: (this._seededUnit(seed + 29) - 0.5) * 0.24
    };
  }

  _pruneFissures(liveIds) {
    Array.from(this.fissureMeshes.entries()).forEach(([id, node]) => {
      if (liveIds.has(id)) {
        return;
      }
      this.dynamicHazards.remove(node.group);
      node.group.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          child.material.dispose();
        }
      });
      this.fissureMeshes.delete(id);
    });
  }

  _updateHazards(snapshot, dt) {
    const nextRockIds = new Set();
    snapshot.rocks.forEach((rock, index) => {
      nextRockIds.add(rock.id);
      let node = this.rockMeshes.get(rock.id);

      if (!node) {
        const group = new THREE.Group();
        const rockSeed = Math.random() * 1000;
        const coreGeom = this._buildBoulderGeometry(
          0.92,
          this._seededUnit(rockSeed + 1) > 0.62 ? 3 : 2,
          0.24 + this._seededUnit(rockSeed + 2) * 0.08,
          { seed: rockSeed }
        );
        const coreMaterial = this._makeRockMaterial(rockSeed, 'falling');
        const core = new THREE.Mesh(
          coreGeom,
          coreMaterial
        );
        core.castShadow = true;
        core.receiveShadow = true;
        const coreScale = new THREE.Vector3(
          0.84 + Math.random() * 0.22,
          0.72 + Math.random() * 0.18,
          0.76 + Math.random() * 0.2
        );
        core.scale.copy(coreScale);
        group.add(core);

        const dust = new THREE.Sprite(this.materials.trail.clone());
        dust.material.color.setHex(0x96a4ad);
        dust.material.opacity = 0;
        dust.position.set(0, 0.28, -0.16);
        dust.scale.set(0.9, 1.4, 1);
        group.add(dust);

        const chips = [];
        for (let chipIndex = 0; chipIndex < 3; chipIndex += 1) {
          const chipRadius = 0.18 + chipIndex * 0.06;
          const chip = new THREE.Mesh(
            this._buildBoulderGeometry(chipRadius, 1, 0.3, { seed: rockSeed + chipIndex * 19 + 5 }),
            coreMaterial
          );
          chip.position.set(
            (Math.random() - 0.5) * 0.95,
            (Math.random() - 0.5) * 0.95,
            (Math.random() - 0.5) * 0.95
          );
          group.add(chip);
          chips.push(chip);
        }

        group.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.35
        );
        const spin = new THREE.Vector3(
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.006
        );

        // Landing telegraph: a soft dark shadow on the slope instead of
        // the old orange bullseye. Reads as the rock's approaching mass
        // without turning the 3D frame into a HUD.
        const targetGeom = new THREE.CircleGeometry(1.2, 32);
        const targetMat = new THREE.MeshBasicMaterial({
          color: 0x0e1821,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const target = new THREE.Mesh(targetGeom, targetMat);
        target.rotation.x = 0;
        this.dynamicHazards.add(target);

        const targetCore = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 24),
          new THREE.MeshBasicMaterial({
            color: 0x070c12,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        this.dynamicHazards.add(targetCore);

        this.dynamicHazards.add(group);
        node = {
          group,
          core,
          baseColor: core.material.color.clone(),
          dust,
          chips,
          target,
          targetCore,
          spin
        };
        this.rockMeshes.set(rock.id, node);
      }

      node.group.position.set(rock.x, rock.y, 1.46 + Math.sin(this.elapsed * 2.2 + index) * 0.03);
      node.group.scale.setScalar(rock.size * 0.9);
      node.group.rotation.x += (node.spin.x + rock.speed * 0.00012) * dt * 60;
      node.group.rotation.y += (node.spin.y + rock.speed * 0.00016) * dt * 60;
      node.group.rotation.z += (node.spin.z + rock.speed * 0.00008) * dt * 60;
      const fallingAlertColor = this.tempColorD || (this.tempColorD = new THREE.Color());
      fallingAlertColor.setHex(0x99a0a5);
      node.core.material.color.copy(node.baseColor).lerp(fallingAlertColor, rock.warning ? 0.22 : 0.08);
      node.dust.material.opacity = rock.warning ? 0.055 : 0.028;
      node.dust.scale.set(rock.size * 0.9, rock.size * 1.4, 1);

      node.chips.forEach((chip, chipIndex) => {
        chip.rotation.x += 0.002 + chipIndex * 0.0015;
        chip.rotation.y += 0.0025 + chipIndex * 0.0015;
      });

      // Shadow marker: grows a touch as impact nears, stays a cold dark
      // pool on the slope. No colour flash — the hazard feed copy and the
      // rock's own descent sell urgency.
      const dy = Math.max(0, rock.y - snapshot.player.y);
      const timeToImpact = dy / Math.max(4, rock.speed);
      const urgency = clamp01(1 - timeToImpact / 2.4);
      const markerY = snapshot.player.y + 0.4;
      node.target.position.set(rock.x, markerY, 1.44);
      node.target.scale.setScalar(0.8 + (1 - urgency) * 0.42);
      node.target.material.opacity = 0.18 + urgency * 0.18;
      node.targetCore.position.set(rock.x, markerY, 1.43);
      node.targetCore.scale.setScalar(0.55 + urgency * 0.2);
      node.targetCore.material.opacity = 0.26 + urgency * 0.16;
    });

    Array.from(this.rockMeshes.entries()).forEach(([id, node]) => {
      if (!nextRockIds.has(id)) {
        this.dynamicHazards.remove(node.group);
        this.dynamicHazards.remove(node.target);
        this.dynamicHazards.remove(node.targetCore);
        node.group.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            child.material.dispose();
          }
        });
        if (node.target) {
          node.target.geometry.dispose();
          node.target.material.dispose();
        }
        if (node.targetCore) {
          node.targetCore.geometry.dispose();
          node.targetCore.material.dispose();
        }
        this.rockMeshes.delete(id);
      }
    });

    const nextAvalancheIds = new Set();
    snapshot.avalanches.forEach((avalanche, index) => {
      nextAvalancheIds.add(avalanche.id);
      let node = this.avalancheMeshes.get(avalanche.id);

      if (!node) {
        node = this._createAvalancheNode();
        this.avalancheGroup.add(node.group);
        this.avalancheMeshes.set(avalanche.id, node);
      }

      this._updateAvalancheNode(node, avalanche, index, dt);
    });

    Array.from(this.avalancheMeshes.entries()).forEach(([id, node]) => {
      if (!nextAvalancheIds.has(id)) {
        this.avalancheGroup.remove(node.group);
        this._disposeAvalancheNode(node);
        this.avalancheMeshes.delete(id);
      }
    });
  }

  _createAvalancheNode() {
    const group = new THREE.Group();

    // Shared per-avalanche materials — cloned once so per-frame opacity
    // pulses don't touch the base material and we don't leak 30+ clones.
    const blobMat = this.materials.avalancheBlob.clone();
    const crestMat = this.materials.avalancheCrest.clone();
    const trailMat = this.materials.avalancheTrail.clone();
    const sprayMat = this.materials.avalancheSpray.clone();
    const haloMat = this.materials.avalancheGlow.clone();

    // Backlit halo: wide additive card behind the mass so the silhouette
    // is framed by a diffuse glow instead of a hard cut-out.
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(44, 18, 1);
    halo.position.set(0, 0.4, -2.2);
    group.add(halo);

    // Main billow: many overlapping displaced puffs read as a dense cloud
    // of powder. Detail 20×14 keeps sphere silhouettes smooth when the
    // camera passes close; stacking ~18 of them hides any single shape.
    const blobs = [];
    const blobCount = 18;
    for (let i = 0; i < blobCount; i += 1) {
      const radius = 1.8 + Math.random() * 2.4;
      const mesh = new THREE.Mesh(this._buildSnowPuffGeometry(radius, 0.11), blobMat);
      const anchorX = (Math.random() - 0.5) * 22;
      // Concentrate body slightly below centre; leaves room above for crest.
      const anchorY = -0.2 + (Math.random() - 0.6) * 4.2;
      const anchorZ = (Math.random() - 0.5) * 3.2;
      mesh.position.set(anchorX, anchorY, anchorZ);
      mesh.userData = {
        anchor: new THREE.Vector3(anchorX, anchorY, anchorZ),
        spinX: (Math.random() - 0.5) * 0.4,
        spinY: (Math.random() - 0.3) * 0.6,
        drift: 0.9 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2
      };
      group.add(mesh);
      blobs.push(mesh);
    }

    // Crest: smaller brighter puffs hugging the top edge — the foam crown
    // that catches the rim-light and sells the direction of motion.
    const crest = [];
    const crestCount = 11;
    for (let i = 0; i < crestCount; i += 1) {
      const radius = 0.7 + Math.random() * 0.9;
      const mesh = new THREE.Mesh(this._buildSnowPuffGeometry(radius, 0.18), crestMat);
      const anchorX = (Math.random() - 0.5) * 20;
      const anchorY = 2.6 + Math.random() * 2.6;
      const anchorZ = (Math.random() - 0.5) * 2.2;
      mesh.position.set(anchorX, anchorY, anchorZ);
      mesh.userData = {
        anchor: new THREE.Vector3(anchorX, anchorY, anchorZ),
        phase: Math.random() * Math.PI * 2
      };
      group.add(mesh);
      crest.push(mesh);
    }

    // Ice-crystal spray: point particles launched from the leading edge
    // that drift downward and recycle. Additive blending so they pop
    // brightly against the cliff without over-whitening the mass behind.
    const sprayCount = 160;
    const sprayGeom = new THREE.BufferGeometry();
    const sprayPos = new Float32Array(sprayCount * 3);
    const sprayState = new Array(sprayCount);
    for (let i = 0; i < sprayCount; i += 1) {
      const { x, y, z, vx, vy, vz, life } = this._seedAvalancheSprayParticle(true);
      sprayPos[i * 3] = x;
      sprayPos[i * 3 + 1] = y;
      sprayPos[i * 3 + 2] = z;
      sprayState[i] = { vx, vy, vz, life, lifespan: 1.4 + Math.random() * 1.4 };
    }
    sprayGeom.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    const spray = new THREE.Points(sprayGeom, sprayMat);
    group.add(spray);

    // Powder trail cards behind the mass so the storm reads as pulling
    // its own debris cloud along with it.
    const trails = [];
    const trailCount = 5;
    for (let i = 0; i < trailCount; i += 1) {
      const trail = new THREE.Sprite(trailMat);
      trail.scale.set(17 + Math.random() * 8, 5 + Math.random() * 3, 1);
      trail.position.set((Math.random() - 0.5) * 18, 1.2 + Math.random() * 2, -3.2 - i * 0.7);
      trail.userData = { phase: Math.random() * Math.PI * 2 };
      group.add(trail);
      trails.push(trail);
    }

    return { group, halo, blobs, crest, spray, sprayState, trails, blobMat, crestMat, trailMat, sprayMat, haloMat };
  }

  _seedAvalancheSprayParticle(initial) {
    // When initial, scatter across the whole front; otherwise re-emit from
    // the leading edge so recycled particles look fresh off the crest.
    const x = (Math.random() - 0.5) * 24;
    const y = initial ? 3 + Math.random() * 2 : 2.4 + Math.random() * 2.4;
    const z = (Math.random() - 0.5) * 3.4;
    return {
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 1.8,
      vy: -1.6 - Math.random() * 2.4,
      vz: (Math.random() - 0.5) * 0.6,
      life: initial ? Math.random() * 1.2 : 0
    };
  }

  _updateAvalancheNode(node, avalanche, index, dt) {
    const t = this.elapsed;
    const sway = Math.sin(t * 1.6 + index) * 0.5;
    node.group.position.set(sway, avalanche.y, 3.4);
    node.group.rotation.z = Math.sin(t * 1.9 + index) * 0.04;
    node.group.scale.y = avalanche.heightScale * 1.35;
    node.group.scale.x = 1 + (avalanche.heightScale - 1) * 0.18;

    const base = 0.58 + avalanche.intensity * 0.32;

    // Animate blobs: lazy drift around each anchor + slow tumble.
    node.blobs.forEach((blob) => {
      const u = blob.userData;
      blob.position.x = u.anchor.x + Math.sin(t * 1.05 * u.drift + u.phase) * 0.55;
      blob.position.y = u.anchor.y + Math.cos(t * 0.9 * u.drift + u.phase) * 0.42;
      blob.position.z = u.anchor.z + Math.sin(t * 0.6 + u.phase) * 0.28;
      blob.rotation.y += u.spinY * dt;
      blob.rotation.x += u.spinX * dt;
    });
    node.blobMat.opacity = base;

    // Crest foam: tighter, faster undulation for visible turbulence.
    node.crest.forEach((blob) => {
      const u = blob.userData;
      blob.position.x = u.anchor.x + Math.sin(t * 2.2 + u.phase) * 0.32;
      blob.position.y = u.anchor.y + Math.cos(t * 1.6 + u.phase) * 0.22;
      blob.rotation.z += 0.6 * dt;
    });
    node.crestMat.opacity = Math.min(0.96, 0.68 + avalanche.intensity * 0.32);

    // Spray particles: integrate velocity, recycle when they drop below
    // the mass or exceed their lifespan.
    const pos = node.spray.geometry.attributes.position;
    for (let i = 0; i < node.sprayState.length; i += 1) {
      const s = node.sprayState[i];
      let x = pos.getX(i) + s.vx * dt;
      let y = pos.getY(i) + s.vy * dt;
      let z = pos.getZ(i) + s.vz * dt;
      s.life += dt;
      if (y < -7 || s.life > s.lifespan) {
        const seed = this._seedAvalancheSprayParticle(false);
        x = seed.x;
        y = seed.y;
        z = seed.z;
        s.vx = seed.vx;
        s.vy = seed.vy;
        s.vz = seed.vz;
        s.life = 0;
        s.lifespan = 1.4 + Math.random() * 1.4;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    node.sprayMat.opacity = 0.55 + avalanche.intensity * 0.34;
    node.sprayMat.size = 0.48 + avalanche.intensity * 0.14;

    // Back halo + trailing powder cards.
    node.haloMat.opacity = 0.26 + avalanche.intensity * 0.32;
    node.trails.forEach((trail, ti) => {
      const phase = trail.userData.phase;
      trail.material.opacity = (0.1 + avalanche.intensity * 0.12) * (0.7 + 0.3 * Math.sin(t * 1.4 + phase + ti));
    });
  }

  _disposeAvalancheNode(node) {
    node.blobs.forEach((blob) => blob.geometry.dispose());
    node.crest.forEach((blob) => blob.geometry.dispose());
    node.spray.geometry.dispose();
    node.blobMat.dispose();
    node.crestMat.dispose();
    node.trailMat.dispose();
    node.sprayMat.dispose();
    node.haloMat.dispose();
  }

  _updateFootprints(snapshot) {
    const keepIds = new Set();
    snapshot.footprints.forEach((mark) => {
      keepIds.add(mark.id);
      let mesh = this.footprints.get(mark.id);

      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.05), this.materials.footprint.clone());
        this.footprintGroup.add(mesh);
        this.footprints.set(mark.id, mesh);
      }

      mesh.position.set(mark.x, mark.y, 1.17);
      mesh.scale.setScalar(1 + mark.strength * 0.22);
      mesh.material.opacity = Math.max(0, 0.34 - mark.age * 0.22);
      mesh.rotation.z = mark.rotation;
    });

    Array.from(this.footprints.entries()).forEach(([id, mesh]) => {
      if (!keepIds.has(id)) {
        this.footprintGroup.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.footprints.delete(id);
      }
    });
  }

  _updateParticles(snapshot, dt) {
    const phase = snapshot.phaseRatio;
    const storm = snapshot.stormStrength;

    if (this.isNewYearPreset) {
      this.materials.snowFar.opacity = 0.06 + storm * 0.16 * (1 - phase * 0.18);
      this.materials.snowMid.opacity = 0.1 + storm * 0.24 * (1 - phase * 0.1);
      this.materials.snowNear.opacity = 0.16 + storm * 0.32;
      this.materials.ash.opacity = 0;
    } else {
      this.materials.snowFar.opacity = 0.18 + storm * 0.24 * (1 - phase * 0.22);
      this.materials.snowMid.opacity = 0.26 + storm * 0.4 * (1 - phase * 0.12);
      this.materials.snowNear.opacity = 0.34 + storm * 0.48;
      this.materials.ash.opacity = phase * (0.08 + storm * 0.22);
    }

    this._driftPoints(this.snowFarField, dt, {
      speedY: 7 + storm * 8,
      driftX: 2.8 + storm * 3.4,
      jitterZ: 0.03
    });
    this._driftPoints(this.snowMidField, dt, {
      speedY: 10 + storm * 12,
      driftX: 4.2 + storm * 5.8,
      jitterZ: 0.05
    });
    this._driftPoints(this.snowNearField, dt, {
      speedY: 18 + storm * 18,
      driftX: 8 + storm * 10,
      jitterZ: 0.09
    });
    this._driftPoints(this.ashField, dt, {
      speedY: -2 - storm * 2,
      driftX: 2 + storm * 2,
      jitterZ: 0.05
    });
  }

  _driftPoints(field, dt, config) {
    const attribute = field.points.geometry.attributes.position;
    const bounds = field.bounds;

    for (let index = 0; index < attribute.count; index += 1) {
      let x = attribute.getX(index);
      let y = attribute.getY(index);
      let z = attribute.getZ(index);

      x += Math.sin(this.elapsed * 1.6 + index * 0.37) * config.driftX * dt * 0.45;
      y -= config.speedY * dt;
      z += Math.cos(this.elapsed * 1.2 + index) * config.jitterZ;

      if (y < bounds.yMin) {
        y = bounds.yMax;
      }
      if (y > bounds.yMax) {
        y = bounds.yMin;
      }
      if (x < -bounds.x / 2) {
        x = bounds.x / 2;
      }
      if (x > bounds.x / 2) {
        x = -bounds.x / 2;
      }
      if (z < bounds.zMin) {
        z = bounds.zMax;
      }
      if (z > bounds.zMax) {
        z = bounds.zMin;
      }

      attribute.setXYZ(index, x, y, z);
    }

    attribute.needsUpdate = true;
  }

  _updateCamera(snapshot, dt) {
    const danger = snapshot.dangerLevel || 0;
    const shake = snapshot.cameraShake || 0;
    const progressRatio = Math.min(1, snapshot.player.progressY / 100);
    const summitApproach = smoothStep(0.86, 1, progressRatio);
    const playerWorldY = this._worldY(this.playerRender.y);
    const summitWorldY = this._worldY(this.summitFocusLocal.y);
    const climbing = Boolean(snapshot.player.climbing);
    const falling = Boolean(snapshot.player.falling);
    const fallRatio = snapshot.player.fallRatio || 0;
    const fallOffsetWorld = this._worldY((snapshot.player.fallOffset || 0) * 0.38);

    // Over-the-shoulder POV with weight. The camera lags the climber, leans
    // into the slope when they climb, and sways gently against their
    // lateral motion so the rig reads as attached to a body breathing
    // on a rope — not a locked follow-cam.
    const panoramaIntensityForFov = (snapshot.panorama && snapshot.panorama.intensity) || 0;
    const desiredFov = falling
      ? 81 + fallRatio * 4
      : 74 - progressRatio * 4 + (climbing ? 1.6 : 0) + panoramaIntensityForFov * 5.5;
    if (Math.abs(this.camera.fov - desiredFov) > 0.02) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 2.2);
      this.camera.updateProjectionMatrix();
    }

    // Climber's helmet now sits around scene-local y=1.95; shoulder is
    // just below. Reduced from the old 2.45 so the cam doesn't float
    // half a metre above the rebuilt (properly-proportioned) climber.
    const shoulderWorldY = this._worldY(1.9);
    // Pull the rig a bit further back when climbing: gives the axe-plant
    // frame room to read. Settles closer when the climber is just hanging.
    const climbOffset = climbing ? 0.35 : 0;
    const camBackOffset = 2.55 + climbOffset + summitApproach * 1.15;
    const camRise = 0.42 + climbOffset * 0.4 + summitApproach * 0.28;

    const lookAheadLocal = 24 + progressRatio * 8 + (climbing ? 2.4 : 0) + summitApproach * 4.5;
    const lookWorldY = Math.min(
      summitWorldY + 1.6,
      playerWorldY + this._worldY(lookAheadLocal)
    );
    const lookZ = 0.2 - summitApproach * 0.35;

    // Lateral counter-sway: when the climber swings right, the cam drifts
    // left of his back, so the silhouette cuts through frame instead of
    // being centred and lifeless.
    const lateralX = snapshot.player.x || 0;
    const baseLane = snapshot.player.baseLane || 0;
    const activeCouloirX = baseLane * (window.BERG_ROUTE_LANE_SPACING || 6.35);
    const lateralVx = snapshot.player.vx || 0;
    const counterSway = -lateralX * 0.12 - lateralVx * 0.009;
    const cameraLaneShift = activeCouloirX * (0.26 + danger * 0.04);
    const lookLaneShift = activeCouloirX * (0.35 + danger * 0.03);

    const targetPosition = falling
      ? this.tempVecA.set(
        lateralX * 0.26 + counterSway * 0.42 + cameraLaneShift * 0.82,
        playerWorldY + shoulderWorldY - 0.1 - fallOffsetWorld,
        this.playerRender.z + 3.18 + summitApproach * 0.8 + fallRatio * 0.7 + Math.sin(this.elapsed * 0.68) * 0.03
      )
      : this.tempVecA.set(
        lateralX * 0.42 + counterSway + cameraLaneShift,
        playerWorldY + shoulderWorldY + camRise,
        this.playerRender.z + camBackOffset + Math.sin(this.elapsed * 0.42) * 0.04
      );
    const targetLook = falling
      ? this.tempVecB.set(
        lateralX * 0.1 + lookLaneShift * 0.72,
        Math.min(
          summitWorldY + 1.2,
          playerWorldY + this._worldY(32 + fallRatio * 14) - fallOffsetWorld * 0.22
        ),
        0.14
      )
      : this.tempVecB.set(
        lateralX * 0.22 + lookLaneShift,
        lookWorldY,
        lookZ
      );

    // Panorama pull-back. The game freezes the world at a phase change and
    // asks the rig to widen: the camera drifts back + up, the look-target
    // lifts toward the summit so the distant peak enters frame, and the
    // roll/shake bleed off. Intensity is 0..1 eased in game.js.
    const panoramaIntensity = (snapshot.panorama && snapshot.panorama.intensity) || 0;
    if (panoramaIntensity > 0 && !falling) {
      const lift = this._worldY(panoramaIntensity * 1.8);
      targetPosition.y += lift;
      targetPosition.z += panoramaIntensity * 2.6;
      targetPosition.x *= 1 - panoramaIntensity * 0.35;
      const liftedLook = summitWorldY + 1.4;
      targetLook.y += (liftedLook - targetLook.y) * panoramaIntensity * 0.55;
      targetLook.x *= 1 - panoramaIntensity * 0.55;
    }

    // Heavier damping — exp(-dt*3.2) lags ~0.3s vs the old ~0.15s.
    // Gives the rig real mass and turns the old "whip to target" feel
    // into a weighted follow.
    this.camera.position.lerp(targetPosition, 1 - Math.exp(-dt * 3.2));
    this.cameraTarget.lerp(targetLook, 1 - Math.exp(-dt * 3.6));

    // Breathing: deeper amplitude under load, syncopated X so it's not a
    // simple bob. Extra pulse when actively climbing — the axe/foot
    // cadence bleeds into the rig. Panorama slows breath toward stillness.
    const load = (climbing ? 0.5 : 0) + danger * 0.4 + (falling ? 0.18 : 0);
    const breathDamp = 1 - panoramaIntensity * 0.85;
    const breathAmp = (0.06 + progressRatio * 0.09 + load * 0.08) * breathDamp;
    const breath = Math.sin(this.elapsed * (0.9 + load * 0.4)) * breathAmp;
    const breathSway = Math.sin(this.elapsed * 0.6 + 0.4) * breathAmp * 0.55;
    this.camera.position.y += falling ? breath * 0.26 : breath;
    this.camera.position.x += falling ? breathSway * 0.32 : breathSway;

    // Axe-plant micro-dolly: a short forward bump timed to the climb
    // stroke phase, then a settle. Gives the rig a living, reactive feel.
    if (climbing && !falling && panoramaIntensity < 0.98) {
      const stroke = (snapshot.player.climbStrokePhase || 0);
      const phaseOffset = stroke * Math.PI;
      const kick = Math.max(0, Math.sin(this.elapsed * 4.8 + phaseOffset)) * (1 - panoramaIntensity);
      this.camera.position.z -= kick * kick * 0.08;
      this.camera.position.y += kick * kick * 0.04;
    }

    this.camera.position.x += Math.sin(this.elapsed * 23) * shake * 0.14;
    this.camera.position.y += Math.cos(this.elapsed * 19) * shake * 0.2;
    this.camera.position.z += Math.sin(this.elapsed * 21) * shake * 0.08;

    this.camera.lookAt(this.cameraTarget);

    // Roll responds to tether tension (up-vector pulling the climber
    // tight) plus lateral swing. A touch of idle breath keeps it alive
    // even when the climber is still. Panorama calms the roll too.
    const rollDamp = 1 - panoramaIntensity * 0.92;
    const rollBreath = Math.sin(this.elapsed * 0.7 + 1.2) * (0.003 + progressRatio * 0.004) * rollDamp;
    const tensionRoll = climbing ? Math.sin(this.elapsed * 2.1) * 0.012 * rollDamp : 0;
    this.camera.rotation.z =
      falling
        ? -lateralX * 0.01 - lateralVx * 0.0016 + Math.sin(this.elapsed * 1.2) * 0.006
        : (-lateralX * 0.022 - lateralVx * 0.0028) * rollDamp + rollBreath + tensionRoll;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  dispose() {
    window.removeEventListener('resize', this._handleResize);
    this.renderer.dispose();
  }
}
