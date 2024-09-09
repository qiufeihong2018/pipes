// 定义网格的边界
var gridBounds = new THREE.Box3(
  new THREE.Vector3(-10, -10, -10),
  new THREE.Vector3(10, 10, 10)
);

// 存储节点的对象
var nodes = {};

// 在网格的特定位置设置值的函数
function setAt(position, value) {
  nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"] = value;
}

// 获取网格特定位置值的函数
function getAt(position, value) {
  return nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"];
}

// 清空网格的函数
function clearGrid() {
  nodes = {};
}

// 存储纹理的对象
var textures = {};

// 管道构造函数
var Pipe = function(scene, options) {
  var self = this;
  var pipeRadius = 0.2;
  var ballJointRadius = pipeRadius * 1.5;
  var teapotSize = ballJointRadius;

  // 初始化管道位置并添加到场景中
  self.currentPosition = randomIntegerVector3WithinBox(gridBounds);
  self.positions = [self.currentPosition];
  self.object3d = new THREE.Object3D();
  scene.add(self.object3d);

  // 根据选项设置材质
  if (options.texturePath) {
    self.material = new THREE.MeshLambertMaterial({
      map: textures[options.texturePath],
    });
  } else {
    var color = randomInteger(0, 0xffffff);
    var emissive = new THREE.Color(color).multiplyScalar(0.3);
    self.material = new THREE.MeshPhongMaterial({
      specular: 0xa9fcff,
      color: color,
      emissive: emissive,
      shininess: 100,
    });
  }

  // 在两点之间创建圆柱体的函数
  var makeCylinderBetweenPoints = function(fromPoint, toPoint, material) {
    var deltaVector = new THREE.Vector3().subVectors(toPoint, fromPoint);
    var arrow = new THREE.ArrowHelper(
      deltaVector.clone().normalize(),
      fromPoint
    );
    var geometry = new THREE.CylinderGeometry(
      pipeRadius,
      pipeRadius,
      deltaVector.length(),
      10,
      4,
      true
    );
    var mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.setFromQuaternion(arrow.quaternion);
    mesh.position.addVectors(fromPoint, deltaVector.multiplyScalar(0.5));
    mesh.updateMatrix();

    self.object3d.add(mesh);
  };

  // 在特定位置创建球形关节的函数
  var makeBallJoint = function(position) {
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballJointRadius, 8, 8),
      self.material
    );
    ball.position.copy(position);
    self.object3d.add(ball);
  };

  // 在特定位置创建茶壶关节的函数
  var makeTeapotJoint = function(position) {
    var teapot = new THREE.Mesh(
      new THREE.TeapotBufferGeometry(teapotSize, true, true, true, true, true),
      self.material
    );
    teapot.position.copy(position);
    teapot.rotation.x = (Math.floor(random(0, 50)) * Math.PI) / 2;
    teapot.rotation.y = (Math.floor(random(0, 50)) * Math.PI) / 2;
    teapot.rotation.z = (Math.floor(random(0, 50)) * Math.PI) / 2;
    self.object3d.add(teapot);
  };

  // 在两个位置之间创建肘形关节的函数
  var makeElbowJoint = function(fromPosition, toPosition, tangentVector) {
    var elball = new THREE.Mesh(
      new THREE.SphereGeometry(pipeRadius, 8, 8),
      self.material
    );
    elball.position.copy(fromPosition);
    self.object3d.add(elball);
  };

  // 设置网格中的初始位置
  setAt(self.currentPosition, self);

  // 创建初始球形关节
  makeBallJoint(self.currentPosition);

  // 管道的更新函数
  self.update = function() {
    if (self.positions.length > 1) {
      var lastPosition = self.positions[self.positions.length - 2];
      var lastDirectionVector = new THREE.Vector3().subVectors(
        self.currentPosition,
        lastPosition
      );
    }
    if (chance(1 / 2) && lastDirectionVector) {
      var directionVector = lastDirectionVector;
    } else {
      var directionVector = new THREE.Vector3();
      directionVector[chooseFrom("xyz")] += chooseFrom([+1, -1]);
    }
    var newPosition = new THREE.Vector3().addVectors(
      self.currentPosition,
      directionVector
    );

    // 检查新位置是否在边界内且未被占用
    if (!gridBounds.containsPoint(newPosition)) {
      return;
    }
    if (getAt(newPosition)) {
      return;
    }
    setAt(newPosition, self);

    // 根据方向变化创建关节
    if (lastDirectionVector && !lastDirectionVector.equals(directionVector)) {
      if (chance(options.teapotChance)) {
        makeTeapotJoint(self.currentPosition);
      } else if (chance(options.ballJointChance)) {
        makeBallJoint(self.currentPosition);
      } else {
        makeElbowJoint(self.currentPosition, newPosition, lastDirectionVector);
      }
    }

    // 在当前和新位置之间创建圆柱体
    makeCylinderBetweenPoints(self.currentPosition, newPosition, self.material);

    // 更新当前的位置
    self.currentPosition = newPosition;
    self.positions.push(newPosition);
  };
};

