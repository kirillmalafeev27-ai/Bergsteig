function smoothStep(min, max, value) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

class BergRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0e1821, 85, 300);

    this.routeHeight = 228;
    this.routeScale = this.routeHeight / 100;
    this.verticalCompression = 0.32;
    this.summitFocusLocal = new THREE.Vector3(0, 239.5, -0.6);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 520);
    this.camera.position.set(0, -4, 52);
    this.camera.lookAt(0, 38, 0);

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
    this.renderer.toneMappingExposure = 1.04;
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

    this.rockMeshes = new Map();
    this.avalancheMeshes = new Map();
    this.footprints = new Map();
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
        color: 0xf7fbff,
        emissive: 0xffb06f,
        emissiveIntensity: 0.18,
        roughness: 0.6
      }),
      flag: new THREE.MeshStandardMaterial({
        color: 0xffcfa1,
        emissive: 0xff7b46,
        emissiveIntensity: 0.42,
        side: THREE.DoubleSide
      }),
      peakShadow: new THREE.MeshStandardMaterial({
        color: 0x0f1820,
        roughness: 1
      }),
      rope: new THREE.MeshStandardMaterial({
        color: 0xc8d7df,
        roughness: 0.76,
        metalness: 0.08
      }),
      ropeLine: new THREE.LineBasicMaterial({
        color: 0xeff8ff,
        transparent: true,
        opacity: 0.6
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
        map: rockMap,
        color: 0x435661,
        roughness: 1,
        metalness: 0.04
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
        color: 0x2d4250,
        roughness: 0.88
      }),
      bodyAccent: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0xe38d46,
        roughness: 0.72
      }),
      bodySoft: new THREE.MeshStandardMaterial({
        map: fabricMap,
        color: 0x6fa2c2,
        roughness: 0.66
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
        color: 0xf4f8fc,
        roughness: 0.46
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

    this.moonHalo = new THREE.Sprite(this.materials.halo.clone());
    this.moonHalo.position.set(-38, 150, -120);
    this.moonHalo.scale.set(36, 36, 1);
    this.scene.add(this.moonHalo);

    this.moonDisk = new THREE.Sprite(this.materials.moon.clone());
    this.moonDisk.position.copy(this.moonHalo.position);
    this.moonDisk.scale.set(9, 9, 1);
    this.scene.add(this.moonDisk);

    const starPositions = new Float32Array(850 * 3);
    for (let index = 0; index < 850; index += 1) {
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
    this.scene.add(this.starField);

    this.distantPeaks = new THREE.Group();
    this.root.add(this.distantPeaks);
    const peakPositions = [-148, -118, -92, -70, 72, 94, 120, 150];
    peakPositions.forEach((x, index) => {
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(14 + (index % 3) * 4, 42 + (index % 4) * 14, 5 + (index % 2)),
        this.materials.peakShadow.clone()
      );
      peak.position.set(x, 32 + (index % 3) * 14, -130 - (index % 2) * 18);
      peak.rotation.z = (Math.random() - 0.5) * 0.15;
      peak.scale.x = 1 + (index % 2) * 0.25;
      peak.scale.z = 1.2;
      this.distantPeaks.add(peak);
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

    this.auroraGroup = new THREE.Group();
    this.root.add(this.auroraGroup);
    for (let index = 0; index < 3; index += 1) {
      const material = this.materials.aurora.clone();
      const band = new THREE.Mesh(new THREE.PlaneGeometry(90, 12, 1, 1), material);
      band.position.set(index * 26 - 26, 134 + index * 8, -100);
      band.rotation.x = -0.44;
      band.rotation.z = -0.16 + index * 0.14;
      this.auroraBands.push(band);
      this.auroraGroup.add(band);
    }
  }

  _buildEnvironment() {
    this.environmentGroup = new THREE.Group();
    this.root.add(this.environmentGroup);

    const LANE_X = 2.85;
    const ROUTE_HALF = LANE_X * 1.5 + 0.35;

    // Wider, taller plane so the mountain reads as a real peak, not a strip.
    // The playable corridor stays at +/-ROUTE_HALF; everything outside tapers
    // into a classic pyramidal silhouette that narrows to a single apex.
    const MOUNT_WIDTH = 150;
    const MOUNT_HEIGHT = 290;
    const MOUNT_HALF_W = MOUNT_WIDTH / 2;
    const MOUNT_HALF_H = MOUNT_HEIGHT / 2;
    const FLANK_SPAN = MOUNT_HALF_W - ROUTE_HALF;
    const mountainGeometry = new THREE.PlaneGeometry(MOUNT_WIDTH, MOUNT_HEIGHT, 180, 340);
    const positions = mountainGeometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const snowTone = new THREE.Color(0xe5f0f7);
    const stoneTone = new THREE.Color(0x485864);
    const darkTone = new THREE.Color(0x242d36);
    const scratch = new THREE.Color();
    const noise = (x, y, fx, fy) => Math.sin(x * fx + y * fy * 1.3) * Math.cos(y * fx * 1.1 - x * fy * 0.7);

    for (let index = 0; index < positions.count; index += 1) {
      const baseX = positions.getX(index);
      const y = positions.getY(index);
      const slopeRatio = clamp01((y + MOUNT_HALF_H) / MOUNT_HEIGHT);
      const xSign = baseX === 0 ? 0 : Math.sign(baseX);

      // Silhouette profile: wide at base, near-zero at summit. This is what
      // gives the mesh its triangular "mountain" outline when seen from below.
      const silhouette = Math.pow(1 - slopeRatio, 1.55);
      const summitPinch = smoothStep(0.82, 1, slopeRatio);

      let x;
      const absBase = Math.abs(baseX);
      if (absBase <= ROUTE_HALF) {
        // Climbing corridor: preserve geometry exactly so gameplay stays valid.
        x = baseX;
      } else {
        // Exterior: collapse outward vertices by the silhouette profile so
        // flanks shrink to the apex.
        const outerFrac = (absBase - ROUTE_HALF) / FLANK_SPAN;
        const scaled = outerFrac * Math.max(0.04, silhouette);
        x = xSign * (ROUTE_HALF * Math.max(0.05, silhouette + summitPinch * -0.04) + scaled * FLANK_SPAN);
      }
      const absX = Math.abs(x);
      const outsideCorridor = absX > ROUTE_HALF;
      const insideRoute = !outsideCorridor;

      positions.setX(index, x);

      // Central spine pulls the climb face outward toward the camera.
      const spineBank = Math.pow(Math.max(0, 1 - absX / 22), 1.3) * 3.1;
      // Broad terraces across the face.
      const terrace = Math.sin(y * 0.085) * 1.35 + Math.sin(y * 0.04 - x * 0.18) * 0.9;
      // Rocky crag noise (quieter inside the corridor so gameplay reads clean).
      const crags =
        noise(x, y, 0.32, 0.22) * 1.4 +
        noise(x, y, 0.78, 0.61) * 0.85 +
        noise(x, y, 1.6, 1.1) * 0.38;
      // Side buttresses — heavy shoulders mid-height.
      const sideMass = smoothStep(ROUTE_HALF + 2, ROUTE_HALF + 16, absX) * (3.4 + Math.sin(y * 0.14) * 0.7);
      const shoulderRise = Math.sin(slopeRatio * Math.PI) * smoothStep(ROUTE_HALF, ROUTE_HALF + 14, absX) * 1.6;
      const crownLift = smoothStep(0.7, 1, slopeRatio) * Math.max(0, 6.2 - absX * 0.32);
      // Flanks recede away from the viewer to give the mountain real volume.
      const flankFrac = outsideCorridor
        ? clamp01((absX - ROUTE_HALF) / FLANK_SPAN)
        : 0;
      const flankRecession = -Math.pow(flankFrac, 1.35) * 22;
      // Subtle couloir carved into the climb corridor.
      const couloirDepth = insideRoute
        ? smoothStep(0, ROUTE_HALF, ROUTE_HALF - absX) * (0.78 + Math.sin(y * 0.22) * 0.1)
        : 0;
      const ledges = insideRoute ? Math.sin(y * 0.55 + x * 0.2) * 0.22 : 0;
      // Apex push so the summit sits slightly forward of the receding flanks.
      const apexPush = smoothStep(0.85, 1, slopeRatio) * Math.max(0, 3.4 - absX * 0.42);

      const z =
        -2.8 +
        spineBank +
        terrace +
        crags * (insideRoute ? 0.48 : 0.9) +
        sideMass +
        shoulderRise +
        crownLift +
        ledges +
        apexPush +
        flankRecession -
        couloirDepth;

      positions.setZ(index, z);

      // Colour mixing: snow hugs the route and summit; flanks darken into stone.
      const snowMix = clamp01(
        1 - absX / 14 +
        smoothStep(0.72, 1, slopeRatio) * 0.25 -
        Math.max(0, -crags * 0.28)
      );
      const darkMix = clamp01(
        Math.max(0, -terrace * 0.35 - crags * 0.18) +
        smoothStep(90, 10, y) * 0.15 +
        smoothStep(ROUTE_HALF + 4, ROUTE_HALF + 22, absX) * 0.22 +
        flankFrac * 0.18
      );
      scratch.copy(stoneTone).lerp(snowTone, snowMix);
      scratch.lerp(darkTone, darkMix * 0.75);
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

    // lane markers: three painted chalk strips along the route
    const laneOffsets = [-LANE_X, 0, LANE_X];
    laneOffsets.forEach((laneOffsetX, laneIndex) => {
      const laneGeom = new THREE.PlaneGeometry(0.42, 240, 1, 40);
      const lanePositions = laneGeom.attributes.position;
      for (let i = 0; i < lanePositions.count; i += 1) {
        const py = lanePositions.getY(i);
        lanePositions.setZ(i, Math.sin(py * 0.3 + laneIndex) * 0.04);
      }
      const laneMat = new THREE.MeshBasicMaterial({
        color: laneIndex === 1 ? 0xf4c88a : 0xbcd6e4,
        transparent: true,
        opacity: 0.34,
        depthWrite: false
      });
      const laneStrip = new THREE.Mesh(laneGeom, laneMat);
      laneStrip.position.set(laneOffsetX, 110, 1.38);
      this.environmentGroup.add(laneStrip);

      // dashed rungs across each lane every few meters
      for (let rung = 0; rung < 44; rung += 1) {
        const rungY = -6 + rung * 6 + (laneIndex - 1) * 0.8;
        const rungMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.4, 0.12),
          new THREE.MeshBasicMaterial({
            color: 0xffe7b8,
            transparent: true,
            opacity: 0.24 + (rung % 2) * 0.12,
            depthWrite: false
          })
        );
        rungMesh.position.set(laneOffsetX, rungY, 1.4);
        this.environmentGroup.add(rungMesh);
      }
    });

    // scattered boulders, flanking crags, and ledges so the face feels 3D
    this._boulderMats = [
      new THREE.MeshStandardMaterial({ map: this.materials.cliffShadow.map, color: 0x556673, roughness: 0.96, metalness: 0.05, flatShading: true }),
      new THREE.MeshStandardMaterial({ map: this.materials.cliffShadow.map, color: 0x3d4954, roughness: 1, metalness: 0.03, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x788c98, roughness: 0.85, metalness: 0.04, flatShading: true })
    ];
    for (let index = 0; index < 72; index += 1) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const slopeFrac = Math.random();
      // Scatter boulders along the tapered flanks rather than on a flat band.
      const flankBand = ROUTE_HALF + 0.4 + Math.random() * Math.max(2, (1 - slopeFrac * 0.8) * 30);
      const bx = side * flankBand;
      const by = -8 + slopeFrac * 252;
      const bz = 0.6 + Math.random() * 0.8 - Math.min(12, (Math.abs(bx) - ROUTE_HALF) * 0.42);
      const scale = 0.8 + Math.random() * 2.2;
      const geom = Math.random() < 0.5
        ? new THREE.DodecahedronGeometry(scale, 0)
        : new THREE.IcosahedronGeometry(scale * 0.95, 0);
      const boulder = new THREE.Mesh(geom, this._boulderMats[index % this._boulderMats.length]);
      boulder.position.set(bx, by, bz);
      boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      boulder.scale.set(1 + Math.random() * 0.4, 0.55 + Math.random() * 0.35, 0.7 + Math.random() * 0.5);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.environmentGroup.add(boulder);
    }

    // a handful of boulders inside the route for visual interest (clear of lanes)
    for (let index = 0; index < 18; index += 1) {
      const laneBetween = Math.random() < 0.5 ? -LANE_X * 0.5 : LANE_X * 0.5;
      const bx = laneBetween + (Math.random() - 0.5) * 0.8;
      const by = 4 + Math.random() * 236;
      const scale = 0.42 + Math.random() * 0.56;
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(scale, 0),
        this._boulderMats[index % this._boulderMats.length]
      );
      boulder.position.set(bx, by, 1.42);
      boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      boulder.scale.set(1, 0.45, 0.6);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.environmentGroup.add(boulder);
    }

    // Massive background silhouette — a single broad pyramid behind the climb
    // face that gives the mountain its iconic triangular profile against the sky.
    const backMassGeometry = new THREE.ConeGeometry(96, 330, 7, 4, false);
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
    backMass.position.set(0, 108, -52);
    backMass.receiveShadow = true;
    backMass.castShadow = false;
    this.environmentGroup.add(backMass);

    // Two flanking sub-peaks spreading outward so the ridge feels broad.
    [-1, 1].forEach((side) => {
      const flankGeom = new THREE.ConeGeometry(42, 230, 6, 2, false);
      const flank = new THREE.Mesh(flankGeom, this.materials.peakShadow.clone());
      flank.material.color.setHex(0x323e4b);
      flank.position.set(side * 62, 72, -44);
      flank.rotation.z = side * 0.18;
      flank.receiveShadow = true;
      this.environmentGroup.add(flank);
    });

    // Jagged ridgeline spires on each flank — further out now that the
    // mountain itself is wide.
    for (let index = 0; index < 14; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(2.8 + Math.random() * 2.2, 18 + Math.random() * 22, 5),
        this.materials.cliffShadow.clone()
      );
      spire.position.set(
        side * (58 + Math.random() * 18),
        -2 + index * 20 + Math.random() * 6,
        -18 - Math.random() * 10
      );
      spire.rotation.z = side * (0.08 + Math.random() * 0.14);
      spire.castShadow = true;
      spire.receiveShadow = true;
      this.environmentGroup.add(spire);
    }

    const lowerMist = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 48),
      new THREE.MeshBasicMaterial({
        map: this.materials.cloud.map,
        color: 0xdff3ff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    lowerMist.position.set(0, -14, 18);
    this.environmentGroup.add(lowerMist);

    this.summitGroup = new THREE.Group();
    this.environmentGroup.add(this.summitGroup);

    const crownShadow = new THREE.Mesh(new THREE.ConeGeometry(13.5, 24, 8), this.materials.peakShadow.clone());
    crownShadow.position.set(0, 228, -7.4);
    crownShadow.scale.set(1.3, 1, 1.05);
    crownShadow.castShadow = true;
    this.summitGroup.add(crownShadow);

    const peak = new THREE.Mesh(new THREE.ConeGeometry(8.5, 20, 7), this.materials.summit);
    peak.position.set(0, 230, -2.8);
    peak.castShadow = true;
    this.summitGroup.add(peak);

    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(new THREE.ConeGeometry(4.6, 10.5, 6), this.materials.summit.clone());
      shoulder.position.set(side * 5.1, 226.4, -4.2);
      shoulder.rotation.z = side * 0.12;
      shoulder.castShadow = true;
      this.summitGroup.add(shoulder);
    });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 8.5, 8), this.materials.anchorMetal);
    tower.position.set(0, 240, -1.2);
    this.summitGroup.add(tower);

    this.flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.2), this.materials.flag);
    this.flagMesh.position.set(2.8, 242.6, -0.8);
    this.flagMesh.rotation.y = -0.16;
    this.summitGroup.add(this.flagMesh);

    this.summitAura = new THREE.Sprite(this.materials.halo.clone());
    this.summitAura.position.set(0, 237.5, 0.2);
    this.summitAura.scale.set(22, 22, 1);
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
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.09 + index * 0.02, 6, false), this.materials.crack.clone());
      this.environmentGroup.add(tube);

      const glow = new THREE.Sprite(this.materials.halo.clone());
      glow.position.copy(points[points.length - 2]);
      glow.scale.set(8 + index * 2, 8 + index * 2, 1);
      this.environmentGroup.add(glow);

      this.crackNodes.push({ tube, glow, offset: index * 0.6 });
    });
  }

  _buildRope() {
    this.ropePointCount = 28;
    this.ropePoints = Array.from({ length: this.ropePointCount }, (_, index) => {
      const t = index / (this.ropePointCount - 1);
      return new THREE.Vector3(0, -10 + t * 254, 1.28);
    });

    this.ropeGeometry = new THREE.BufferGeometry().setFromPoints(this.ropePoints);
    this.ropeLine = new THREE.Line(this.ropeGeometry, this.materials.ropeLine);
    this.environmentGroup.add(this.ropeLine);

    const ropeSegmentGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1, 8, 1, false);
    for (let index = 0; index < this.ropePointCount - 1; index += 1) {
      const segment = new THREE.Mesh(ropeSegmentGeometry, this.materials.rope);
      segment.castShadow = true;
      this.ropeSegments.push(segment);
      this.environmentGroup.add(segment);
    }

    this.anchorNodes = [];
    [24, 58, 94, 132, 170, 210].forEach((y, index) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 10), this.materials.anchorMetal);
      screw.position.set(index % 2 === 0 ? -0.8 : 0.8, y, 0.34);
      screw.rotation.z = Math.PI / 2;
      this.environmentGroup.add(screw);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 18), this.materials.anchorMetal);
      ring.position.set(index % 2 === 0 ? -0.1 : 0.1, y, 0.98);
      this.environmentGroup.add(ring);
      this.anchorNodes.push({ screw, ring, baseY: y });
    });
  }

  _buildPlayer() {
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0, 0, 1.5);
    this.root.add(this.playerGroup);

    this.harnessAnchor = new THREE.Object3D();
    this.harnessAnchor.position.set(0, 0.32, -0.16);
    this.playerGroup.add(this.harnessAnchor);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.92, 0.72), this.materials.body);
    torso.position.set(0, 0.95, 0);
    torso.castShadow = true;
    this.playerGroup.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.1, 0.76), this.materials.bodySoft);
    chest.position.set(0, 1.02, 0.08);
    chest.castShadow = true;
    this.playerGroup.add(chest);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.28, 0.72), this.materials.bodyAccent);
    backpack.position.set(0, 0.98, -0.66);
    backpack.castShadow = true;
    this.playerGroup.add(backpack);

    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.42, 18), this.materials.bodyAccent);
    hood.position.set(0, 2.1, -0.1);
    hood.castShadow = true;
    this.playerGroup.add(hood);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 18), this.materials.skin);
    head.position.set(0, 2.28, 0.06);
    head.castShadow = true;
    this.playerGroup.add(head);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.47, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), this.materials.helmet);
    helmet.position.set(0, 2.46, 0.02);
    helmet.rotation.x = 0.18;
    helmet.castShadow = true;
    this.playerGroup.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.18), this.materials.visor);
    visor.position.set(0, 2.24, 0.34);
    this.playerGroup.add(visor);

    this.headlamp = new THREE.PointLight(0xc6efff, 2.4, 18, 2);
    this.headlamp.position.set(0, 2.34, 0.7);
    this.playerGroup.add(this.headlamp);

    const headlampBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.14), this.materials.metal);
    headlampBody.position.copy(this.headlamp.position);
    this.playerGroup.add(headlampBody);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.74), this.materials.gloves);
    belt.position.set(0, 0.15, 0);
    belt.castShadow = true;
    this.playerGroup.add(belt);

    const harnessLoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 20), this.materials.metal);
    harnessLoop.position.set(0, 0.05, 0.2);
    harnessLoop.rotation.x = Math.PI / 2;
    this.playerGroup.add(harnessLoop);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.72, 1.58, 0.06);
    this.playerGroup.add(this.leftArmPivot);
    const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.04, 10), this.materials.bodyAccent);
    leftUpperArm.position.y = -0.5;
    leftUpperArm.castShadow = true;
    this.leftArmPivot.add(leftUpperArm);
    this.leftForearmPivot = new THREE.Group();
    this.leftForearmPivot.position.set(0, -1.02, 0);
    this.leftArmPivot.add(this.leftForearmPivot);
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.94, 10), this.materials.bodySoft);
    leftForearm.position.y = -0.48;
    leftForearm.castShadow = true;
    this.leftForearmPivot.add(leftForearm);
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), this.materials.gloves);
    leftHand.position.set(0, -0.96, 0.02);
    this.leftForearmPivot.add(leftHand);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.72, 1.58, 0.06);
    this.playerGroup.add(this.rightArmPivot);
    const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.04, 10), this.materials.bodyAccent);
    rightUpperArm.position.y = -0.5;
    rightUpperArm.castShadow = true;
    this.rightArmPivot.add(rightUpperArm);
    this.rightForearmPivot = new THREE.Group();
    this.rightForearmPivot.position.set(0, -1.02, 0);
    this.rightArmPivot.add(this.rightForearmPivot);
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.94, 10), this.materials.bodySoft);
    rightForearm.position.y = -0.48;
    rightForearm.castShadow = true;
    this.rightForearmPivot.add(rightForearm);
    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), this.materials.gloves);
    rightHand.position.set(0, -0.96, 0.02);
    this.rightForearmPivot.add(rightHand);

    const axeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 10), this.materials.iceTool);
    axeShaft.position.set(0, -0.58, 0.12);
    axeShaft.rotation.z = 0.18;
    this.rightForearmPivot.add(axeShaft);
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.14), this.materials.metal);
    axeHead.position.set(0.12, -1.12, 0.2);
    axeHead.rotation.z = 0.2;
    this.rightForearmPivot.add(axeHead);

    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.34, -0.48, 0.04);
    this.playerGroup.add(this.leftLegPivot);
    const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.18, 12), this.materials.body);
    leftThigh.position.y = -0.58;
    leftThigh.castShadow = true;
    this.leftLegPivot.add(leftThigh);
    this.leftShinPivot = new THREE.Group();
    this.leftShinPivot.position.set(0, -1.12, 0.04);
    this.leftLegPivot.add(this.leftShinPivot);
    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 1.12, 12), this.materials.bodySoft);
    leftShin.position.y = -0.56;
    leftShin.castShadow = true;
    this.leftShinPivot.add(leftShin);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.72), this.materials.boot);
    leftBoot.position.set(0, -1.18, 0.14);
    leftBoot.castShadow = true;
    this.leftShinPivot.add(leftBoot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.34, -0.48, 0.04);
    this.playerGroup.add(this.rightLegPivot);
    const rightThigh = leftThigh.clone();
    this.rightLegPivot.add(rightThigh);
    this.rightShinPivot = new THREE.Group();
    this.rightShinPivot.position.set(0, -1.12, 0.04);
    this.rightLegPivot.add(this.rightShinPivot);
    const rightShin = leftShin.clone();
    this.rightShinPivot.add(rightShin);
    const rightBoot = leftBoot.clone();
    this.rightShinPivot.add(rightBoot);

    this.shieldBillboard = new THREE.Sprite(this.materials.shield.clone());
    this.shieldBillboard.position.set(0, 1.2, 0.1);
    this.shieldBillboard.scale.set(4.4, 6.2, 1);
    this.shieldBillboard.visible = false;
    this.playerGroup.add(this.shieldBillboard);

    this.shieldRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 12, 36), this.materials.metal.clone());
    this.shieldRing.material.transparent = true;
    this.shieldRing.material.opacity = 0;
    this.shieldRing.rotation.x = Math.PI / 2;
    this.shieldRing.position.set(0, 1.0, 0.08);
    this.playerGroup.add(this.shieldRing);

    this.tetherPoints = [new THREE.Vector3(), new THREE.Vector3()];
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
        fallOffset: this._sceneYFromGameY(snapshot.player.fallOffset || 0)
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
    this._updateRope(renderSnapshot);
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

    this.moonHalo.material.opacity = 0.34 + (1 - phase) * 0.22;
    this.moonDisk.material.opacity = 0.52 + (1 - phase) * 0.3;
    this.starField.material.opacity = (1 - phase) * 0.68;

    this.cloudCards.forEach((cloud, index) => {
      cloud.mesh.position.x = cloud.anchorX + Math.sin(this.elapsed * cloud.speed + index) * cloud.drift;
      cloud.mesh.position.y += Math.sin(this.elapsed * 0.2 + index) * dt * 0.5;
      cloud.mesh.material.opacity = 0.08 + (1 - phase) * 0.09 + Math.sin(this.elapsed * cloud.speed) * 0.015;
    });

    this.auroraBands.forEach((band, index) => {
      band.visible = phase < 0.4;
      band.material.opacity = (1 - phase) * (0.08 + Math.sin(this.elapsed * 0.8 + index) * 0.03);
      band.rotation.z = -0.18 + Math.sin(this.elapsed * 0.3 + index) * 0.05;
      band.position.x = -22 + index * 22 + Math.sin(this.elapsed * 0.2 + index) * 8;
    });

    this.distantPeaks.children.forEach((peak, index) => {
      peak.position.y = 40 + Math.sin(this.elapsed * 0.16 + index * 0.8) * 2 + progressRatio * 10;
      peak.material.color.setRGB(
        0.05 + phase * 0.16,
        0.08 + phase * 0.05,
        0.1 - phase * 0.01
      );
    });
  }

  _updateEnvironment(snapshot) {
    const phase = snapshot.phaseRatio;
    const progressRatio = Math.min(1, snapshot.player.progressY / 100);
    const danger = snapshot.dangerLevel || 0;

    this.skyUniforms.topColor.value.setRGB(
      0.49 + (1 - phase) * 0.12,
      0.66 - phase * 0.18,
      0.84 - phase * 0.28
    );
    this.skyUniforms.horizonColor.value.setRGB(
      0.84 + phase * 0.08,
      0.93 - phase * 0.22,
      1 - phase * 0.34
    );
    this.skyUniforms.bottomColor.value.setRGB(
      0.03 + phase * 0.09,
      0.06 + phase * 0.02,
      0.1 - phase * 0.01
    );

    this.scene.fog.color.setRGB(
      0.05 + phase * 0.16,
      0.08 + phase * 0.03,
      0.12 - phase * 0.02
    );
    this.scene.fog.near = 18;
    this.scene.fog.far = 100 - phase * 22 - danger * 8;

    this.renderer.setClearColor(
      new THREE.Color().setRGB(
        0.05 + phase * 0.16,
        0.1 + phase * 0.02,
        0.15 - phase * 0.02
      )
    );

    this.materials.cliff.color.lerpColors(
      new THREE.Color(0xffffff),
      new THREE.Color(0x8c5a4a),
      phase * 0.42
    );
    this.materials.cliff.emissive = new THREE.Color(0x000000);
    this.materials.moltenFace.opacity = phase * 0.92;
    this.materials.moltenFace.emissiveIntensity = 0.6 + phase * 1.2 + danger * 0.2;
    this.materials.glacier.opacity = (1 - phase) * 0.24 + 0.04;

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
    this.summitAura.material.opacity = 0.28 + phase * 0.18 + Math.sin(this.elapsed * 1.8) * 0.05;
    this.summitAura.scale.set(18 + phase * 7, 18 + phase * 7, 1);
    this.summitGroup.position.y = Math.sin(this.elapsed * 0.35) * 0.3;

    this.ambientLight.intensity = 1.42 - phase * 0.12;
    this.ambientLight.groundColor.setRGB(0.12 + phase * 0.08, 0.16 + phase * 0.04, 0.18);
    this.keyLight.color.setRGB(0.85 + phase * 0.08, 0.94 - phase * 0.18, 1 - phase * 0.28);
    this.keyLight.intensity = 2.2 - phase * 0.18 + danger * 0.06;
    this.fillLight.intensity = 0.48 - phase * 0.14;
    this.lavaLight.intensity = 4 + phase * 13 + danger * 2.2;
    this.lavaLight.position.y = this._worldY(136 + snapshot.player.y * 0.4);
    this.summitLight.intensity = 4 + phase * 6;

    this.moonHalo.position.y = 148 + progressRatio * 12;
    this.moonDisk.position.y = this.moonHalo.position.y;
  }

  _updatePlayer(snapshot, dt) {
    const targetPosition = new THREE.Vector3(snapshot.player.x, snapshot.player.y, 1.5);
    this.playerRender.lerp(targetPosition, 1 - Math.exp(-dt * 7));
    this.playerGroup.position.copy(this.playerRender);

    const lateralSwing = snapshot.player.vx || 0;
    const climbPulse = Math.sin(this.elapsed * 7 + snapshot.player.y * 0.38) * 0.18;
    const sway = clamp(snapshot.player.x * 0.08 + lateralSwing * 0.008, -0.45, 0.45);

    this.playerGroup.rotation.z = -sway * 0.7;
    this.playerGroup.rotation.x = -0.16 + climbPulse * 0.08;

    this.leftArmPivot.rotation.x = 1.65 + climbPulse * 0.55;
    this.leftArmPivot.rotation.z = -0.38 - sway * 0.25;
    this.leftForearmPivot.rotation.x = -0.52 - climbPulse * 0.34;

    this.rightArmPivot.rotation.x = 1.42 - climbPulse * 0.45;
    this.rightArmPivot.rotation.z = 0.34 - sway * 0.22;
    this.rightForearmPivot.rotation.x = -0.44 + climbPulse * 0.24;

    this.leftLegPivot.rotation.x = 0.28 - climbPulse * 0.58;
    this.leftShinPivot.rotation.x = -0.32 + climbPulse * 0.44;
    this.rightLegPivot.rotation.x = 0.22 + climbPulse * 0.58;
    this.rightShinPivot.rotation.x = -0.28 - climbPulse * 0.38;

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

    if (snapshot.player.falling) {
      this.playerGroup.rotation.z = -0.92;
      this.playerGroup.rotation.x = -0.64;
      this.playerGroup.position.y -= snapshot.player.fallOffset;
      this.playerGroup.position.z += snapshot.player.fallOffset * 0.42;
      this.leftArmPivot.rotation.x = 2.2;
      this.rightArmPivot.rotation.x = 0.4;
      this.leftLegPivot.rotation.x = 0.8;
      this.rightLegPivot.rotation.x = -0.2;
    }

    this.harnessAnchor.updateMatrixWorld(true);
    const harnessPosition = this.harnessAnchor.getWorldPosition(this.tempVecA);
    this.root.worldToLocal(harnessPosition);
    const tetherAttr = this.tetherGeometry.attributes.position;
    tetherAttr.setXYZ(0, harnessPosition.x, harnessPosition.y, harnessPosition.z);
    tetherAttr.setXYZ(1, this.playerRender.x * 0.55, this.playerRender.y + 2.2, 1.1);
    tetherAttr.needsUpdate = true;
  }

  _updateRope(snapshot) {
    const attr = this.ropeGeometry.attributes.position;
    const ropeDepth = 1.16;
    const playerPullY = snapshot.player.y + 1.6;

    for (let index = 0; index < this.ropePointCount; index += 1) {
      const t = index / (this.ropePointCount - 1);
      const y = -10 + t * 254;
      const localPull = Math.exp(-Math.pow((y - playerPullY) / 18, 2));
      const x =
        Math.sin(t * Math.PI * 1.18 + this.elapsed * 0.9) * 0.14 +
        Math.sin(t * Math.PI * 4 + this.elapsed * 1.7) * 0.04 +
        snapshot.player.x * 0.16 * Math.sin(t * Math.PI) +
        snapshot.player.vx * 0.004 * localPull;
      const z =
        ropeDepth +
        Math.cos(t * Math.PI + this.elapsed * 0.7) * 0.05 +
        localPull * 0.18;

      this.ropePoints[index].set(x, y, z);
      attr.setXYZ(index, x, y, z);
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

    this.anchorNodes.forEach((node) => {
      node.ring.rotation.x = Math.PI / 2 + Math.sin(this.elapsed * 1.2 + node.baseY * 0.01) * 0.06;
      node.ring.rotation.y = Math.sin(this.elapsed * 0.9 + node.baseY * 0.008) * 0.14;
    });
  }

  _updateHazards(snapshot, dt) {
    const nextRockIds = new Set();
    snapshot.rocks.forEach((rock, index) => {
      nextRockIds.add(rock.id);
      let node = this.rockMeshes.get(rock.id);

      if (!node) {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.55, 0),
          new THREE.MeshStandardMaterial({
            map: this.materials.rock.map,
            color: 0x697782,
            roughness: 1,
            metalness: 0.06,
            flatShading: true
          })
        );
        core.castShadow = true;
        core.receiveShadow = true;
        group.add(core);

        const shell = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.75, 0),
          new THREE.MeshBasicMaterial({
            color: 0xfff0c6,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.BackSide
          })
        );
        group.add(shell);

        const trail = new THREE.Sprite(this.materials.trail.clone());
        trail.position.set(0, 1.8, -0.1);
        trail.scale.set(3.2, 5.6, 1);
        group.add(trail);

        const ember = new THREE.Sprite(this.materials.emberTrail.clone());
        ember.position.set(0, 1.0, 0.1);
        ember.scale.set(2.4, 2.4, 1);
        group.add(ember);

        const chips = [];
        for (let chipIndex = 0; chipIndex < 4; chipIndex += 1) {
          const chip = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.26 + chipIndex * 0.08, 0),
            core.material
          );
          chip.position.set(
            (Math.random() - 0.5) * 1.2,
            (Math.random() - 0.5) * 1.2,
            (Math.random() - 0.5) * 1.2
          );
          group.add(chip);
          chips.push(chip);
        }

        // landing telegraph on the slope
        const targetGeom = new THREE.RingGeometry(1.1, 1.45, 28);
        const targetMat = new THREE.MeshBasicMaterial({
          color: 0xffb070,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const target = new THREE.Mesh(targetGeom, targetMat);
        target.rotation.x = 0;
        this.dynamicHazards.add(target);

        const targetCore = new THREE.Mesh(
          new THREE.CircleGeometry(0.9, 24),
          new THREE.MeshBasicMaterial({
            color: 0xff6a3d,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        this.dynamicHazards.add(targetCore);

        this.dynamicHazards.add(group);
        node = { group, core, shell, trail, ember, chips, target, targetCore };
        this.rockMeshes.set(rock.id, node);
      }

      node.group.position.set(rock.x, rock.y, 1.9 + Math.sin(this.elapsed * 12 + index) * 0.2);
      node.group.scale.setScalar(rock.size * 1.25);
      node.group.rotation.x += (0.07 + rock.speed * 0.002) * dt * 60;
      node.group.rotation.y += 0.06 * dt * 60;
      node.group.rotation.z += 0.04 * dt * 60;
      node.core.material.color.setHex(rock.warning ? 0xaed6ea : 0x5f6e79);
      node.shell.material.opacity = rock.warning ? 0.32 + Math.sin(this.elapsed * 9) * 0.08 : 0.12;
      node.trail.material.opacity = rock.warning ? 0.32 : 0.44;
      node.trail.scale.set(rock.size * 2.6, rock.size * 4.2, 1);
      node.ember.material.opacity = snapshot.phaseRatio * 0.22;
      node.ember.scale.set(rock.size * 1.6, rock.size * 1.6, 1);

      node.chips.forEach((chip, chipIndex) => {
        chip.rotation.x += 0.03 + chipIndex * 0.02;
        chip.rotation.y += 0.05 + chipIndex * 0.03;
      });

      // telegraph marker tracks the landing lane at the player's current altitude
      const dy = Math.max(0, rock.y - snapshot.player.y);
      const timeToImpact = dy / Math.max(4, rock.speed);
      const urgency = clamp01(1 - timeToImpact / 2.4);
      const pulse = 0.7 + Math.sin(this.elapsed * (6 + urgency * 14)) * 0.25;
      const markerY = snapshot.player.y + 0.4;
      node.target.position.set(rock.x, markerY, 1.44);
      node.target.scale.setScalar(1 + (1 - urgency) * 1.2);
      node.target.material.opacity = (0.35 + urgency * 0.45) * pulse;
      node.target.material.color.setHex(urgency > 0.6 ? 0xff4a2a : 0xffb070);
      node.targetCore.position.set(rock.x, markerY, 1.43);
      node.targetCore.scale.setScalar(0.9 + urgency * 0.4);
      node.targetCore.material.opacity = 0.18 + urgency * 0.42;
      node.targetCore.material.color.setHex(urgency > 0.6 ? 0xff3020 : 0xff6a3d);
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
        const group = new THREE.Group();
        const back = new THREE.Mesh(new THREE.PlaneGeometry(28, 8), this.materials.avalanche.clone());
        const core = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.2), this.materials.avalancheCore.clone());
        const foam = new THREE.Mesh(new THREE.PlaneGeometry(30, 5.2), this.materials.avalanche.clone());
        foam.position.z = 0.6;
        core.position.z = 0.3;
        group.add(back);
        group.add(core);
        group.add(foam);
        this.avalancheGroup.add(group);
        node = { group, back, core, foam };
        this.avalancheMeshes.set(avalanche.id, node);
      }

      const sway = Math.sin(this.elapsed * 2.2 + index) * 0.6;
      node.group.position.set(sway, avalanche.y, 3.5);
      node.group.rotation.z = Math.sin(this.elapsed * 2.8 + index) * 0.07;
      node.back.scale.set(1, avalanche.heightScale * 1.16, 1);
      node.core.scale.set(1, avalanche.heightScale, 1);
      node.foam.scale.set(1, avalanche.heightScale * 0.88, 1);
      node.back.material.opacity = 0.14 + avalanche.intensity * 0.18;
      node.core.material.opacity = 0.08 + avalanche.intensity * 0.16;
      node.foam.material.opacity = 0.12 + avalanche.intensity * 0.16;
    });

    Array.from(this.avalancheMeshes.entries()).forEach(([id, node]) => {
      if (!nextAvalancheIds.has(id)) {
        this.avalancheGroup.remove(node.group);
        node.group.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            child.material.dispose();
          }
        });
        this.avalancheMeshes.delete(id);
      }
    });
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

    this.materials.snowFar.opacity = 0.18 + storm * 0.24 * (1 - phase * 0.22);
    this.materials.snowMid.opacity = 0.26 + storm * 0.4 * (1 - phase * 0.12);
    this.materials.snowNear.opacity = 0.34 + storm * 0.48;
    this.materials.ash.opacity = phase * (0.08 + storm * 0.22);

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
    const phase = snapshot.phaseRatio;
    const danger = snapshot.dangerLevel || 0;
    const shake = snapshot.cameraShake || 0;
    const progressRatio = Math.min(1, snapshot.player.progressY / 100);
    const playerWorldY = this._worldY(this.playerRender.y);
    const summitWorldY = this._worldY(this.summitFocusLocal.y);
    const spanY = Math.max(3.5, summitWorldY - playerWorldY);

    // Widen FOV slightly near the base so the whole mountain reads in one
    // glance; tighten it near the summit for a cinematic push-in.
    const desiredFov = 64 - progressRatio * 10;
    if (Math.abs(this.camera.fov - desiredFov) > 0.02) {
      this.camera.fov += (desiredFov - this.camera.fov) * Math.min(1, dt * 3.2);
      this.camera.updateProjectionMatrix();
    }

    const halfFovRad = (this.camera.fov * Math.PI / 180) / 2;
    const tanHalf = Math.tan(halfFovRad);

    // Where to aim: a point biased toward the summit so the peak sits in the
    // upper third of the frame. The player is always below the look point.
    // Capped so we never overshoot the actual peak near the end of the climb.
    const lookBias = 0.58 + progressRatio * 0.1;
    const lookY = Math.min(summitWorldY + 0.6, playerWorldY + spanY * lookBias);
    const lookZ = 1.2 + (summitWorldY - lookY) * 0.02;

    // Required horizontal distance so both player and peak fit vertically,
    // with margin. Derived from: (max angular offset) = atan(d / D), then
    // solved for D using the screen-space target position.
    const playerAngularSpan = lookY - playerWorldY;           // distance from look target down to player
    const summitAngularSpan = Math.max(0.5, summitWorldY + 3 - lookY);  // up to peak plus headroom for flag/aura
    // Player should sit at ~0.85 of half-FOV below centre; peak at ~0.55 above.
    const distForPlayer = playerAngularSpan / (0.86 * tanHalf);
    const distForPeak = summitAngularSpan / (0.55 * tanHalf);
    const framingDistance = Math.max(distForPlayer, distForPeak);

    // Near the summit, hold a minimum distance so the peak still looms without
    // the camera clipping into geometry.
    const minDistance = 16 + (1 - progressRatio) * 6;
    const rawDistance = Math.max(minDistance, framingDistance);
    // Soft-cap distance so early game doesn't push the camera past the fog.
    const distance = Math.min(rawDistance, 140);

    // Camera sits below the look target so the view pitches up the slope.
    // As the climber approaches the peak, pitch flattens for the summit shot.
    const pitchDrop = spanY * (0.18 - progressRatio * 0.06);
    const cameraY = lookY - Math.max(4, pitchDrop);

    const targetPosition = this.tempVecA.set(
      this.playerRender.x * 0.32 + Math.sin(this.elapsed * 0.4) * 0.2,
      cameraY - danger * 0.4,
      distance + Math.sin(this.elapsed * 0.6) * 0.22
    );
    const targetLook = this.tempVecB.set(
      this.playerRender.x * 0.12,
      lookY + phase * 0.8,
      lookZ
    );

    this.camera.position.lerp(targetPosition, 1 - Math.exp(-dt * 3.2));
    this.cameraTarget.lerp(targetLook, 1 - Math.exp(-dt * 3.6));

    this.camera.position.x += Math.sin(this.elapsed * 23) * shake * 0.16;
    this.camera.position.y += Math.cos(this.elapsed * 19) * shake * 0.24;
    this.camera.position.z += Math.sin(this.elapsed * 21) * shake * 0.12;

    this.camera.lookAt(this.cameraTarget);
    this.camera.rotation.z = -snapshot.player.x * 0.012 - (snapshot.player.vx || 0) * 0.0018 + Math.sin(this.elapsed * 0.9) * 0.004;
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
