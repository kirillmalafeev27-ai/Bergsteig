class MountainRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc7e6fa);
    this.scene.fog = new THREE.Fog(0xd7ebf6, 20, 92);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.clock = new THREE.Clock();
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.cameraPosition = new THREE.Vector3(0, 3.2, 10.2);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.rockMeshes = new Map();

    this._createMaterials();
    this._buildLights();
    this._buildWorld();
    this._buildPlayer();
    this._buildParticles();

    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _createMaterials() {
    this.mountainMaterial = new THREE.MeshStandardMaterial({
      color: 0xe4eff7,
      roughness: 0.92,
      metalness: 0.02
    });
    this.shadowMaterial = new THREE.MeshStandardMaterial({
      color: 0x516879,
      roughness: 1,
      metalness: 0.02
    });
    this.rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x605952,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x18110d,
      emissiveIntensity: 0.24
    });
    this.playerBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x294d66,
      roughness: 0.56,
      metalness: 0.08
    });
    this.playerAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4a75b,
      roughness: 0.44,
      metalness: 0.12
    });
    this.playerSkinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1dac1,
      roughness: 0.68,
      metalness: 0.02
    });
    this.playerBootMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b232d,
      roughness: 0.88,
      metalness: 0.08
    });
  }

  _buildLights() {
    this.ambientLight = new THREE.HemisphereLight(0xeef7ff, 0x1d2732, 0.96);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.3);
    this.sunLight.position.set(14, 18, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 160;
    this.sunLight.shadow.camera.left = -18;
    this.sunLight.shadow.camera.right = 18;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.bias = -0.0007;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0x94d8ff, 0.4);
    this.fillLight.position.set(-10, 8, 10);
    this.scene.add(this.fillLight);
  }

  _buildWorld() {
    const skyShell = new THREE.Mesh(
      new THREE.SphereGeometry(130, 36, 18),
      new THREE.MeshBasicMaterial({
        color: 0xe8f5ff,
        side: THREE.BackSide
      })
    );
    this.root.add(skyShell);

    const mountainGeometry = new THREE.PlaneGeometry(26, 170, 34, 120);
    const positions = mountainGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const noise = (Math.sin(y * 0.12) * 0.44) + (Math.cos(x * 0.7 + y * 0.08) * 0.22);
      const ridge = Math.pow(Math.abs(x) / 12, 1.45) * 2.2;
      positions.setZ(index, noise - ridge);
    }
    mountainGeometry.computeVertexNormals();

    const mountain = new THREE.Mesh(mountainGeometry, this.mountainMaterial);
    mountain.rotation.x = -1.12;
    mountain.position.set(0, -16, -64);
    mountain.receiveShadow = true;
    mountain.castShadow = true;
    this.root.add(mountain);
    this.mountain = mountain;

    const cliffLeft = new THREE.Mesh(new THREE.BoxGeometry(8, 34, 144), this.shadowMaterial);
    cliffLeft.position.set(-14.2, 3.4, -34);
    cliffLeft.rotation.x = -0.5;
    cliffLeft.castShadow = true;
    cliffLeft.receiveShadow = true;
    this.root.add(cliffLeft);

    const cliffRight = cliffLeft.clone();
    cliffRight.position.x = 14.2;
    this.root.add(cliffRight);

    const ridge = new THREE.Mesh(new THREE.ConeGeometry(15, 18, 9), this.shadowMaterial.clone());
    ridge.position.set(0, 40, -116);
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    this.root.add(ridge);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 6), this.mountainMaterial.clone());
    crest.position.set(0, 33.6, -102);
    crest.rotation.z = 0.06;
    crest.castShadow = true;
    crest.receiveShadow = true;
    this.root.add(crest);

    this.rockGroup = new THREE.Group();
    this.root.add(this.rockGroup);
  }

  _buildPlayer() {
    this.playerGroup = new THREE.Group();

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.34, 10), this.playerBodyMaterial);
    torso.position.y = 1.2;
    torso.castShadow = true;
    this.playerGroup.add(torso);
    this.playerTorso = torso;

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.34), this.playerAccentMaterial);
    chest.position.set(0, 1.36, 0.1);
    chest.castShadow = true;
    this.playerGroup.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), this.playerSkinMaterial);
    head.position.set(0, 2.12, 0.04);
    head.castShadow = true;
    this.playerGroup.add(head);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.28), this.playerAccentMaterial);
    backpack.position.set(0, 1.28, -0.3);
    backpack.castShadow = true;
    this.playerGroup.add(backpack);

    this.playerLeftArm = this._createLimb(0.11, 0.68, this.playerBodyMaterial);
    this.playerLeftArm.position.set(-0.42, 1.5, 0.02);
    this.playerGroup.add(this.playerLeftArm);

    this.playerRightArm = this._createLimb(0.11, 0.68, this.playerBodyMaterial);
    this.playerRightArm.position.set(0.42, 1.5, 0.02);
    this.playerGroup.add(this.playerRightArm);

    this.playerLeftLeg = this._createLimb(0.12, 0.86, this.playerBootMaterial);
    this.playerLeftLeg.position.set(-0.18, 0.48, 0.08);
    this.playerGroup.add(this.playerLeftLeg);

    this.playerRightLeg = this._createLimb(0.12, 0.86, this.playerBootMaterial);
    this.playerRightLeg.position.set(0.18, 0.48, -0.02);
    this.playerGroup.add(this.playerRightLeg);

    this.root.add(this.playerGroup);
  }

  _createLimb(radius, height, material) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), material);
    limb.castShadow = true;
    return limb;
  }

  _buildParticles() {
    this.snowField = this._createParticleField(260, 0xffffff, 0.11, 13, 9, 24, 0.44);
    this.dustField = this._createParticleField(110, 0xdad4cf, 0.12, 12, 7, 18, 0.18);
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

    return { count, spreadX, spreadY, spreadZ, geometry, positions, speeds, points, material };
  }

  _mountainPoint(progress, lateral) {
    return new THREE.Vector3(
      lateral * 3.2,
      -2.2 + (progress * 0.92) + Math.sin(progress * 0.22) * 0.18,
      16 - (progress * 3.12) + Math.cos(progress * 0.14 + lateral) * 0.14
    );
  }

  _syncRocks(rocks) {
    const nextIds = new Set(rocks.map((rock) => rock.id));

    Array.from(this.rockMeshes.keys()).forEach((id) => {
      if (nextIds.has(id)) {
        return;
      }
      const mesh = this.rockMeshes.get(id);
      this.rockGroup.remove(mesh);
      this.rockMeshes.delete(id);
    });

    rocks.forEach((rock) => {
      if (this.rockMeshes.has(rock.id)) {
        return;
      }
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.84, 0), this.rockMaterial.clone());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.rockGroup.add(mesh);
      this.rockMeshes.set(rock.id, mesh);
    });
  }

  _updateParticles(field, anchor, deltaSeconds, driftX, driftY, driftZ) {
    field.points.position.copy(anchor);
    const { positions, speeds, spreadX, spreadY, spreadZ, geometry, count } = field;
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
    const pressure = snapshot.pressure || 0;
    const accent = new THREE.Color(snapshot.themeAccent || '#9fdcff');
    const cold = new THREE.Color(0xc7e6fa);
    const mist = new THREE.Color(0xecf6ff);

    this.scene.background.copy(cold.clone().lerp(accent, 0.14));
    this.scene.fog.color.copy(mist.clone().lerp(accent, 0.1));
    this.scene.fog.near = 20 - (pressure * 2);
    this.scene.fog.far = 92 - (pressure * 18);
    this.ambientLight.intensity = 0.96 - (pressure * 0.08);
    this.sunLight.intensity = 1.28 - (pressure * 0.18);
    this.fillLight.intensity = 0.38 + (pressure * 0.08);

    this.mountainMaterial.color.copy(new THREE.Color(0xe4eff7).lerp(accent, 0.08));

    const playerPos = this._mountainPoint(snapshot.playerProgress || 0, snapshot.playerLateral || 0);
    const movePulse = snapshot.isMoving ? 1 : 0;
    const climbBob = movePulse ? Math.sin(time * 10.4) * 0.08 : Math.sin(time * 2.4) * 0.02;
    this.playerGroup.position.copy(playerPos);
    this.playerGroup.position.y += climbBob;

    if (snapshot.isDead) {
      const fallSeconds = (snapshot.deathElapsedMs || 0) / 1000;
      this.playerGroup.position.y -= Math.min(7.4, fallSeconds * 3.2);
      this.playerGroup.position.z += fallSeconds * 1.4;
      this.playerGroup.position.x += Math.sin(fallSeconds * 3.2) * 0.38;
    }

    this.playerGroup.rotation.x = snapshot.isDead ? 0.92 : -0.24;
    this.playerGroup.rotation.z = clamp(-(snapshot.playerLateralVelocity || 0) * 0.08, -0.46, 0.46);
    this.playerTorso.rotation.x = snapshot.isDead ? 0.42 : -0.14;

    const actionBias = snapshot.moveDirection === 'left'
      ? -1
      : snapshot.moveDirection === 'right'
        ? 1
        : 0;
    const stride = movePulse ? Math.sin(time * 10.2) : Math.sin(time * 3.2) * 0.1;
    this.playerLeftArm.rotation.x = -0.3 + (stride * 0.24);
    this.playerRightArm.rotation.x = -0.3 - (stride * 0.24);
    this.playerLeftArm.rotation.z = 0.26 - (actionBias * 0.12);
    this.playerRightArm.rotation.z = -0.26 - (actionBias * 0.12);
    this.playerLeftLeg.rotation.x = -stride * 0.34;
    this.playerRightLeg.rotation.x = stride * 0.34;

    this._syncRocks(snapshot.rocks || []);
    (snapshot.rocks || []).forEach((rock) => {
      const mesh = this.rockMeshes.get(rock.id);
      if (!mesh) {
        return;
      }
      const position = this._mountainPoint(rock.progress, rock.lateral + ((1 - clamp((rock.progress - snapshot.playerProgress) / 14, 0, 1)) * rock.entryBias * 0.08));
      mesh.position.copy(position);
      mesh.position.y += 0.9 + (Math.sin(time * 8 + rock.id) * 0.06);
      mesh.scale.setScalar(rock.size);
      mesh.rotation.x = rock.rotation * rock.spinX * 0.08;
      mesh.rotation.y = rock.rotation * rock.spinY * 0.08;
      mesh.rotation.z = rock.rotation * 0.14;
    });

    this.snowField.material.opacity = 0.24 + (pressure * 0.18);
    this.dustField.material.opacity = 0.06 + (pressure * 0.24);
    this._updateParticles(this.snowField, playerPos, deltaSeconds, -1.2, -0.46, 0.72);
    this._updateParticles(this.dustField, playerPos, deltaSeconds, -0.84, -0.22, 0.46);

    const target = playerPos.clone().add(snapshot.isDead ? new THREE.Vector3(0, 0.5, -1.4) : new THREE.Vector3(0, 0.95, -4.9));
    const desiredCamera = playerPos.clone().add(
      snapshot.isDead
        ? new THREE.Vector3(4.8, 3.8, 4.1)
        : new THREE.Vector3((snapshot.playerLateral || 0) * 0.55, 2.7, 8.0)
    );

    this.cameraTarget.lerp(target, 0.09);
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