// 关节类型
var JOINTS_ELBOW = "elbow";
var JOINTS_BALL = "ball";
var JOINTS_MIXED = "mixed";
var JOINTS_CYCLE = "cycle";

// 用于循环关节类型的数组和索引
var jointsCycleArray = [JOINTS_ELBOW, JOINTS_BALL, JOINTS_MIXED];
var jointsCycleIndex = 0;

// 获取关节类型选择元素
var jointTypeSelect = document.getElementById("joint-types");

// 存储管道的数组和选项对象
var pipes = [];
var options = {
  multiple: true,
  texturePath: null,
  joints: jointTypeSelect.value,
  interval: [16, 24], // 淡出之间的秒数范围
};

// 关节类型更改事件监听器
jointTypeSelect.addEventListener("change", function() {
  options.joints = jointTypeSelect.value;
});

// 获取画布容器元素
var canvasContainer = document.getElementById("canvas-container");

// 用于溶解效果的2D画布
var canvas2d = document.getElementById("canvas-2d");
var ctx2d = canvas2d.getContext("2d");

// WebGL渲染器
var canvasWebGL = document.getElementById("canvas-webgl");
var renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  canvas: canvasWebGL,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// 相机设置
var camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  100000
);

// 相机的轨道控制
var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enabled = false;

// 场景设置
var scene = new THREE.Scene();

// 灯光设置
var ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

var directionalLightL = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLightL.position.set(-1.2, 1.5, 0.5);
scene.add(directionalLightL);

// 用于溶解过渡效果的变量
var dissolveRects = [];
var dissolveRectsIndex = -1;
var dissolveRectsPerRow = 50;
var dissolveRectsPerColumn = 50;
var dissolveTransitionSeconds = 2;
var dissolveTransitionFrames = dissolveTransitionSeconds * 60;
var dissolveEndCallback;

// 开始溶解效果的函数
function dissolve(seconds, endCallback) {
  dissolveRectsPerRow = Math.ceil(window.innerWidth / 20);
  dissolveRectsPerColumn = Math.ceil(window.innerHeight / 20);

  dissolveRects = new Array(dissolveRectsPerRow * dissolveRectsPerColumn)
    .fill(null)
    .map(function(_null, index) {
      return {
        x: index % dissolveRectsPerRow,
        y: Math.floor(index / dissolveRectsPerRow),
      };
    });
  shuffleArrayInPlace(dissolveRects);
  dissolveRectsIndex = 0;
  dissolveTransitionSeconds = seconds;
  dissolveTransitionFrames = dissolveTransitionSeconds * 60;
  dissolveEndCallback = endCallback;
}

// 完成溶解效果的函数
function finishDissolve() {
  dissolveEndCallback();
  dissolveRects = [];
  dissolveRectsIndex = -1;
  ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
}

