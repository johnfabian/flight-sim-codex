import * as THREE from 'three';
import { islands, terrainHeight, checkpoints, GATE_RADIUS, type Flight } from './simulation';

const color = (c: string) => new THREE.Color(c);
const standard = (c: string, roughness = .75) => new THREE.MeshStandardMaterial({ color: c, roughness });
const dummy = new THREE.Object3D();
let seed = 811;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

export class World {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, 1, 1, 28000);
  renderer: THREE.WebGLRenderer;
  aircraft = new THREE.Group();
  propeller = new THREE.Group();
  gates: THREE.Group[] = [];
  clouds = new THREE.Group();
  sun: THREE.DirectionalLight;
  ambient: THREE.HemisphereLight;
  water: THREE.ShaderMaterial;
  sky: THREE.ShaderMaterial;
  cameraMode = 0;
  golden = true;
  private smoothTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private headingQuat = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private initialized = false;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.4 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.fog = new THREE.FogExp2('#a8c9c6', .000062);
    this.ambient = new THREE.HemisphereLight('#cee9f5', '#6f7150', 2.1);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight('#ffdbad', 3.3);
    this.sun.position.set(-5500, 3700, -8500);
    this.scene.add(this.sun);
    this.sky = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { topColor: { value: color('#458fb7') }, horizonColor: { value: color('#e8ddbc') }, sunDirection: { value: this.sun.position.clone().normalize() } },
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDirection; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDirection;
        void main(){vec3 d=normalize(vDirection); float h=max(d.y,0.); vec3 c=mix(horizonColor,topColor,pow(h,.42)); float s=max(dot(d,sunDirection),0.); c+=vec3(1.,.64,.27)*pow(s,16.)*.18; c+=vec3(1.,.88,.6)*pow(s,16000.)*3.; gl_FragColor=vec4(c,1.);}`
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(23000, 32, 16), this.sky));
    this.water = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, sunDirection: { value: this.sun.position.clone().normalize() }, oceanColor: { value: color('#167d91') }, fogColor: { value: color('#a8c9c6') } },
      vertexShader: `varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: `uniform float time; uniform vec3 sunDirection; uniform vec3 oceanColor; uniform vec3 fogColor; varying vec3 vWorld;
        void main(){vec2 p=vWorld.xz; float a=sin(p.x*.034+p.y*.024+time*.7); float b=sin(p.x*.015-p.y*.047-time*.5); float detail=sin(p.x*.17+p.y*.12+time);
        vec3 normal=normalize(vec3((a+b)*.055,1.,cos(p.y*.033+time*.6)*.08+detail*.013));
        vec3 viewDir=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(dot(viewDir,normal),0.),3.);
        float shine=pow(max(dot(reflect(-sunDirection,normal),viewDir),0.),150.);
        vec3 c=mix(oceanColor,vec3(.49,.69,.71),fresnel*.65)+(a*b*.013)+vec3(1.,.81,.47)*shine*1.8;
        float streak=pow(max(0.,sin(p.x*.012+p.y*.041+a*.6)),24.);c+=streak*.025;
        float fog=1.-exp(-length(cameraPosition-vWorld)*.000075);gl_FragColor=vec4(mix(c,fogColor,fog),1.);}`
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), this.water);
    ocean.rotation.x = -Math.PI / 2;
    this.scene.add(ocean);
    this.buildTerrain();
    this.buildScenery();
    this.buildAircraft();
    this.buildGates();
    this.resize();
  }

  private buildTerrain() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .98 });
    for (const island of islands) {
      const geo = new THREE.PlaneGeometry(island.rx * 2.25, island.rz * 2.25, 140, 150);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const colors: number[] = [];
      const sand = color('#d8c69a'), green = color('#537e51'), forest = color('#365d49'), rock = color('#8b9285'), snow = color('#d4d9cb');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + island.x, z = pos.getZ(i) + island.z, h = terrainHeight(x, z);
        pos.setXYZ(i, x, h, z);
        const c = new THREE.Color();
        if (h < 9) c.copy(sand);
        else if (h < 45) c.copy(sand).lerp(green, (h-9)/36);
        else if (h < 250) c.copy(green).lerp(forest, (h-45)/205);
        else if (h < 620) c.copy(forest).lerp(rock, (h-250)/370);
        else c.copy(rock).lerp(snow, Math.min(1,(h-620)/230));
        c.multiplyScalar(.92 + random()*.14);
        colors.push(c.r,c.g,c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      this.scene.add(new THREE.Mesh(geo, mat));
      // Translucent shelf around each island gives the water a shallow turquoise rim.
      const shelf = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: '#56bdb4', transparent: true, opacity: .035, depthWrite: false }));
      shelf.rotation.x = -Math.PI / 2; shelf.position.set(island.x, .4, island.z); shelf.scale.set(island.rx*1.01,island.rz*1.01,1);
      this.scene.add(shelf);
    }
  }

  private buildScenery() {
    const count = matchMedia('(pointer: coarse)').matches ? 2000 : 4500;
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), standard('#315944'), count);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count*12; tries++) {
      const island = islands[Math.floor(random()*islands.length)];
      const x = island.x + (random()-.5)*island.rx*1.9, z = island.z+(random()-.5)*island.rz*1.9;
      const y = terrainHeight(x,z);
      if (y < 28 || y > 490 || (x > -1080 && x < -660 && z > -480 && z < 330)) continue;
      const size = 11+random()*14;
      dummy.position.set(x,y+size*.4,z); dummy.scale.set(size*.36,size,size*.36); dummy.rotation.set(0,random()*6.28,0); dummy.updateMatrix();
      trees.setMatrixAt(placed,dummy.matrix);
      trees.setColorAt(placed,new THREE.Color().setHSL(.36+random()*.04,.23+random()*.15,.18+random()*.13));
      placed++;
    }
    trees.count = placed; this.scene.add(trees);
    const cloudMaterial = new THREE.MeshStandardMaterial({ color: '#fff9ed', emissive: '#d5d6ca', emissiveIntensity: .16, roughness: 1, transparent: true, opacity: .92 });
    const cloudGeometry = new THREE.IcosahedronGeometry(1, 2);
    for (let i=0; i<38; i++) {
      const cloud = new THREE.Group();
      cloud.position.set((random()-.5)*17000,1350+random()*1500,-random()*14000+2000);
      for(let j=0;j<5;j++) {
        const puff = new THREE.Mesh(cloudGeometry,cloudMaterial);
        puff.position.set(j*95,random()*40,random()*70); puff.scale.set(130+random()*80,50+random()*60,80+random()*70); cloud.add(puff);
      }
      this.clouds.add(cloud);
    }
    this.scene.add(this.clouds);
    const runway = new THREE.Mesh(new THREE.BoxGeometry(45, .7, 540), standard('#525c58'));
    runway.position.set(-870,13.5,-70);this.scene.add(runway);
    const white = standard('#f3e9d0');
    for(let i=0;i<13;i++) {
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(2,.1,18),white);stripe.position.set(-870,14,-310+i*40);this.scene.add(stripe);
    }
    for(const z of [-305,165]) for(let x=-885;x<=-855;x+=6) {
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(3,.1,22),white);stripe.position.set(x,14,z);this.scene.add(stripe);
    }
    const hangar=new THREE.Mesh(new THREE.BoxGeometry(65,24,70),standard('#b5b3a0'));hangar.position.set(-960,25,-120);this.scene.add(hangar);
    const roof=new THREE.Mesh(new THREE.CylinderGeometry(34,34,72,3,1),standard('#626e69'));roof.rotation.x=Math.PI/2;roof.position.set(-960,38,-120);this.scene.add(roof);
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(5,8,46,8),white);tower.position.set(-945,35,75);this.scene.add(tower);
    const cabin=new THREE.Mesh(new THREE.CylinderGeometry(12,10,12,8),standard('#35565b'));cabin.position.set(-945,61,75);this.scene.add(cabin);
    // A lighthouse at the southern headland.
    const lx=-1710,lz=120,ly=terrainHeight(lx,lz);
    const lighthouse=new THREE.Mesh(new THREE.CylinderGeometry(5,8,44,12),white);lighthouse.position.set(lx,ly+22,lz);this.scene.add(lighthouse);
    const lantern=new THREE.Mesh(new THREE.CylinderGeometry(7,7,9,12),standard('#ec8648'));lantern.position.set(lx,ly+47,lz);this.scene.add(lantern);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(9,8,12),standard('#374e52'));cap.position.set(lx,ly+55,lz);this.scene.add(cap);
  }

  private buildAircraft() {
    const cream=standard('#f0e8d2',.42), orange=standard('#ea6938',.42), dark=standard('#283b3e',.65), metal=standard('#a3b2b1',.28);
    const add=(geo: THREE.BufferGeometry,mat: THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);this.aircraft.add(m);return m;};
    // Forward is -Z. Tapered, elliptical fuselage with a high wing.
    const body=add(new THREE.CylinderGeometry(.72,1.13,7.8,12),cream,0,0,1.0);body.rotation.x=Math.PI/2;body.scale.z=.95;
    const nose=add(new THREE.SphereGeometry(1.17,16,12),orange,0,0,-3.0);nose.scale.set(1,.95,1.3);
    const cowling=add(new THREE.CylinderGeometry(1.05,1.1,1.5,16),orange,0,0,-3.5);cowling.rotation.x=Math.PI/2;
    const tail=add(new THREE.ConeGeometry(.73,4.2,12),cream,0,.18,6.1);tail.rotation.x=Math.PI/2;
    const cabin=add(new THREE.SphereGeometry(1,16,12),new THREE.MeshStandardMaterial({color:'#345b68',metalness:.35,roughness:.17}),0,.78,-.6);cabin.scale.set(.97,.88,2.1);
    add(new THREE.BoxGeometry(.12,1.25,2.7),cream,0,1.05,-.6);
    const wing=add(new THREE.BoxGeometry(17.5,.22,2.35),cream,0,1.6,-.2);wing.rotation.x=-.025;
    for(const side of [-1,1]) {
      add(new THREE.BoxGeometry(1.4,.25,2.36),orange,side*8.12,1.6,-.2);
      add(new THREE.BoxGeometry(3.9,.05,.08),dark,side*5.2,1.735,.64);
      const strut=add(new THREE.CylinderGeometry(.045,.045,6.1,6),metal,side*3,-.05,.1);strut.rotation.z=-side*1.14;
      const gear=add(new THREE.CylinderGeometry(.09,.09,2.4,7),dark,side*1.0,-1.6,-1.1);gear.rotation.z=side*.55;
      const wheel=add(new THREE.CylinderGeometry(.46,.46,.32,14),dark,side*1.7,-2.5,-1.1);wheel.rotation.z=Math.PI/2;
      add(new THREE.SphereGeometry(.12,8,8),new THREE.MeshBasicMaterial({color:side===-1?'#ef593e':'#8cf0b5'}),side*8.85,1.63,-.1);
    }
    add(new THREE.BoxGeometry(5.6,.16,1.45),cream,0,.5,6.5);
    add(new THREE.BoxGeometry(.16,2.5,1.75),orange,0,1.53,6.6);
    add(new THREE.BoxGeometry(1.2,.18,1.45),orange,-2.25,.5,6.5);add(new THREE.BoxGeometry(1.2,.18,1.45),orange,2.25,.5,6.5);
    const tailwheel=add(new THREE.SphereGeometry(.25,8,8),dark,0,-.5,6.8);tailwheel.scale.x=.5;
    for(const side of [-1,1]) {
      const trim=add(new THREE.BoxGeometry(.04,.13,5.8),orange,side*.78,-.16,1.85);trim.rotation.y=side*-.055;
    }
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.19,4.7,.1),dark);this.propeller.add(blade);
    const spinner=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),metal);spinner.scale.z=1.8;this.propeller.add(spinner);
    const blur=new THREE.Mesh(new THREE.CircleGeometry(2.3,40),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.085,side:THREE.DoubleSide,depthWrite:false}));this.propeller.add(blur);
    this.propeller.position.set(0,0,-4.55);this.aircraft.add(this.propeller);
    this.scene.add(this.aircraft);
  }

  private buildGates() {
    for(let i=0;i<checkpoints.length;i++) {
      const point=checkpoints[i],gate=new THREE.Group();
      gate.position.set(point.x,point.y,point.z);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(GATE_RADIUS,2.4,8,80),new THREE.MeshBasicMaterial({color:'#ffb569',transparent:true,opacity:.95}));gate.add(ring);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(GATE_RADIUS,9,8,80),new THREE.MeshBasicMaterial({color:'#ffb569',transparent:true,opacity:.07,depthWrite:false}));gate.add(halo);
      for(let j=0;j<4;j++) {
        const tick=new THREE.Mesh(new THREE.BoxGeometry(4,17,4),new THREE.MeshBasicMaterial({color:'#fff1c5'}));const a=j*Math.PI/2;tick.position.set(Math.sin(a)*GATE_RADIUS,Math.cos(a)*GATE_RADIUS,0);tick.rotation.z=-a;gate.add(tick);
      }
      this.gates.push(gate);this.scene.add(gate);
    }
  }

  setLighting(golden: boolean) {
    this.golden=golden;
    this.sun.color.set(golden?'#ffdbad':'#f3faff');this.sun.intensity=golden?3.3:2.8;
    this.sky.uniforms.topColor.value.set(golden?'#458fb7':'#398bca');this.sky.uniforms.horizonColor.value.set(golden?'#e8ddbc':'#c1e1e9');
    this.water.uniforms.oceanColor.value.set(golden?'#167d91':'#127f9d');
  }

  resize() { const w=window.innerWidth,h=window.innerHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix(); }

  render(s: Flight, dt: number) {
    const moving=s.status==='flying'||s.status==='briefing';
    if(moving)this.time+=dt;
    this.water.uniforms.time.value=this.time;
    this.aircraft.position.set(s.position.x,s.position.y,s.position.z);
    this.aircraft.rotation.set(s.pitch,s.heading,s.roll,'YXZ');
    if(s.status==='briefing') {this.aircraft.position.y+=Math.sin(this.time*.7)*.45;this.aircraft.rotation.z=Math.sin(this.time*.4)*.018;}
    if(moving)this.propeller.rotation.z+=dt*(30+s.throttle*65);
    this.headingQuat.setFromAxisAngle(this.up,s.heading);
    const briefing=s.status==='briefing';
    if(briefing) {
      const narrow=window.innerWidth<760;
      this.cameraPosition.set(narrow?30:35,narrow?14:15,narrow?53:49).applyQuaternion(this.headingQuat).add(this.aircraft.position);
      this.cameraTarget.set(narrow?0:-15,narrow?-20:2,narrow?0:-28).applyQuaternion(this.headingQuat).add(this.aircraft.position);
    } else if(this.cameraMode===1) {
      this.cameraPosition.set(0,2.5,-2).applyQuaternion(this.aircraft.quaternion).add(this.aircraft.position);
      this.cameraTarget.set(0,2.5,-180).applyQuaternion(this.aircraft.quaternion).add(this.aircraft.position);
    } else {
      this.cameraPosition.set(this.cameraMode===2?40:0,this.cameraMode===2?16:10,this.cameraMode===2?26:39).applyQuaternion(this.headingQuat).add(this.aircraft.position);
      this.cameraTarget.set(0,this.cameraMode===2?0:-4,this.cameraMode===2?-5:-35).applyQuaternion(this.headingQuat).add(this.aircraft.position);
    }
    const lerp=this.initialized?1-Math.exp(-dt*(this.cameraMode===1?16:4)):1;
    this.camera.position.lerp(this.cameraPosition,lerp);this.smoothTarget.lerp(this.cameraTarget,lerp);
    this.camera.up.set(0,1,0);
    if(this.cameraMode===1&&!briefing)this.camera.up.applyQuaternion(this.aircraft.quaternion);
    this.camera.lookAt(this.smoothTarget);
    this.aircraft.visible=this.cameraMode!==1||briefing;
    for(let i=0;i<this.gates.length;i++) {
      this.gates[i].visible=s.mode==='expedition'&&i>=s.checkpoint&&i<s.checkpoint+3;
      this.gates[i].scale.setScalar(i===s.checkpoint?1+Math.sin(this.time*1.8)*.012:1);
      (this.gates[i].children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>).material.opacity=i===s.checkpoint?.95:.22;
    }
    this.initialized=true;
    this.renderer.render(this.scene,this.camera);
  }
}
