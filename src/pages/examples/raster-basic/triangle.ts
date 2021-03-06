import { Matrix4 } from '../../../libs/math/matrix4';
import { Vector3 } from '../../../libs/math/vector3';
import { Vector4 } from '../../../libs/math/vector4';
import { Vertex } from './vertex';

/**
 * 三角形
 */
export class Triangle {
  /**
   * 三个顶点
   */
  v: Vertex[];

  get v0() {
    return this.v[0];
  }
  get v1() {
    return this.v[1];
  }
  get v2() {
    return this.v[2];
  }

  // 法线
  get normal() {
    // v2->v0, v1->v0 两条边向量，叉乘为其法向量
    const e1 = Vector3.subtract(this.v2.pos, this.v0.pos);
    const e2 = Vector3.subtract(this.v1.pos, this.v0.pos);

    return Vector3.crossProduct(e1, e2);
  }

  constructor(v: Vertex[]) {
    this.v = v;
  }

  /**
   * 获取包围盒
   */
  getBoundingBox() {
    const minX = Math.floor(Math.min(this.v0.pos.x, this.v1.pos.x, this.v2.pos.x));
    const maxX = Math.ceil(Math.max(this.v0.pos.x, this.v1.pos.x, this.v2.pos.x));
    const minY = Math.floor(Math.min(this.v0.pos.y, this.v1.pos.y, this.v2.pos.y));
    const maxY = Math.ceil(Math.max(this.v0.pos.y, this.v1.pos.y, this.v2.pos.y));

    return {
      minX,
      maxX,
      minY,
      maxY
    };
  }

  /**
   * 判断点 p(x,y) 是否在三角形内
   * - 判断点 p 和三个点组成的向量 和对应的边向量的差乘结果是否是同方向
   *
   * @param x
   * @param y
   */
  isInside(x: number, y: number) {
    const a = new Vector3(this.v0.pos.x, this.v0.pos.y, 0);
    const b = new Vector3(this.v1.pos.x, this.v1.pos.y, 0);
    const c = new Vector3(this.v2.pos.x, this.v2.pos.y, 0);
    const p = new Vector3(x, y, 0);

    const ab = Vector3.subtract(b, a);
    const bc = Vector3.subtract(c, b);
    const ca = Vector3.subtract(a, c);

    const ap = Vector3.subtract(p, a);
    const bp = Vector3.subtract(p, b);
    const cp = Vector3.subtract(p, c);

    const v1 = ab.cross(ap).normalized();
    const v2 = bc.cross(bp).normalized();
    const v3 = ca.cross(cp).normalized();

    const v12 = v1.dot(v2);
    const v23 = v2.dot(v3);
    const v31 = v3.dot(v1);

    if (v12 == v23 && v23 == v31 && v1.z > 0) {
      return true;
    }

    return false;
  }

  /**
   * mvp变换
   */
  transformMVP(mvp: Matrix4) {
    // 普通的点转换为齐次坐标的点
    const v0 = Vector4.fromVec3(this.v0.pos);
    const v1 = Vector4.fromVec3(this.v1.pos);
    const v2 = Vector4.fromVec3(this.v2.pos);

    // mvp变换
    let v00 = mvp.multiplyByVector4(v0);
    let v11 = mvp.multiplyByVector4(v1);
    let v22 = mvp.multiplyByVector4(v2);

    // 齐次坐标归一
    v00 = v00.divide(v00.w);
    v11 = v11.divide(v11.w);
    v22 = v22.divide(v22.w);

    console.log(v00, v11, v22);

    this.v0.pos = v00.toVec3();
    this.v1.pos = v11.toVec3();
    this.v2.pos = v22.toVec3();
  }

  /**
   * 视口变换
   */
  transfromViewport(vw: number, vh: number, f1: number, f2: number) {
    for (let i = 0; i < this.v.length; i += 1) {
      const vertex = this.v[i];
      const v = vertex.pos;

      const x = 0.5 * vw * (v.x + 1);
      const y = 0.5 * vh * (v.y + 1);
      const z = v.z * f1 + f2;

      vertex.pos = new Vector3(x, y, z);
    }
  }

  /**
   *
   * @param frame_buffer
   * @param z_buffer
   * @param vw
   * @param vh
   * @param is_open_anti_alias
   * @param anti_alias_n
   */
  render(frame_buffer: number[][], z_buffer: number[][], vw: number, vh: number, is_open_anti_alias?: boolean, anti_alias_n?: number) {
    const { minX, maxX, minY, maxY } = this.getBoundingBox();

    for (let i = minX; i < maxX; i++) {
      for (let j = minY; j < maxY; j++) {
        // 开启抗锯齿 - MSAA
        if (is_open_anti_alias && anti_alias_n) {
          this.do_render_pixel_with_msaa(this, anti_alias_n, vw, vh, i, j, frame_buffer, z_buffer);
        }
        // 没有抗锯齿
        else {
          this.do_render_pixel(this, vw, vh, i, j, frame_buffer, z_buffer);
        }
      }
    }
  }

