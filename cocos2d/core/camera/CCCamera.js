/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

const affineTrans = require('../value-types/CCAffineTransform');
const renderEngine = require('../renderer/render-engine');
const renderer = require('../renderer/index');

const mat4 = cc.vmath.mat4;
const vec2 = cc.vmath.vec2;
const vec3 = cc.vmath.vec3;

let _static_culling_mask = 1;

let _mat4_temp = mat4.create();
let _vec3_temp_1 = vec3.create();
let _vec3_temp_2 = vec3.create();

let _cameras = [];

/**
 * !#en
 * Camera is usefull when making reel game or other games which need scroll screen.
 * Using camera will be more efficient than moving node to scroll screen.
 * Camera 
 * !#zh
 * 摄像机在制作卷轴或是其他需要移动屏幕的游戏时比较有用，使用摄像机将会比移动节点来移动屏幕更加高效。
 * @class Camera
 * @extends Component
 */
let Camera = cc.Class({
    name: 'cc.Camera',
    extends: cc.Component,
    
    ctor () {
        let camera = new renderEngine.Camera();

        camera.setStages([
            'transparent'
        ]);

        camera.setClearFlags(0);

        this._fov = Math.PI * 60 / 180;
        camera.setFov(this._fov);
        camera.setNear(0.1);
        camera.setFar(1024);

        let view = new renderEngine.View();
        camera.view = view;
        camera.dirty = true;

        this.cullingMask = 1 << _static_culling_mask++;
        camera._cullingMask = view._cullingMask = this.cullingMask;

        this._camera = camera;
    },

    editor: CC_EDITOR && {
        menu: 'i18n:MAIN_MENU.component.others/Camera',
        executeInEditMode: false
    },

    properties: {
        _targets: {
            default: [],
            type: cc.Node,
            visible: true
        },

        /**
         * !#en
         * The camera zoom ratio.
         * !#zh
         * 摄像机缩放比率
         * @property {Number} zoomRatio
         */
        zoomRatio: 1,
    },

    statics: {
        /**
         * !#en
         * Current active camera, the scene should only have one active camera at the same time.
         * !#zh
         * 当前激活的摄像机，场景中在同一时间内只能有一个激活的摄像机。
         * @property {Camera} main
         * @static
         */
        main: null,

        cameras: _cameras
    },

    onLoad () {
        this._camera.setNode(this.node);
    },

    onEnable () {
        if (!Camera.main) {
            Camera.main = this;
        }

        let targets = this._targets;
        for (let i = 0, l = targets.length; i < l; i++) {
            targets[i]._viewID = this.cullingMask;
        }

        renderer.scene.addCamera(this._camera);
        _cameras.push(this);
    },

    onDisable () {
        if (Camera.main === this) {
            Camera.main = null;
        }
        
        let targets = this._targets;
        for (let i = 0, l = targets.length; i < l; i++) {
            targets[i]._viewID = 1;
        }

        renderer.scene.removeCamera(this._camera);
        cc.js.array.remove(_cameras, this);
    },

    /**
     * !#en
     * Add the specified target to camera.
     * !#zh
     * 将指定的节点添加到摄像机中。
     * @method addTarget
     * @param {Node} target 
     */
    addTarget (target) {
        if (this._targets.indexOf(target) !== -1) {
            return;
        }

        target._viewID = this.viewID;
        this._targets.push(target);
    },

    /**
     * !#en
     * Remove the specified target from camera.
     * !#zh
     * 将指定的节点从摄像机中移除。
     * @method removeTarget
     * @param {Node} target 
     */
    removeTarget (target) {
        if (this._targets.indexOf(target) === -1) {
            return;
        }

        target._viewID = -1;
        cc.js.array.remove(this._targets, target);
    },

    /**
     * !#en
     * Get all camera targets.
     * !#zh
     * 获取所有摄像机目标节点。
     * @method getTargets
     * @return {[Node]}
     */
    getTargets () {
        return this._targets;
    },

    /**
     * !#en
     * Returns the matrix that transform the node's (local) space coordinates into the camera's space coordinates.
     * !#zh
     * 返回一个将节点坐标系转换到摄像机坐标系下的矩阵
     * @method getNodeToCameraTransform
     * @param {Node} node - the node which should transform
     * @return {AffineTransform}
     */
    getNodeToCameraTransform (node) {
        let out = affineTrans.makeIdentity();
        node.getWorldMatrix(_mat4_temp);
        if (this.containsNode(node)) {
            mat4.mul(_mat4_temp, _mat4_temp, this._matView);
        }
        affineTrans.fromMatrix(_mat4_temp, out);
        return out;
    },

    /**
     * !#en
     * Conver a camera coordinates point to world coordinates.
     * !#zh
     * 将一个摄像机坐标系下的点转换到世界坐标系下。
     * @method getCameraToWorldPoint
     * @param {Vec2} point - the point which should transform
     * @param {Vec2} out - the point to receive the result
     * @return {Vec2}
     */
    getCameraToWorldPoint (point, out) {
        out = out || cc.v2();
        _vec3_temp_2.x = point.x;
        _vec3_temp_2.y = point.y;
        _vec3_temp_2.z = 0;
        this._camera.screenToWorld(_vec3_temp_1, _vec3_temp_2, renderer.canvas.width, renderer.canvas.height);
        out.x = _vec3_temp_1.x;
        out.y = _vec3_temp_1.y;
        return out;
    },

    /**
     * !#en
     * Conver a world coordinates point to camera coordinates.
     * !#zh
     * 将一个世界坐标系下的点转换到摄像机坐标系下。
     * @param {Vec2} point 
     * @param {Vec2} out - the point to receive the result
     * @return {Vec2}
     */
    getWorldToCameraPoint (point, out) {
        out = out || cc.v2();
        vec2.transformMat4(out, point, this._matView);
        return out;
    },

    /**
     * !#en
     * Get the camera to world matrix
     * !#zh
     * 获取摄像机坐标系到世界坐标系的矩阵
     * @param {Mat4} out - the matrix to receive the result
     * @return {Mat4}
     */
    getCameraToWorldMatrix (out) {
        let mat = this._matView;
        mat = mat4.invert(_mat4_temp, mat);
        mat4.copy(out, _mat4_temp);
        return out;
    },

    /**
     * !#en
     * Get the world to camera matrix
     * !#zh
     * 获取世界坐标系到摄像机坐标系的矩阵
     * @param {Mat4} out - the matrix to receive the result
     * @return {Mat4}
     */
    getWorldToCameraMatrix (out) {
        let mat = this._matView;
        mat4.copy(out, mat);
        return out;
    },

    /**
     * !#en
     * Check whether the node is in the camera.
     * !#zh
     * 检测节点是否被此摄像机影响
     * @method containsNode
     * @param {Node} node - the node which need to check
     * @return {Boolean}
     */
    containsNode (node) {
        return node._viewMask === this.viewID;
    },

    lateUpdate: !CC_EDITOR && function () {
        let m = this._matView;
        let visibleRect = cc.visibleRect;
        let node = this.node;

        this._camera.setFov(this._fov / this.zoomRatio);

        node.z = renderer.canvas.height / cc.view.getScaleY() / 1.1566;
        node.getWorldMatrix(_mat4_temp);

        _vec3_temp_1.x = _mat4_temp.m12;
        _vec3_temp_1.y = _mat4_temp.m13;
        _vec3_temp_1.z = 0;
        node.lookAt(_vec3_temp_1);

        this._camera.dirty = true;
    }
});

module.exports = cc.Camera = Camera;