// 用于清屏的变量
var clearing = false;
var clearTID = -1;

// 清屏函数
function clear(fast) {
  clearTimeout(clearTID);
  clearTID = setTimeout(
    clear,
    random(options.interval[0], options.interval[1]) * 1000
  );
  if (!clearing) {
    clearing = true;
    var fadeOutTime = fast ? 0.2 : 2;
    dissolve(fadeOutTime, reset);
  }
}
clearTID = setTimeout(
  clear,
  random(options.interval[0], options.interval[1]) * 1000
);

// 重置场景的函数
function reset() {
  renderer.clear();
  for (var i = 0; i < pipes.length; i++) {
    scene.remove(pipes[i].object3d);
  }
  pipes = [];
  clearGrid();
  look();
  clearing = false;
}

// 动画循环函数
function animate() {
  controls.update();
  if (options.texturePath && !textures[options.texturePath]) {
    var texture = THREE.ImageUtils.loadTexture(options.texturePath);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    textures[options.texturePath] = texture;
  }

  // 更新管道
  for (var i = 0; i < pipes.length; i++) {
    pipes[i].update(scene);
  }

  // 如果没有管道，则创建新的管道
  if (pipes.length === 0) {
    var jointType = options.joints;
    if (options.joints === JOINTS_CYCLE) {
      jointType = jointsCycleArray[jointsCycleIndex++];
    }
    var pipeOptions = {
      teapotChance: 1 / 200,
      ballJointChance:
        jointType === JOINTS_BALL ? 1 : jointType === JOINTS_MIXED ? 1 / 3 : 0,
      texturePath: options.texturePath,
    };
    if (chance(1 / 20)) {
      pipeOptions.teapotChance = 1 / 20;
      pipeOptions.texturePath = "images/textures/candycane.png";
      if (!textures[pipeOptions.texturePath]) {
        var texture = THREE.ImageUtils.loadTexture(pipeOptions.texturePath);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        textures[pipeOptions.texturePath] = texture;
      }
    }
    for (var i = 0; i < 1 + options.multiple * (1 + chance(1 / 10)); i++) {
      pipes.push(new Pipe(scene, pipeOptions));
    }
  }

  // 如果没有清屏，则渲染场景
  if (!clearing) {
    renderer.render(scene, camera);
  }

  // 更新溶解效果
  if (
    canvas2d.width !== window.innerWidth ||
    canvas2d.height !== window.innerHeight
  ) {
    canvas2d.width = window.innerWidth;
    canvas2d.height = window.innerHeight;
    if (dissolveRectsIndex > -1) {
      for (var i = 0; i < dissolveRectsIndex; i++) {
        var rect = dissolveRects[i];
        var rectWidth = innerWidth / dissolveRectsPerRow;
        var rectHeight = innerHeight / dissolveRectsPerColumn;
        ctx2d.fillStyle = "black";
        ctx2d.fillRect(
          Math.floor(rect.x * rectWidth),
          Math.floor(rect.y * rectHeight),
          Math.ceil(rectWidth),
          Math.ceil(rectHeight)
        );
      }
    }
  }
  if (dissolveRectsIndex > -1) {
    var rectsAtATime = Math.floor(
      dissolveRects.length / dissolveTransitionFrames
    );
    for (
      var i = 0;
      i < rectsAtATime && dissolveRectsIndex < dissolveRects.length;
      i++
    ) {
      var rect = dissolveRects[dissolveRectsIndex];
      var rectWidth = innerWidth / dissolveRectsPerRow;
      var rectHeight = innerHeight / dissolveRectsPerColumn;
      ctx2d.fillStyle = "black";
      ctx2d.fillRect(
        Math.floor(rect.x * rectWidth),
        Math.floor(rect.y * rectHeight),
        Math.ceil(rectWidth),
        Math.ceil(rectHeight)
      );
      dissolveRectsIndex += 1;
    }
    if (dissolveRectsIndex === dissolveRects.length) {
      finishDissolve();
    }
  }

  requestAnimationFrame(animate);
}

