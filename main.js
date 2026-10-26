'use strict';

let gl;
let surface;
let shProgram;
let spaceball;

// --- ШЕЙДЕРИ ---
const vertexShaderSource = `
    attribute vec3 vertex;
    attribute vec2 tex;
    attribute vec3 normal;
    attribute vec3 tangent;
    
    uniform mat4 ModelViewProjectionMatrix;
    uniform mat4 ModelViewMatrix;
    
    varying vec2 vTex;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vEyeVertex;
    
    void main() {
        gl_Position = ModelViewProjectionMatrix * vec4(vertex, 1.0);
        
        vTex = tex;
        vEyeVertex = (ModelViewMatrix * vec4(vertex, 1.0)).xyz;
        
        mat3 normalMatrix = mat3(
            ModelViewMatrix[0].xyz, ModelViewMatrix[1].xyz, ModelViewMatrix[2].xyz
        );
        
        vNormal = normalize(normalMatrix * normal);
        vTangent = normalize(normalMatrix * tangent);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    
    varying vec2 vTex;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vEyeVertex;
    
    uniform sampler2D iTMU0; // Diffuse
    uniform sampler2D iTMU1; // Specular
    uniform sampler2D iTMU2; // Normal
    uniform vec3 lightPosition;
    
    void main() {
        // Ортогоналізація Грама-Шмідта з пріоритетом Нормалі (Варіант 6)
        vec3 N = normalize(vNormal);
        vec3 T = normalize(vTangent);
        T = normalize(T - dot(T, N) * N); // Пріоритет нормалі
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);
        
        // Читання текстур
        vec4 diffColor = texture2D(iTMU0, vTex);
        vec4 specColor = texture2D(iTMU1, vTex);
        vec3 normalMap = texture2D(iTMU2, vTex).rgb;
        
        // Декодування нормалі та перехід у видовий простір
        normalMap = normalMap * 2.0 - 1.0;
        vec3 finalNormal = normalize(TBN * normalMap);
        
        // Освітлення Phong
        vec3 L = normalize(lightPosition - vEyeVertex);
        vec3 V = vec3(0.0, 0.0, 1.0); 
        vec3 R = reflect(-L, finalNormal);
        
        vec3 ambient = vec3(0.1, 0.1, 0.1);
        float diff = max(dot(finalNormal, L), 0.0);
        float spec = pow(max(dot(R, V), 0.0), 32.0);
        
        vec3 finalDiffuse = diffColor.rgb * diff;
        vec3 finalSpecular = specColor.rgb * spec;
        
        gl_FragColor = vec4(ambient + finalDiffuse + finalSpecular, 1.0);
    }
`;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribTexCoords = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iLightPos = -1;
    
    this.iTMU0 = -1;
    this.iTMU1 = -1;
    this.iTMU2 = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.count = 0;
    this.idTextureDiffuse = null;
    this.idTextureSpecular = null;
    this.idTextureNormal = null;

    this.BufferData = function(vertices, indices, texcoords, normals, tangents) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, tangents, gl.STREAM_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);

        this.count = indices.length;
    }

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoords, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoords);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        if(this.idTextureDiffuse) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
            gl.uniform1i(shProgram.iTMU0, 0);
        }
        if(this.idTextureSpecular) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);
            gl.uniform1i(shProgram.iTMU1, 1);
        }
        if(this.idTextureNormal) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);
            gl.uniform1i(shProgram.iTMU2, 2);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
}

