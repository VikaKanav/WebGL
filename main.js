'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object

// --- ШЕЙДЕРИ ДЛЯ GOURAUD SHADING ---
const vertexShaderSource = `
    attribute vec3 vertex;
    attribute vec3 normal;
    
    uniform mat4 ModelViewProjectionMatrix;
    uniform mat4 ModelViewMatrix;
    uniform vec3 lightPosition;
    
    varying vec4 vColor;
    
    void main() {
        gl_Position = ModelViewProjectionMatrix * vec4(vertex, 1.0);
        
        // Координати вершини у видовому просторі
        vec4 eyeVertex = ModelViewMatrix * vec4(vertex, 1.0);
        
        // Матриця нормалей
        mat3 normalMatrix = mat3(
            ModelViewMatrix[0].xyz,
            ModelViewMatrix[1].xyz,
            ModelViewMatrix[2].xyz
        );
        vec3 eyeNormal = normalize(normalMatrix * normal);
        
        // Вектори для освітлення
        vec3 L = normalize(lightPosition - eyeVertex.xyz);
        vec3 V = vec3(0.0, 0.0, 1.0); // За підказкою (0,0,1)
        vec3 R = reflect(-L, eyeNormal);
        
        // Компоненти освітлення (Irgb = Ambient + Diffuse + Specular)
        vec3 ambient = vec3(0.1, 0.1, 0.2);
        vec3 diffuseColor = vec3(0.0, 0.6, 0.8);
        vec3 specularColor = vec3(1.0, 1.0, 1.0);
        
        float diff = max(dot(eyeNormal, L), 0.0);
        float spec = pow(max(dot(R, V), 0.0), 32.0);
        
        vec3 color = ambient + (diffuseColor * diff) + (specularColor * spec);
        vColor = vec4(color, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    varying vec4 vColor;
    
    void main() {
        gl_FragColor = vColor;
    }
`;

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, indices, normals) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}

// Constructor
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = gl.getAttribLocation(program, "vertex");
    this.iAttribNormal = gl.getAttribLocation(program, "normal");
    
    this.iModelViewProjectionMatrix = gl.getUniformLocation(program, "ModelViewProjectionMatrix");
    this.iModelViewMatrix = gl.getUniformLocation(program, "ModelViewMatrix");
    this.iLightPos = gl.getUniformLocation(program, "lightPosition");

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function draw() { 
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    // --- ОБЕРТАННЯ ДЖЕРЕЛА СВІТЛА ---
    let time = Date.now() * 0.001; 
    let lightRadius = 3.0;
    let lightWorld = [lightRadius * Math.cos(time), lightRadius * Math.sin(time), 2.0, 1.0];

    // Множимо координати світла на матрицю ModelView
    let c = matAccum1;
    let lx = lightWorld[0]*c[0] + lightWorld[1]*c[4] + lightWorld[2]*c[8] + lightWorld[3]*c[12];
    let ly = lightWorld[0]*c[1] + lightWorld[1]*c[5] + lightWorld[2]*c[9] + lightWorld[3]*c[13];
    let lz = lightWorld[0]*c[2] + lightWorld[1]*c[6] + lightWorld[2]*c[10] + lightWorld[3]*c[14];

    gl.uniform3f(shProgram.iLightPos, lx, ly, lz);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);

    surface.Draw();
    
    // Цикл для анімації обертання світла
    requestAnimationFrame(draw);
}

function CreateSurfaceData(data, uSteps=40, vSteps=40) {
    let vertices = [];
    let indices = [];
    const uMin = 0, uMax = 2 * Math.PI, vMin = 0, vMax = 2 * Math.PI;
    const a = 2.0; 

    // 1. Вершини (Variant 6 - The Klein Bottle)
    for (let j = 0; j <= vSteps; j++) {
        let v = vMin + j * (vMax - vMin) / vSteps;
        for (let i = 0; i <= uSteps; i++) {
            let u = uMin + i * (uMax - uMin) / uSteps;
            let r = a + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
            let x = Math.cos(u) * r * 0.3;
            let y = Math.sin(u) * r * 0.3;
            let z = (Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v)) * 0.3;
            vertices.push(x, y, z);
        }
    }

    // 2. Індекси (FILLED TRIANGLES)
    for (let j = 0; j < vSteps; j++) {
        for (let i = 0; i < uSteps; i++) {
            let p1 = j * (uSteps + 1) + i;
            let p2 = p1 + 1;
            let p3 = (j + 1) * (uSteps + 1) + i;
            let p4 = p3 + 1;
            indices.push(p1, p2, p3);
            indices.push(p2, p4, p3);
        }
    }

    // 3. Нормалі (Facet Average Normal)
    let normals = new Float32Array(vertices.length);
    for(let i = 0; i < indices.length; i += 3) {
        let i1 = indices[i]*3, i2 = indices[i+1]*3, i3 = indices[i+2]*3;
        
        let v1 = [vertices[i1], vertices[i1+1], vertices[i1+2]];
        let v2 = [vertices[i2], vertices[i2+1], vertices[i2+2]];
        let v3 = [vertices[i3], vertices[i3+1], vertices[i3+2]];

        let dx1 = v2[0]-v1[0], dy1 = v2[1]-v1[1], dz1 = v2[2]-v1[2];
        let dx2 = v3[0]-v1[0], dy2 = v3[1]-v1[1], dz2 = v3[2]-v1[2];

        let nx = dy1*dz2 - dz1*dy2;
        let ny = dz1*dx2 - dx1*dz2;
        let nz = dx1*dy2 - dy1*dx2;

        let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        if(len > 0) { nx/=len; ny/=len; nz/=len; }

        normals[i1]+=nx; normals[i1+1]+=ny; normals[i1+2]+=nz;
        normals[i2]+=nx; normals[i2+1]+=ny; normals[i2+2]+=nz;
        normals[i3]+=nx; normals[i3+1]+=ny; normals[i3+2]+=nz;
    }
    
    for(let i = 0; i < normals.length; i += 3) {
        let nx = normals[i], ny = normals[i+1], nz = normals[i+2];
        let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        if(len > 0) { normals[i]/=len; normals[i+1]/=len; normals[i+2]/=len; }
    }

    data.verticesF32 = new Float32Array(vertices);
    data.normalsF32 = normals;
    data.indicesU16 = new Uint16Array(indices);
}

function updateSurface() {
    let uSteps = parseInt(document.getElementById('uSlider')?.value || 40);
    let vSteps = parseInt(document.getElementById('vSlider')?.value || 40);
    
    if(document.getElementById('uVal')) document.getElementById('uVal').innerText = uSteps;
    if(document.getElementById('vVal')) document.getElementById('vVal').innerText = vSteps;
    
    let data = {};
    CreateSurfaceData(data, uSteps, vSteps);
    surface.BufferData(data.verticesF32, data.indicesU16, data.normalsF32);
}

function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    let data = {};
    CreateSurfaceData(data, 40, 40);

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16, data.normalsF32);

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) { throw "Browser does not support WebGL"; }
    }
    catch (e) { return; }
    try { initGL(); } catch (e) { return; }

    // Змінено null замість draw, щоб уникнути конфлікту з requestAnimationFrame
    spaceball = new TrackballRotator(canvas, null, 0); 
    draw();
}