// 设置相机视角的函数
function look() {
  if (chance(1 / 2)) {
    camera.position.set(0, 0, 14);
  } else {
    var vector = new THREE.Vector3(14, 0, 0);
    var axis = new THREE.Vector3(random(-1, 1), random(-1, 1), random(-1, 1));
    var angle = Math.PI / 2;
    var matrix = new THREE.Matrix4().makeRotationAxis(axis, angle);
    vector.applyMatrix4(matrix);
    camera.position.copy(vector);
  }
  var center = new THREE.Vector3(0, 0, 0);
  camera.lookAt(center);
  controls.update();
}
look();

// 窗口大小调整事件监听器
addEventListener(
  "resize",
  function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  },
  false
);

// 画布容器的鼠标按下事件监听器
canvasContainer.addEventListener("mousedown", function(e) {
  e.preventDefault();
  if (!controls.enabled) {
    if (e.button) {
      clear(true);
    } else {
      look();
    }
  }
  window.getSelection().removeAllRanges();
  document.activeElement.blur();
});

// 阻止画布容器的上下文菜单事件监听器
canvasContainer.addEventListener(
  "contextmenu",
  function(e) {
    e.preventDefault();
  },
  false
);

// 全屏按钮的事件监听器
var fullscreenButton = document.getElementById("fullscreen-button");
fullscreenButton.addEventListener(
  "click",
  function(e) {
    if (canvasContainer.requestFullscreen) {
      canvasContainer.requestFullscreen();
    } else if (canvasContainer.mozRequestFullScreen) {
      canvasContainer.mozRequestFullScreen();
    } else if (canvasContainer.webkitRequestFullScreen) {
      canvasContainer.webkitRequestFullScreen();
    }
  },
  false
);

// 切换控制按钮的事件监听器
var toggleControlButton = document.getElementById("toggle-controls");
toggleControlButton.addEventListener(
  "click",
  function(e) {
    controls.enabled = !controls.enabled;
    showElementsIf(".normal-controls-enabled", !controls.enabled);
    showElementsIf(".orbit-controls-enabled", controls.enabled);
  },
  false
);

// 从URL参数更新选项的函数
function updateFromParametersInURL() {
  var paramsJSON = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (paramsJSON) {
    try {
      var params = JSON.parse(paramsJSON);
      if (typeof params !== "object") {
        alert("无效的URL参数JSON：顶级值必须是对象");
        params = null;
      }
    } catch (error) {
      alert(
        "无效的URL参数JSON语法\n\n" + error + "\n\n接收到的:\n" + paramsJSON
      );
    }
  }
  params = params || {};
  showElementsIf(".ui-container", !params.hideUI);
}

updateFromParametersInURL();
window.addEventListener("hashchange", updateFromParametersInURL);

// 开始动画循环
animate();

/**************\
|无聊的辅助函数|
\**************/

// 生成x1和x2之间随机数的辅助函数
function random(x1, x2) {
  return Math.random() * (x2 - x1) + x1;
}

// 生成x1和x2之间随机整数的辅助函数
function randomInteger(x1, x2) {
  return Math.round(random(x1, x2));
}

// 确定随机机会是否发生的辅助函数
function chance(value) {
  return Math.random() < value;
}

// 从数组中随机选择一个值的辅助函数
function chooseFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

// 就地打乱数组的辅助函数
function shuffleArrayInPlace(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// 在盒子内生成随机整数向量的辅助函数
function randomIntegerVector3WithinBox(box) {
  return new THREE.Vector3(
    randomInteger(box.min.x, box.max.x),
    randomInteger(box.min.y, box.max.y),
    randomInteger(box.min.z, box.max.z)
  );
}

// 根据条件显示或隐藏元素的辅助函数
function showElementsIf(selector, condition) {
  Array.from(document.querySelectorAll(selector)).forEach(function(el) {
    if (condition) {
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "hidden");
    }
  });
}
