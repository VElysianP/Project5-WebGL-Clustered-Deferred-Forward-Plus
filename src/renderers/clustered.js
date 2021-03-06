import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  //special function to calculate the coordinate of the near-bottom-left corner 
  //of the cluster

  //special function to calculate the x min and max that the light might influence


  //special function to calculate the y min and max that the light might influence
  // doSomething(a, b, c) {

  // }
  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    var zClusterDis = (camera.far - camera.near)/this._zSlices;
    var _cameraAspect = camera.aspect;
    var _cameraFovTan = Math.tan(((camera.fov/2)*Math.PI)/180);
    var _cameraFar = camera.far;
    const farHeight = _cameraFar*_cameraFovTan*2;
    const farWidth = farHeight*_cameraAspect;
    const zSliceMax = 3;
    // var nearNormal = [0,0,camera.near];
    // var farNormal = [0,0,-camera.far];
    var totalLight = scene.lights.length;

    for (let z = 0; z < zSliceMax; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          let zPosNear = -(z*zClusterDis + camera.near);
          let zPosFar = -((z+1)*zClusterDis + camera.near);
          let yHeightFull = 2*Math.abs(zPosNear)*_cameraFovTan;
          let xWidthFull = yHeightFull*_cameraAspect;

          let clusterWidth = xWidthFull/this._xSlices;
          let clusterHeight = yHeightFull/this._ySlices;
          
          let xPosNear = -(xWidthFull/2) + x*clusterWidth;
          let yPosNear = (yHeightFull/2) - y*clusterHeight;
          let xPosNearPlus = -(xWidthFull/2) + (x+1)*clusterWidth;
          let yPosNearPlus = (yHeightFull/2) - (y+1)*clusterHeight;

          let nearTopLeft = [xPosNear, yPosNear, zPosNear];
          let nearBottomLeft = [xPosNear,yPosNearPlus,zPosNear];
          let nearTopRight = [xPosNearPlus,yPosNear,zPosNear];
          let nearBottomRight = [xPosNearPlus,yPosNearPlus,zPosNear];

          let upNormal = vec3.create();
          vec3.cross(upNormal,nearTopRight,nearTopLeft);
          vec3.normalize(upNormal,upNormal);
          let downNormal = vec3.create();
          vec3.cross(downNormal,nearBottomLeft,nearBottomRight);
          vec3.normalize(downNormal,downNormal);
          let leftNormal = vec3.create();
          vec3.cross(leftNormal,nearTopLeft,nearBottomLeft);
          vec3.normalize(leftNormal,leftNormal);
          let rightNormal = vec3.create();
          vec3.cross(rightNormal,nearBottomRight,nearTopRight);
          vec3.normalize(rightNormal,rightNormal);

          let lightCount = 0; 
          for(let iTemp = 0;iTemp<totalLight;++iTemp)
          {            
            let judgeInOut = true; 
            let lightPos4World = vec4.create();
            lightPos4World[0] = scene.lights[iTemp].position[0];
            lightPos4World[1] = scene.lights[iTemp].position[1];
            lightPos4World[2] = scene.lights[iTemp].position[2];
            lightPos4World[3] = 1;
            vec4.transformMat4(lightPos4World,lightPos4World,viewMatrix);
            
            let lightPos = vec3.create();
            lightPos[0] = lightPos4World[0];
            lightPos[1] = lightPos4World[1];
            lightPos[2] = lightPos4World[2];
            let lightRadius = scene.lights[iTemp].radius;

            //left
            let leftProjection = vec3.dot(lightPos,leftNormal);
            if(leftProjection>lightRadius)
            {
              //if(lightRadius<=leftProjection){
                judgeInOut = false;
              //} 
            }

            //right
            let rightProjection = vec3.dot(lightPos,rightNormal);
            if(rightProjection>lightRadius)
            {
              // if(lightRadius<=rightProjection)
              // {
                judgeInOut = false;
              //}              
            }

            //up
            let upProjection = vec3.dot(lightPos,upNormal);
            if(upProjection>lightRadius)
            {
              // if(lightRadius<=upProjection)
              // {
                judgeInOut = false;
              //}             
            }

            //down
            let downProjection = vec3.dot(lightPos,downNormal);
            if(downProjection>lightRadius)
            {
              // if(lightRadius<=downProjection)
              // {
                judgeInOut = false;
              //}
            }

            //near
            if((lightPos[2]-lightRadius)>=zPosNear)
            {
              judgeInOut = false;
            }

            //far
            if((lightPos[2]+lightRadius)<=zPosFar)
            {
              judgeInOut = false;
            }

            //judgeInOut has to be true to make the light inside the special 

            if(judgeInOut)
            {
              lightCount = lightCount+1;              
              let lightRowNumer = Math.floor(lightCount/4);
              let lightColumnNumber = lightCount - lightRowNumer*4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightRowNumer)+lightColumnNumber] = iTemp;
            }
          }
          this._clusterTexture._buffer[this._clusterTexture.bufferIndex(i,0)]=lightCount;
        //debugger;
        }
        //debugger;
      }
      //debugger;
    }
    //debugger;
    this._clusterTexture.update();
  }

  //TODO
  //another method specially for the deferred shading
  //used only for tiles not clusters
  updateClustersTile(camera,viewMatrix,projectionMatrix,scene)
  {
    var yFarHeight = 2*(camera.far*Math.tan((camera.fov/2)*Math.PI/180));
    var xFarWidth = yFarHeight*camera.aspect;
    var farClip = camera.far;
    var totalLight = scene.lights.length;

    var xSliceLength = xFarWidth/this._xSlices;
    var ySliceLength = yFarHeight/this._ySlices;

    var xInitial = xFarWidth/2;
    var yInitial = yFarHeight/2;
    for (let y = 0; y < this._ySlices; ++y) {
      for (let x = 0; x < this._xSlices; ++x) {

        let i = x + y * this._xSlices;

        let vertLeftTop = vec4.create(); 
        vertLeftTop[0] = x*xSliceLength-xInitial;
        vertLeftTop[1] = yInitial - y*ySliceLength;
        vertLeftTop[2] = farClip;
        vertLeftTop[3] = 1;

        let vertLeftBottom = vec4.create();
        vertLeftBottom[0] = x*xSliceLength-xInitial;
        vertLeftBottom[1] = yInitial = (y+1)*ySliceLength;
        vertLeftBottom[2] = farClip;
        vertLeftBottom[3] = 1;

        let vertRightTop = vec4.create();
        vertRightTop[0] = (x+1)*xSliceLength-xInitial;
        vertRightTop[1] = yInitial - y*ySliceLength;
        vertRightTop[2] = farClip;
        vertRightTop[3] = 1;

        let vertRightBottom = vec4.create();
        vertRightBottom[0] = (x+1)*xSliceLength-xInitial;
        vertRightBottom[1] = yInitial - (y+1)*ySliceLength;
        vertRightBottom[2] = farClip;
        vertRightBottom[3] = 1;

        let screenLeftTop = vec4.create();
        vec4.transformMat4(screenLeftTop,vertLeftTop,projectionMatrix);
        let pixelLeftTop = vec2.create();
        pixelLeftTop[0] = screenLeftTop[0];
        pixelLeftTop[1] = screenLeftTop[1];

        let screenLeftBottom = vec4.create();
        vec4.transformMat4(screenLeftBottom,vertLeftBottom,projectionMatrix);
        let pixelLeftBottom = vec2.create();
        pixelLeftBottom[0] = screenLeftBottom[0];
        pixelLeftBottom[1] = screenLeftBottom[1];

        let screenRightTop = vec4.create();
        vec4.transformMat4(screenRightTop,vertRightTop,projectionMatrix);
        let pixelRightTop = vec2.create();
        pixelRightTop[0] = screenRightTop[0];
        pixelRightTop[1] = screenRightTop[1];

        let screenRightBottom = vec4.create();
        vec4.transformMat4(screenRightBottom,vertRightBottom,projectionMatrix);
        let pixelRightBottom = vec2.create();
        pixelRightBottom[0] = screenRightBottom[0];
        pixelRightBottom[1] = screenRightBottom[1];    
        
        let lightCount = 0;

        for(let lTemp=0;lTemp<totalLight;++lTemp)
        {
          let lightPos4 = vec4.create();    
          let lightPos4World = vec4.create();
          lightPos4World[0] = scene.lights[lTemp].position[0];
          lightPos4World[1] = scene.lights[lTemp].position[1];
          lightPos4World[2] = scene.lights[lTemp].position[2];
          lightPos4World[3] = 1;
          vec4.transformMat4(lightPos4,lightPos4World,viewMatrix);
          vec4.transformMat4(lightPos4,lightPos4,projectionMatrix);

          let lightPos = vec2.create();
          lightPos[0] = lightPos4[0];
          lightPos[1] = lightPos4[1];
          let lightRadius = scene.lights[lTemp].radius;

          let disLT = (lightPos-pixelLeftTop).distance;
          let disLB = (lightPos-pixelLeftBottom).distance;
          let disRT = (lightPos-pixelRightTop).distance;
          let disRB = (lightPos-pixelRightBottom).distance;

          let minDis = Math.min(disLT, disLB,disRT,disRB);
          //debugger;
          if(minDis<lightRadius)
          {
            debugger;
            lightCount = lightCount+1;              
            let lightRowNumer = Math.floor(lightCount/4);
            let lightColumnNumber = lightCount - lightRowNumer*4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, lightRowNumer)+lightColumnNumber] = lTemp;
          }
        }
        this._clusterTexture._buffer[this._clusterTexture.bufferIndex(i,0)]=lightCount;
      }
    }

    this._clusterTexture.update();
  }
}