  /**
   *
   * @param triangle
   * @param antiAliasN
   * @param vw
   * @param vh
   * @param i
   * @param j
   * @returns
   */
  private do_render_pixel_with_msaa = (
    triangle: Triangle,
    antiAliasN: number,
    vw: number,
    vh: number,
    i: number,
    j: number,
    frame_buffer: number[][],
    z_buffer: number[][]
  ) => {
    const ysqrt = antiAliasN * antiAliasN;

    const gap = 1 / (antiAliasN * 2);
    const ind = i + (vh - j) * vw;

    let count = 0;
    for (let x = 1; x <= ysqrt; x++) {
      const row = Math.ceil(x / antiAliasN);
      const col = x % antiAliasN;

      const xx = i + (col * 2 - 1) * gap;
      const yy = j + (row * 2 - 1) * gap;

      const is_inside_triangle = triangle.isInside(xx, yy);
      if (is_inside_triangle === true) {
        const [alpha, beta, gamma] = this.compute_barycentric_2D(xx, yy);

        const w = 1 / (alpha + beta + gamma);
        let z_interpolated = alpha * triangle.v0.pos.z + beta * triangle.v1.pos.z + gamma * triangle.v2.pos.z;

        z_interpolated *= w;
        const z_depth = z_interpolated;

        if (!z_buffer[ind]) z_buffer[ind] = [];

        const old_z_depth = z_buffer[ind][x - 1];

        if (old_z_depth === undefined || old_z_depth < z_depth) {
          z_buffer[ind][x - 1] = z_depth;
          count += 1;
        }
      }
    }

    let frame_color = Vector3.fromArray(frame_buffer[ind] || [255, 255, 255]).multiply((ysqrt - count) / ysqrt);
    let current_color = triangle.v0.color.multiply(count / ysqrt);

    frame_buffer[ind] = frame_color.add(current_color).toArray();
  };

  /**
   *
   * @param triangle
   * @param vw
   * @param vh
   * @param i
   * @param j
   * @param frame_buffer
   * @param z_buffer
   */
  private do_render_pixel = (
    triangle: Triangle,
    vw: number,
    vh: number,
    i: number,
    j: number,
    frame_buffer: number[][],
    z_buffer: number[][]
  ) => {
    if (triangle.isInside(i, j)) {
      const [alpha, beta, gamma] = this.compute_barycentric_2D(i, j);

      const x = i;
      const y = vh - j;

      const w = 1 / (alpha + beta + gamma);
      let z_interpolated = alpha * triangle.v0.pos.z + beta * triangle.v1.pos.z + gamma * triangle.v2.pos.z;
      z_interpolated *= w;

      const ind = x + y * vw;

      const old_z_depth = z_buffer[ind]?.[0];

      if (old_z_depth === undefined || old_z_depth < z_interpolated) {
        frame_buffer[ind] = triangle.v0.color.toArray();
        z_buffer[ind] = [z_interpolated];
      }
    }
  };

  /**
   * 计算重心坐标的三个参数
   *
   * @param x
   * @param y
   * @returns
   */
  private compute_barycentric_2D = (x: number, y: number) => {
    const v = this.v;

    const c1 =
      (x * (v[1].pos.y - v[2].pos.y) + (v[2].pos.x - v[1].pos.x) * y + v[1].pos.x * v[2].pos.y - v[2].pos.x * v[1].pos.y) /
      (v[0].pos.x * (v[1].pos.y - v[2].pos.y) + (v[2].pos.x - v[1].pos.x) * v[0].pos.y + v[1].pos.x * v[2].pos.y - v[2].pos.x * v[1].pos.y);
    const c2 =
      (x * (v[2].pos.y - v[0].pos.y) + (v[0].pos.x - v[2].pos.x) * y + v[2].pos.x * v[0].pos.y - v[0].pos.x * v[2].pos.y) /
      (v[1].pos.x * (v[2].pos.y - v[0].pos.y) + (v[0].pos.x - v[2].pos.x) * v[1].pos.y + v[2].pos.x * v[0].pos.y - v[0].pos.x * v[2].pos.y);
    const c3 =
      (x * (v[0].pos.y - v[1].pos.y) + (v[1].pos.x - v[0].pos.x) * y + v[0].pos.x * v[1].pos.y - v[1].pos.x * v[0].pos.y) /
      (v[2].pos.x * (v[0].pos.y - v[1].pos.y) + (v[1].pos.x - v[0].pos.x) * v[2].pos.y + v[0].pos.x * v[1].pos.y - v[1].pos.x * v[0].pos.y);

    return [c1, c2, c3];
  };
}