function CreateSurfaceData(data, uSteps=60, vSteps=60) {
    let vertices = [], indices = [], normals = [], texcoords = [], tangents = [];
    const uMin = 0, uMax = 2 * Math.PI, vMin = 0, vMax = 2 * Math.PI, a = 2.0; 

    for (let j = 0; j <= vSteps; j++) {
        let v = vMin + j * (vMax - vMin) / vSteps;
        for (let i = 0; i <= uSteps; i++) {
            let u = uMin + i * (uMax - uMin) / uSteps;
            
            let r = a + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
            let x = Math.cos(u) * r * 0.3;
            let y = Math.sin(u) * r * 0.3;
            let z = (Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v)) * 0.3;
            vertices.push(x, y, z);

            // ВИПРАВЛЕНО: UV координати тепер строго від 0.0 до 1.0 для CLAMP_TO_EDGE
            texcoords.push(i / uSteps, j / vSteps);

            let dr_du = -0.5 * Math.sin(u / 2) * Math.sin(v) - 0.5 * Math.cos(u / 2) * Math.sin(2 * v);
            let dx_du = -Math.sin(u) * r + Math.cos(u) * dr_du;
            let dy_du = Math.cos(u) * r + Math.sin(u) * dr_du;
            let dz_du = 0.5 * Math.cos(u / 2) * Math.sin(v) - 0.5 * Math.sin(u / 2) * Math.sin(2 * v);

            let dr_dv = Math.cos(u / 2) * Math.cos(v) - 2.0 * Math.sin(u / 2) * Math.cos(2 * v);
            let dx_dv = Math.cos(u) * dr_dv;
            let dy_dv = Math.sin(u) * dr_dv;
            let dz_dv = Math.sin(u / 2) * Math.cos(v) + 2.0 * Math.cos(u / 2) * Math.cos(2 * v);

            let nx = dy_du * dz_dv - dz_du * dy_dv;
            let ny = dz_du * dx_dv - dx_du * dz_dv;
            let nz = dx_du * dy_dv - dy_du * dx_dv;

            let lenN = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if(lenN > 0) { nx/=lenN; ny/=lenN; nz/=lenN; }
            normals.push(nx, ny, nz);

            let lenT = Math.sqrt(dx_du*dx_du + dy_du*dy_du + dz_du*dz_du);
            if(lenT > 0) tangents.push(dx_du/lenT, dy_du/lenT, dz_du/lenT);
            else tangents.push(1, 0, 0);
        }
    }

    for (let j = 0; j < vSteps; j++) {
        for (let i = 0; i < uSteps; i++) {
            let p1 = j * (uSteps + 1) + i, p2 = p1 + 1, p3 = (j + 1) * (uSteps + 1) + i, p4 = p3 + 1;
            indices.push(p1, p2, p3, p2, p4, p3);
        }
    }

    data.verticesF32 = new Float32Array(vertices);
    data.normalsF32 = new Float32Array(normals);
    data.tangentsF32 = new Float32Array(tangents);
    data.texcoordsF32 = new Float32Array(texcoords);
    data.indicesU16 = new Uint16Array(indices);
}

function updateSurface() {
    let uSteps = parseInt(document.getElementById('uSlider')?.value || 60);
    let vSteps = parseInt(document.getElementById('vSlider')?.value || 60);
    if(document.getElementById('uVal')) document.getElementById('uVal').innerText = uSteps;
    if(document.getElementById('vVal')) document.getElementById('vVal').innerText = vSteps;
    
    let data = {};
    CreateSurfaceData(data, uSteps, vSteps);
    
    surface.BufferData(data.verticesF32, data.indicesU16, data.texcoordsF32, data.normalsF32, data.tangentsF32);
}

function LoadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 200, 200, 255]));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    image.src = url;
    return texture;
}

function draw() { 
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    let modelView = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    let time = Date.now() * 0.001; 
    let lightWorld = [3.0 * Math.cos(time), 3.0 * Math.sin(time), 2.0, 1.0];
    let c = matAccum1;
    let lx = lightWorld[0]*c[0] + lightWorld[1]*c[4] + lightWorld[2]*c[8] + lightWorld[3]*c[12];
    let ly = lightWorld[0]*c[1] + lightWorld[1]*c[5] + lightWorld[2]*c[9] + lightWorld[3]*c[13];
    let lz = lightWorld[0]*c[2] + lightWorld[1]*c[6] + lightWorld[2]*c[10] + lightWorld[3]*c[14];

    gl.uniform3f(shProgram.iLightPos, lx, ly, lz);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1 );
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    surface.Draw();
}

function animate() {
    draw();
    requestAnimationFrame(animate);
}

function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );
    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoords           = gl.getAttribLocation(prog, "tex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent             = gl.getAttribLocation(prog, "tangent");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iLightPos                  = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iTMU0                      = gl.getUniformLocation(prog, "iTMU0");
    shProgram.iTMU1                      = gl.getUniformLocation(prog, "iTMU1");
    shProgram.iTMU2                      = gl.getUniformLocation(prog, "iTMU2");

    let data = {};
    CreateSurfaceData(data);

    surface = new Model('Surface');
    surface.BufferData(data.verticesF32, data.indicesU16, data.texcoordsF32, data.normalsF32, data.tangentsF32);

    // Підключення текстур
    surface.idTextureDiffuse  = LoadTexture("textures/diffuse.png");
    surface.idTextureSpecular = LoadTexture("textures/specular.png");
    surface.idTextureNormal   = LoadTexture("textures/normal.png");

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    return prog;
}

function init() {
    let canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    initGL();
    spaceball = new TrackballRotator(canvas, function(){}, 0); 
    animate();
}
