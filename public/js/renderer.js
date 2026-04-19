class AscentRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc9deeb);
    this.scene.fog = new THREE.Fog(0xb6ccdc, 18, 92);

    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 240);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.clock = new THREE.Clock();
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.hazardEntries = [];
    this.currentHazardKey = '';
    this.lastFootprintUnit = -1;
    this.nextFootprintIndex = 0;
    this.footprints = [];
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraPosition = new THREE.Vector3(2.8, 2.15, -8.2);
    this.playerWorldPosition = new THREE.Vector3();
    this.anchorPosition = new THREE.Vector3();

    this._createMaterials();
    this._buildLights();
    this._buildWorld();
    this._buildParticles();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _createMaterials() {
    this.mountainMaterial = new THREE.MeshStandardMaterial({
      color: 0xdde6ef,
      roughness: 0.96,
      metalness: 0.02
    });
    this.darkMountainMaterial = new THREE.MeshStandardMaterial({
      color: 0x31414d,
      roughness: 0.96,
      metalness: 0.02
    });
    this.laneMaterials = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({
      color: 0xd7e3eb,
      emissive: 0x0a1420,
      emissiveIntensity: 0.24,
      roughness: 0.7,
      metalness: 0.05
    }));
    this.ropeMaterial = new THREE.LineBasicMaterial({ color: 0xe7d6b0, transparent: true, opacity: 0.84 });
    this.playerBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x264762, roughness: 0.62, metalness: 0.08 });
    this.playerAccentMaterial = new THREE.MeshStandardMaterial({ color: 0xf5a34d, roughness: 0.48, metalness: 0.12 });
    this.playerSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xf2dac0, roughness: 0.66, metalness: 0.02 });
    this.playerBootMaterial = new THREE.MeshStandardMaterial({ color: 0x1c232d, roughness: 0.84, metalness: 0.08 });
    this.rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x574d46,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x120d09,
      emissiveIntensity: 0.28
    });
    this.avalancheMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f6fb,
      transparent: true,
      opacity: 0.42,
      roughness: 0.6,
      metalness: 0.02
    });
    this.footprintMaterial = new THREE.MeshBasicMaterial({
      color: 0x5c6d77,
      transparent: true,
      opacity: 0.34
    });
    this.summitMaterial = new THREE.MeshStandardMaterial({
      color: 0xcfdbe4,
      roughness: 0.9,
      metalness: 0.04
    });
    this.volcanoMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2424,
      emissive: 0x6d2d17,
      emissiveIntensity: 0.6,
      roughness: 0.84,
      metalness: 0.08
    });
    this.craterGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7d2f,
      transparent: true,
      opacity: 0.42
    });
  }

  _buildLights() {
    this.ambientLight = new THREE.HemisphereLight(0xeaf6ff, 0x172433, 0.95);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.sunLight.position.set(12, 18, -6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 140;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -22;
    this.sunLight.shadow.bias = -0.0007;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x8cd0ff, 0.46);
    this.rimLight.position.set(-10, 8, 10);
    this.scene.add(this.rimLight);

    this.lavaLight = new THREE.PointLight(0xff6b2d, 0.3, 42, 1.7);
    this.lavaLight.position.set(0, 26, 74);
    this.scene.add(this.lavaLight);
  }

  _buildWorld() {
    const skyShell = new THREE.Mesh(
      new THREE.SphereGeometry(120, 32, 16),
      new THREE.MeshBasicMaterial({
        color: 0xe9f3fb,
        side: THREE.BackSide
      })
    );
    this.root.add(skyShell);
    this.skyShell = skyShell;

    const slope = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 146), this.mountainMaterial);
    slope.position.set(0, -4.4, 24);
    slope.rotation.x = -0.58;
    slope.receiveShadow = true;
    this.root.add(slope);
    this.slope = slope;

    const ridgeLeft = new THREE.Mesh(new THREE.BoxGeometry(10, 24, 146), this.darkMountainMaterial);
    ridgeLeft.position.set(-11.5, 0.5, 24);
    ridgeLeft.rotation.x = -0.58;
    ridgeLeft.castShadow = true;
    ridgeLeft.receiveShadow = true;
    this.root.add(ridgeLeft);

    const ridgeRight = ridgeLeft.clone();
    ridgeRight.position.x = 11.5;
    this.root.add(ridgeRight);

    this.laneMeshes = [];
    for (let lane = 0; lane < 3; lane += 1) {
      const laneMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.14, 112),
        this.laneMaterials[lane]
      );
      laneMesh.position.set(LANE_WORLD_X[lane] * 1.95, -1.05, 23);
      laneMesh.rotation.x = -0.58;
      laneMesh.castShadow = true;
      laneMesh.receiveShadow = true;
      this.root.add(laneMesh);
      this.laneMeshes.push(laneMesh);
    }

    const laneGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 94),
      new THREE.MeshBasicMaterial({
        color: 0xd8edf9,
        transparent: true,
        opacity: 0.06
      })
    );
    laneGlow.position.set(0, 0.2, 24);
    laneGlow.rotation.x = -Math.PI / 2 + 0.58;
    this.root.add(laneGlow);

    const summit = new THREE.Mesh(new THREE.ConeGeometry(12, 18, 8), this.summitMaterial);
    summit.position.set(0, 30, 84);
    summit.castShadow = true;
    summit.receiveShadow = true;
    this.root.add(summit);
    this.summit = summit;

    const volcanoCone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 9, 12), this.volcanoMaterial);
    volcanoCone.position.set(0, 27.8, 80);
    volcanoCone.castShadow = true;
    volcanoCone.receiveShadow = true;
    this.root.add(volcanoCone);
    this.volcanoCone = volcanoCone;

    const craterGlow = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.18, 32), this.craterGlowMaterial);
    craterGlow.position.set(0, 31.8, 80);
    this.root.add(craterGlow);
    this.craterGlow = craterGlow;

    this.hazardGroup = new THREE.Group();
    this.root.add(this.hazardGroup);

    this.footprintGroup = new THREE.Group();
    this.root.add(this.footprintGroup);
    for (let index = 0; index < 48; index += 1) {
      const footprint = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.38), this.footprintMaterial.clone());
      footprint.visible = false;
      this.footprintGroup.add(footprint);
      this.footprints.push(footprint);
    }

    this._buildPlayer();
    this._buildRope();
  }

  _buildPlayer() {
    this.playerGroup = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.18, 10), this.playerBodyMaterial);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.playerGroup.add(torso);
    this.playerTorso = torso;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.34), this.playerAccentMaterial);
    chest.position.set(0, 1.32, 0.08);
    chest.castShadow = true;
    this.playerGroup.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), this.playerSkinMaterial);
    head.position.set(0, 1.95, 0.02);
    head.castShadow = true;
    this.playerGroup.add(head);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.22), this.playerAccentMaterial);
    backpack.position.set(0, 1.2, -0.25);
    backpack.castShadow = true;
    this.playerGroup.add(backpack);

    this.playerLeftArm = this._createLimb(0.1, 0.58, this.playerBodyMaterial);
    this.playerLeftArm.position.set(-0.37, 1.42, 0.02);
    this.playerLeftArm.rotation.z = 0.34;
    this.playerGroup.add(this.playerLeftArm);

    this.playerRightArm = this._createLimb(0.1, 0.58, this.playerBodyMaterial);
    this.playerRightArm.position.set(0.37, 1.42, 0.02);
    this.playerRightArm.rotation.z = -0.34;
    this.playerGroup.add(this.playerRightArm);

    this.playerLeftLeg = this._createLimb(0.12, 0.72, this.playerBootMaterial);
    this.playerLeftLeg.position.set(-0.16, 0.45, 0.04);
    this.playerGroup.add(this.playerLeftLeg);

    this.playerRightLeg = this._createLimb(0.12, 0.72, this.playerBootMaterial);
    this.playerRightLeg.position.set(0.16, 0.45, -0.02);
    this.playerGroup.add(this.playerRightLeg);

    this.root.add(this.playerGroup);
  }

  _createLimb(radius, height, material) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), material);
    limb.castShadow = true;
    return limb;
  }

  _buildRope() {
    this.ropeGeometry = new THREE.BufferGeometry();
    this.ropeLine = new THREE.Line(this.ropeGeometry, this.ropeMaterial);
    this.root.add(this.ropeLine);
  }

  _buildParticles() {
    this.snowField = this._createParticleField(260, 0xffffff, 0.1, 10, 8, 26, 0.54);
    this.ashField = this._createParticleField(140, 0xff7d3b, 0.12, 10, 8, 22, 0.24);
  }

  _createParticleField(count, color, size, spreadX, spreadY, spreadZ, opacity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const i3 = index * 3;
      positions[i3] = randomBetween(-spreadX, spreadX);
      positions[i3 + 1] = randomBetween(-spreadY, spreadY);
      positions[i3 + 2] = randomBetween(-spreadZ, spreadZ);
      speeds[index] = randomBetween(0.8, 2.4);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    this.root.add(points);

    return {
      count,
      spreadX,
      spreadY,
      spreadZ,
      points,
      geometry,
      positions,
      speeds,
      material
    };
  }

  _syncHazards(snapshot) {
    if (!snapshot.hazardSignature) {
      while (this.hazardGroup.children.length) {
        this.hazardGroup.remove(this.hazardGroup.children[0]);
      }
      this.hazardEntries = [];
      this.currentHazardKey = '';
      return;
    }

    if (this.currentHazardKey === snapshot.hazardSignature) {
      return;
    }

    while (this.hazardGroup.children.length) {
      this.hazardGroup.remove(this.hazardGroup.children[0]);
    }
    this.hazardEntries = [];
    this.currentHazardKey = snapshot.hazardSignature;

    const hazard = snapshot.hazard;
    if (!hazard) {
      return;
    }

    hazard.waves.forEach((wave, waveIndex) => {
      if (wave.kind === 'rock') {
        wave.lanes.forEach((lane) => {
          const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), this.rockMaterial.clone());
          rock.castShadow = true;
          rock.receiveShadow = true;
          this.hazardGroup.add(rock);
          this.hazardEntries.push({ mesh: rock, waveIndex, lane, kind: 'rock' });
        });
        return;
      }

      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(8.8, 5.6, 1, 1),
        this.avalancheMaterial.clone()
      );
      wall.rotation.x = -0.08;
      this.hazardGroup.add(wall);
      this.hazardEntries.push({ mesh: wall, waveIndex, lane: 1, kind: 'avalanche' });
    });
  }

  _pathPosition(progressUnits, lateralOffset) {
    const position = new THREE.Vector3(
      lateralOffset * 1.95,
      -0.8 + progressUnits * 1.9,
      -24 + progressUnits * 5.4
    );
    return position;
  }

  _dropFootprint(pathPosition, lateralOffset, progressUnits, biomeMix) {
    const footprint = this.footprints[this.nextFootprintIndex];
    this.nextFootprintIndex = (this.nextFootprintIndex + 1) % this.footprints.length;

    const strideSide = (this.nextFootprintIndex % 2 === 0 ? 1 : -1) * 0.12;
    footprint.visible = true;
    footprint.position.set(
      (lateralOffset * 1.95) + strideSide,
      pathPosition.y - 0.7,
      pathPosition.z - 0.1
    );
    footprint.rotation.x = -0.58;
    footprint.rotation.y = randomBetween(-0.25, 0.25);
    footprint.scale.set(lerp(1, 0.72, biomeMix), 1, lerp(1, 0.7, biomeMix));
    footprint.material.opacity = lerp(0.32, 0.15, biomeMix) + (Math.sin(progressUnits) * 0.04);
  }

  _updateRope(playerPosition, snapshot) {
    const anchorBase = this._pathPosition(Math.max(0, (playerPosition.z + 24) / 5.4 + 2.4), 0);
    this.anchorPosition.set(anchorBase.x, anchorBase.y + 4.4, anchorBase.z + 7.2);

    const swingSag = (snapshot.swingIntensity || 0) * 0.42;
    const deathSag = snapshot.state === 'dead' ? Math.min(2.4, (snapshot.deathElapsedMs || 0) / 1000 * 1.5) : 0;
    const sagAmount = 1.15 + swingSag + deathSag;
    const points = [];
    const handPosition = playerPosition.clone().add(new THREE.Vector3(
      (snapshot.lateralVelocity || 0) * 0.02 + ((snapshot.emergencyLedgeActive ? snapshot.ledgeSide : 0) * 0.18),
      1.5,
      0.12
    ));
    for (let index = 0; index < 6; index += 1) {
      const t = index / 5;
      const point = new THREE.Vector3().lerpVectors(this.anchorPosition, handPosition, t);
      point.y -= Math.sin(t * Math.PI) * sagAmount;
      if (snapshot.state === 'dead') {
        point.z -= Math.sin(t * Math.PI) * 0.65;
      }
      points.push(point);
    }
    this.ropeGeometry.setFromPoints(points);
  }

  _updateParticles(field, playerPosition, deltaSeconds, driftX, driftY, driftZ) {
    const { positions, speeds, geometry, spreadX, spreadY, spreadZ, count } = field;
    field.points.position.copy(playerPosition);

    for (let index = 0; index < count; index += 1) {
      const i3 = index * 3;
      positions[i3] += driftX * speeds[index] * deltaSeconds;
      positions[i3 + 1] += driftY * speeds[index] * deltaSeconds;
      positions[i3 + 2] += driftZ * speeds[index] * deltaSeconds;

      if (positions[i3] < -spreadX) positions[i3] = spreadX;
      if (positions[i3] > spreadX) positions[i3] = -spreadX;
      if (positions[i3 + 1] < -spreadY) positions[i3 + 1] = spreadY;
      if (positions[i3 + 1] > spreadY) positions[i3 + 1] = -spreadY;
      if (positions[i3 + 2] < -spreadZ) positions[i3 + 2] = spreadZ;
      if (positions[i3 + 2] > spreadZ) positions[i3 + 2] = -spreadZ;
    }

    geometry.attributes.position.needsUpdate = true;
  }

  render(snapshot, deltaSeconds) {
    const time = this.clock.getElapsedTime();
    const biomeMix = snapshot.biomeMix || 0;
    const swingIntensity = snapshot.swingIntensity || 0;
    const emergencyLedgeActive = Boolean(snapshot.emergencyLedgeActive);
    const visibilityLoss = 1 - (snapshot.visibilityClarity || 1);
    const deathSeconds = (snapshot.deathElapsedMs || 0) / 1000;
    const fogNear = lerp(20, 14, snapshot.stormStrength || 0);
    const fogFar = lerp(92, 54, clamp((snapshot.stormStrength || 0) * 0.7 + (snapshot.ashStrength || 0), 0, 1));

    this.scene.background.lerpColors(
      new THREE.Color(0xc9deeb),
      new THREE.Color(0x3a2626),
      biomeMix
    );
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.near = fogNear;
    this.scene.fog.far = fogFar;

    this.ambientLight.intensity = lerp(1.0, 0.62, biomeMix);
    this.sunLight.intensity = lerp(1.35, 0.78, biomeMix);
    this.rimLight.intensity = lerp(0.46, 0.26, biomeMix);
    this.lavaLight.intensity = lerp(0.3, 2.1, biomeMix);
    this.craterGlow.material.opacity = lerp(0.12, 0.6, biomeMix);

    this.mountainMaterial.color.lerpColors(new THREE.Color(0xdde6ef), new THREE.Color(0x665753), biomeMix);
    this.darkMountainMaterial.color.lerpColors(new THREE.Color(0x31414d), new THREE.Color(0x241d1e), biomeMix);
    this.summitMaterial.color.lerpColors(new THREE.Color(0xcfdbe4), new THREE.Color(0x73584e), biomeMix);
    this.volcanoCone.material.emissiveIntensity = lerp(0.6, 1.35, biomeMix);

    const pathPosition = this._pathPosition(snapshot.visualProgressUnits || 0, snapshot.lateralOffset || 0);
    this.playerWorldPosition.copy(pathPosition);

    const climbBob = snapshot.state === 'movement'
      ? Math.sin(time * lerp(7.6, 9.1, swingIntensity)) * lerp(0.08, 0.16, swingIntensity)
      : Math.sin(time * 2.2) * 0.03;
    this.playerGroup.position.copy(pathPosition);
    this.playerGroup.position.y += climbBob;
    if (snapshot.state === 'dead') {
      this.playerGroup.position.y -= Math.min(7.2, deathSeconds * 2.6);
      this.playerGroup.position.z -= deathSeconds * 1.25;
      this.playerGroup.position.x += Math.sin(deathSeconds * 3.4) * 0.34;
    }
    this.playerGroup.rotation.z = clamp(
      -((snapshot.lateralVelocity || 0) * 0.065) + (emergencyLedgeActive ? (snapshot.ledgeSide || 0) * 0.28 : 0),
      -0.62,
      0.62
    );
    this.playerGroup.rotation.x = snapshot.state === 'dead'
      ? 1.05 + Math.min(0.56, deathSeconds * 0.4)
      : -0.08 - (swingIntensity * 0.08);
    this.playerTorso.rotation.x = snapshot.state === 'movement' ? -0.14 - (swingIntensity * 0.12) : -0.02;

    const gripIntensity = emergencyLedgeActive ? 1 : swingIntensity;
    const armCycle = time * lerp(7.5, 9.4, swingIntensity);
    const legCycle = time * lerp(7.5, 8.6, swingIntensity);
    this.playerLeftArm.rotation.x = (-0.44 * gripIntensity) + (Math.sin(armCycle) * lerp(0.28, 0.12, gripIntensity));
    this.playerRightArm.rotation.x = (-0.44 * gripIntensity) - (Math.sin(armCycle) * lerp(0.28, 0.12, gripIntensity));
    this.playerLeftArm.rotation.z = lerp(0.34, 0.58, gripIntensity);
    this.playerRightArm.rotation.z = -lerp(0.34, 0.58, gripIntensity);
    this.playerLeftLeg.rotation.x = snapshot.state === 'dead'
      ? -0.38 - (Math.sin(deathSeconds * 4.2) * 0.18)
      : -(Math.sin(legCycle) * lerp(0.34, 0.22, gripIntensity));
    this.playerRightLeg.rotation.x = snapshot.state === 'dead'
      ? 0.38 + (Math.sin(deathSeconds * 4.2) * 0.18)
      : Math.sin(legCycle) * lerp(0.34, 0.22, gripIntensity);

    this._updateRope(this.playerGroup.position, snapshot);

    const hazardSafeLanes = snapshot.hazard
      ? [0, 1, 2].filter((lane) => !snapshot.hazard.waves.some((wave) => wave.lanes.includes(lane)))
      : [0, 1, 2];

    this.laneMeshes.forEach((laneMesh, lane) => {
      const material = this.laneMaterials[lane];
      const isSelected = lane === snapshot.selectedLane;
      const isCurrent = lane === snapshot.currentLane;
      const isSafe = hazardSafeLanes.includes(lane);

      material.color.lerpColors(
        new THREE.Color(0xd7e3eb),
        new THREE.Color(0x6f4739),
        biomeMix
      );
      material.emissive.setHex(
        isSelected
          ? 0xffb55a
          : isCurrent
            ? 0x6fb1ff
            : isSafe
              ? 0x12303a
              : 0x5a1e17
      );
      material.emissiveIntensity = isSelected ? 0.62 : isCurrent ? 0.4 : isSafe ? 0.18 : 0.34;
    });

    this._syncHazards(snapshot);
    this.hazardEntries.forEach((entry) => {
      const wave = snapshot.hazard?.waves?.[entry.waveIndex];
      if (!wave) {
        entry.mesh.visible = false;
        return;
      }

      if (entry.kind === 'rock') {
        const progress = clamp(snapshot.hazardElapsedMs / Math.max(wave.impactMs, 1), 0, 1.24);
        const travel = lerp(16, -2.4, progress);
        entry.mesh.visible = progress <= 1.16;
        entry.mesh.position.set(
          LANE_WORLD_X[entry.lane] * 1.95,
          pathPosition.y + 2 + (travel * 0.35),
          pathPosition.z + travel
        );
        entry.mesh.rotation.x += deltaSeconds * 4.2;
        entry.mesh.rotation.y += deltaSeconds * 3.1;
        entry.mesh.scale.setScalar(entry.mesh.visible ? 1 : 0.001);
        return;
      }

      const progress = clamp(snapshot.hazardElapsedMs / Math.max(wave.impactMs, 1), 0, 1.15);
      const travel = lerp(20, -2, progress);
      entry.mesh.visible = progress <= 1.05;
      entry.mesh.position.set(0, pathPosition.y + 3.6 + (travel * 0.2), pathPosition.z + travel);
      entry.mesh.rotation.y = Math.sin(time * 0.9) * 0.08;
      entry.mesh.material.opacity = 0.28 + (Math.sin(time * 6.5) * 0.04);
    });

    const currentFootprintUnit = Math.floor((snapshot.visualProgressUnits || 0) * 2);
    if (currentFootprintUnit > this.lastFootprintUnit) {
      this.lastFootprintUnit = currentFootprintUnit;
      this._dropFootprint(pathPosition, snapshot.lateralOffset || 0, snapshot.visualProgressUnits || 0, biomeMix);
    }

    this.snowField.material.opacity = lerp(0.34, 0.08, biomeMix) + ((snapshot.stormStrength || 0) * 0.18) + (visibilityLoss * 0.04);
    this.ashField.material.opacity = lerp(0, 0.36, snapshot.ashStrength || 0) + (visibilityLoss * 0.06);
    this._updateParticles(this.snowField, pathPosition, deltaSeconds, -1.4, -0.7, 0.8);
    this._updateParticles(this.ashField, pathPosition, deltaSeconds, -1.1, -0.2, 1.1);

    const cameraFocus = this.playerGroup.position.clone();
    const desiredTarget = cameraFocus.clone().add(
      snapshot.state === 'dead'
        ? new THREE.Vector3(0, 0.8, 2.9)
        : new THREE.Vector3(0, 1.05, 4.5)
    );
    const desiredCamera = cameraFocus.clone().add(
      snapshot.state === 'dead'
        ? new THREE.Vector3(5.3, 3.7, -3.8)
        : new THREE.Vector3(
          2.95 + ((snapshot.lateralVelocity || 0) * 0.018),
          2.18 + (visibilityLoss * 0.28),
          -8.55
        )
    );

    this.cameraTarget.lerp(desiredTarget, 0.08);
    this.cameraPosition.lerp(desiredCamera, 0.08);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);

    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
