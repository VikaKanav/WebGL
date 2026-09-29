class Model {
    constructor(gl) {
        this.gl = gl;
        this.vertexBuffers = [];
        this.initBuffers();
    }

        initBuffers() {
        const uVertices = [];
        const vVertices = [];

        const uMin = 0, uMax = 2 * Math.PI, uSteps = 40;
        const vMin = 0, vMax = 2 * Math.PI, vSteps = 40;
        const a = 2.0;

        // 1. U-полілінії
        for (let j = 0; j <= vSteps; j++) {
            let v = vMin + j * (vMax - vMin) / vSteps;
            for (let i = 0; i <= uSteps; i++) {
                let u = uMin + i * (uMax - uMin) / uSteps;

                let r = a + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
                let x = Math.cos(u) * r;
                let y = Math.sin(u) * r;
                let z = Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v);

                uVertices.push(x * 0.3, y * 0.3, z * 0.3);
            }
        }

        // 2. V-полілінії
        for (let i = 0; i <= uSteps; i++) {
            let u = uMin + i * (uMax - uMin) / uSteps;
            for (let j = 0; j <= vSteps; j++) {
                let v = vMin + j * (vMax - vMin) / vSteps;

                let r = a + Math.cos(u / 2) * Math.sin(v) - Math.sin(u / 2) * Math.sin(2 * v);
                let x = Math.cos(u) * r;
                let y = Math.sin(u) * r;
                let z = Math.sin(u / 2) * Math.sin(v) + Math.cos(u / 2) * Math.sin(2 * v);

                vVertices.push(x * 0.3, y * 0.3, z * 0.3);
            }
        }

        // Передача у буфери
        this.createBuffer(uVertices, uSteps + 1, vSteps + 1);
        this.createBuffer(vVertices, vSteps + 1, uSteps + 1);
    }

    createBuffer(vertices, pointsPerLine, lineCount) {
        const gl = this.gl;
        const buffer = gl.createBuffer();
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        this.vertexBuffers.push({
            buffer: buffer,
            pointsPerLine: pointsPerLine,
            lineCount: lineCount
        });
    }

    draw(positionAttributeLocation) {
        const gl = this.gl;
        gl.enableVertexAttribArray(positionAttributeLocation);

        for (let item of this.vertexBuffers) {
            gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);
            gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

            for (let i = 0; i < item.lineCount; i++) {
                gl.drawArrays(gl.LINE_STRIP, i * item.pointsPerLine, item.pointsPerLine);
            }
        }
    }
}